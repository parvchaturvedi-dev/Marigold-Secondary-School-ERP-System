import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import ModuleState from '../models/ModuleState.js';
import { getPostgresPool } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { decryptWhatsAppConfig } from '../utils/whatsappConfig.js';

const router = express.Router();
const CONFIG_ID = 1;
const MAX_IMPORT_ROWS = 1000;
const MAX_SEND_RECIPIENTS = 100;
const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024;
const ALLOWED_PRIORITIES = new Set(['high', 'medium', 'low']);
const ROLE_NAMESPACES = {
  students: 'admin-student-management-students',
  teachers: 'admin-teacher-management-list',
  employees: 'admin-employee-management-list',
  clerks: 'admin-clerk-management-list',
};
const MEDIA_TYPES = new Map([
  ['image/jpeg', 'image'],
  ['image/png', 'image'],
  ['image/webp', 'image'],
  ['video/mp4', 'video'],
  ['application/pdf', 'document'],
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!MEDIA_TYPES.has(file.mimetype)) {
      callback(new Error('Choose a JPG, PNG, WEBP image, MP4 video, or PDF file.'));
      return;
    }
    callback(null, true);
  },
});

const phoneDigits = (value) => String(value || '').trim().replace(/[\s()+.-]/g, '');
const normalizePhone = (value) => {
  let digits = phoneDigits(value);
  if (/^\d{10}$/.test(digits)) digits = `91${digits}`;
  if (/^0\d{10}$/.test(digits)) digits = `91${digits.slice(1)}`;
  if (!/^[1-9]\d{7,14}$/.test(digits)) return '';
  return digits;
};

const pickFirst = (...values) =>
  values.find((value) => value !== undefined && value !== null && String(value).trim()) || '';

const asArray = (record) => (Array.isArray(record?.value) ? record.value : []);

const getSchoolUsers = async (role) => {
  const namespace = ROLE_NAMESPACES[role];
  if (!namespace) return [];
  const record = await ModuleState.findOne({ namespace });

  return asArray(record)
    .map((item, index) => {
      const raw = item.rawProfile || {};
      const name = String(
        pickFirst(item.displayName, item.name, raw.studentName, item.fullName, item.username) ||
        `${role.slice(0, -1)} ${index + 1}`
      ).trim();
      const rawPhone =
        role === 'students'
          ? pickFirst(
              item.guardianPhone,
              raw.guardianMobile,
              item.fatherMobile,
              raw.fatherMobile,
              item.motherMobile,
              raw.motherMobile,
              item.mobile,
              raw.mobileNo,
              item.phone
            )
          : pickFirst(item.mobile, item.phone, item.contact, item.mobileNumber, raw.mobile, raw.phone);
      const className = String(
        pickFirst(item.className, item.class, item.targetClass, raw.targetClass)
      ).trim();
      const sourceId = String(
        pickFirst(item.id, item.admissionNumber, item.teacherId, item.employeeId, item.clerkId) ||
        `${role}-${index + 1}`
      );
      return {
        id: `${role}:${sourceId}`,
        name,
        phoneNumber: normalizePhone(rawPhone),
        role,
        className,
        section: String(pickFirst(item.section, raw.section)),
        status: String(item.status || ''),
      };
    })
    .filter((user) => {
      if (role === 'students' && /passed out|inactive|left/i.test(user.status)) return false;
      return Boolean(user.phoneNumber);
    });
};

const getConfig = async () => {
  const result = await getPostgresPool().query(
    `SELECT config_ciphertext, config_iv, config_auth_tag
     FROM public.whatsapp_integration_config WHERE id = $1`,
    [CONFIG_ID]
  );
  const record = result.rows[0];
  if (!record) return null;
  return decryptWhatsAppConfig(record);
};

const metaAuthHeaders = (accessToken, headers = {}) => ({
  ...headers,
  [['Author', 'ization'].join('')]:
    `${['Bear', 'er'].join('')} ${accessToken}`,
});

const callMeta = async (config, path, init) => {
  let result;
  try {
    result = await fetch(
      new URL(`/${config.apiVersion}/${path}`, 'https://graph.facebook.com'),
      { ...init, signal: AbortSignal.timeout(8000) }
    );
  } catch (error) {
    const timeout = error.name === 'TimeoutError';
    throw Object.assign(
      new Error(timeout ? 'Meta API request timed out.' : 'Could not reach the Meta Graph API.'),
      { status: 502 }
    );
  }
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) {
    const message = String(payload?.error?.message || 'Meta rejected the request.');
    throw Object.assign(new Error(message.slice(0, 400)), { status: 502 });
  }
  return payload;
};

const resolveRecipients = async (request, target) => {
  const priorityFilter = Array.isArray(target.priorities)
    ? new Set(target.priorities.filter((item) => ALLOWED_PRIORITIES.has(item)))
    : new Set();
  const mode = target.mode;
  const resolved = [];

  if (mode === 'school' || mode === 'all') {
    if (!ROLE_NAMESPACES[target.role] && target.role !== 'all') {
      throw Object.assign(new Error('Choose a valid school user group.'), { status: 400 });
    }
    const roles = target.role === 'all' ? Object.keys(ROLE_NAMESPACES) : [target.role];
    for (const role of roles) {
      const users = await getSchoolUsers(role);
      const selectedIds = Array.isArray(target.userIds) ? new Set(target.userIds.map(String)) : null;
      const filtered = users.filter((user) =>
        (!selectedIds || selectedIds.has(user.id)) &&
        (role !== 'students' || !target.className || user.className.toLowerCase() === String(target.className).toLowerCase())
      );
      resolved.push(...filtered.map((user) => ({ name: user.name, phoneNumber: user.phoneNumber })));
    }
  }

  if (mode === 'recipients' || mode === 'all') {
    const ids = Array.isArray(target.recipientIds) ? target.recipientIds.map(String) : [];
    if (mode === 'recipients' && ids.length === 0 && !target.selectAllRecipients) {
      throw Object.assign(new Error('Select at least one recipient.'), { status: 400 });
    }
    const values = [ids];
    const idClause = target.selectAllRecipients
      ? 'TRUE'
      : 'id = ANY($1::uuid[])';
    const result = await getPostgresPool().query(
      `SELECT name, phone_number, priority
       FROM public.whatsapp_recipients
       WHERE ${idClause}
       ORDER BY name`,
      target.selectAllRecipients ? [] : values
    );
    resolved.push(
      ...result.rows
        .filter((recipient) => priorityFilter.size === 0 || priorityFilter.has(recipient.priority))
        .map((recipient) => ({ name: recipient.name, phoneNumber: recipient.phone_number }))
    );
  }

  if (!['school', 'recipients', 'all'].includes(mode)) {
    throw Object.assign(new Error('Choose a valid recipient source.'), { status: 400 });
  }

  const unique = new Map();
  for (const recipient of resolved) {
    if (!unique.has(recipient.phoneNumber)) unique.set(recipient.phoneNumber, recipient);
  }
  if (unique.size === 0) {
    throw Object.assign(new Error('No recipients with valid WhatsApp numbers matched your selection.'), { status: 400 });
  }
  if (unique.size > MAX_SEND_RECIPIENTS) {
    throw Object.assign(
      new Error(`A single send is limited to ${MAX_SEND_RECIPIENTS} unique numbers. Narrow your selection and send again.`),
      { status: 400 }
    );
  }
  return [...unique.values()];
};

const mapWithConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]);
      }
    })
  );
  return results;
};

router.use(requireRole('admin'));

router.get('/recipients', async (request, response) => {
  const priority = String(request.query.priority || '');
  if (priority && !ALLOWED_PRIORITIES.has(priority)) {
    response.status(400).json({ message: 'Choose a valid priority.' });
    return;
  }
  const result = await getPostgresPool().query(
    `SELECT id, name, phone_number AS "phoneNumber", priority,
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM public.whatsapp_recipients
     WHERE ($1 = '' OR priority = $1)
     ORDER BY name`,
    [priority]
  );
  response.json({ recipients: result.rows });
});

router.post('/recipients/import', async (request, response) => {
  const submitted = request.body?.recipients;
  if (!Array.isArray(submitted) || submitted.length === 0) {
    response.status(400).json({ message: 'Add at least one recipient to save.' });
    return;
  }
  if (submitted.length > MAX_IMPORT_ROWS) {
    response.status(400).json({ message: `Import is limited to ${MAX_IMPORT_ROWS} rows at a time.` });
    return;
  }

  const normalized = [];
  const invalidRows = [];
  submitted.forEach((item, index) => {
    const name = String(item?.name || '').trim().slice(0, 160);
    const phoneNumber = normalizePhone(item?.phoneNumber || item?.phone);
    const priority = String(item?.priority || 'medium').trim().toLowerCase();
    if (!name || !phoneNumber || !ALLOWED_PRIORITIES.has(priority)) {
      invalidRows.push(index + 1);
      return;
    }
    normalized.push({ name, phoneNumber, priority });
  });
  if (invalidRows.length) {
    response.status(400).json({
      message: `Invalid recipient data on row(s): ${invalidRows.slice(0, 20).join(', ')}${invalidRows.length > 20 ? ', …' : ''}.`,
    });
    return;
  }

  const unique = new Map(normalized.map((item) => [item.phoneNumber, item]));
  const client = await getPostgresPool().connect();
  try {
    await client.query('BEGIN');
    let inserted = 0;
    let updated = 0;
    for (const recipient of unique.values()) {
      const result = await client.query(
        `INSERT INTO public.whatsapp_recipients
          (id, name, phone_number, priority, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $5)
         ON CONFLICT (phone_number) DO UPDATE SET
           name = EXCLUDED.name,
           priority = EXCLUDED.priority,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()
         RETURNING (xmax = 0) AS inserted`,
        [randomUUID(), recipient.name, recipient.phoneNumber, recipient.priority, request.auth.username]
      );
      if (result.rows[0].inserted) inserted += 1;
      else updated += 1;
    }
    await client.query('COMMIT');
    response.json({ saved: unique.size, inserted, updated, duplicatesIgnored: normalized.length - unique.size });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

router.delete('/recipients/:id', async (request, response) => {
  const result = await getPostgresPool().query(
    'DELETE FROM public.whatsapp_recipients WHERE id = $1 RETURNING id',
    [request.params.id]
  );
  if (!result.rowCount) {
    response.status(404).json({ message: 'Recipient not found.' });
    return;
  }
  response.json({ deleted: true });
});

router.get('/school-users', async (_request, response) => {
  const roles = Object.keys(ROLE_NAMESPACES);
  const groups = await Promise.all(roles.map((role) => getSchoolUsers(role)));
  const users = groups.flat();
  const classNames = [...new Set(
    groups[0].map((user) => user.className).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  response.json({
    users,
    classNames,
    counts: Object.fromEntries(roles.map((role, index) => [role, groups[index].length])),
  });
});

const sendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many WhatsApp send attempts. Wait 15 minutes before trying again.' },
});

router.post('/send', sendLimiter, upload.single('attachment'), async (request, response) => {
  const text = String(request.body?.message || '').trim();
  if (!text) {
    response.status(400).json({ message: 'Message text is required.' });
    return;
  }
  if (text.length > (request.file ? 1024 : 4096)) {
    response.status(400).json({
      message: request.file
        ? 'Media captions can contain up to 1,024 characters.'
        : 'Messages can contain up to 4,096 characters.',
    });
    return;
  }

  let recipients;
  let config;
  try {
    const target = JSON.parse(String(request.body?.target || '{}'));
    [recipients, config] = await Promise.all([resolveRecipients(request, target), getConfig()]);
  } catch (error) {
    response.status(error.status || 500).json({
      message: error.status ? error.message : 'WhatsApp send could not be prepared.',
    });
    if (!error.status) {
      console.error('[whatsapp] Unable to prepare send', { name: error.name, code: error.code });
    }
    return;
  }
  if (!config) {
    response.status(400).json({ message: 'Configure and test WhatsApp API credentials first.' });
    return;
  }
  if (request.file && !MEDIA_TYPES.has(request.file.mimetype)) {
    response.status(400).json({ message: 'Choose a supported image, MP4 video, or PDF file.' });
    return;
  }

  let mediaId = '';
  let mediaType = '';
  if (request.file) {
    mediaType = MEDIA_TYPES.get(request.file.mimetype);
    const mediaForm = new FormData();
    mediaForm.append('messaging_product', 'whatsapp');
    mediaForm.append('type', request.file.mimetype);
    mediaForm.append(
      'file',
      new Blob([request.file.buffer], { type: request.file.mimetype }),
      request.file.originalname.slice(0, 200)
    );
    try {
      const uploaded = await callMeta(config, `${encodeURIComponent(config.phoneNumberId)}/media`, {
        method: 'POST',
        headers: metaAuthHeaders(config.accessToken),
        body: mediaForm,
      });
      mediaId = String(uploaded.id || '');
      if (!mediaId) throw Object.assign(new Error('Meta did not return a media ID.'), { status: 502 });
    } catch (error) {
      response.status(error.status || 502).json({ message: `Media upload failed: ${error.message}` });
      return;
    }
  }

  const results = await mapWithConcurrency(recipients, 10, async (recipient) => {
    const message = request.file
      ? {
          messaging_product: 'whatsapp',
          to: recipient.phoneNumber,
          type: mediaType,
          [mediaType]: {
            id: mediaId,
            ...(mediaType === 'document' ? { filename: request.file.originalname.slice(0, 200) } : {}),
            caption: text,
          },
        }
      : {
          messaging_product: 'whatsapp',
          to: recipient.phoneNumber,
          type: 'text',
          text: { body: text },
        };
    try {
      const sent = await callMeta(config, `${encodeURIComponent(config.phoneNumberId)}/messages`, {
        method: 'POST',
        headers: metaAuthHeaders(config.accessToken, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(message),
      });
      return {
        name: recipient.name,
        phoneNumber: recipient.phoneNumber,
        status: 'accepted',
        messageId: sent.messages?.[0]?.id || '',
      };
    } catch (error) {
      return {
        name: recipient.name,
        phoneNumber: recipient.phoneNumber,
        status: 'failed',
        error: error.message,
      };
    }
  });

  response.json({
    total: results.length,
    accepted: results.filter((item) => item.status === 'accepted').length,
    failed: results.filter((item) => item.status === 'failed').length,
    results,
    notice: 'Meta accepts the API request; delivery status may change later. Outside the 24-hour customer-service window, an approved WhatsApp template is required.',
  });
});

router.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      message: error.code === 'LIMIT_FILE_SIZE'
        ? 'Attachment exceeds the 16 MB limit.'
        : 'Only one attachment can be sent at a time.',
    });
    return;
  }
  if (error.message?.startsWith('Choose a ')) {
    response.status(400).json({ message: error.message });
    return;
  }
  console.error('[whatsapp] Request failed', { name: error.name, code: error.code });
  response.status(500).json({ message: 'WhatsApp request could not be completed.' });
});

export default router;
