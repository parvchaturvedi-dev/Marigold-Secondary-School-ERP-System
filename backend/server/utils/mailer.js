const DEFAULT_FROM_NAME = 'MGPS ERP Portal';
const DEFAULT_MAX_CONNECTIONS = 3;
const BREVO_API_BASE_URL = 'https://api.brevo.com/v3';
const BREVO_API_TIMEOUT_MS = 20_000;

const firstEnv = (...keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== '') return value;
  }
  return '';
};

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isEmailAddress = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeRecipients = (recipients) => {
  if (Array.isArray(recipients)) {
    return recipients
      .map((recipient) => String(recipient || '').trim())
      .filter(Boolean)
      .map((recipient) => recipient.replace(/\s+/g, ''));
  }

  if (typeof recipients === 'string') {
    return recipients
      .split(',')
      .map((recipient) => String(recipient || '').trim())
      .filter(Boolean)
      .map((recipient) => recipient.replace(/\s+/g, ''));
  }

  return [];
};

export const logSmtpError = (error, context = {}) => {
  const details = {
    ...context,
    name: error?.name,
    code: error?.code,
    status: error?.status,
    statusText: error?.statusText,
    message: error?.message || 'Unknown Brevo API error.',
  };

  console.error('[brevo-api] Mail error', details);
};

const isAuthError = (error) =>
  /unauthorized|invalid api key|api key|forbidden|authorization/i.test(error?.message || '') ||
  [401, 403].includes(error?.status);

const isNetworkError = (error) =>
  /failed to fetch|network|timeout|etimedout|econnrefused|econnreset|enotfound|eai_again/i.test(
    error?.message || ''
  ) ||
  [408, 429, 500, 502, 503, 504].includes(error?.status);

const parseResponseError = async (response) => {
  const rawBody = await response.text().catch(() => '');

  if (!rawBody) {
    return response.statusText || `Brevo API request failed with status ${response.status}.`;
  }

  try {
    const parsed = JSON.parse(rawBody);
    return parsed?.message || parsed?.error?.message || parsed?.detail || rawBody;
  } catch {
    return rawBody;
  }
};

const sendBrevoRequest = async (mailConfig, payload) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BREVO_API_TIMEOUT_MS);

  try {
    const response = await fetch(`${BREVO_API_BASE_URL}/smtp/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': mailConfig.apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = await parseResponseError(response);
      const error = new Error(message);
      error.status = response.status;
      error.statusText = response.statusText;
      throw error;
    }

    const data = await response.json().catch(() => ({}));
    return {
      messageId: data.messageId || data.id || data.messageIds?.[0] || '',
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Brevo API request timed out.');
      timeoutError.status = 504;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const createBrevoPayload = ({ senderEmail, senderName, to, subject, text, html }) => {
  const recipients = normalizeRecipients(to);

  if (recipients.length === 0) {
    throw new Error('At least one recipient is required.');
  }

  return {
    sender: {
      email: senderEmail,
      name: senderName,
    },
    to: recipients.map((email) => ({ email })),
    subject,
    ...(text ? { textContent: text } : {}),
    ...(html ? { htmlContent: html } : {}),
  };
};

export const getMailConfig = () => {
  const apiKey = String(firstEnv('BREVO_API_KEY')).trim();
  const senderEmail = String(firstEnv('BREVO_SENDER_EMAIL', 'BREVO_FROM_EMAIL')).trim();
  const senderName = String(firstEnv('BREVO_SENDER_NAME', 'BREVO_FROM_NAME', 'EMAIL_FROM_NAME') || DEFAULT_FROM_NAME).trim();

  return {
    apiKey,
    senderEmail,
    senderName,
    maxConnections: parsePositiveInteger(firstEnv('BREVO_MAX_CONNECTIONS'), DEFAULT_MAX_CONNECTIONS),
    isReady: Boolean(apiKey && senderEmail),
  };
};

export const getSenderAddress = (mailConfig = getMailConfig()) =>
  `"${mailConfig.senderName.replace(/"/g, '\\"')}" <${mailConfig.senderEmail}>`;

export const createMailTransporter = async (mailConfig = getMailConfig()) => {
  if (!mailConfig.isReady) {
    throw new Error('Email is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL in backend/.env.');
  }

  if (!isEmailAddress(mailConfig.senderEmail)) {
    throw new Error('Sender email must be a valid email address.');
  }

  return {
    sendMail: async (message) => {
      const payload = createBrevoPayload({
        senderEmail: mailConfig.senderEmail,
        senderName: mailConfig.senderName,
        to: message.to,
        subject: String(message.subject || '').trim(),
        text: message.text ? String(message.text) : undefined,
        html: message.html ? String(message.html) : undefined,
      });

      const response = await sendBrevoRequest(mailConfig, payload);
      return {
        messageId: response.messageId,
      };
    },
    close: () => {},
  };
};

export const closeMailTransporter = (_transporter) => {};

export const buildMailErrorPayload = (error) => {
  logSmtpError(error, { phase: 'dispatch' });

  const detail = error?.message || 'Unknown Brevo API error.';

  if (/not configured/i.test(detail)) {
    return {
      status: 503,
      body: {
        message: 'Email is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL in backend/.env.',
        detail,
      },
    };
  }

  const isAuthFailure = isAuthError(error);
  const isNetworkFailure = isNetworkError(error);

  return {
    status: 502,
    body: {
      message: isAuthFailure
        ? 'Email authentication failed. Please check your Brevo API key.'
        : isNetworkFailure
          ? 'Email API request failed. Check your Brevo API key, network connectivity, and API usage limits.'
          : 'Email dispatch failed.',
      detail,
    },
  };
};
