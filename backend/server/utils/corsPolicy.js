const normalizeOrigin = (origin = '') => String(origin).trim().replace(/\/+$/, '');

const parseOriginList = (value = '') =>
  String(value)
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

const localDevOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const isProductionLike = (env) =>
  env.NODE_ENV === 'production' ||
  Boolean(env.VERCEL || env.RENDER || env.RENDER_EXTERNAL_URL || env.RAILWAY);

export const createCorsOriginPolicy = (env = process.env) => {
  const productionLike = isProductionLike(env);
  const vercelOrigin = env.VERCEL_URL ? `https://${normalizeOrigin(env.VERCEL_URL)}` : '';
  const frontendUrl = env.FRONTEND_URL || env.FRONTEND_ORIGIN || '';
  const exactOrigins = [
    'https://www.mghub.marigoldschoolbehror.com',
    'https://mghub.marigoldschoolbehror.com',
    'http://localhost:5173',
    'https://marigold-secondary-school-erp-system-frontend-dhuizf172.vercel.app',
    ...parseOriginList(env.CORS_ORIGINS),
    ...parseOriginList(env.CLIENT_ORIGIN),
    ...parseOriginList(frontendUrl),
    vercelOrigin,
  ]
    .map(normalizeOrigin)
    .filter((origin) => origin && (!productionLike || !localDevOriginPattern.test(origin)));
  const configuredOrigins = new Set(exactOrigins);

  return {
    isAllowedOrigin: (origin) => {
      if (!origin) return true;
      const normalizedOrigin = normalizeOrigin(origin);
      return (
        configuredOrigins.has(normalizedOrigin) ||
        (!productionLike && localDevOriginPattern.test(normalizedOrigin))
      );
    },
  };
};
