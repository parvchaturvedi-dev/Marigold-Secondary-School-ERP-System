const normalizeClassName = (value) => String(value || '').trim();
const normalizeClassKey = (value) => normalizeClassName(value).toLowerCase();

export const getSessionClassOrder = (preferences = []) =>
  (Array.isArray(preferences) ? preferences : [])
    .map((entry) =>
      typeof entry === 'string' ? entry : entry?.name || entry?.className || entry?.class || ''
    )
    .map(normalizeClassName)
    .filter(Boolean);

const feeAmount = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const hasPendingFees = (student = {}) => {
  const ledger = Array.isArray(student.feeLedger) ? student.feeLedger : [];
  if (ledger.length) {
    return ledger.some((entry) => {
      const assigned = feeAmount(entry.assigned ?? entry.totalFees ?? entry.amount ?? entry.assignedFees);
      const paid = feeAmount(entry.paid ?? entry.paidFees ?? entry.collected);
      return Math.max(0, assigned - paid) > 0;
    });
  }
  return feeAmount(
    student.pendingFees ?? student.feePending ?? student.balanceFees ?? student.unpaidFees ?? student.dueAmount
  ) > 0;
};

const getStudentClass = (student = {}) =>
  student.className || student.class || student.rawProfile?.targetClass || '';

const withNextClassFeeRow = (student, nextClass) => {
  if (!Array.isArray(student.feeLedger)) return student;
  if (student.feeLedger.some((entry) => normalizeClassKey(entry.className || entry.class) === normalizeClassKey(nextClass))) {
    return student;
  }
  return {
    ...student,
    feeLedger: [
      ...student.feeLedger,
      { className: nextClass, assigned: 0, paid: 0, payments: [], note: '' },
    ],
  };
};

const promote = (student, nextClass, currentClass) => {
  const prepared = withNextClassFeeRow(student, nextClass);
  return {
    ...prepared,
    previousClass: currentClass,
    class: nextClass,
    className: nextClass,
    targetClass: nextClass,
    promotedOut: false,
    status: prepared.status || 'Active',
    rawProfile: {
      ...(prepared.rawProfile || {}),
      targetClass: nextClass,
    },
  };
};

const markPassedOut = (student, currentClass) => ({
  ...student,
  previousClass: currentClass,
  promotedOut: true,
  status: 'Passed Out',
  rawProfile: {
    ...(student.rawProfile || {}),
    targetClass: '',
  },
});

export const planSessionPromotion = (students = [], preferences = []) => {
  const classOrder = getSessionClassOrder(preferences);
  if (!classOrder.length) throw new Error('Configure class hierarchy before starting a new session.');

  let promotedCount = 0;
  let retainedCount = 0;
  let graduatedCount = 0;
  let movedToPendingCount = 0;
  const remainingStudents = [];
  const newAlumni = [];

  for (const student of Array.isArray(students) ? students : []) {
    const currentClass = getStudentClass(student);
    const rank = classOrder.findIndex((name) => normalizeClassKey(name) === normalizeClassKey(currentClass));
    if (student.isRepeating || !currentClass || rank === -1) {
      if (student.isRepeating) retainedCount += 1;
      remainingStudents.push(student);
      continue;
    }

    if (rank === classOrder.length - 1) {
      if (hasPendingFees(student)) {
        movedToPendingCount += 1;
        newAlumni.push(markPassedOut(student, currentClass));
      } else {
        graduatedCount += 1;
      }
      continue;
    }

    promotedCount += 1;
    remainingStudents.push(promote(student, classOrder[rank + 1], currentClass));
  }

  if (!promotedCount && !graduatedCount && !movedToPendingCount) {
    throw new Error('No eligible students found for promotion. Check the class hierarchy and roster.');
  }

  const studentCountByClass = remainingStudents.reduce((counts, student) => {
    const name = getStudentClass(student);
    if (name) counts[name] = (counts[name] || 0) + 1;
    return counts;
  }, {});

  return {
    classOrder,
    remainingStudents,
    newAlumni,
    studentCountByClass,
    counts: { promotedCount, retainedCount, graduatedCount, movedToPendingCount },
  };
};
