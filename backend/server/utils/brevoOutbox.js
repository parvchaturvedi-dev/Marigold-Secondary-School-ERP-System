import { createDecipheriv, createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import { getPostgresPool } from '../db.js';

const MAX_ATTEMPTS = 10;
const BASE_RETRY_DELAY_MS = 30_000;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;
const WORKER_INTERVAL_MS = 2_000;

const getEncryptionKey = () => {
  const value = String(process.env.BREVO_OUTBOX_ENCRYPTION_KEY || '').trim();
  if (!/^[a-f\d]{64}$/i.test(value)) {
    throw new Error('BREVO_OUTBOX_ENCRYPTION_KEY must be a 64-character hexadecimal key.');
  }
  return Buffer.from(value, 'hex');
};

const encryptPayload = (payload) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return { encrypted, iv, authTag: cipher.getAuthTag() };
};

const decryptPayload = ({ payload_ciphertext, payload_iv, payload_auth_tag }) => {
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), payload_iv);
  decipher.setAuthTag(payload_auth_tag);
  const plaintext = Buffer.concat([
    decipher.update(payload_ciphertext),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plaintext);
};

export const enqueueBrevoEmail = async (payload) => {
  const { encrypted, iv, authTag } = encryptPayload(payload);
  const id = randomUUID();
  await getPostgresPool().query(
    `INSERT INTO public.brevo_email_outbox
      (id, payload_ciphertext, payload_iv, payload_auth_tag)
     VALUES ($1, $2, $3, $4)`,
    [id, encrypted, iv, authTag]
  );
  return id;
};

const claimEmail = async (id) => {
  await getPostgresPool().query(
    `UPDATE public.brevo_email_outbox
     SET status = 'failed', locked_at = NULL, updated_at = now()
     WHERE status = 'sending'
       AND attempts >= $1
       AND locked_at < now() - interval '2 minutes'`,
    [MAX_ATTEMPTS]
  );
  const values = id ? [id] : [];
  const idFilter = id ? 'AND id = $1' : '';
  const result = await getPostgresPool().query(
    `WITH candidate AS (
       SELECT id
       FROM public.brevo_email_outbox
       WHERE attempts < $${values.length + 1}
         AND (
           (status = 'queued' AND available_at <= now())
           OR (status = 'sending' AND locked_at < now() - interval '2 minutes')
         )
         ${idFilter}
       ORDER BY created_at, id
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     UPDATE public.brevo_email_outbox AS outbox
     SET status = 'sending',
         attempts = outbox.attempts + 1,
         locked_at = now(),
         updated_at = now()
     FROM candidate
     WHERE outbox.id = candidate.id
     RETURNING outbox.id, outbox.payload_ciphertext, outbox.payload_iv,
               outbox.payload_auth_tag, outbox.attempts`,
    [...values, MAX_ATTEMPTS]
  );
  return result.rows[0] || null;
};

const recordDeliveryFailure = async (email, error) => {
  const retryDelayMs = Math.min(
    BASE_RETRY_DELAY_MS * 2 ** Math.max(0, email.attempts - 1),
    MAX_RETRY_DELAY_MS
  );
  const permanentlyFailed = email.attempts >= MAX_ATTEMPTS;
  await getPostgresPool().query(
    `UPDATE public.brevo_email_outbox
     SET status = $2,
         available_at = CASE WHEN $2 = 'queued'
           THEN now() + ($3 * interval '1 millisecond')
           ELSE available_at
         END,
         locked_at = NULL,
         last_error_status = $4,
         updated_at = now()
     WHERE id = $1`,
    [email.id, permanentlyFailed ? 'failed' : 'queued', retryDelayMs, Number(error?.status) || null]
  );
};

const recordDeliverySuccess = async (id, messageId) => {
  await getPostgresPool().query(
    `UPDATE public.brevo_email_outbox
     SET status = 'sent',
         payload_ciphertext = NULL,
         payload_iv = NULL,
         payload_auth_tag = NULL,
         message_id = NULLIF($2, ''),
         sent_at = now(),
         locked_at = NULL,
         last_error_status = NULL,
         updated_at = now()
     WHERE id = $1`,
    [id, messageId]
  );
};

export const dispatchBrevoEmail = async (deliver, id) => {
  const email = await claimEmail(id);
  if (!email) return null;

  try {
    const payload = decryptPayload(email);
    const result = await deliver(payload);
    await recordDeliverySuccess(email.id, result.messageId || '');
    return { ...result, queued: false, outboxId: email.id };
  } catch (error) {
    await recordDeliveryFailure(email, error);
    error.outboxQueued = email.attempts < MAX_ATTEMPTS;
    error.outboxFailed = email.attempts >= MAX_ATTEMPTS;
    error.outboxId = email.id;
    throw error;
  }
};

export const startBrevoOutboxWorker = (deliver) => {
  let stopped = false;
  let timeout;
  let working = false;

  const run = async () => {
    if (stopped || working) return;
    working = true;
    try {
      while (!stopped) {
        const email = await claimEmail();
        if (!email) break;
        try {
          const payload = decryptPayload(email);
          const result = await deliver(payload);
          await recordDeliverySuccess(email.id, result.messageId || '');
        } catch (error) {
          await recordDeliveryFailure(email, error);
          console.error('[brevo-outbox] Delivery attempt failed', {
            outboxId: email.id,
            attempt: email.attempts,
            status: Number(error?.status) || undefined,
            name: error?.name || 'Error',
          });
        }
      }
    } catch (error) {
      console.error('[brevo-outbox] Worker failed', {
        name: error.name,
        code: error.code,
      });
    } finally {
      working = false;
      if (!stopped) {
        timeout = setTimeout(run, WORKER_INTERVAL_MS);
        timeout.unref?.();
      }
    }
  };

  timeout = setTimeout(run, 0);
  timeout.unref?.();

  return () => {
    stopped = true;
    clearTimeout(timeout);
  };
};
