import { API_BASE_URL, authFetch, withAuthHeaders } from './api';

export const LEAVE_REQUEST_STORAGE_KEY = 'mgps_erp_leave_requests';
export const LEAVE_REQUEST_UPDATED_EVENT = 'mgps-erp-leave-requests-updated';
const LEAVE_REQUEST_API_URL = `${API_BASE_URL}/leave-requests`;

export const LEAVE_STATUS = {
  pendingAdmin: 'pending_admin',
  pendingClassTeacher: 'pending_class_teacher',
  forwardedAdmin: 'forwarded_admin',
  approvedByAdmin: 'approved_by_admin',
  rejectedByAdmin: 'rejected_by_admin',
  approvedByTeacher: 'approved_by_teacher',
  rejectedByTeacher: 'rejected_by_teacher',
};

export const LEAVE_STATUS_LABELS = {
  [LEAVE_STATUS.pendingAdmin]: 'Pending at Admin',
  [LEAVE_STATUS.pendingClassTeacher]: 'Pending at Class Teacher',
  [LEAVE_STATUS.forwardedAdmin]: 'Forwarded to Admin',
  [LEAVE_STATUS.approvedByAdmin]: 'Approved by Admin',
  [LEAVE_STATUS.rejectedByAdmin]: 'Rejected by Admin',
  [LEAVE_STATUS.approvedByTeacher]: 'Approved by Class Teacher',
  [LEAVE_STATUS.rejectedByTeacher]: 'Rejected by Class Teacher',
};

export const TERMINAL_LEAVE_STATUSES = [
  LEAVE_STATUS.approvedByAdmin,
  LEAVE_STATUS.rejectedByAdmin,
  LEAVE_STATUS.approvedByTeacher,
  LEAVE_STATUS.rejectedByTeacher,
];

export const getLeaveDemoIdentity = (session) => {
  const username = session?.username || '';
  const role = session?.role || 'student';

  if (role === 'student' && session?.activeStudent) {
    return {
      isSiblingAccount: Boolean(session.isSiblingAccount),
      members: (session.studentProfiles?.length ? session.studentProfiles : [session.activeStudent]).map(
        (student) => ({
          id: student.id,
          name: student.displayName,
          className: student.className,
          metaInfo: `${student.className || 'Class'}${student.section ? `-${student.section}` : ''}${
            student.rollNo ? ` - Roll ${student.rollNo}` : ''
          }`,
        })
      ),
    };
  }

  if (role === 'student') {
    return {
      isSiblingAccount: false,
      members: [
        {
          id: username || 'student',
          name: session?.displayName || username || 'Student',
          className: session?.className || '',
          metaInfo: session?.className || '',
        },
      ],
    };
  }

  if (role === 'teacher') {
    return {
      isSiblingAccount: false,
      members: [
        {
          id: username || 'teacher',
          name: session?.displayName || username || 'Teacher',
          className: session?.allottedClasses?.[0] || '',
          metaInfo: session?.allottedClasses?.length
            ? `Classes: ${session.allottedClasses.join(', ')}`
            : 'Teacher',
        },
      ],
    };
  }

  if (role === 'clerk') {
    return {
      isSiblingAccount: false,
      members: [
        {
          id: username || 'clerk',
          name: session?.displayName || username || 'Clerk',
          className: 'Office Desk',
          metaInfo: 'Main Office Desk',
        },
      ],
    };
  }

  return {
    isSiblingAccount: false,
    members: [
      {
        id: username || 'admin',
        name: session?.displayName || username || 'Admin',
        className: 'Admin Office',
        metaInfo: 'Admin Office',
      },
    ],
  };
};

export const formatLeaveDate = (dateValue) => {
  if (!dateValue) return 'Not selected';

  return new Date(`${dateValue}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const getLeaveDurationLabel = (request) => {
  if (!request?.startDate) return 'Not selected';

  if (request.leaveMode === 'multiple') {
    const startDate = new Date(`${request.startDate}T00:00:00`);
    const endDate = new Date(`${request.endDate}T00:00:00`);
    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.max(1, Math.round((endDate - startDate) / dayMs) + 1);

    return `${formatLeaveDate(request.startDate)} to ${formatLeaveDate(request.endDate)} (${totalDays} Days)`;
  }

  return `${formatLeaveDate(request.startDate)} (1 Day)`;
};

const broadcastLeaveRequestUpdate = () => {
  window.dispatchEvent(new Event(LEAVE_REQUEST_UPDATED_EVENT));
};

let leaveRequestCache = [];

const writeLeaveRequests = (requests) => {
  leaveRequestCache = Array.isArray(requests) ? requests : [];
};

export const readLeaveRequests = () => leaveRequestCache;

export const getLeaveRequestsForSession = (session, selectedIdentity) => {
  const requests = readLeaveRequests();

  if (session?.role === 'admin') {
    return requests;
  }

  if (session?.role === 'teacher') {
    return requests.filter(
      (request) =>
        request.applicantUsername === session?.username ||
        request.classTeacherUsername === session?.username ||
        request.className === selectedIdentity?.className
    );
  }

  if (session?.role === 'student') {
    return requests.filter(
      (request) =>
        request.applicantUsername === session?.username &&
        (!selectedIdentity?.id ||
          !request.applicantIdentityId ||
          request.applicantIdentityId === selectedIdentity.id ||
          request.applicantIdentity === selectedIdentity.name)
    );
  }

  return requests.filter((request) => request.applicantUsername === session?.username);
};

export const fetchLeaveRequests = async (session, selectedIdentity) => {
  try {
    const params = new URLSearchParams({
      role: session?.role || '',
      username: session?.username || '',
      identityId: selectedIdentity?.id || '',
      identityName: selectedIdentity?.name || '',
      className: selectedIdentity?.className || '',
    });

    const response = await authFetch(`${LEAVE_REQUEST_API_URL}?${params.toString()}`);

    if (response.ok) {
      const requests = await response.json();
      writeLeaveRequests(requests);
      broadcastLeaveRequestUpdate();
      return requests;
    }

    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Leave requests could not be loaded.');
  } catch (error) {
    alert(`Leave request sync failed: ${error.message}`);
    return getLeaveRequestsForSession(session, selectedIdentity);
  }
};

export const createLeaveRequest = async (payload) => {
  try {
    const response = await authFetch(LEAVE_REQUEST_API_URL, {
      method: 'POST',
      headers: withAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const request = await response.json();
      writeLeaveRequests([request, ...readLeaveRequests().filter((item) => item.id !== request.id)]);
      broadcastLeaveRequestUpdate();
      return request;
    }

    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Leave request could not be saved.');
  } catch (error) {
    alert(`Leave request save failed: ${error.message}`);
    return null;
  }
};

export const adminActionLeaveRequest = async ({ requestId, action, adminUsername }) => {
  try {
    const response = await authFetch(`${LEAVE_REQUEST_API_URL}/${requestId}/admin-action`, {
      method: 'PATCH',
      headers: withAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ action, adminUsername }),
    });

    if (response.ok) {
      const updatedRequest = await response.json();
      writeLeaveRequests(
        readLeaveRequests().map((request) =>
          request.id === updatedRequest.id ? updatedRequest : request
        )
      );
      broadcastLeaveRequestUpdate();
      return updatedRequest;
    }

    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Leave request action could not be saved.');
  } catch (error) {
    alert(`Leave request action failed: ${error.message}`);
    return null;
  }
};

export const teacherActionLeaveRequest = async ({ requestId, action, teacherUsername }) => {
  try {
    const response = await authFetch(`${LEAVE_REQUEST_API_URL}/${requestId}/teacher-action`, {
      method: 'PATCH',
      headers: withAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ action, teacherUsername }),
    });

    if (response.ok) {
      const updatedRequest = await response.json();
      writeLeaveRequests(
        readLeaveRequests().map((request) =>
          request.id === updatedRequest.id ? updatedRequest : request
        )
      );
      broadcastLeaveRequestUpdate();
      return updatedRequest;
    }

    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Leave request action could not be saved.');
  } catch (error) {
    alert(`Leave request action failed: ${error.message}`);
    return null;
  }
};
