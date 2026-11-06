import assert from 'node:assert/strict';
import test from 'node:test';
import { withPostgresAdvisoryLock } from './postgresAdvisoryLock.js';

const createPool = ({ acquired = true } = {}) => {
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired }] };
      return { rows: [] };
    },
    release(discard) {
      calls.push(discard ? 'release-discard' : 'release');
    },
  };

  return {
    calls,
    async connect() {
      return client;
    },
  };
};

test('runs the task while holding the advisory lock and releases the client', async () => {
  const pool = createPool();
  let ran = false;

  const result = await withPostgresAdvisoryLock(pool, 42, async () => {
    ran = true;
    return 'done';
  });

  assert.deepEqual(result, { acquired: true, value: 'done' });
  assert.equal(ran, true);
  assert.equal(pool.calls.length, 3);
  assert.match(pool.calls[1], /pg_advisory_unlock/);
  assert.equal(pool.calls[2], 'release');
});

test('skips the task when another backend holds the advisory lock', async () => {
  const pool = createPool({ acquired: false });
  let ran = false;

  const result = await withPostgresAdvisoryLock(pool, 42, async () => {
    ran = true;
  });

  assert.deepEqual(result, { acquired: false, value: undefined });
  assert.equal(ran, false);
  assert.deepEqual(pool.calls, [
    'SELECT pg_try_advisory_lock($1::bigint) AS acquired',
    'release',
  ]);
});

test('releases the advisory lock and client when the task throws', async () => {
  const pool = createPool();

  await assert.rejects(
    withPostgresAdvisoryLock(pool, 42, async () => {
      throw new Error('task failed');
    }),
    /task failed/
  );

  assert.match(pool.calls[1], /pg_advisory_unlock/);
  assert.equal(pool.calls[2], 'release');
});
