import { verifyAuthToken } from '../utils/authToken.js';

export const requireAuth = (request, response, next) => {
  const header = request.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (token) {
    const auth = verifyAuthToken(token);
    if (!auth) {
      response.status(401).json({ message: 'Authentication is required.' });
      return;
    }
    request.auth = auth;
    next();
    return;
  }

  const sessionAuth = request.session?.auth;
  if (sessionAuth?.username && sessionAuth?.role) {
    request.auth = sessionAuth;
    next();
    return;
  }

  response.status(401).json({ message: 'Authentication is required.' });
};

export const optionalAuth = (request, response, next) => {
  const header = request.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (token) {
    const auth = verifyAuthToken(token);
    if (!auth) {
      response.status(401).json({ message: 'Authentication is required.' });
      return;
    }
    request.auth = auth;
    next();
    return;
  }

  const sessionAuth = request.session?.auth;
  if (sessionAuth?.username && sessionAuth?.role) {
    request.auth = sessionAuth;
  }

  next();
};

export const requireRole = (...roles) => (request, response, next) => {
  if (!roles.includes(request.auth?.role)) {
    response.status(403).json({ message: 'You do not have permission to perform this action.' });
    return;
  }

  next();
};
