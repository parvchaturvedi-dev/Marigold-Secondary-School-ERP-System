import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const getAuthSecret = () => {
  const secret =
    process.env.JWT_SECRET ||
    process.env.AUTH_TOKEN_SECRET ||
    process.env.SESSION_SECRET;

  if (secret) return secret;

  const fallbackSecret = randomBytes(32).toString('hex');
  console.warn(
    'JWT_SECRET/AUTH_TOKEN_SECRET is not set. Using an ephemeral token secret; tokens will be invalidated on restart.'
  );
  return fallbackSecret;
};

const SECRET = getAuthSecret();

const base64UrlEncode = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

const base64UrlDecode = (value) =>
  JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));

const sign = (payload) =>
  createHmac('sha256', SECRET).update(payload).digest('base64url');

export const createAuthToken = (user) => {
  const payload = base64UrlEncode({
    sub: user._id.toString(),
    username: user.username,
    role: user.role,
    iat: Date.now(),
    exp: Date.now() + TOKEN_TTL_MS,
  });
  return `${payload}.${sign(payload)}`;
};

export const verifyAuthToken = (token = '') => {
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const expected = sign(payload);
    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      return null;
    }

    const decoded = base64UrlDecode(payload);
    if (!decoded?.username || !decoded?.role || Number(decoded.exp) < Date.now()) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
};
