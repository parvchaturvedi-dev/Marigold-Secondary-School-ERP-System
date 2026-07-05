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
        errors.push(`Expo push failed with status ${response.status}`);
        continue;
      }

      sent += group.length;
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }

  return { sent, errors };
}

export default sendExpoPush;
