import assert from 'node:assert/strict';
import test from 'node:test';
import { emitRealtimeEvent, emitRealtimeInvalidation, setRealtimeServer } from './realtime.js';

test('emits module-state invalidations only to authorized role rooms', () => {
  const emissions = [];
  const io = {
    emit: (...args) => emissions.push({ scope: 'all', args }),
    to: (rooms) => ({
      emit: (...args) => emissions.push({ scope: rooms, args }),
    }),
  };
  setRealtimeServer(io);

  emitRealtimeEvent(
    'mgps-erp-module-state:admin-employee-management-list',
    { __moduleStateInvalidation: true },
    ['role:admin', 'role:clerk']
  );

  assert.equal(emissions.length, 1);
  assert.deepEqual(emissions[0].scope, ['role:admin', 'role:clerk']);
  assert.equal(emissions[0].args[0], 'realtime:event');
  assert.deepEqual(emissions[0].args[1].detail, { __moduleStateInvalidation: true });
});

test('emits other sensitive updates as minimal invalidations to selected role rooms', () => {
  const emissions = [];
  setRealtimeServer({
    emit: (...args) => emissions.push({ scope: 'all', args }),
    to: (rooms) => ({
      emit: (...args) => emissions.push({ scope: rooms, args }),
    }),
  });

  emitRealtimeInvalidation('mgps-erp-attendance:updated', ['admin', 'clerk', 'admin']);
  emitRealtimeInvalidation('mgps-timetable-updated', ['admin', 'clerk', 'teacher', 'student']);

  assert.equal(emissions.length, 2);
  assert.deepEqual(emissions[0].scope, ['role:admin', 'role:clerk']);
  assert.deepEqual(emissions[1].scope, [
    'role:admin',
    'role:clerk',
    'role:teacher',
    'role:student',
  ]);
  for (const emission of emissions) {
    assert.equal(emission.args[0], 'realtime:event');
    assert.deepEqual(emission.args[1].detail, { invalidate: true });
  }
});
