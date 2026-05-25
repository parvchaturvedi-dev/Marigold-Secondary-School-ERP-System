import { API_BASE_URL, authFetch, withAuthHeaders } from './api';

const GMAIL_API_URL = `${API_BASE_URL}/gmail/send`;

export const sendGmailMessages = async (messages) => {
  const payload = Array.isArray(messages) ? { messages } : messages;

  const response = await authFetch(GMAIL_API_URL, {
    method: 'POST',
    headers: withAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = responseBody.detail ? ` ${responseBody.detail}` : '';
    throw new Error(`${responseBody.message || 'Email dispatch failed.'}${detail}`);
  }

  return responseBody;
};
