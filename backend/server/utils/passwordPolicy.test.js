import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedDuringPasswordChange, needsPasswordChange } from './passwordPolicy.js';

test('requires a password change for forced or temporary credentials', () => {
  assert.equal(needsPasswordChange({ forcePasswordChange: true }), true);
  assert.equal(needsPasswordChange({ initialPassword: 'temporary' }), true);
  assert.equal(needsPasswordChange({ passwordChanged: true }), false);
  assert.equal(needsPasswordChange({}), false);
});

test('allows only password change and session refresh during a forced change', () => {
  assert.equal(isAllowedDuringPasswordChange('POST', '/api/auth/change-password'), true);
  assert.equal(isAllowedDuringPasswordChange('GET', '/api/auth/session?refresh=1'), true);
  assert.equal(isAllowedDuringPasswordChange('POST', '/api/auth/logout'), false);
  assert.equal(isAllowedDuringPasswordChange('GET', '/api/dashboard'), false);
  assert.equal(isAllowedDuringPasswordChange('GET', '/api/auth/users'), false);
});
