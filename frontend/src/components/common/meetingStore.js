import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL, authFetch, withAuthHeaders } from './api';
import { getTeacherAllowedClasses } from './assignmentStore';
import { getClassName, sortClassNames, useMasterData } from './masterData';

export const MEETINGS_UPDATED_EVENT = 'mgps-erp-meetings-updated';
const MEETINGS_API_URL = `${API_BASE_URL}/meetings`;

const fallbackStudents = [
  {
    id: 'STD-301',
    displayName: 'Parv Choudhary',
    admissionNumber: 'MGPS-2026-301',
    className: 'Class 9',
    section: 'A',
    rollNo: 11,
  },
  {
    id: 'STD-302',
    displayName: 'Ananya Sharma',
    admissionNumber: 'MGPS-2026-302',
    className: 'Class 9',
    section: 'A',
    rollNo: 14,
  },
  {
    id: 'STD-303',
    displayName: 'Kabir Malhotra',
    admissionNumber: 'MGPS-2026-303',
    className: 'Class 9',
    section: 'B',
    rollNo: 18,
  },
  {
    id: 'STD-501',
    displayName: 'Meera Singh',
    admissionNumber: 'MGPS-2026-501',
    className: 'Class 6',
    section: 'B',
    rollNo: 6,
  },
  {
    id: 'STD-701',
    displayName: 'Aarav Sharma',
    admissionNumber: 'MGPS-2026-701',
    className: 'Class 8',
    section: 'A',
    rollNo: 8,
  },
];

export const normalizeMeetingClass = (className = '') => String(className || '').trim();

export const createJitsiRoomName = ({ title, className, hostUsername }) => {
  const slug = [title, className, hostUsername, Date.now()]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);

  return `mgps-erp-${slug || Date.now()}`;
};

export const getMeetingIdentity = (session = {}) => ({
  role: session.role || '',
  username: session.username || '',
  displayName: session.displayName || session.accountDisplayName || session.username || 'MGPS User',
});

export const getMeetingClassesForRole = (session = {}, classNames = []) => {
  if (session.role === 'teacher') {
    const assignedClasses = getTeacherAllowedClasses(session);
    return sortClassNames(
      classNames.length
        ? assignedClasses.filter((className) => classNames.includes(className))
        : assignedClasses
    );
  }

  return sortClassNames(classNames);
};

export const canHostClassMeeting = (session = {}, className = '') => {
  if (session.role === 'admin' || session.role === 'clerk') return true;
  if (session.role !== 'teacher') return false;
  return getTeacherAllowedClasses(session).includes(normalizeMeetingClass(className));
};

export const getMeetingAudienceLabel = (meeting = {}) => {
  if (meeting.scopeType === 'school') return 'Entire School';
  if (meeting.scopeType === 'staff') return 'Staff Meeting';
  return (meeting.targetClasses || []).join(', ') || 'Class Meeting';
};

export const getMeetingInviteClasses = (meeting = {}, classNames = []) => {
  if (meeting.scopeType === 'school') return classNames;
  if (meeting.scopeType === 'class') return meeting.targetClasses || [];
  return [];
};

export const isMeetingForClass = (meeting = {}, className = '') => {
  const normalizedClass = normalizeMeetingClass(className);
  if (!normalizedClass) return false;
  if (meeting.scopeType === 'school') return true;
  return (meeting.targetClasses || []).includes(normalizedClass);
};

export const isMeetingForStudent = (meeting = {}, student = {}) => {
  if (!meeting || meeting.status === 'ended') return false;
  if (meeting.scopeType === 'staff') return false;
  return isMeetingForClass(meeting, student.className);
};

export const getStudentMeetingStatus = (meeting = {}, student = {}) => {
  const studentId = student.id || student.admissionNumber;
  return meeting.attendance?.[studentId]?.status || 'absent';
};

export const useMeetingDirectory = () => {
  const masterData = useMasterData();

  const students = useMemo(() => {
    const source = masterData.students.length ? masterData.students : fallbackStudents;
    return source.map((student, index) => ({
      ...student,
      id: student.id || student.admissionNumber || `student-${index + 1}`,
      displayName: student.displayName || student.name || `Student ${index + 1}`,
      admissionNumber: student.admissionNumber || student.id || '',
      className: student.className || student.class || '',
      section: student.section || '',
      rollNo: student.rollNo || index + 1,
    }));
  }, [masterData.students]);

  const classNames = useMemo(() => {
    return sortClassNames((masterData.raw?.classRecords || []).map(getClassName).filter(Boolean));
  }, [masterData.raw]);

  const staff = useMemo(() => {
    if (masterData.teachers.length) return masterData.teachers;

    return [
      { id: 'TCH-501', name: 'Dr. Ramesh Verma', role: 'Teacher' },
      { id: 'TCH-502', name: 'Mrs. Sunita Sharma', role: 'Teacher' },
      { id: 'CLK-201', name: 'Amit Sharma', role: 'Clerk' },
      { id: 'ADM-101', name: 'Principal Office', role: 'Admin' },
    ];
  }, [masterData.teachers]);

  return {
    ...masterData,
    classNames,
    students,
    staff,
  };
};

export const getStudentsForMeeting = (meeting = {}, students = [], classNames = []) => {
  const inviteClasses = getMeetingInviteClasses(meeting, classNames);
  if (!inviteClasses.length) return [];

  return students.filter((student) => inviteClasses.includes(student.className));
};

const getMeetingQuery = (session = {}) => {
  const activeStudent = session.activeStudent || session.studentProfiles?.[0] || {};
  const params = new URLSearchParams({
    role: session.role || '',
    username: session.username || '',
    className: activeStudent.className || session.className || '',
    allottedClasses: getTeacherAllowedClasses(session).join(','),
    status: 'ongoing',
  });

  return params.toString();
};

export const useMeetingsDatabase = (session = {}) => {
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMeetings = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await authFetch(`${MEETINGS_API_URL}?${getMeetingQuery(session)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Meetings could not be loaded.');
      setMeetings(Array.isArray(payload) ? payload : []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  useEffect(() => {
    window.addEventListener(MEETINGS_UPDATED_EVENT, loadMeetings);
    return () => window.removeEventListener(MEETINGS_UPDATED_EVENT, loadMeetings);
  }, [loadMeetings]);

  const createMeeting = useCallback(
    async (meeting) => {
      const response = await authFetch(MEETINGS_API_URL, {
        method: 'POST',
        headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...meeting,
          allottedClasses: getTeacherAllowedClasses(session),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Meeting could not be created.');
      setMeetings((prev) => [payload, ...prev.filter((item) => item.id !== payload.id)]);
      return payload;
    },
    [session]
  );

  const updateAttendance = useCallback(async (meetingId, entry) => {
    const response = await authFetch(`${MEETINGS_API_URL}/${meetingId}/attendance`, {
      method: 'PATCH',
      headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status: entry.status, entry }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.message || 'Attendance could not be updated.');
    setMeetings((prev) => prev.map((item) => (item.id === payload.id ? payload : item)));
    return payload;
  }, []);

  const endMeeting = useCallback(async (meetingId) => {
    const response = await authFetch(`${MEETINGS_API_URL}/${meetingId}/end`, {
      method: 'PATCH',
      headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.message || 'Meeting could not be ended.');
    setMeetings((prev) => prev.filter((item) => item.id !== payload.id));
    return payload;
  }, []);

  return {
    meetings,
    isLoading,
    error,
    createMeeting,
    updateAttendance,
    endMeeting,
    reloadMeetings: loadMeetings,
  };
};
