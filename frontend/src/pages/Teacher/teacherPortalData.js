import { getUserProfile } from '../../components/common/auth';
import { compareClassNames, sortClassNames } from '../../components/common/masterData';
import {
  getTeacherAllowedClasses,
  readAssignments,
} from '../../components/common/assignmentStore';
import {
  getStudentsForClass,
  getSubjectsForClass,
  getTeacherExamAssignments,
  readExaminationState,
  teacherDirectory,
} from '../../components/common/examinationStore';

const hashText = (value = '') =>
  value.split('').reduce((total, char) => total + char.charCodeAt(0), 0);

const teacherNamesByUsername = Object.fromEntries(
  Object.entries(teacherDirectory).map(([name, username]) => [username, name])
);

const teacherProfiles = {
  'TCH-501': {
    displayName: 'Dr. Ramesh Verma',
    designation: 'Senior Mathematics Faculty',
    department: 'Science & Mathematics',
    qualification: 'Ph.D. Mathematics, M.Sc.',
    employeeId: 'MGPS-TCH-501',
    phone: '9829005010',
    email: 'ramesh.verma@mgps.edu.in',
    joiningDate: '2018-04-02',
    dob: '1984-09-12',
    gender: 'Male',
    bloodGroup: 'B+',
    address: 'Vaishali Nagar, Jaipur',
    classTeacherFor: 'Class 10-A',
    emergencyContact: '9829005011',
  },
  'TCH-502': {
    displayName: 'Mrs. Sunita Sharma',
    designation: 'Primary & Middle School Faculty',
    department: 'Foundational Academics',
    qualification: 'M.Sc., B.Ed.',
    employeeId: 'MGPS-TCH-502',
    phone: '9829005020',
    email: 'sunita.sharma@mgps.edu.in',
    joiningDate: '2019-07-15',
    dob: '1988-01-21',
    gender: 'Female',
    bloodGroup: 'O+',
    address: 'Mansarovar, Jaipur',
    classTeacherFor: 'Class 6-B',
    emergencyContact: '9829005021',
  },
  'TCH-503': {
    displayName: 'Mrs. Kavita Rao',
    designation: 'English Faculty',
    department: 'Languages',
    qualification: 'M.A. English, B.Ed.',
    employeeId: 'MGPS-TCH-503',
    phone: '9829005030',
    email: 'kavita.rao@mgps.edu.in',
    joiningDate: '2020-06-08',
    dob: '1987-05-18',
    gender: 'Female',
    bloodGroup: 'A+',
    address: 'C-Scheme, Jaipur',
    classTeacherFor: 'Class 9-A',
    emergencyContact: '9829005031',
  },
};

const fallbackNameFromUsername = (username = '') =>
  username
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

export const getTeacherProfile = (session = {}) => {
  const username = (session.username || 'TCH-501').trim().toUpperCase();
  const authProfile = getUserProfile(username, 'teacher');
  const configuredProfile = teacherProfiles[username] || {};
  const displayName =
    configuredProfile.displayName ||
    teacherNamesByUsername[username] ||
    session.displayName ||
    authProfile.displayName ||
    fallbackNameFromUsername(username);

  return {
    username,
    displayName,
    designation: configuredProfile.designation || 'Faculty Member',
    department: configuredProfile.department || 'Academic Department',
    qualification: configuredProfile.qualification || 'B.Ed., Graduate',
    employeeId: configuredProfile.employeeId || `MGPS-${username}`,
    phone: configuredProfile.phone || 'Not updated',
    email:
      configuredProfile.email ||
      `${username.toLowerCase().replace(/[^a-z0-9]/g, '.')}@mgps.edu.in`,
    joiningDate: configuredProfile.joiningDate || '2021-04-01',
    dob: configuredProfile.dob || '1985-01-01',
    gender: configuredProfile.gender || 'Not updated',
    bloodGroup: configuredProfile.bloodGroup || 'Not updated',
    address: configuredProfile.address || 'Registered residential address',
    classTeacherFor: configuredProfile.classTeacherFor || 'Class 9-A',
    emergencyContact: configuredProfile.emergencyContact || 'Not updated',
    allottedClasses: sortClassNames(getTeacherAllowedClasses({ ...session, username })),
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
      className: item.className || 'Class 9',
      section: item.section || 'A',
      subject: item.subject || 'General',
      room: item.room || `Room ${201 + index}`,
    };
  });
};

export const getTeacherRoster = (session = {}, className = '') => {
  const firstClass = getTeacherClassSections(session)[0]?.className || 'Class 9';
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
  const firstLabel = sections[0]?.label || 'Class 9-A';

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
      title: `${sections[0]?.label || 'Class 9-A'} parent interaction`,
      owner: profile.displayName,
      date: 'May 27, 2026',
      time: '10:30 AM',
      mode: 'On Campus',
      scope: sections[0]?.label || 'Class 9-A',
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

export const getTeacherDocuments = () => [
  { name: 'Appointment Letter', status: 'Verified', updatedAt: 'Apr 10, 2026' },
  { name: 'Qualification Certificates', status: 'Verified', updatedAt: 'Apr 12, 2026' },
  { name: 'Identity Proof', status: 'Verified', updatedAt: 'Apr 15, 2026' },
  { name: 'Bank Details', status: 'Pending Review', updatedAt: 'May 18, 2026' },
];
