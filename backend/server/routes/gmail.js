import express from 'express';
import {
  buildMailErrorPayload,
  closeMailTransporter,
  createMailTransporter,
  getMailConfig,
  getSenderAddress,
} from '../utils/mailer.js';

const router = express.Router();

const normalizeMessage = (message) => ({
  to: Array.isArray(message.to) ? message.to.filter(Boolean) : message.to,
  subject: String(message.subject || '').trim(),
  text: String(message.text || '').trim(),
  html: message.html ? String(message.html) : undefined,
});

const mapWithConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const currentIndex = cursor;
        cursor += 1;
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    })
  );

  return results;
};

const validateMessage = (message) => {
  if (!message.to || (Array.isArray(message.to) && message.to.length === 0)) {
    return 'Recipient email is required.';
  }

  if (!message.subject) {
    return 'Email subject is required.';
  }

  if (!message.text && !message.html) {
    return 'Email body is required.';
  }

  return '';
};

router.get('/status', (_request, response) => {
  const mailConfig = getMailConfig();
  response.json({
    service: 'gmail',
    configured: mailConfig.isReady,
    hasUser: Boolean(mailConfig.user),
    hasPassword: Boolean(mailConfig.pass),
    fromName: mailConfig.fromName,
    host: mailConfig.host,
    port: mailConfig.port,
    secure: mailConfig.secure,
    forceIPv4: mailConfig.forceIPv4,
    maxConnections: mailConfig.maxConnections,
    requiredEnv: ['GMAIL_USER', 'GMAIL_APP_PASSWORD'],
    smtpEnvAliases: ['GMAIL_SMTP_HOST/GMAIL_SMTP_PORT', 'EMAIL_SMTP_HOST/EMAIL_SMTP_PORT', 'SMTP_HOST/SMTP_PORT'],
  });
});

router.post('/send', async (request, response) => {
  const mailConfig = getMailConfig();

  if (!mailConfig.isReady) {
    response.status(503).json({
      message: 'Email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env.',
    });
    return;
  }

  const requestMessages = Array.isArray(request.body.messages)
    ? request.body.messages
    : [request.body];

  const messages = requestMessages.map(normalizeMessage);
  const validationError = messages.map(validateMessage).find(Boolean);

  if (validationError) {
    response.status(400).json({ message: validationError });
    return;
  }

  try {
    const transporter = await createMailTransporter(mailConfig);
    const sender = getSenderAddress(mailConfig);

    try {
      const results = await mapWithConcurrency(messages, mailConfig.maxConnections, async (message) => {
        const info = await transporter.sendMail({
          from: sender,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });

        return {
          to: message.to,
          subject: message.subject,
          messageId: info.messageId,
        };
      });

      response.json({
        sent: results.length,
        results,
      });
    } finally {
      closeMailTransporter(transporter);
    }
  } catch (error) {
    const failure = buildMailErrorPayload(error);
    response.status(failure.status).json(failure.body);
  }
});

export default router;
