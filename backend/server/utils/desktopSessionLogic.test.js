import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planSessionPromotion } from './desktopSessionLogic.js';

describe('planSessionPromotion', () => {
  const classes = ['Nursery', 'Class 1', 'Class 2'];

  it('promotes students and carries their ledger forward without changing existing fees', () => {
    const student = {
      admissionNumber: 'A-1',
      className: 'Nursery',
      feeLedger: [{ className: 'Nursery', assigned: 1000, paid: 300 }],
    };
    const result = planSessionPromotion([student], classes);

    assert.equal(result.counts.promotedCount, 1);
    assert.equal(result.remainingStudents[0].className, 'Class 1');
    assert.equal(result.remainingStudents[0].previousClass, 'Nursery');
    assert.deepEqual(result.remainingStudents[0].feeLedger, [
      { className: 'Nursery', assigned: 1000, paid: 300 },
      { className: 'Class 1', assigned: 0, paid: 0, payments: [], note: '' },
    ]);
    assert.equal(student.feeLedger.length, 1);
  });

  it('retains repeaters and sends final-class debt to alumni while graduating fully paid students', () => {
    const result = planSessionPromotion([
      { admissionNumber: 'R-1', className: 'Class 1', isRepeating: true },
      { admissionNumber: 'D-1', className: 'Class 2', pendingFees: 100 },
      { admissionNumber: 'G-1', className: 'Class 2', pendingFees: 0 },
    ], classes);

    assert.deepEqual(result.counts, {
      promotedCount: 0,
      retainedCount: 1,
      graduatedCount: 1,
      movedToPendingCount: 1,
    });
    assert.deepEqual(result.remainingStudents.map((student) => student.admissionNumber), ['R-1']);
    assert.equal(result.newAlumni[0].admissionNumber, 'D-1');
    assert.equal(result.newAlumni[0].status, 'Passed Out');
  });

  it('refuses a rollover with no eligible changes', () => {
    assert.throws(
      () => planSessionPromotion([{ className: 'Class 1', isRepeating: true }], classes),
      /No eligible students/
    );
  });
});
