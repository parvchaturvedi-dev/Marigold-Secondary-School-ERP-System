import { sortClassNames } from './masterData';

const clean = (value = '') => String(value || '').trim();

const firstValue = (...values) => values.find((value) => clean(value));

const fallbackNameFromUsername = (username = '', fallback = 'User') =>
  clean(username)
    ? clean(username).replace(/[-_]/g, ' ').replace(/\s+/g, ' ').toUpperCase()
    : fallback;

export const normalizeStudentProfile = (student = {}, index = 0) => {
  const raw = student.rawProfile || {};
  const admissionNumber = clean(firstValue(student.admissionNumber, student.id, raw.admissionNumber));
  const displayName = clean(
    firstValue(student.displayName, student.name, raw.studentName, admissionNumber)
  );
  const className = clean(firstValue(student.className, student.class, raw.targetClass));

  return {
    ...student,
    id: admissionNumber || clean(student.id) || `student-${index + 1}`,
    displayName: displayName || `Student ${index + 1}`,
    name: clean(student.name) || displayName,
    className,
    class: clean(student.class) || className,
    section: clean(firstValue(student.section, raw.section)),
    rollNo: student.rollNo || raw.rollNo || index + 1,
    admissionNumber,
    fatherName: clean(firstValue(student.fatherName, raw.fatherName)),
    motherName: clean(firstValue(student.motherName, raw.motherName)),
    guardianName: clean(firstValue(student.guardianName, raw.guardianName)),
    guardianPhone: clean(
      firstValue(student.guardianPhone, student.mobile, raw.guardianMobile, raw.mobileNo)
    ),
    guardianEmail: clean(firstValue(student.guardianEmail, student.email, raw.email)),
    dob: clean(firstValue(student.dob, raw.dob)),
    gender: clean(firstValue(student.gender, raw.gender)),
    bloodGroup: clean(firstValue(student.bloodGroup, raw.bloodGroup)),
    category: clean(firstValue(student.category, raw.category)),
    religion: clean(firstValue(student.religion, raw.religion)),
    house: clean(firstValue(student.house, raw.house)),
    busRoute: clean(firstValue(student.busRoute, raw.busRoute)),
    address: clean(firstValue(student.address, raw.permAddress, raw.tempAddress)),
    tempAddress: clean(firstValue(student.tempAddress, raw.tempAddress)),
    permAddress: clean(firstValue(student.permAddress, raw.permAddress, student.address)),
    studentAadhar: clean(firstValue(student.studentAadhar, raw.studentAadhar)),
    penNumber: clean(firstValue(student.penNumber, raw.penNumber)),
    dateOfAdmission: clean(firstValue(student.dateOfAdmission, raw.dateOfAdmission)),
    lastSchoolName: clean(firstValue(student.lastSchoolName, raw.lastSchoolName)),
    photoDataUrl: clean(firstValue(student.photoDataUrl, raw.photoDataUrl)),
    status: clean(firstValue(student.status, raw.status)) || 'Active',
  };
};

export const getSessionStudentProfiles = (session = {}) =>
  Array.isArray(session.studentProfiles)
    ? session.studentProfiles.map(normalizeStudentProfile)
    : [];

export const getActiveStudentProfile = (session = {}) => {
  const studentProfiles = getSessionStudentProfiles(session);
  if (!studentProfiles.length) return null;

  return (
    studentProfiles.find((student) => student.id === session.selectedStudentId) ||
    (session.activeStudent ? normalizeStudentProfile(session.activeStudent) : null) ||
    studentProfiles[0]
  );
};

export const getSessionTeacherProfile = (session = {}) => {
  const source = session.teacherProfile || session.profile?.teacherProfile || {};
  const username = clean(session.username || source.id || source.empId).toUpperCase();
  const displayName = clean(firstValue(source.name, source.displayName, session.displayName)) ||
    fallbackNameFromUsername(username, 'Teacher');
  const employeeId = clean(firstValue(source.id, source.empId, username));
  const allottedClasses = Array.isArray(session.allottedClasses)
    ? session.allottedClasses
    : Array.isArray(source.classAssignments)
      ? source.classAssignments.map((entry) => entry.className).filter(Boolean)
      : [];

  return {
    ...source,
    username,
    displayName,
    name: clean(source.name) || displayName,
    designation: clean(firstValue(source.designation, source.role)) || 'Faculty',
    department: clean(firstValue(source.department, source.subjectDepartment)),
    qualification: clean(firstValue(source.qualification, source.highestQualification)),
    employeeId,
    phone: clean(firstValue(source.mobile, source.phone, session.mobile)),
    mobile: clean(firstValue(source.mobile, source.phone, session.mobile)),
    email: clean(firstValue(source.email, session.email)),
    joiningDate: clean(firstValue(source.dateOfJoining, source.joiningDate)),
    dob: clean(source.dob),
    gender: clean(source.gender),
    bloodGroup: clean(source.bloodGroup),
    address: clean(source.address),
    classTeacherFor: clean(firstValue(source.assignedClassTeacherFor, session.assignedClassTeacherFor)),
    assignedClassTeacherFor: clean(firstValue(source.assignedClassTeacherFor, session.assignedClassTeacherFor)),
    emergencyContact: clean(firstValue(source.emergencyContact, source.mobile, source.phone)),
    photoDataUrl: clean(firstValue(source.photoDataUrl, session.photoDataUrl)),
    classAssignments: Array.isArray(source.classAssignments) ? source.classAssignments : [],
    allottedClasses: sortClassNames(allottedClasses),
    experience: Array.isArray(source.experience) ? source.experience : [],
    documentsAttached: Array.isArray(source.documentsAttached) ? source.documentsAttached : [],
  };
};
