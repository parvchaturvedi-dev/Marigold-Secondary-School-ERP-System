import express from 'express';
import { getPostgresPool } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import {
  decryptWhatsAppConfig,
  encryptWhatsAppConfig,
} from '../utils/whatsappConfig.js';

const router = express.Router();
const CONFIG_ID = 1;
const DEFAULT_API_VERSION = 'v23.0';

const getStoredConfig = async () => {
  const result = await getPostgresPool().query(
    `SELECT config_ciphertext, config_iv, config_auth_tag, updated_by, updated_at
     FROM public.whatsapp_integration_config
     WHERE id = $1`,
    [CONFIG_ID]
  );
  return result.rows[0] || null;
};

const getPublicConfig = (record) => {
  if (!record) {
    return {
      configured: false,
      phoneNumberId: '',
      businessAccountId: '',
      apiVersion: DEFAULT_API_VERSION,
      updatedAt: null,
    };
  }

  const config = decryptWhatsAppConfig(record);
  return {
    configured: true,
    phoneNumberId: config.phoneNumberId,
    businessAccountId: config.businessAccountId,
    apiVersion: config.apiVersion,
    updatedAt: record.updated_at,
  };
};

const validateConfig = ({ phoneNumberId, businessAccountId, apiVersion, accessToken }) => {
  if (!/^\d{5,30}$/.test(phoneNumberId)) {
    return 'Enter a valid WhatsApp Phone Number ID.';
  }
  if (businessAccountId && !/^\d{5,30}$/.test(businessAccountId)) {
    return 'WhatsApp Business Account ID must contain only digits.';
  }
  if (!/^v\d{1,3}\.\d{1,2}$/.test(apiVersion)) {
    return 'Enter a valid Meta Graph API version, such as v23.0.';
  }
  if (typeof accessToken !== 'string' || accessToken.length < 20 || accessToken.length > 8192) {
    return 'Enter a valid WhatsApp access token.';
  }
  return '';
};

router.use(requireRole('admin'));

router.get('/config', async (_request, response) => {
  try {
    const record = await getStoredConfig();
    response.json(getPublicConfig(record));
  } catch (error) {
    console.error('[whatsapp-integration] Unable to read configuration', {
      name: error.name,
      code: error.code,
    });
    response.status(500).json({ message: 'WhatsApp configuration could not be loaded.' });
  }
});

router.put('/config', async (request, response) => {
  try {
    const phoneNumberId = String(request.body?.phoneNumberId || '').trim();
    const businessAccountId = String(request.body?.businessAccountId || '').trim();
    const apiVersion = String(request.body?.apiVersion || DEFAULT_API_VERSION).trim();
    const submittedToken = request.body?.accessToken;
    const existing = await getStoredConfig();
    const previousConfig = existing ? decryptWhatsAppConfig(existing) : null;
    const accessToken =
      typeof submittedToken === 'string' && submittedToken.length > 0
        ? submittedToken
        : previousConfig?.accessToken;

    const validationError = validateConfig({
      phoneNumberId,
      businessAccountId,
      apiVersion,
      accessToken,
    });
    if (validationError) {
      response.status(400).json({ message: validationError });
      return;
    }

    const { ciphertext, iv, authTag } = encryptWhatsAppConfig({
      phoneNumberId,
      businessAccountId,
      apiVersion,
      accessToken,
    });
    await getPostgresPool().query(
      `INSERT INTO public.whatsapp_integration_config
        (id, config_ciphertext, config_iv, config_auth_tag, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (id) DO UPDATE SET
         config_ciphertext = EXCLUDED.config_ciphertext,
         config_iv = EXCLUDED.config_iv,
         config_auth_tag = EXCLUDED.config_auth_tag,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()`,
      [CONFIG_ID, ciphertext, iv, authTag, request.auth.username]
    );

    response.json({
      configured: true,
      phoneNumberId,
      businessAccountId,
      apiVersion,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error.message === 'WHATSAPP_CONFIG_ENCRYPTION_KEY must be a 64-character hexadecimal key.') {
      response.status(503).json({
        message: 'Server-side WhatsApp encryption is not configured. Contact the system administrator.',
      });
      return;
    }
    console.error('[whatsapp-integration] Unable to save configuration', {
      name: error.name,
      code: error.code,
    });
    response.status(500).json({ message: 'WhatsApp configuration could not be saved.' });
  }
});

router.post('/test', async (_request, response) => {
  try {
    const record = await getStoredConfig();
    if (!record) {
      response.status(400).json({ message: 'Save WhatsApp API settings before testing the connection.' });
      return;
    }

    const config = decryptWhatsAppConfig(record);
    const apiUrl = new URL(
      `/${config.apiVersion}/${encodeURIComponent(config.phoneNumberId)}`,
      'https://graph.facebook.com'
    );
    apiUrl.searchParams.set('fields', 'id,display_phone_number,verified_name');

    let apiResponse;
    try {
      apiResponse = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      const timedOut = error.name === 'TimeoutError';
      response.status(502).json({
        message: timedOut
          ? 'Meta connection timed out. Please try again.'
          : 'Could not reach the Meta Graph API. Check the server network connection.',
      });
      return;
    }

    if (!apiResponse.ok) {
      response.status(502).json({
        message: `Meta rejected the connection (HTTP ${apiResponse.status}). Check the access token, API version, and Phone Number ID.`,
      });
      return;
    }

    const profile = await apiResponse.json();
    response.json({
      connected: true,
      phoneNumberId: profile.id,
      displayPhoneNumber: profile.display_phone_number || '',
      verifiedName: profile.verified_name || '',
    });
  } catch (error) {
    if (error.message === 'WHATSAPP_CONFIG_ENCRYPTION_KEY must be a 64-character hexadecimal key.') {
      response.status(503).json({
        message: 'Server-side WhatsApp encryption is not configured. Contact the system administrator.',
      });
      return;
    }
    console.error('[whatsapp-integration] Connection test failed', {
      name: error.name,
      code: error.code,
    });
    response.status(500).json({ message: 'WhatsApp connection test could not be completed.' });
  }
});

export default router;
