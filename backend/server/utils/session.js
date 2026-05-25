import session from 'express-session';
import MongoStore from 'connect-mongo';
import { randomBytes } from 'node:crypto';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const isProductionLike = () =>
  process.env.NODE_ENV === 'production' ||
  Boolean(process.env.VERCEL || process.env.RENDER || process.env.RENDER_EXTERNAL_URL || process.env.RAILWAY);

const getSessionSecret = () => {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.JWT_SECRET ||
    process.env.AUTH_TOKEN_SECRET;

  if (secret) return secret;

  const fallbackSecret = randomBytes(32).toString('hex');
  console.warn(
    'SESSION_SECRET is not set. Using an ephemeral session secret; all sessions will be invalidated on restart.'
  );
  return fallbackSecret;
};

export const createSessionMiddleware = () => {
  const productionLike = isProductionLike();
  const cookie = {
    httpOnly: true,
    sameSite: productionLike ? 'none' : 'lax',
    secure: productionLike,
    maxAge: SESSION_TTL_MS,
    path: '/',
  };

  const baseOptions = {
    name: 'mgps_erp_sid',
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: true,
    cookie,
  };

  if (process.env.MONGODB_URI) {
    baseOptions.store = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      dbName: process.env.MONGODB_DB_NAME || undefined,
      ttl: SESSION_TTL_MS / 1000,
      autoRemove: 'native',
    });
  }

  return session(baseOptions);
};
