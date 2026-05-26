import { getActiveStudentProfile, normalizeStudentProfile } from '../../components/common/portalProfiles';
import { getStudentsForClass, getSubjectsForClass } from '../../components/common/examinationStore';

const hasValue = (value) => value !== undefined && value !== null && value !== '';

const pickNumber = (value, fallback) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const hashText = (value = '') =>
  String(value).split('').reduce((total, char) => total + char.charCodeAt(0), 0);

const getClassNumber = (student) =>
  Number(String(student?.className || '').replace(/\D/g, '')) || 9;

export const getPortalStudent = (session) =>
  getActiveStudentProfile(session) ||
  normalizeStudentProfile({
    id: session?.username || 'student',
    displayName: session?.displayName || session?.username || 'Student',
  });

export const getClassLabel = (student) =>
  [student.className, student.section].filter(Boolean).join('-') || 'Class not assigned';

export const getStudentMetrics = (student) => {
  const seed = hashText(student.admissionNumber || student.id);
  const attendance = 82 + (seed % 13);
  const assignmentCompletion = 72 + (seed % 21);
  const examAverage = 76 + (seed % 18);
  const presentDays = Math.round((attendance / 100) * 142);

  return {
    attendance: pickNumber(student.attendance, attendance),
    assignmentCompletion: pickNumber(student.assignmentCompletion, assignmentCompletion),
    examAverage: pickNumber(student.examAverage, examAverage),
    feePaid: !pickNumber(student.pendingFees, seed % 3 === 0 ? 8500 : 0),
    presentDays: pickNumber(student.presentDays, presentDays),
    workingDays: pickNumber(student.workingDays, 142),
    pendingAssignments: pickNumber(student.pendingAssignments, Math.max(1, 5 - (seed % 5))),
    libraryBooks: pickNumber(student.libraryBooks, 1 + (seed % 3)),
    behaviorScore: pickNumber(student.behaviorScore, 8 + (seed % 3)),
  };
};

export const getSubjectPlan = (student) => {
  if (student.subjectPlan?.length) return student.subjectPlan;

  return getSubjectsForClass(student.className).map((item, index) => ({
    subject: item.subject,
    teacher: item.teacherName || 'Not assigned',
    progress: pickNumber(item.progress, 0),
    order: index + 1,
  }));
};

export const getAttendanceRows = (student) => {
  if (student.attendanceRows?.length) return student.attendanceRows;

  const seed = hashText(student.id || student.admissionNumber);
  const months = ['January', 'February', 'March', 'April', 'May'];

  return months.map((month, index) => {
    const workingDays = 22 + ((seed + index) % 3);
    const absent = (seed + index) % 4;

    return {
      month,
      workingDays,
      present: workingDays - absent,
      absent,
      late: (seed + index) % 2,
    };
  });
};

export const getClassRoster = (student) => {
  if (student.classRoster?.length) return student.classRoster;

  const roster = getStudentsForClass(student.className);
  return (roster.length ? roster : [student]).sort(
    (a, b) => Number(a.rollNo || 99) - Number(b.rollNo || 99)
  );
};

export const getTimetable = (student) => {
  if (student.timetable?.length) return student.timetable;

  const subjects = getSubjectPlan(student);

  return [
    { period: '1', time: '08:30 - 09:10', subject: subjects[0]?.subject || 'Not assigned', room: 'Not assigned' },
    { period: '2', time: '09:10 - 09:50', subject: subjects[1]?.subject || 'Not assigned', room: 'Not assigned' },
    { period: '3', time: '09:50 - 10:30', subject: subjects[2]?.subject || 'Not assigned', room: 'Not assigned' },
    { period: '4', time: '10:45 - 11:25', subject: subjects[3]?.subject || 'Not assigned', room: 'Not assigned' },
    { period: '5', time: '11:25 - 12:05', subject: subjects[4]?.subject || 'Not assigned', room: 'Not assigned' },
  ].filter((row) => row.subject !== 'Not assigned' || subjects.length === 0);
};

export const getExamRecords = (student) => {
  if (student.examRecords?.length) return student.examRecords;

  const seed = hashText(student.admissionNumber);
  const subjects = getSubjectPlan(student).slice(0, 5);

  return subjects.map((item, index) => {
    const marks = 68 + ((seed + index * 7) % 27);

    return {
      subject: item.subject,
      teacher: item.teacher,
      marks,
      grade: marks >= 90 ? 'A+' : marks >= 80 ? 'A' : marks >= 70 ? 'B+' : 'B',
      remark: marks >= 80 ? 'Strong' : 'Needs revision',
    };
  });
};

export const getNotices = (student) => {
  if (student.notices?.length) return student.notices;

  return [
    {
      id: 'notice-1',
      title: 'Final Practical File Submission',
      scope: getClassLabel(student),
      date: 'May 24, 2026',
      body: 'Subject notebooks and practical files must be submitted before the morning assembly.',
    },
    {
      id: 'notice-2',
      title: 'Parent Teacher Meeting',
      scope: getClassLabel(student),
      date: 'May 27, 2026',
      body: 'Class teacher will discuss attendance, assignment completion, and examination preparation.',
    },
    {
      id: 'notice-3',
      title: 'Summer Uniform Advisory',
      scope: 'All Students',
      date: 'May 30, 2026',
      body: 'Students should carry water bottles and follow summer uniform guidelines from Monday.',
    },
  ];
};

export const getMessages = (student) => {
  if (student.messages?.length) return student.messages;

  return [
    {
      id: 'msg-1',
      from: 'Class Teacher',
      title: `${student.displayName} progress note`,
      body: 'Notebook checking is mostly complete. Please revise the marked questions before Monday.',
      time: 'Today, 10:30 AM',
    },
    {
      id: 'msg-2',
      from: 'Accounts Desk',
      title: 'Fee ledger update',
      body: 'Transport and tuition ledger has been updated for the current quarter.',
      time: 'Yesterday, 04:15 PM',
    },
    {
      id: 'msg-3',
      from: 'Library',
      title: 'Book return reminder',
      body: 'Please return or renew issued library books before the weekly library period.',
      time: 'May 21, 2026',
    },
  ];
};

export const getMeetings = (student) => {
  if (student.meetings?.length) return student.meetings;

  return [
    {
      id: 'meet-1',
      title: 'Parent Teacher Meeting',
      owner: 'Class Teacher',
      date: 'May 27, 2026',
      time: '10:30 AM',
      mode: 'On Campus',
      scope: getClassLabel(student),
    },
    {
      id: 'meet-2',
      title: 'Career Guidance Interaction',
      owner: 'Academic Coordinator',
      date: 'June 3, 2026',
      time: '11:45 AM',
      mode: 'Auditorium',
      scope: getClassNumber(student) >= 9 ? student.className : 'Senior Students',
    },
  ];
};

export const getFeeSummary = (student) => {
  const seed = hashText(student.admissionNumber);
  const generatedAnnual = 42000 + (seed % 8) * 1000;
  const annual = pickNumber(student.annualFees, generatedAnnual);
  const concession = pickNumber(student.feeConcession, seed % 4 === 0 ? 2500 : 0);
  const payable = pickNumber(student.payableFees, Math.max(annual - concession, 0));
  const generatedPaid = seed % 3 === 0 ? payable - 8500 : payable;
  const paidAmount = Math.max(0, Math.min(pickNumber(student.paidFees, generatedPaid), payable));
  const pending = Math.max(0, payable - paidAmount);

  return {
    annual,
    concession,
    payable,
    paid: paidAmount,
    pending,
    nextDueDate: hasValue(student.nextFeeDueDate)
      ? student.nextFeeDueDate
      : pending === 0
        ? 'No dues'
        : 'June 10, 2026',
    status: pending === 0 ? 'Clear' : 'Pending',
  };
};

export const getFeeInstallments = (student) => {
  if (student.feeInstallments?.length) return student.feeInstallments;

  const summary = getFeeSummary(student);
  const quarters = [
    { id: 'q1', term: 'Quarter 1', months: 'April - June', dueDate: 'April 10, 2026' },
    { id: 'q2', term: 'Quarter 2', months: 'July - September', dueDate: 'July 10, 2026' },
    { id: 'q3', term: 'Quarter 3', months: 'October - December', dueDate: 'October 10, 2026' },
    { id: 'q4', term: 'Quarter 4', months: 'January - March', dueDate: 'January 10, 2027' },
  ];

  let remainingPaid = summary.paid;

  return quarters.map((quarter, index) => {
    const baseAmount = Math.floor(summary.payable / quarters.length);
    const amount =
      index === quarters.length - 1
        ? summary.payable - baseAmount * (quarters.length - 1)
        : baseAmount;
    const paid = Math.min(amount, Math.max(remainingPaid, 0));
    remainingPaid -= paid;

    return {
      ...quarter,
      amount,
      paid,
      balance: amount - paid,
      status: amount - paid === 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Due',
    };
  });
};

export const getPaymentHistory = (student) => {
  if (student.paymentHistory?.length) return student.paymentHistory;

  return getFeeInstallments(student)
    .filter((installment) => installment.paid > 0)
    .map((installment, index) => ({
      id: `receipt-${installment.id}`,
      receiptNo: `MGPS/FEE/26-${String(hashText(student.id) + index).padStart(4, '0').slice(-4)}`,
      date: index === 0 ? 'April 8, 2026' : 'May 12, 2026',
      head: installment.term,
      amount: installment.paid,
      mode: index % 2 === 0 ? 'UPI' : 'Card',
      status: installment.balance ? 'Part Paid' : 'Paid',
    }));
};

export const getTransportDetails = (student) => {
  if (!student.busRoute || String(student.busRoute).toLowerCase() === 'self') {
    return {
      route: 'Self',
      pickupPoint: 'Not opted',
      pickupTime: 'Not applicable',
      vehicleNo: 'Not assigned',
      driver: 'Not assigned',
      contact: 'Not assigned',
    };
  }

  const seed = hashText(student.busRoute);

  return {
    route: student.busRoute,
    pickupPoint: student.pickupPoint || (seed % 2 === 0 ? 'Main Road Stop' : 'Community Gate'),
    pickupTime: student.pickupTime || (seed % 2 === 0 ? '07:15 AM' : '07:25 AM'),
    vehicleNo: student.vehicleNo || `RJ14 SC ${4200 + (seed % 300)}`,
    driver: student.driver || (seed % 2 === 0 ? 'Mahesh Singh' : 'Ramesh Yadav'),
    contact: student.transportContact || (seed % 2 === 0 ? '9829001122' : '9829001133'),
  };
};

export const getLibraryRecords = (student) => {
  if (student.libraryRecords?.length) return student.libraryRecords;

  const seed = hashText(student.admissionNumber);

  return [
    {
      id: 'book-1',
      title: getClassNumber(student) >= 9 ? 'Concepts of Physics' : 'Science Explorer',
      issueDate: 'May 10, 2026',
      dueDate: 'May 31, 2026',
      status: 'Issued',
      fine: 0,
    },
    {
      id: 'book-2',
      title: seed % 2 === 0 ? 'The Blue Umbrella' : 'Wings of Fire',
      issueDate: 'May 3, 2026',
      dueDate: 'May 24, 2026',
      status: seed % 3 === 0 ? 'Due Soon' : 'Issued',
      fine: seed % 3 === 0 ? 20 : 0,
    },
  ];
};

export const getDocumentStatus = (student) => {
  if (student.documents?.length) return student.documents;

  const optionalVerified = hashText(student.id) % 2 === 0;

  return [
    { id: 'photo', name: 'Student Photo', status: 'Verified', updatedOn: 'April 2, 2026' },
    { id: 'aadhaar', name: 'Aadhaar Card', status: 'Verified', updatedOn: 'April 2, 2026' },
    { id: 'birth', name: 'Birth Certificate', status: 'Verified', updatedOn: 'April 3, 2026' },
    {
      id: 'marksheet',
      name: 'Previous Marksheet',
      status: optionalVerified ? 'Verified' : 'Review',
      updatedOn: optionalVerified ? 'April 4, 2026' : 'Pending office review',
    },
  ];
};

export const getStudentActionItems = (student) => {
  if (student.actionItems?.length) return student.actionItems;

  const feeSummary = getFeeSummary(student);
  const libraryRecords = getLibraryRecords(student);
  const notices = getNotices(student);
  const meetings = getMeetings(student);
  const items = [
    {
      id: 'assignment',
      label: 'Assignment notebook review',
      meta: 'Science and Mathematics',
      status: 'Today',
    },
    {
      id: 'notice',
      label: notices[0]?.title || 'School notice',
      meta: notices[0]?.date || 'This week',
      status: 'Notice',
    },
    {
      id: 'meeting',
      label: meetings[0]?.title || 'Scheduled meeting',
      meta: meetings[0] ? `${meetings[0].date}, ${meetings[0].time}` : 'Upcoming',
      status: 'Meeting',
    },
  ];

  if (feeSummary.pending > 0) {
    items.push({
      id: 'fee',
      label: 'Fee balance pending',
      meta: `Due by ${feeSummary.nextDueDate}`,
      status: 'Fee',
    });
  }

  const dueLibraryBook = libraryRecords.find((record) => record.status === 'Due Soon');
  if (dueLibraryBook) {
    items.push({
      id: 'library',
      label: `${dueLibraryBook.title} return`,
      meta: `Due ${dueLibraryBook.dueDate}`,
      status: 'Library',
    });
  }

  return items;
};
