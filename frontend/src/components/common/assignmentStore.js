import { getUserProfile } from './auth';
import { API_BASE_URL, authFetch, withAuthHeaders } from './api';
import { sortClassNames } from './masterData';

export const ASSIGNMENT_STORAGE_KEY = 'mgps_erp_assignments';
export const ASSIGNMENT_UPDATED_EVENT = 'mgps-erp-assignments-updated';

const ASSIGNMENTS_API_URL = `${API_BASE_URL}/assignments`;

export const SCHOOL_CLASSES = [
  'Nursery',
  'LKG',
  'UKG',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
];

let assignmentCache = [];

const broadcastAssignmentUpdate = () => {
  window.dispatchEvent(new Event(ASSIGNMENT_UPDATED_EVENT));
};

export const readAssignments = () => assignmentCache;

const writeAssignments = (assignments) => {
  assignmentCache = Array.isArray(assignments) ? assignments : [];
};

const isCheckingLocked = (checkingDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(checkingDate);
  deadline.setHours(0, 0, 0, 0);
  return deadline < today;
};

export const enrichAssignment = (assignment) => ({
  ...assignment,
  isLocked: isCheckingLocked(assignment.checkingDate),
});

const toFormData = (payload) => {
  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('description', payload.description);
  formData.append('subject', payload.subject || 'General');
  formData.append('targetClasses', JSON.stringify(payload.targetClasses || []));
  formData.append('checkingDate', payload.checkingDate || '');
  formData.append('createdByRole', payload.createdByRole || '');
  formData.append('createdByUsername', payload.createdByUsername || '');
  formData.append('createdByName', payload.createdByName || '');
  formData.append('actorRole', payload.actorRole || payload.createdByRole || '');
  formData.append('actorUsername', payload.actorUsername || payload.createdByUsername || '');
  formData.append('actorName', payload.actorName || payload.createdByName || '');
  formData.append('removeAttachment', String(payload.removeAttachment || false));

  if (payload.attachmentFile) {
    formData.append('attachment', payload.attachmentFile);
  }

  return formData;
};

export const getAssignmentIdentity = (session = {}) => {
  const profile = getUserProfile(session?.username || '', session?.role || '');
  const activeStudent = session?.activeStudent || profile.studentProfile || {};
  const children = session?.studentProfiles?.length
    ? session.studentProfiles
    : profile.children;

  return {
    ...profile,
    displayName: session?.displayName || profile.displayName,
    allottedClasses: session?.allottedClasses?.length
      ? sortClassNames(session.allottedClasses)
      : profile.allottedClasses || [],
    className:
      activeStudent.className ||
      session?.className ||
      profile.className ||
      '',
    section:
      activeStudent.section ||
      session?.section ||
      profile.section ||
      '',
    admissionNumber:
      activeStudent.admissionNumber ||
      session?.admissionNumber ||
      profile.admissionNumber ||
      '',
    fatherName:
      activeStudent.fatherName ||
      session?.fatherName ||
      profile.fatherName ||
      '',
    children,
    studentProfile: activeStudent.id ? activeStudent : profile.studentProfile,
  };
};

export const getTeacherAllowedClasses = (session) => {
  const profile = getAssignmentIdentity(session);
  return profile.allottedClasses?.length ? sortClassNames(profile.allottedClasses) : [];
};

export const getStudentOptions = (session) => {
  if (session?.role === 'student' && session?.activeStudent) {
    return [session.activeStudent];
  }

  const profile = getAssignmentIdentity(session);
  if (profile.children?.length) return profile.children;

  return [
    {
      id: 'self',
      displayName: profile.displayName,
      className: profile.className,
      admissionNumber: profile.admissionNumber,
      fatherName: profile.fatherName,
    },
  ];
};

const getLocalAssignmentsForRole = (session, selectedStudent) => {
  const assignments = readAssignments().map(enrichAssignment);

  if (session?.role === 'admin' || session?.role === 'clerk') return assignments;

  if (session?.role === 'student') {
    return assignments.filter((assignment) =>
      assignment.targetClasses.includes(selectedStudent?.className)
    );
  }

  if (session?.role === 'teacher') {
    const allowedClasses = getTeacherAllowedClasses(session);
    return assignments.filter(
      (assignment) =>
        assignment.createdByUsername === session?.username ||
        assignment.targetClasses.some((className) => allowedClasses.includes(className))
    );
  }

  return assignments;
};

export const fetchAssignments = async (session, selectedStudent) => {
  try {
    const profile = getAssignmentIdentity(session);
    const params = new URLSearchParams({
      role: session?.role || '',
      username: session?.username || '',
      className: selectedStudent?.className || profile.className || '',
      allottedClasses: (profile.allottedClasses || []).join(','),
    });

    const response = await authFetch(`${ASSIGNMENTS_API_URL}?${params.toString()}`);

    if (response.ok) {
      const assignments = (await response.json()).map(enrichAssignment);
      writeAssignments(assignments);
      return assignments;
    }
  } catch (error) {
    alert(`Assignment loading failed: ${error.message}`);
    return getLocalAssignmentsForRole(session, selectedStudent);
  }

  return getLocalAssignmentsForRole(session, selectedStudent);
};

export const createAssignment = async (payload) => {
  try {
    const response = await authFetch(ASSIGNMENTS_API_URL, {
      method: 'POST',
      body: toFormData(payload),
    });

    if (response.ok) {
      const assignment = enrichAssignment(await response.json());
      writeAssignments([assignment, ...readAssignments().filter((item) => item.id !== assignment.id)]);
      broadcastAssignmentUpdate();
      return assignment;
    }
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Assignment could not be saved.');
  } catch (error) {
    alert(`Assignment save failed: ${error.message}`);
    return null;
  }

};

export const updateAssignment = async (assignmentId, payload) => {
  try {
    const response = await authFetch(`${ASSIGNMENTS_API_URL}/${assignmentId}`, {
      method: 'PATCH',
      body: toFormData(payload),
    });

    if (response.ok) {
      const assignment = enrichAssignment(await response.json());
      writeAssignments(readAssignments().map((item) => (item.id === assignment.id ? assignment : item)));
      broadcastAssignmentUpdate();
      return assignment;
    }

    if (response.status === 409) {
      alert('Checking date has passed. Assignment is view-only now.');
      return null;
    }
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Assignment could not be updated.');
  } catch (error) {
    alert(`Assignment update failed: ${error.message}`);
    return null;
  }

};

export const extendAssignmentDate = async (assignmentId, payload) => {
  try {
    const response = await authFetch(`${ASSIGNMENTS_API_URL}/${assignmentId}/checking-date`, {
      method: 'PATCH',
      headers: withAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const assignment = enrichAssignment(await response.json());
      writeAssignments(readAssignments().map((item) => (item.id === assignment.id ? assignment : item)));
      broadcastAssignmentUpdate();
      return assignment;
    }

    if (response.status === 409) {
      alert('Checking date has passed. Assignment is view-only now.');
      return null;
    }
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Checking date could not be extended.');
  } catch (error) {
    alert(`Checking date update failed: ${error.message}`);
    return null;
  }

};

export const formatAssignmentDateTime = (dateValue) => {
  if (!dateValue) return 'Not recorded';
  return new Date(dateValue).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatCheckingDate = (dateValue) => {
  if (!dateValue) return 'No date';
  return new Date(dateValue).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};
