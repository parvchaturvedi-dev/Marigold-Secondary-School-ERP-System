const normalize = (value) => String(value || '').trim().toLowerCase();

export const canTeacherPublishAssignment = (auth = {}, subject, targetClasses = []) => {
  if (auth.role !== 'teacher') return true;

  const normalizedSubject = normalize(subject);
  if (!normalizedSubject || !Array.isArray(targetClasses) || targetClasses.length === 0) {
    return false;
  }

  const assignedSubjectsByClass = new Map();
  const assignments = Array.isArray(auth.teacherProfile?.classAssignments)
    ? auth.teacherProfile.classAssignments
    : Array.isArray(auth.classAssignments)
      ? auth.classAssignments
      : [];

  for (const assignment of assignments) {
    const className = normalize(assignment?.className || assignment?.class);
    const assignedSubject = normalize(
      assignment?.subject || assignment?.subjectName || assignment?.paperSubject
    );
    if (!className || !assignedSubject) continue;

    const subjects = assignedSubjectsByClass.get(className) || new Set();
    subjects.add(assignedSubject);
    assignedSubjectsByClass.set(className, subjects);
  }

  return targetClasses.every((targetClass) => {
    const className = normalize(targetClass);
    return className && assignedSubjectsByClass.get(className)?.has(normalizedSubject);
  });
};
