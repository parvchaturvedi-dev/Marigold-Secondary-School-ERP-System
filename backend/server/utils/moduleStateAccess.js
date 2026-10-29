const STUDENT_BLOCKED_NAMESPACES = new Set([
  'admin-student-management-students',
  'admin-teacher-management-list',
  'admin-clerk-management-list',
  'admin-employee-management-list',
  'admin-employee-designations',
  'admin-finance-class-ledgers',
  'admin-finance-alumni-pending',
  'admin-communication-messages',
]);

const BACK_OFFICE_ONLY_NAMESPACES = new Set([
  'admin-employee-management-list',
  'admin-employee-designations',
  'admin-teacher-management-list',
  'admin-clerk-management-list',
  'admin-finance-class-ledgers',
  'admin-finance-alumni-pending',
]);

const KNOWN_ROLES = ['admin', 'clerk', 'student', 'teacher', 'employee'];
const STUDENT_NAMESPACE = 'admin-student-management-students';

const isBackOfficeOnlyNamespace = (namespace) =>
  BACK_OFFICE_ONLY_NAMESPACES.has(namespace) ||
  /^admin-(?:finance|employee|teacher|clerk)(?:-|$)/.test(String(namespace || ''));

const normalizeClassName = (value) => String(value || '').trim().toLowerCase();

export const getAssignedClassNames = (auth = {}) => {
  const classes = [
    ...(Array.isArray(auth.allottedClasses) ? auth.allottedClasses : []),
    auth.assignedClassTeacherFor,
  ]
    .map((item) =>
      typeof item === 'object' && item
        ? item.className || item.name || item.class
        : item
    )
    .map(normalizeClassName)
    .filter(Boolean);

  return new Set(classes);
};

export const filterModuleStateValue = (role, namespace, value, auth = {}) => {
  if (role !== 'teacher' || namespace !== STUDENT_NAMESPACE) return value;

  const assignedClasses = getAssignedClassNames(auth);
  if (!Array.isArray(value)) return [];

  return value.filter((student) => {
    const className =
      student?.className ||
      student?.class ||
      student?.targetClass ||
      student?.rawProfile?.targetClass;
    return assignedClasses.has(normalizeClassName(className));
  });
};

export const canReadModuleState = (role, namespace) => {
  if (
    isBackOfficeOnlyNamespace(namespace) &&
    !['admin', 'clerk'].includes(role)
  ) {
    return false;
  }

  if (
    ['student', 'employee'].includes(role) &&
    STUDENT_BLOCKED_NAMESPACES.has(namespace)
  ) {
    return false;
  }

  // Employee API access is limited to this one module-state endpoint.
  if (role === 'employee' && namespace !== 'admin-notices-list') {
    return false;
  }

  return true;
};

export const getModuleStateReadableRoles = (namespace) =>
  KNOWN_ROLES.filter((role) => canReadModuleState(role, namespace));
