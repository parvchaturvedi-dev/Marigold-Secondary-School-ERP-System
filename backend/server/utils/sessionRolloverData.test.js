import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeRolloverSnapshot } from './sessionRolloverData.js';

describe('sanitizeRolloverSnapshot', () => {
  it('removes rollover-cleared records and recalculates the archived record count', () => {
    const source = {
      schemaVersion: 1,
      recordCount: 7,
      tables: {
        assignments: [{ id: 'assignment-1' }],
        applications: [{ id: 'application-1' }],
        notifications: [{ id: 'notification-1' }],
        meetings: [{ id: 'meeting-1' }],
        leave_requests: [{ id: 'leave-1' }],
        modulestates: [
          { namespace: 'admin-notices-list', value: [{ id: 'notice-1' }] },
          { namespace: 'admin-class-management-classes', value: [{ id: 'class-1' }] },
        ],
        users: [{ id: 'user-1' }],
      },
    };

    const { changed, snapshot } = sanitizeRolloverSnapshot(source, {
      clearedTableNames: [
        'assignments',
        'applications',
        'notifications',
        'meetings',
        'leave_requests',
      ],
      moduleStateTableName: 'modulestates',
    });

    assert.equal(changed, true);
    assert.equal(snapshot.recordCount, 2);
    assert.equal(Object.hasOwn(snapshot.tables, 'assignments'), false);
    assert.equal(Object.hasOwn(snapshot.tables, 'applications'), false);
    assert.equal(Object.hasOwn(snapshot.tables, 'notifications'), false);
    assert.equal(Object.hasOwn(snapshot.tables, 'meetings'), false);
    assert.equal(Object.hasOwn(snapshot.tables, 'leave_requests'), false);
    assert.deepEqual(snapshot.tables.modulestates, [
      { namespace: 'admin-class-management-classes', value: [{ id: 'class-1' }] },
    ]);
    assert.deepEqual(snapshot.tables.users, [{ id: 'user-1' }]);
  });

  it('leaves snapshots without these records unchanged', () => {
    const source = {
      recordCount: 1,
      tables: {
        modulestates: [
          { namespace: 'admin-class-management-classes', value: [] },
        ],
      },
    };

    const result = sanitizeRolloverSnapshot(source, {
      clearedTableNames: ['assignments', 'applications'],
      moduleStateTableName: 'modulestates',
    });

    assert.equal(result.changed, false);
    assert.deepEqual(result.snapshot, source);
  });
});
