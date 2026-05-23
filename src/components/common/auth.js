import { apiFetch } from './api';

export const AUTH_STORAGE_KEY = 'mgps_erp_auth_session';

export const ROLE_DASHBOARD_PATHS = {
  admin: '/admin/dashboard',
  clerk: '/clerk/dashboard',
  student: '/student/dashboard',
  teacher: '/teacher/dashboard',
};

export const VALID_ROLES = Object.keys(ROLE_DASHBOARD_PATHS);

const fallbackNameFromUsername = (username = '') =>
  username
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const normalizeStudent = (student = {}, index = 0) => ({
  id: student.id || student.admissionNumber || `student-${index + 1}`,
  displayName: student.displayName || student.name || `Student ${index + 1}`,
  className: student.className || '',
  section: student.section || '',
  rollNo: student.rollNo || index + 1,
  admissionNumber: student.admissionNumber || '',
  fatherName: student.fatherName || '',
  motherName: student.motherName || '',
  guardianPhone: student.guardianPhone || '',
  guardianEmail: student.guardianEmail || '',
  dob: student.dob || '',
  gender: student.gender || '',
  bloodGroup: student.bloodGroup || '',
  house: student.house || '',
  busRoute: student.busRoute || '',
  address: student.address || '',
  photoDataUrl: student.photoDataUrl || '',
});

const buildFallbackStudent = (username = '') => {
  return normalizeStudent({
    id: username || 'student',
    displayName: fallbackNameFromUsername(username) || 'Student',
  });
};

export const getStudentProfiles = (username = '', role = '') => {
  if (role !== 'student') return [];
  return username ? [buildFallbackStudent(username.trim().toUpperCase())] : [];
};

export const getActiveStudent = (session = {}) => {
  const studentProfiles = session.studentProfiles?.length
    ? session.studentProfiles.map(normalizeStudent)
    : [];

  if (!studentProfiles.length) return null;

  return (
    studentProfiles.find((student) => student.id === session.selectedStudentId) ||
    studentProfiles[0]
  );
};

export const hydrateStudentSession = (session = {}, selectedStudentId = '') => {
  if (session.role !== 'student') return session;

  const studentProfiles = session.studentProfiles?.length
    ? session.studentProfiles.map(normalizeStudent)
    : [];
  const activeStudent =
    studentProfiles.find((student) => student.id === (selectedStudentId || session.selectedStudentId)) ||
    studentProfiles[0] ||
    null;

  return {
    ...session,
    accountDisplayName:
      session.accountDisplayName ||
      session.username,
    displayName: activeStudent?.displayName || session.displayName,
    studentProfiles,
    selectedStudentId: activeStudent?.id || '',
    activeStudent,
    isSiblingAccount: studentProfiles.length > 1,
    photoDataUrl: activeStudent?.photoDataUrl || session.photoDataUrl || '',
  };
};

export const saveStudentSelection = (session, selectedStudentId) => {
  if (!session || session.role !== 'student') return session;

  const nextSession = hydrateStudentSession(session, selectedStudentId);
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
  return nextSession;
};

export const getUserProfile = (username = '', role = '') => {
  const upperUsername = username.trim().toUpperCase();

  if (role === 'student') {
    const studentProfiles = getStudentProfiles(upperUsername, role);
    const firstStudent = studentProfiles[0] || buildFallbackStudent(upperUsername);

    return {
      displayName: firstStudent.displayName,
      children: studentProfiles.length > 1 ? studentProfiles : undefined,
      className: firstStudent.className,
      section: firstStudent.section,
      admissionNumber: firstStudent.admissionNumber,
      fatherName: firstStudent.fatherName,
      studentProfile: firstStudent,
    };
  }

  return {
    displayName: fallbackNameFromUsername(upperUsername),
    allottedClasses: [],
    className: '',
    admissionNumber: '',
    fatherName: '',
  };
};

export const detectRoleFromUsername = (input = '') => {
  const upperInput = input.trim().toUpperCase();

  if (upperInput.startsWith('FAM-') || upperInput.startsWith('STD-')) {
    return {
      id: 'student',
      label: 'Student / Parent Dashboard',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    };
  }

  if (upperInput.startsWith('TCH-')) {
    return {
      id: 'teacher',
      label: 'Academic Faculty Console',
      color: 'text-purple-600 bg-purple-50 border-purple-200',
    };
  }

  if (upperInput.startsWith('CLK-')) {
    return {
      id: 'clerk',
      label: 'Institutional Accounts Desk',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    };
  }

  if (upperInput.startsWith('ADM-')) {
    return {
      id: 'admin',
      label: 'SuperAdmin Kernel System',
      color: 'text-rose-600 bg-rose-50 border-rose-200',
    };
  }

  return {
    id: 'unknown',
    label: 'Secure Identity Gateway',
    color: 'text-neutral-500 bg-neutral-50 border-neutral-200',
  };
};

export const isValidRole = (role) => VALID_ROLES.includes(role);

export const getDashboardPath = (role) => ROLE_DASHBOARD_PATHS[role] || '/login';

export const getStoredSession = () => {
  try {
    const cachedSession = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!cachedSession) return null;

    const parsedSession = JSON.parse(cachedSession);
    if (!parsedSession?.username || !isValidRole(parsedSession?.role)) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    const baseSession = {
      ...parsedSession,
      displayName:
        parsedSession.displayName ||
        getUserProfile(parsedSession.username, parsedSession.role).displayName,
    };

    return parsedSession.role === 'student'
      ? hydrateStudentSession(baseSession, parsedSession.selectedStudentId)
      : baseSession;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

export const authenticateUser = async ({ username, password }) =>
  apiFetch('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

export const saveSession = (authPayload) => {
  const { username, role } = authPayload || {};
  if (!username || !isValidRole(role)) return null;

  const normalizedUsername = username.trim().toUpperCase();
  const userProfile = getUserProfile(normalizedUsername, role);

  const session = {
    ...authPayload,
    username: normalizedUsername,
    role,
    displayName: authPayload.displayName || userProfile.displayName,
    accountDisplayName:
      authPayload.accountDisplayName || authPayload.displayName || userProfile.displayName,
    createdAt: authPayload.createdAt || new Date().toISOString(),
  };

  const hydratedSession =
    role === 'student' ? hydrateStudentSession(session) : session;

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(hydratedSession));
  return hydratedSession;
};

export const clearSession = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};
