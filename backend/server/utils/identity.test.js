import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialPassword, createPasswordHash, verifyPassword } from './identity.js';

test('creates high-entropy temporary passwords unrelated to usernames', () => {
  const first = createInitialPassword();
  const second = createInitialPassword();

  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, 'STD-123@MGPS');
  assert.notEqual(first, second);
});

test('temporary passwords remain verifiable through the password hash', () => {
  const password = createInitialPassword();
  const hash = createPasswordHash(password);

  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword('wrong-password', hash), false);
});
