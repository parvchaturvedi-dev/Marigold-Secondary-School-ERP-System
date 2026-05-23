import { API_BASE_URL, authFetch, withAuthHeaders } from './api';

export const APPLICATION_STORAGE_KEY = 'mgps_erp_applications';
export const APPLICATION_UPDATED_EVENT = 'mgps-erp-applications-updated';

const APPLICATION_API_URL = `${API_BASE_URL}/applications`;
const CLASS_APPROVAL_THRESHOLD = 80;

export const APPLICATION_CATEGORIES = [
  'General Problem',
  'Infrastructure Problem',
  'Violence / Safety Concern',
  'Event / Farewell',
  'Resource Request',
  'Discipline Concern',
  'Other',
];

export const STATUS_LABELS = {
  collecting_consensus: 'Collecting Class Consent',
  pending: 'Pending Admin Review',
  approved: 'Approved',
  rejected: 'Rejected',
  replied: 'Replied',
};

export const getDemoIdentity = (session) => {
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
        },
      ],
    };
  }

  if (role === 'teacher') {
    return {
      isSiblingAccount: false,
      members: [{ id: username || 'teacher', name: session?.displayName || username || 'Teacher', className: 'Academic Staff' }],
    };
  }

  return {
    isSiblingAccount: false,
    members: [{ id: username || role, name: session?.displayName || username || role, className: 'Office Desk' }],
  };
};

export const formatApplicationDate = (dateValue) => {
  if (!dateValue) return 'Not available';
  return new Date(dateValue).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const getConsensusMetrics = (application) => {
  const votes = application?.votes || [];
  const acceptedCount = votes.filter((vote) => vote.decision === 'in').length;
  const rejectedCount = votes.filter((vote) => vote.decision === 'out').length;
  const totalClassMembers = Number(application?.totalClassMembers) || 0;
  const consensusPercent = totalClassMembers
    ? Math.round((acceptedCount / totalClassMembers) * 100)
    : 0;

  return {
    acceptedCount,
    rejectedCount,
    totalClassMembers,
    consensusPercent,
    isReadyForAdmin: consensusPercent >= CLASS_APPROVAL_THRESHOLD,
  };
};

let applicationCache = [];

export const readApplications = () => applicationCache;

const writeApplications = (applications) => {
  applicationCache = Array.isArray(applications) ? applications : [];
};

const broadcastApplicationUpdate = () => {
  window.dispatchEvent(new Event(APPLICATION_UPDATED_EVENT));
};

const getLocalApplicationsForSession = (session, selectedIdentity) => {
  const applications = readApplications();

  if (session?.role === 'admin') {
    return applications.filter((application) => application.status !== 'collecting_consensus');
  }

  if (session?.role === 'student') {
    return applications.filter(
      (application) =>
        (application.senderUsername === session?.username &&
          (!selectedIdentity?.id ||
            !application.senderIdentityId ||
            application.senderIdentityId === selectedIdentity.id ||
            application.senderIdentity === selectedIdentity.name)) ||
        (application.audienceMode === 'all-class' &&
          application.status === 'collecting_consensus' &&
          application.targetClassName === selectedIdentity?.className)
    );
  }

  return applications.filter((application) => application.senderUsername === session?.username);
};

const mapApiApplication = (application) => ({
  ...application,
  votes: application.votes || [],
});

export const fetchApplications = async (session, selectedIdentity) => {
  try {
    const params = new URLSearchParams({
      role: session?.role || '',
      username: session?.username || '',
      className: selectedIdentity?.className || '',
      identityId: selectedIdentity?.id || '',
    });

    const response = await authFetch(`${APPLICATION_API_URL}?${params.toString()}`);

    if (response.ok) {
      const applications = (await response.json()).map(mapApiApplication);
      writeApplications(applications);
      return applications;
    }
  } catch (error) {
    alert(`Application sync failed: ${error.message}`);
    return getLocalApplicationsForSession(session, selectedIdentity);
  }

  return getLocalApplicationsForSession(session, selectedIdentity);
};

export const createApplication = async (payload) => {
  try {
    const response = await authFetch(APPLICATION_API_URL, {
      method: 'POST',
      headers: withAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const application = mapApiApplication(await response.json());
      writeApplications([application, ...readApplications().filter((item) => item.id !== application.id)]);
      broadcastApplicationUpdate();
      return application;
    }
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Application could not be saved.');
  } catch (error) {
    alert(`Application save failed: ${error.message}`);
    return null;
  }
};

export const voteOnApplication = async ({ applicationId, username, name, decision }) => {
  try {
    const response = await authFetch(`${APPLICATION_API_URL}/${applicationId}/vote`, {
      method: 'PATCH',
      headers: withAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ username, name, decision }),
    });

    if (response.ok) {
      const application = mapApiApplication(await response.json());
      writeApplications(readApplications().map((item) => (item.id === application.id ? application : item)));
      broadcastApplicationUpdate();
      return application;
    }
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Vote could not be saved.');
  } catch (error) {
    alert(`Application vote failed: ${error.message}`);
    return null;
  }
};

export const adminActionApplication = async ({ applicationId, action, reply, adminUsername }) => {
  try {
    const response = await authFetch(`${APPLICATION_API_URL}/${applicationId}/admin-action`, {
      method: 'PATCH',
      headers: withAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ action, reply, adminUsername }),
    });

    if (response.ok) {
      const application = mapApiApplication(await response.json());
      writeApplications(readApplications().map((item) => (item.id === application.id ? application : item)));
      broadcastApplicationUpdate();
      return application;
    }
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Admin action could not be saved.');
  } catch (error) {
    alert(`Application action failed: ${error.message}`);
    return null;
  }
};
