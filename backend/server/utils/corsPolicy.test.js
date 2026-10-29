import assert from 'node:assert/strict';
import test from 'node:test';
import { createCorsOriginPolicy } from './corsPolicy.js';

test('allows explicit development origins and localhost ports outside production', () => {
  const { isAllowedOrigin } = createCorsOriginPolicy({ NODE_ENV: 'development' });

  assert.equal(isAllowedOrigin('http://localhost:5173'), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:8081'), true);
  assert.equal(isAllowedOrigin('https://untrusted.vercel.app'), false);
});

test('production allows only exact configured origins and blocks localhost exemptions', () => {
  const { isAllowedOrigin } = createCorsOriginPolicy({
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://trusted.example.com',
    CORS_ORIGINS: 'https://also-trusted.example.com,http://localhost:5173',
  });

  assert.equal(isAllowedOrigin('https://trusted.example.com'), true);
  assert.equal(isAllowedOrigin('https://also-trusted.example.com'), true);
  assert.equal(isAllowedOrigin('https://marigold-secondary-school-erp-system-frontend-dhuizf172.vercel.app'), true);
  assert.equal(isAllowedOrigin('https://marigold-secondary-school-erp-system-frontend-preview.vercel.app'), false);
  assert.equal(isAllowedOrigin('http://localhost:5173'), false);
  assert.equal(isAllowedOrigin('http://127.0.0.1:8081'), false);
});
