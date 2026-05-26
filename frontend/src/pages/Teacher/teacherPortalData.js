import { compareClassNames, sortClassNames } from '../../components/common/masterData';
import { getSessionTeacherProfile } from '../../components/common/portalProfiles';
import {
  getTeacherAllowedClasses,
  readAssignments,
} from '../../components/common/assignmentStore';
import {
  getStudentsForClass,
  getSubjectsForClass,
  getTeacherExamAssignments,
  readExaminationState,
} from '../../components/common/examinationStore';

const hashText = (value = '') =>
  value.split('').reduce((total, char) => total + char.charCodeAt(0), 0);

const fallbackNameFromUsername = (username = '') =>
  username
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

export const getTeacherProfile = (session = {}) => {
  const profile = getSessionTeacherProfile(session);
  const username = (profile.username || session.username || '').trim().toUpperCase();
  const displayName = profile.displayName || session.displayName || fallbackNameFromUsername(username);

  return {
    ...profile,
    username,
    displayName,
    designation: profile.designation || 'Faculty',
    department: profile.department || 'Not assigned',
    qualification: profile.qualification || 'Not updated',
    employeeId: profile.employeeId || username,
    phone: profile.phone || profile.mobile || 'Not updated',
    email: profile.email || 'Not updated',
    joiningDate: profile.joiningDate || 'Not updated',
    dob: profile.dob || 'Not updated',
    gender: profile.gender || 'Not updated',
    bloodGroup: profile.bloodGroup || 'Not updated',
    address: profile.address || 'Not updated',
    classTeacherFor: profile.classTeacherFor || '',
    emergencyContact: profile.emergencyContact || 'Not updated',
    allottedClasses: sortClassNames(getTeacherAllowedClasses({ ...session, username, allottedClasses: profile.allottedClasses })),
  };
};

const getSectionForClass = (className = '', index = 0) => {
  const number = Number(String(className).replace(/\D/g, '')) || index + 1;
  return number % 2 === 0 ? 'B' : 'A';
};

export const getTeacherClassSections = (session = {}) => {
  const profile = getTeacherProfile(session);

  return sortClassNames(profile.allottedClasses).map((className, index) => {
    const classTeacherSection = profile.classTeacherFor.startsWith(className)
      ? profile.classTeacherFor.split('-').pop()
      : '';
    const section = classTeacherSection || getSectionForClass(className, index);
    const roster = getStudentsForClass(className);
    const examAssignments = getTeacherExamAssignments(session).filter(
      (item) => item.className === className
    );
    const subjects = examAssignments.length
      ? examAssignments.map((item) => item.subject)
      : getSubjectsForClass(className).slice(0, 2).map((item) => item.subject);

    return {
      id: `${className}-${section}`,
      className,
      section,
      label: `${className}-${section}`,
      room: `Room ${200 + index + 1}`,
      students: roster.length,
      subjects,
      classTeacher: profile.classTeacherFor === `${className}-${section}`,
    };
  });
};

export const getTeacherSubjectLoad = (session = {}) => {
  const assignments = [...getTeacherExamAssignments(session)].sort(
    (a, b) => compareClassNames(a.className, b.className)
  );
  const fallbackClasses = getTeacherClassSections(session);

  if (!assignments.length) {
    return fallbackClasses.flatMap((item) =>
      item.subjects.map((subject) => ({
        className: item.className,
        section: item.section,
        subject,
        room: item.room,
        weeklyPeriods: 5,
        syllabusProgress: 64 + (hashText(`${item.className}${subject}`) % 25),
      }))
    );
  }

  return assignments.map((item, index) => ({
    className: item.className,
    section: getSectionForClass(item.className, index),
    subject: item.subject,
    room: `Room ${201 + index}`,
    weeklyPeriods: 4 + (hashText(`${item.className}${item.subject}`) % 3),
    syllabusProgress: 62 + (hashText(`${item.subject}${item.className}`) % 29),
  }));
};

export const getTeacherTimetable = (session = {}) => {
  const load = getTeacherSubjectLoad(session);
  if (!load.length) return [];
  const dayPlan = [
    ['1', '08:30 - 09:10'],
    ['2', '09:10 - 09:50'],
    ['3', '09:50 - 10:30'],
    ['4', '10:45 - 11:25'],
    ['5', '11:25 - 12:05'],
  ];

  return dayPlan.map(([period, time], index) => {
    const item = load[index % Math.max(load.length, 1)] || {};

    return {
      period,
      time,
      className: item.className || 'Not assigned',
      section: item.section || '',
      subject: item.subject || 'Not assigned',
      room: item.room || `Room ${201 + index}`,
    };
  });
};

export const getTeacherRoster = (session = {}, className = '') => {
  const firstClass = getTeacherClassSections(session)[0]?.className || '';
  const selectedClass = className || firstClass;

  return getStudentsForClass(selectedClass).map((student, index) => ({
    ...student,
    attendanceStatus: index % 7 === 0 ? 'Late' : index % 5 === 0 ? 'Absent' : 'Present',
    lastScore: 68 + ((hashText(student.admissionNumber) + index) % 28),
    notebookStatus: index % 4 === 0 ? 'Pending' : 'Checked',
  }));
};

export const getTeacherAttendanceRows = (session = {}) => {
  const sections = getTeacherClassSections(session);

  return sections.map((section, index) => {
    const total = section.students || getStudentsForClass(section.className).length;
    const absent = (hashText(section.id) + index) % 3;
    const late = (hashText(section.className) + index) % 2;
    const present = Math.max(total - absent, 0);

    return {
      ...section,
      total,
      present,
      absent,
      late,
      percentage: total ? Math.round((present / total) * 100) : 0,
    };
  });
};

export const getTeacherMetrics = (session = {}) => {
  const profile = getTeacherProfile(session);
  const sections = getTeacherClassSections(session);
  const load = getTeacherSubjectLoad(session);
  const attendance = getTeacherAttendanceRows(session);
  const state = readExaminationState();
  const assignments = readAssignments();
  const classNames = sections.map((item) => item.className);
  const pendingPapers = state.papers.filter(
    (paper) =>
      paper.status === 'teacher_review' &&
      (paper.teacherUsername === profile.username ||
        paper.teacherName === profile.displayName ||
        classNames.includes(paper.className))
  ).length;
  const activeAssignments = assignments.filter((assignment) =>
    assignment.targetClasses?.some((className) => classNames.includes(className))
  ).length;

  return {
    classes: sections.length,
    subjects: new Set(load.map((item) => item.subject)).size,
    students: sections.reduce((total, item) => total + item.students, 0),
    periodsToday: getTeacherTimetable(session).length,
    attendanceAverage: attendance.length
      ? Math.round(
          attendance.reduce((total, row) => total + row.percentage, 0) / attendance.length
        )
      : 0,
    pendingPapers,
    activeAssignments,
    classTeacherFor: profile.classTeacherFor,
  };
};

export const getTeacherNotices = (session = {}) => {
  const sections = getTeacherClassSections(session);
  const firstLabel = sections[0]?.label || 'assigned class';

  return [
    {
      id: 'notice-teacher-1',
      title: 'Monthly attendance register closing',
      scope: 'Faculty',
      date: 'May 24, 2026',
      priority: 'High',
      body: 'Attendance registers for May must be reviewed before the office exports the monthly report.',
    },
    {
      id: 'notice-teacher-2',
      title: `${firstLabel} notebook verification`,
      scope: firstLabel,
      date: 'May 25, 2026',
      priority: 'Normal',
      body: 'Submit the checked notebook count and pending student list to the academic coordinator.',
    },
    {
      id: 'notice-teacher-3',
      title: 'Assessment blueprint update',
      scope: 'Examination',
      date: 'May 27, 2026',
      priority: 'Normal',
      body: 'Subject teachers should review the SA-1 blueprint before paper analysis opens next week.',
    },
  ];
};

export const getTeacherMeetings = (session = {}) => {
  const profile = getTeacherProfile(session);
  const sections = getTeacherClassSections(session);

  return [
    {
      id: 'meet-teacher-1',
      title: 'Faculty review huddle',
      owner: 'Academic Coordinator',
      date: 'May 25, 2026',
      time: '09:45 AM',
      mode: 'Staff Room',
      scope: profile.department,
      agenda: 'Attendance, assignment completion, and SA-1 preparation.',
    },
    {
      id: 'meet-teacher-2',
      title: `${sections[0]?.label || 'assigned class'} parent interaction`,
      owner: profile.displayName,
      date: 'May 27, 2026',
      time: '10:30 AM',
      mode: 'On Campus',
      scope: sections[0]?.label || 'assigned class',
      agenda: 'Discuss student progress, pending notebooks, and classroom conduct.',
    },
    {
      id: 'meet-teacher-3',
      title: 'Question paper moderation',
      owner: 'Examination Cell',
      date: 'June 1, 2026',
      time: '12:15 PM',
      mode: 'Conference Room',
      scope: 'Subject Teachers',
      agenda: 'Review submitted papers and route corrections before final approval.',
    },
  ];
};

export const getTeacherMessages = (session = {}) => {
  const profile = getTeacherProfile(session);
  const sections = getTeacherClassSections(session);

  return [
    {
      id: 'msg-teacher-1',
      from: 'Academic Coordinator',
      title: 'SA-1 readiness check',
      body: `${profile.displayName}, please confirm the syllabus coverage for ${sections[0]?.label || 'your class'} by tomorrow morning.`,
      time: 'Today, 10:15 AM',
      tag: 'Academic',
    },
    {
      id: 'msg-teacher-2',
      from: 'Admin Office',
      title: 'Leave request queue',
      body: 'Two student leave requests are waiting for class teacher review in the leave module.',
      time: 'Today, 09:20 AM',
      tag: 'Action',
    },
    {
      id: 'msg-teacher-3',
      from: 'Examination Cell',
      title: 'Paper analysis window',
      body: 'Pending papers assigned to you can be approved or returned from Examination Desk.',
      time: 'Yesterday, 04:40 PM',
      tag: 'Exam',
    },
  ];
};

export const getTeacherDocuments = (session = {}) => {
  const profile = getTeacherProfile(session);
  return (profile.documentsAttached || []).map((name, index) => ({
    name,
    status: 'Uploaded',
    updatedAt: profile.updatedAt || profile.timestamp || `Document ${index + 1}`,
  }));
};
