import express from 'express';
import nodemailer from 'nodemailer';

const router = express.Router();

const getMailConfig = () => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const fromName = process.env.GMAIL_FROM_NAME || 'MGPS ERP Portal';

  return {
    user,
    pass,
    fromName,
    isReady: Boolean(user && pass),
  };
};

const createTransporter = () => {
  const { user, pass } = getMailConfig();

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
  });
};

const normalizeMessage = (message) => ({
  to: Array.isArray(message.to) ? message.to.filter(Boolean) : message.to,
  subject: String(message.subject || '').trim(),
  text: String(message.text || '').trim(),
  html: message.html ? String(message.html) : undefined,
});

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

router.post('/send', async (request, response) => {
  const mailConfig = getMailConfig();

  if (!mailConfig.isReady) {
    response.status(503).json({
      message: 'Gmail is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env.',
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
    const transporter = createTransporter();
    const results = [];

    for (const message of messages) {
      const info = await transporter.sendMail({
        from: `"${mailConfig.fromName}" <${mailConfig.user}>`,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      results.push({
        to: message.to,
        subject: message.subject,
        messageId: info.messageId,
      });
    }

    response.json({
      sent: results.length,
      results,
    });
  } catch (error) {
    response.status(502).json({
      message: 'Gmail dispatch failed.',
      detail: error.message,
    });
  }
});

export default router;
