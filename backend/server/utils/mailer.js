import dns from 'node:dns/promises';
import net from 'node:net';
import nodemailer from 'nodemailer';

const DEFAULT_SMTP_HOST = 'smtp.gmail.com';
const DEFAULT_SMTP_PORT = 587;
const DEFAULT_FROM_NAME = 'MGPS ERP Portal';
const DEFAULT_TIMEOUT_MS = {
  dns: 5000,
  connection: 20000,
  greeting: 10000,
  socket: 30000,
};
const DEFAULT_MAX_CONNECTIONS = 3;
const DEFAULT_MAX_MESSAGES = 100;
const IPV4_CACHE_TTL_MS = 5 * 60 * 1000;
const GMAIL_HOSTS = new Set(['smtp.gmail.com', 'gmail-smtp-msa.l.google.com']);

const ipv4Cache = new Map();

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

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  if (/^(1|true|yes|on)$/i.test(String(value))) return true;
  if (/^(0|false|no|off)$/i.test(String(value))) return false;
  return fallback;
};

const normalizePassword = (value = '') => String(value).replace(/\s+/g, '');

const isGmailHost = (host = '') => GMAIL_HOSTS.has(String(host).trim().toLowerCase());

const isEmailAddress = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());

export const logSmtpError = (error, context = {}) => {
  const details = {
    ...context,
    name: error?.name,
    code: error?.code,
    command: error?.command,
    responseCode: error?.responseCode,
    response: error?.response,
    message: error?.message || 'Unknown SMTP error.',
  };

  console.error('[smtp] Mail error', details);
};

const isAuthError = (error) =>
  /invalid login|username and password not accepted|application-specific password|app password|eauth|535/i.test(
    error?.message || ''
  );

const isNetworkError = (error) =>
  /enetunreach|econnrefused|econnreset|etimedout|edns|enotfound|eai_again|connection timeout|greeting never received|socket timeout/i.test(
    error?.message || ''
  );

const resolveIPv4Host = async (host, timeoutMs) => {
  if (net.isIP(host)) return host;

  const cached = ipv4Cache.get(host);
  if (cached?.expiresAt > Date.now()) return cached.address;

  let timeoutId;
  try {
    const addresses = await Promise.race([
      dns.resolve4(host),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          const error = new Error(`DNS timeout resolving IPv4 address for ${host}.`);
          error.code = 'EDNS';
          reject(error);
        }, timeoutMs);
      }),
    ]);

    const address = addresses.find(Boolean);
    if (!address) throw new Error(`No IPv4 SMTP address was found for ${host}.`);

    ipv4Cache.set(host, {
      address,
      expiresAt: Date.now() + IPV4_CACHE_TTL_MS,
    });

    return address;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const getMailConfig = () => {
  const user = String(firstEnv('GMAIL_USER', 'EMAIL_USER')).trim();
  const pass = normalizePassword(firstEnv('GMAIL_APP_PASSWORD', 'EMAIL_PASS'));
  const fromName = String(firstEnv('EMAIL_FROM_NAME', 'GMAIL_FROM_NAME') || DEFAULT_FROM_NAME).trim();
  const host = String(firstEnv('GMAIL_SMTP_HOST', 'EMAIL_SMTP_HOST', 'SMTP_HOST') || DEFAULT_SMTP_HOST).trim();
  const configuredPort = parsePositiveInteger(
    firstEnv('GMAIL_SMTP_PORT', 'EMAIL_SMTP_PORT', 'SMTP_PORT'),
    DEFAULT_SMTP_PORT
  );
  const port = isGmailHost(host) ? 587 : configuredPort;
  const configuredSecure = parseBoolean(
    firstEnv('GMAIL_SMTP_SECURE', 'EMAIL_SMTP_SECURE', 'SMTP_SECURE'),
    port === 465
  );
  const secure = isGmailHost(host) ? false : configuredSecure;

  return {
    user,
    pass,
    fromName,
    host,
    port,
    secure,
    forceIPv4: parseBoolean(firstEnv('GMAIL_FORCE_IPV4', 'EMAIL_FORCE_IPV4'), true),
    connectionTimeoutMs: parsePositiveInteger(
      firstEnv('GMAIL_CONNECTION_TIMEOUT_MS', 'EMAIL_CONNECTION_TIMEOUT_MS'),
      DEFAULT_TIMEOUT_MS.connection
    ),
    greetingTimeoutMs: parsePositiveInteger(
      firstEnv('GMAIL_GREETING_TIMEOUT_MS', 'EMAIL_GREETING_TIMEOUT_MS'),
      DEFAULT_TIMEOUT_MS.greeting
    ),
    socketTimeoutMs: parsePositiveInteger(
      firstEnv('GMAIL_SOCKET_TIMEOUT_MS', 'EMAIL_SOCKET_TIMEOUT_MS'),
      DEFAULT_TIMEOUT_MS.socket
    ),
    dnsTimeoutMs: parsePositiveInteger(
      firstEnv('GMAIL_DNS_TIMEOUT_MS', 'EMAIL_DNS_TIMEOUT_MS'),
      DEFAULT_TIMEOUT_MS.dns
    ),
    maxConnections: parsePositiveInteger(
      firstEnv('GMAIL_MAX_CONNECTIONS', 'EMAIL_MAX_CONNECTIONS'),
      DEFAULT_MAX_CONNECTIONS
    ),
    maxMessages: parsePositiveInteger(firstEnv('GMAIL_MAX_MESSAGES', 'EMAIL_MAX_MESSAGES'), DEFAULT_MAX_MESSAGES),
    isReady: Boolean(user && pass),
  };
};

export const getSenderAddress = (mailConfig = getMailConfig()) =>
  `"${mailConfig.fromName.replace(/"/g, '\\"')}" <${mailConfig.user}>`;

const uniqueAttempts = (attempts) => {
  const seen = new Set();
  return attempts.filter((attempt) => {
    const key = `${attempt.host}:${attempt.port}:${attempt.secure}:${attempt.forceIPv4}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getMailConnectionAttempts = (mailConfig) => {
  const attempts = [
    {
      ...mailConfig,
      secure: mailConfig.port === 465 ? true : mailConfig.secure,
    },
  ];

  if (mailConfig.forceIPv4) {
    attempts.push(
      ...attempts.map((attempt) => ({
        ...attempt,
        forceIPv4: false,
      }))
    );
  }

  return uniqueAttempts(attempts);
};

const createTransportForAttempt = async (attempt) => {
  const host = attempt.forceIPv4 ? await resolveIPv4Host(attempt.host, attempt.dnsTimeoutMs) : attempt.host;

  const transporter = nodemailer.createTransport({
    host,
    port: attempt.port,
    secure: attempt.secure,
    requireTLS: attempt.port === 587 || !attempt.secure,
    auth: {
      user: attempt.user,
      pass: attempt.pass,
    },
    pool: true,
    maxConnections: attempt.maxConnections,
    maxMessages: attempt.maxMessages,
    connectionTimeout: attempt.connectionTimeoutMs,
    greetingTimeout: attempt.greetingTimeoutMs,
    socketTimeout: attempt.socketTimeoutMs,
    dnsTimeout: attempt.dnsTimeoutMs,
    tls: {
      servername: attempt.host,
      minVersion: 'TLSv1.2',
    },
  });

  await transporter.verify();
  return transporter;
};

export const createMailTransporter = async (mailConfig = getMailConfig()) => {
  if (!mailConfig.isReady) {
    throw new Error('Email is not configured. Set Brevo SMTP credentials in .env.');
  }

  if (!isEmailAddress(mailConfig.user)) {
    throw new Error('SMTP username must be the full email address.');
  }

  const failures = [];
  for (const attempt of getMailConnectionAttempts(mailConfig)) {
    try {
      return await createTransportForAttempt(attempt);
    } catch (error) {
      logSmtpError(error, {
        phase: 'verify',
        host: attempt.host,
        port: attempt.port,
        secure: attempt.secure,
        starttls: attempt.port === 587 && !attempt.secure,
        forceIPv4: attempt.forceIPv4,
      });

      failures.push({
        host: attempt.host,
        port: attempt.port,
        secure: attempt.secure,
        forceIPv4: attempt.forceIPv4,
        message: error?.message || 'Unknown SMTP connection error.',
      });

      if (isAuthError(error)) break;
      if (!isNetworkError(error)) break;
    }
  }

  const details = failures
    .map(
      (failure) =>
        `${failure.host}:${failure.port} secure=${failure.secure} ipv4=${failure.forceIPv4} - ${failure.message}`
    )
    .join(' | ');
  throw new Error(`Email SMTP connection failed after ${failures.length} attempt(s). ${details}`);
};

export const closeMailTransporter = (transporter) => {
  if (typeof transporter?.close === 'function') {
    transporter.close();
  }
};

export const buildMailErrorPayload = (error) => {
  logSmtpError(error, { phase: 'dispatch' });

  const detail = error?.message || 'Unknown Gmail error.';

  if (/not configured/i.test(detail)) {
    return {
      status: 503,
      body: {
        message: 'Email is not configured. Set BREVO_SMTP_USER and BREVO_SMTP_KEY in backend/.env.',
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
        ? 'Email authentication failed. Please check your Brevo SMTP User and Key.'
        : isNetworkFailure
          ? 'Email SMTP connection failed. Check the server internet/firewall and SMTP port setting.'
          : 'Email dispatch failed.',
      detail,
    },
  };
};
