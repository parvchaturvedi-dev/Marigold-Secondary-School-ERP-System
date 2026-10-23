export const assignClasswiseAlphabeticalRollNumbers = (students, onlyClass = null) => {
  const list = Array.isArray(students) ? students : [];
  const grouped = new Map();

  list.forEach((student, index) => {
    const className = String(student.class || student.className || student.reportClassName || '').trim() || 'Unassigned';
    if (!grouped.has(className)) grouped.set(className, []);
    grouped.get(className).push(index);
  });

  const rollNumbers = new Map();
  grouped.forEach((indices, className) => {
    if (onlyClass && className !== onlyClass) return;
    indices
      .sort((left, right) => {
        const nameA = String(
          list[left].name || list[left].displayName || list[left].studentName || list[left].rawProfile?.studentName || ''
        ).trim();
        const nameB = String(
          list[right].name || list[right].displayName || list[right].studentName || list[right].rawProfile?.studentName || ''
        ).trim();
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' }) ||
          String(list[left].admissionNumber || list[left].id || '').localeCompare(
            String(list[right].admissionNumber || list[right].id || ''),
            undefined,
            { sensitivity: 'base' }
          );
      })
      .forEach((studentIndex, position) => rollNumbers.set(studentIndex, position + 1));
  });

  return list.map((student, index) => {
    const className = String(student.class || student.className || student.reportClassName || '').trim() || 'Unassigned';
    if (onlyClass && className !== onlyClass) return student;

    const rollNo = rollNumbers.get(index) ?? student.rollNo;
    if (rollNo === student.rollNo && String(student.rawProfile?.rollNo ?? '') === String(rollNo ?? '')) {
      return student;
    }
    return {
      ...student,
      rollNo,
      rawProfile: {
        ...(student.rawProfile || {}),
        rollNo,
      },
    };
  });
};

export const getAlphabeticalRollNumber = (student, students = []) => {
  const className = String(student?.class || student?.className || student?.reportClassName || '').trim();
  const classRoster = (Array.isArray(students) ? students : []).filter(
    (candidate) =>
      String(candidate?.class || candidate?.className || candidate?.reportClassName || '').trim() === className
  );
  const studentAdmission = String(student?.admissionNumber || student?.id || '');
  const existingStudent = classRoster.find((candidate) => {
    const candidateAdmission = String(candidate?.admissionNumber || candidate?.id || '');
    return studentAdmission
      ? candidateAdmission === studentAdmission
      : candidate === student;
  });
  const roster = existingStudent ? classRoster : [...classRoster, student];
  const assignedRoster = assignClasswiseAlphabeticalRollNumbers(roster, className || null);
  const index = existingStudent ? classRoster.indexOf(existingStudent) : assignedRoster.length - 1;
  return assignedRoster[index]?.rollNo || '';
};
