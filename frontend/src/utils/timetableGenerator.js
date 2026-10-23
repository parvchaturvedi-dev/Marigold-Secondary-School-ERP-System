const SLOT_SEARCH_LIMIT = 500_000;

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const getWeeklyTimetableCellKey = (day, periodId, className) =>
  `${day}__${periodId}__${className}`;

export const solveWeeklyTimetable = ({
  days = WEEKDAYS,
  periods = [],
  classes = [],
  assignments = [],
  teacherAvailability = {},
}) => {
  const activeDays = [...new Set(days.filter(Boolean))];
  const activeClasses = [...new Set(classes.filter(Boolean))];
  if (!activeDays.length || !periods.length || !activeClasses.length) {
    return { ok: false, reason: 'Add at least one day, class, and period before generating a timetable.' };
  }

  const slots = activeDays.flatMap((day, dayIndex) =>
    periods.map((period, periodIndex) => ({ day, dayIndex, period, periodIndex }))
  );
  const tasks = [];
  const classLoads = new Map();
  const teacherLoadsRequested = new Map();
  for (const assignment of assignments) {
    const className = String(assignment.className || '').trim();
    const subject = String(assignment.subject || '').trim();
    const teacherId = String(assignment.teacherId || '').trim();
    const teacherName = String(assignment.teacherName || '').trim();
    const requiredPeriods = Math.floor(Number(assignment.periodsPerWeek));
    if (
      !className ||
      !subject ||
      !teacherId ||
      !teacherName ||
      !Number.isFinite(requiredPeriods) ||
      requiredPeriods < 0
    ) {
      return { ok: false, reason: 'Every teaching load needs a class, subject, teacher, and valid weekly period count.' };
    }
    if (!activeClasses.includes(className)) {
      return { ok: false, reason: `${className} is not included in the selected classes.` };
    }
    classLoads.set(className, (classLoads.get(className) || 0) + requiredPeriods);
    teacherLoadsRequested.set(teacherId, (teacherLoadsRequested.get(teacherId) || 0) + requiredPeriods);
    for (let occurrence = 0; occurrence < requiredPeriods; occurrence += 1) {
      tasks.push({
        className,
        subject,
        teacherId,
        teacherName,
        occurrence,
      });
    }
  }
  if (!tasks.length) {
    return { ok: false, reason: 'Enter at least one positive weekly teaching load before generating a timetable.' };
  }
  for (const [className, load] of classLoads) {
    if (load > slots.length) {
      return { ok: false, reason: `${className} needs ${load} periods but only has ${slots.length} weekly slots.` };
    }
  }
  for (const [id, load] of teacherLoadsRequested) {
    if (load > getAvailabilityLimit(teacherAvailability[id], slots.length)) {
      return { ok: false, reason: `A teacher is assigned ${load} periods but is only available for ${getAvailabilityLimit(teacherAvailability[id], slots.length)}.` };
    }
  }

  const classSlots = new Set();
  const teacherSlots = new Set();
  const teacherLoads = new Map();
  const scheduled = [];
  let searchNodes = 0;

  const getTeacherLimit = (teacherId) => getAvailabilityLimit(teacherAvailability[teacherId], slots.length);

  const chooseNextTask = (remaining) => {
    let bestIndex = -1;
    let bestCandidates = null;
    for (let index = 0; index < remaining.length; index += 1) {
      const task = remaining[index];
      if ((teacherLoads.get(task.teacherId) || 0) >= getTeacherLimit(task.teacherId)) continue;
      const candidates = slots.filter((slot) =>
        !classSlots.has(`${slot.dayIndex}__${slot.periodIndex}__${task.className}`) &&
        !teacherSlots.has(`${slot.dayIndex}__${slot.periodIndex}__${task.teacherId}`)
      );
      if (!bestCandidates || candidates.length < bestCandidates.length) {
        bestIndex = index;
        bestCandidates = candidates;
        if (candidates.length === 0) break;
      }
    }
    return { index: bestIndex, candidates: bestCandidates || [] };
  };

  const search = (remaining) => {
    if (!remaining.length) return true;
    searchNodes += 1;
    if (searchNodes > SLOT_SEARCH_LIMIT) return false;

    const { index, candidates } = chooseNextTask(remaining);
    if (index < 0 || !candidates.length) return false;
    const [task] = remaining.splice(index, 1);

    for (const slot of candidates) {
      const classKey = `${slot.dayIndex}__${slot.periodIndex}__${task.className}`;
      const teacherKey = `${slot.dayIndex}__${slot.periodIndex}__${task.teacherId}`;
      const cellKey = getWeeklyTimetableCellKey(slot.day, slot.period.id, task.className);
      classSlots.add(classKey);
      teacherSlots.add(teacherKey);
      teacherLoads.set(task.teacherId, (teacherLoads.get(task.teacherId) || 0) + 1);
      scheduled.push({
        ...task,
        day: slot.day,
        periodId: slot.period.id,
        cellKey,
      });

      if (search(remaining)) return true;

      scheduled.pop();
      teacherLoads.set(task.teacherId, teacherLoads.get(task.teacherId) - 1);
      teacherSlots.delete(teacherKey);
      classSlots.delete(classKey);
    }

    remaining.splice(index, 0, task);
    return false;
  };

  const remaining = [...tasks].sort((left, right) =>
    getTeacherLimit(left.teacherId) - getTeacherLimit(right.teacherId) ||
    left.className.localeCompare(right.className) ||
    left.subject.localeCompare(right.subject)
  );
  if (!search(remaining)) {
    return {
      ok: false,
      reason: searchNodes > SLOT_SEARCH_LIMIT
        ? 'The schedule is too constrained to solve quickly. Reduce the requested loads or add more periods.'
        : 'No conflict-free timetable fits these teaching loads and teacher availability. Reduce loads or add periods.',
    };
  }

  const cells = Object.fromEntries(scheduled.map((entry) => [
    entry.cellKey,
    { subject: entry.subject, teacher: entry.teacherName, teacherId: entry.teacherId },
  ]));
  return { ok: true, cells, scheduled, searchNodes };
};

const getAvailabilityLimit = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
};

export const validateWeeklyTimetable = ({ days = [], periods = [], classes = [], cells = {} }) => {
  const teacherSlots = new Set();
  const classSlots = new Set();
  for (const day of days) {
    for (const period of periods) {
      for (const className of classes) {
        const cell = cells[getWeeklyTimetableCellKey(day, period.id, className)];
        if (!cell?.subject || !cell?.teacherId) continue;
        const teacherKey = `${day}__${period.id}__${cell.teacherId}`;
        const classKey = `${day}__${period.id}__${className}`;
        if (teacherSlots.has(teacherKey)) return { valid: false, reason: `${cell.teacher} is scheduled in two classes at the same time.` };
        if (classSlots.has(classKey)) return { valid: false, reason: `${className} has more than one subject in the same period.` };
        teacherSlots.add(teacherKey);
        classSlots.add(classKey);
      }
    }
  }
  return { valid: true };
};
