import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

// ---------------------------------------------------------------------------
// Short-lived, asset-scoped media tokens.
//
// Files used to be inlined into list responses as base64 data URLs. That made
// every list load re-download every attachment — expensive in bandwidth and
// slow to render. Now a list returns a lightweight URL instead, and the browser
// (or the app) fetches the bytes lazily, on demand, and caches them.
//
// The catch: the API authenticates with a Bearer header, but an <img src> (and
// a React Native <Image uri>) cannot send headers. So each media URL carries a
// token that grants read access to ONE asset for a limited time — nothing else.
// It is not a session token: it cannot be replayed against any other endpoint.
// ---------------------------------------------------------------------------

const getSecret = () => {
  const secret = process.env.JWT_SECRET || process.env.AUTH_TOKEN_SECRET || process.env.SESSION_SECRET;
  if (secret) return secret;
  // Mirrors authToken.js: never crash, but tokens die on restart.
  return randomBytes(32).toString('hex');
};

const SECRET = getSecret();

export const MEDIA_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24h — long enough for browser caching

const sign = (payload) => createHmac('sha256', SECRET).update(payload).digest('base64url');

// kind: 'event' | 'assignment' | 'calendar'  — scopes the token to one route.
export const createMediaToken = (kind, id, ttlSeconds = MEDIA_TOKEN_TTL_SECONDS) => {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${kind}:${id}:${exp}`;
  return `${exp}.${sign(payload)}`;
};

export const verifyMediaToken = (kind, id, token = '') => {
  const value = String(token || '');
  const separator = value.indexOf('.');
  if (separator <= 0) return false;

  const exp = Number(value.slice(0, separator));
  const signature = value.slice(separator + 1);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const expected = sign(`${kind}:${id}:${exp}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

// Relative path the frontends prefix with their API origin.
export const mediaUrlFor = (kind, id) =>
  `/api/media/${kind}/${encodeURIComponent(String(id))}?t=${createMediaToken(kind, String(id))}`;
