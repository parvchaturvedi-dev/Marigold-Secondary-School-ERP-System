const clean = (value = "") => String(value || "").trim();

const firstValue = (...values) => values.find((value) => clean(value));

export function normalizeStudentProfile(student = {}, index = 0) {
  const raw = student.rawProfile || {};
  const admissionNumber = clean(firstValue(student.admissionNumber, student.id, raw.admissionNumber));
  const displayName = clean(firstValue(student.displayName, student.name, raw.studentName, admissionNumber));
  const className = clean(firstValue(student.className, student.class, raw.targetClass));

  return {
    ...student,
    id: admissionNumber || clean(student.id) || `student-${index + 1}`,
    displayName: displayName || `Student ${index + 1}`,
    className,
    section: clean(firstValue(student.section, raw.section)),
    rollNo: student.rollNo || raw.rollNo || "",
    admissionNumber,
    fatherName: clean(firstValue(student.fatherName, raw.fatherName)),
    motherName: clean(firstValue(student.motherName, raw.motherName)),
    guardianName: clean(firstValue(student.guardianName, raw.guardianName)),
    guardianPhone: clean(firstValue(student.guardianPhone, student.mobile, raw.guardianMobile, raw.mobileNo)),
    guardianEmail: clean(firstValue(student.guardianEmail, student.email, raw.email)),
    dob: clean(firstValue(student.dob, raw.dob)),
    gender: clean(firstValue(student.gender, raw.gender)),
    bloodGroup: clean(firstValue(student.bloodGroup, raw.bloodGroup)),
    address: clean(firstValue(student.address, raw.permAddress, raw.tempAddress)),
    photoDataUrl: clean(firstValue(student.photoDataUrl, raw.photoDataUrl)),
  };
}

export function getActiveStudentProfile(user = {}) {
  const profiles = Array.isArray(user.studentProfiles)
    ? user.studentProfiles.map(normalizeStudentProfile)
    : [];
  if (!profiles.length) return null;

  return (
    profiles.find((student) => student.id === user.selectedStudentId) ||
    (user.activeStudent ? normalizeStudentProfile(user.activeStudent) : null) ||
    profiles[0]
  );
}

export function getTeacherProfile(user = {}) {
  const source = user.teacherProfile || {};
  const username = clean(user.username || source.id || source.empId).toUpperCase();
  const displayName = clean(firstValue(source.name, source.displayName, user.displayName, user.name, username));

  return {
    ...source,
    username,
    displayName,
    employeeId: clean(firstValue(source.id, source.empId, username)),
    designation: clean(firstValue(source.designation, source.role)) || "Faculty",
    department: clean(source.department),
    qualification: clean(source.qualification),
    mobile: clean(firstValue(source.mobile, source.phone, user.mobile)),
    email: clean(firstValue(source.email, user.email)),
    dob: clean(source.dob),
    gender: clean(source.gender),
    address: clean(source.address),
    assignedClassTeacherFor: clean(firstValue(source.assignedClassTeacherFor, user.assignedClassTeacherFor)),
    allottedClasses: Array.isArray(user.allottedClasses) ? user.allottedClasses : [],
  };
}

export function getStaffProfile(user = {}) {
  const source = user.clerkProfile || user.adminProfile || {};
  const username = clean(user.username || source.id || source.empId).toUpperCase();
  const displayName = clean(firstValue(source.name, source.displayName, user.displayName, user.name, username));

  return {
    ...source,
    username,
    displayName,
    employeeId: clean(firstValue(source.id, source.empId, username)),
    designation: clean(firstValue(source.designation, source.role)) || (user.role === "admin" ? "Administrator" : "Office Administration"),
    department: clean(source.department),
    mobile: clean(firstValue(source.mobile, source.phone, user.mobile)),
    email: clean(firstValue(source.email, user.email)),
    dob: clean(source.dob),
    gender: clean(source.gender),
    address: clean(source.address),
    joiningDate: clean(source.joiningDate),
    shift: clean(source.shift),
    deskWindow: clean(source.deskWindow),
  };
}
