import dns from 'node:dns/promises';
import net from 'node:net';
import nodemailer from 'nodemailer';

const DEFAULT_SMTP_HOST = 'smtp.gmail.com';
const DEFAULT_SMTP_PORT = 587;
const DEFAULT_FROM_NAME = 'MGPS ERP Portal';
const DEFAULT_TIMEOUT_MS = {
  dns: 5000,
  connection: 10000,
  greeting: 10000,
  socket: 30000,
};
const DEFAULT_MAX_CONNECTIONS = 3;
const DEFAULT_MAX_MESSAGES = 100;
const IPV4_CACHE_TTL_MS = 5 * 60 * 1000;

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
  const user = String(firstEnv('EMAIL_USER', 'GMAIL_USER')).trim();
  const pass = normalizePassword(firstEnv('EMAIL_PASS', 'GMAIL_APP_PASSWORD'));
  const fromName = String(firstEnv('EMAIL_FROM_NAME', 'GMAIL_FROM_NAME') || DEFAULT_FROM_NAME).trim();
  const host = String(firstEnv('EMAIL_SMTP_HOST', 'GMAIL_SMTP_HOST') || DEFAULT_SMTP_HOST).trim();
  const port = parsePositiveInteger(firstEnv('EMAIL_SMTP_PORT', 'GMAIL_SMTP_PORT'), DEFAULT_SMTP_PORT);
  const secure = parseBoolean(firstEnv('EMAIL_SMTP_SECURE', 'GMAIL_SMTP_SECURE'), port === 465);

  return {
    user,
    pass,
    fromName,
    host,
    port,
    secure,
    forceIPv4: parseBoolean(firstEnv('EMAIL_FORCE_IPV4', 'GMAIL_FORCE_IPV4'), true),
    connectionTimeoutMs: parsePositiveInteger(
      firstEnv('EMAIL_CONNECTION_TIMEOUT_MS', 'GMAIL_CONNECTION_TIMEOUT_MS'),
      DEFAULT_TIMEOUT_MS.connection
    ),
    greetingTimeoutMs: parsePositiveInteger(
      firstEnv('EMAIL_GREETING_TIMEOUT_MS', 'GMAIL_GREETING_TIMEOUT_MS'),
      DEFAULT_TIMEOUT_MS.greeting
    ),
    socketTimeoutMs: parsePositiveInteger(
      firstEnv('EMAIL_SOCKET_TIMEOUT_MS', 'GMAIL_SOCKET_TIMEOUT_MS'),
      DEFAULT_TIMEOUT_MS.socket
    ),
    dnsTimeoutMs: parsePositiveInteger(
      firstEnv('EMAIL_DNS_TIMEOUT_MS', 'GMAIL_DNS_TIMEOUT_MS'),
      DEFAULT_TIMEOUT_MS.dns
    ),
    maxConnections: parsePositiveInteger(
      firstEnv('EMAIL_MAX_CONNECTIONS', 'GMAIL_MAX_CONNECTIONS'),
      DEFAULT_MAX_CONNECTIONS
    ),
    maxMessages: parsePositiveInteger(firstEnv('EMAIL_MAX_MESSAGES', 'GMAIL_MAX_MESSAGES'), DEFAULT_MAX_MESSAGES),
    isReady: Boolean(user && pass),
  };
};

export const getSenderAddress = (mailConfig = getMailConfig()) =>
  `"${mailConfig.fromName.replace(/"/g, '\\"')}" <${mailConfig.user}>`;

export const createMailTransporter = async (mailConfig = getMailConfig()) => {
  if (!mailConfig.isReady) {
    throw new Error('Email is not configured. Set Gmail credentials in .env.');
  }

  const host = mailConfig.forceIPv4
    ? await resolveIPv4Host(mailConfig.host, mailConfig.dnsTimeoutMs)
    : mailConfig.host;

  return nodemailer.createTransport({
    host,
    port: mailConfig.port,
    secure: mailConfig.secure,
    requireTLS: !mailConfig.secure,
    auth: {
      user: mailConfig.user,
      pass: mailConfig.pass,
    },
    pool: true,
    maxConnections: mailConfig.maxConnections,
    maxMessages: mailConfig.maxMessages,
    connectionTimeout: mailConfig.connectionTimeoutMs,
    greetingTimeout: mailConfig.greetingTimeoutMs,
    socketTimeout: mailConfig.socketTimeoutMs,
    dnsTimeout: mailConfig.dnsTimeoutMs,
    tls: {
      servername: mailConfig.host,
      minVersion: 'TLSv1.2',
    },
  });
};

export const closeMailTransporter = (transporter) => {
  if (typeof transporter?.close === 'function') {
    transporter.close();
  }
};

export const buildMailErrorPayload = (error) => {
  const detail = error?.message || 'Unknown Gmail error.';

  if (/not configured/i.test(detail)) {
    return {
      status: 503,
      body: {
        message: 'Email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env.',
        detail,
      },
    };
  }

  const isAuthFailure =
    /invalid login|username and password not accepted|application-specific password|app password|eauth|535/i.test(detail);
  const isNetworkFailure =
    /enetunreach|econnrefused|econnreset|etimedout|edns|enotfound|eai_again|connection timeout|greeting never received|socket timeout/i.test(
      detail
    );

  return {
    status: 502,
    body: {
      message: isAuthFailure
        ? 'Gmail authentication failed. Use a Google App Password for GMAIL_APP_PASSWORD, not the normal Gmail password.'
        : isNetworkFailure
          ? 'Gmail SMTP connection failed. Check the server internet/firewall and GMAIL_SMTP_PORT setting.'
          : 'Gmail dispatch failed.',
      detail,
    },
  };
};
