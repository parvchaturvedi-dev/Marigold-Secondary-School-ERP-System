export const needsPasswordChange = (profile = {}) =>
  Boolean(profile.forcePasswordChange || profile.initialPassword);

export const isAllowedDuringPasswordChange = (method, path) => {
  const normalizedMethod = String(method || '').toUpperCase();
  const normalizedPath = String(path || '').split('?')[0].replace(/\/+$/, '') || '/';

  return (
    (normalizedMethod === 'POST' &&
      ['/api/auth/change-password', '/auth/change-password'].includes(normalizedPath)) ||
    (normalizedMethod === 'GET' &&
      ['/api/auth/session', '/auth/session'].includes(normalizedPath))
  );
};
