// Expo push notification sender.
// Fire-and-forget: push failures must NEVER throw or break the caller.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 90;

const isExpoToken = (token) =>
  typeof token === 'string' &&
  (token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken'));

const chunk = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
};

export async function sendExpoPush(tokens = [], { title, body, data, image, categoryId } = {}) {
  const unique = [...new Set((Array.isArray(tokens) ? tokens : []).filter(isExpoToken))];

  if (!unique.length) {
    return { sent: 0, errors: [] };
  }

  let sent = 0;
  const errors = [];
  const invalidTokens = [];

  for (const group of chunk(unique, CHUNK_SIZE)) {
    const messages = group.map((to) => ({
      to,
      title,
      body,
      data: data || {},
      sound: 'default',
      priority: 'high',
      // Route to the HIGH-importance Android channel the app creates on launch
      // (registerPush.js -> "default"). Without this, Android delivers straight
      // to the tray with no heads-up banner. iOS ignores channelId.
      channelId: 'default',
      // categoryId ties the notification to an in-app action-button set
      // (registerPush.js -> setNotificationCategoryAsync), e.g. "Pay Now".
      ...(categoryId ? { categoryId } : {}),
      // richContent.image renders a large banner image (Zomato-style) on Android.
      ...(image ? { richContent: { image } } : {}),
    }));

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        await response.text();
        errors.push({ type: 'request', status: response.status });
        continue;
      }

      const payload = await response.json();
      const tickets = Array.isArray(payload?.data) ? payload.data : [];
      if (tickets.length !== group.length) {
        errors.push(`Expo returned ${tickets.length} tickets for ${group.length} push messages.`);
      }

      tickets.forEach((ticket, index) => {
        if (ticket?.status === 'ok') {
          sent += 1;
          return;
        }

        const token = group[index];
        const code = ticket?.details?.error || '';
        errors.push({ type: 'ticket', code: /^[a-z\d_-]+$/i.test(code) ? code : 'unknown' });
        if (code === 'DeviceNotRegistered' && token) invalidTokens.push(token);
      });
    } catch (error) {
      errors.push({ type: 'network', name: error?.name || 'Error' });
    }
  }

  return { sent, errors, invalidTokens };
}

export default sendExpoPush;
