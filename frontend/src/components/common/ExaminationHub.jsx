import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  AlignLeft,
  Award,
  BarChart3,
  Bold,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Edit3,
  Eye,
  FileText,
  GraduationCap,
  Heading1,
  ImagePlus,
  Italic,
  Layers,
  List,
  Mail,
  MessageCircle,
  PenTool,
  Plus,
  Printer,
  Save,
  Search,
  Send,
  ShieldCheck,
  Underline,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { printReportCard, printReportCardsForClass } from './reportCard';
import { printAdmitCard, printAdmitCardsForClass } from './admitCard';
import BoardExaminationDesk from './BoardExaminationDesk';
import {
  EXAMINATION_UPDATED_EVENT,
  MARKS_ADMIN_UNLOCK_HOURS,
  MARKS_EDIT_LOCK_HOURS,
  PAPER_TYPES,
  addPaperDecision,
  allExamClasses,
  calculateGrade,
  configureExaminationMasterData,
  createExamRecord,
  decideAdminOnPaper,
  enableTeacherMarksEdit,
  ensureStudentInRoster,
  fetchExaminationState,
  formatExamDate,
  formatExamDateTime,
  getActor,
  getExamLabel,
  getFocusRemark,
  getPaperStatusDot,
  getPaperStatusMeta,
  getPrintDocument,
  getReportRowsForStudent,
  getBoardResultForStudent,
  getSavedReportOptionsForStudent,
  getStudentsForClass,
  getSubjectsForClass,
  getTeacherExamAssignments,
  isMarksRecordLocked,
  isBoardClass,
  isBoardFinalExam,
  isTeacherMarksEditUnlocked,
  readExaminationState,
  recordReportDelivery,
  roleCanCreatePapers,
  roleCanEnterMarks,
  roleCanManageExams,
  roleCanManageReportCards,
  savePaperRecord,
  setBoardClassEnabled,
  submitPaperForApproval,
  upsertMarksRecord,
  upsertScheduleRows,
} from './examinationStore';
import { sendGmailMessages } from './gmail';
import { useMasterData } from './masterData';
import { API_BASE_URL, getAuthToken } from './api';

// Paper content is authored in a contentEditable editor and stored as raw HTML in
// shared module state, so it must be sanitized before it is rendered back with
// dangerouslySetInnerHTML — otherwise a malicious author can land a stored XSS on
// every viewer (students included). Strips <script>/<style>, on* handlers, and
// javascript:/data: URLs while preserving the rich formatting the editor emits.
const escapeHtmlText = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeRichHtml = (html = '') => {
  if (typeof window === 'undefined' || !window.DOMParser) return '';
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach((node) => node.remove());
  doc.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || '').replace(/\s+/g, '').toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if (
        (name === 'href' || name === 'src' || name === 'xlink:href') &&
        (value.startsWith('javascript:') || value.startsWith('data:text/html'))
      ) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return doc.body.innerHTML;
};

// Board Result PDFs upload as multipart/form-data. authFetch is JSON-only,
// so the raw fetch is used here — token pulled from the same session store.
const boardResultsApi = {
  async upload({ file, className, examTitle, publishedAt }) {
    const form = new FormData();
    form.append('resultPdf', file);
    form.append('className', className);
    form.append('examTitle', examTitle);
    if (publishedAt) form.append('publishedAt', publishedAt);

    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/examinations/board-results`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || 'Board result upload failed.');
    }
    return payload;
  },
  async fetchPdf(id) {
    const token = getAuthToken();
    const response = await fetch(
      `${API_BASE_URL}/examinations/board-results/${id}/pdf`,
      {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || 'Could not load the board result PDF.');
    }
    return payload;
  },
  async remove(id) {
    const token = getAuthToken();
    const response = await fetch(
      `${API_BASE_URL}/examinations/board-results/${id}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || 'Could not delete the board result.');
    }
    return payload;
  },
};

// state.boardResults[] holds two record shapes:
//   1. per-student legacy uploads (studentId/admissionNumber, dataUrl)
//   2. per-class PDF uploads from POST /board-results (pdfName + examTitle)
// The Board Results section below shows only the class-level rows.
const isClassBoardResult = (record) =>
  Boolean(record?.pdfName) && !record?.studentId && !record?.admissionNumber;

const openBoardResultPdf = async (id) => {
  try {
    const payload = await boardResultsApi.fetchPdf(id);
    const nextWindow = window.open('', '_blank');
    if (nextWindow) nextWindow.location.href = payload.dataUrl;
  } catch (error) {
    alert(error.message);
  }
};

const formatBoardResultDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const SECTION_BY_PAGE = {
  Examinations: '',
  'Exam Creation': 'exam-creation',
  'Paper Creation': 'paper-creation',
  'Paper Analysis': 'paper-analysis',
  'Paper Selected': 'paper-selected',
  'Report Card Management': 'report-card-management',
  'Marks Management': 'marks-management',
};

const PAGE_BY_SECTION = {
  'exam-creation': 'Exam Creation',
  'paper-creation': 'Paper Creation',
  'paper-analysis': 'Paper Analysis',
  'paper-selected': 'Paper Selected',
  'report-card-management': 'Report Card Management',
  'marks-management': 'Marks Management',
};

const TAB_CONFIG = {
  'exam-creation': { label: 'Exam Creation', icon: Plus },
  'paper-creation': { label: 'Paper Creation', icon: PenTool },
  'paper-analysis': { label: 'Paper Analysis', icon: Search },
  'paper-selected': { label: 'Paper Selected', icon: ClipboardCheck },
  'report-card-management': { label: 'Report Card Management', icon: FileText },
  'marks-management': { label: 'Marks Management', icon: BarChart3 },
};

const ROLE_SECTIONS = {
  admin: [
    'exam-creation',
    'paper-creation',
    'paper-analysis',
    'paper-selected',
    'report-card-management',
    'marks-management',
  ],
  clerk: [
    'exam-creation',
    'paper-creation',
    'paper-analysis',
    'paper-selected',
    'report-card-management',
    'marks-management',
  ],
  teacher: ['paper-analysis', 'marks-management'],
  student: ['student-report'],
};

const getDefaultSection = (role) => ROLE_SECTIONS[role]?.[0] || 'exam-creation';

const getTodayInputValue = () => new Date().toISOString().slice(0, 10);

const classNames = (...items) => items.filter(Boolean).join(' ');
const getReportOptionKey = (option) => `${option?.examId || ''}__${option?.className || ''}`;

const buildPaperTemplate = (examName, className, subject, type) => `
  <h1 style="text-align:center;margin:0;">Marigold Public School</h1>
  <p style="text-align:center;margin:4px 0 16px;"><strong>${examName} Examination</strong></p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
    <tbody>
      <tr>
        <td style="border:1px solid #222;padding:8px;"><strong>Class:</strong> ${className}</td>
        <td style="border:1px solid #222;padding:8px;"><strong>Subject:</strong> ${subject}</td>
      </tr>
      <tr>
        <td style="border:1px solid #222;padding:8px;"><strong>Paper Type:</strong> ${type}</td>
        <td style="border:1px solid #222;padding:8px;"><strong>Maximum Marks:</strong> 80</td>
      </tr>
    </tbody>
  </table>
  <p><strong>General Instructions:</strong></p>
  <ol>
    <li>Read the question paper carefully.</li>
    <li>Answer all questions in neat handwriting.</li>
    <li>Draw diagrams wherever required.</li>
  </ol>
  <h2>Section A</h2>
  <p>Q1. Write short answers.</p>
  <p><br></p>
  <h2>Section B</h2>
  <p>Q2. Attempt long answer questions.</p>
`;

const openPrintWindow = (title, bodyHtml) => {
  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) {
    alert('Please allow popups to print this document.');
    return;
  }

  printWindow.document.write(getPrintDocument(title, bodyHtml));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'ST';

const buildAdmitCardHtml = (exam, className, students, scheduleRows) =>
  students
    .map(
      (student) => `
        <div class="page">
          <div style="display:flex;justify-content:space-between;gap:18px;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:16px;">
            <div>
              <h1>Marigold Public School</h1>
              <p class="muted">${getExamLabel(exam)} Admit Card | ${exam?.academicYear || '2026-27'}</p>
              <h2>${student.displayName}</h2>
              <p>Class ${className} - Section ${student.section || 'A'} | Roll No. ${student.rollNo}</p>
            </div>
            <div class="photo">${getInitials(student.displayName)}</div>
          </div>
          <table>
            <tbody>
              <tr><th>Admission No.</th><td>${student.admissionNumber}</td><th>Father</th><td>${student.fatherName}</td></tr>
              <tr><th>Mother</th><td>${student.motherName}</td><th>Mobile</th><td>${student.guardianPhone}</td></tr>
              <tr><th>Address</th><td colspan="3">${student.address}</td></tr>
            </tbody>
          </table>
          <h3 style="margin-top:18px;">Exam Schedule</h3>
          <table>
            <thead><tr><th>Subject</th><th>Date</th><th>Time</th></tr></thead>
            <tbody>
              ${scheduleRows
                .map(
                  (row) =>
                    `<tr><td>${row.subject}</td><td>${formatExamDate(row.date)}</td><td>${row.startTime || '-'} to ${row.endTime || '-'}</td></tr>`
                )
                .join('')}
            </tbody>
          </table>
          <div style="display:flex;justify-content:space-between;margin-top:48px;">
            <p>Student Signature</p>
            <p>Controller of Examination</p>
          </div>
        </div>
      `
    )
    .join('');

const buildReportCardHtml = (state, exam, students) =>
  students
    .map((student) => {
      const rows = getReportRowsForStudent(state, student, exam?.id);
      const total = rows.reduce((sum, row) => sum + Number(row.marks || 0), 0);
      const maxTotal = rows.reduce((sum, row) => sum + Number(row.maxMarks || 0), 0);
      const percentage = maxTotal ? Math.round((total / maxTotal) * 100) : 0;

      return `
        <div class="page">
          <h1>Marigold Public School</h1>
          <p class="muted">${getExamLabel(exam)} Report Card | ${exam?.academicYear || '2026-27'}</p>
          <table>
            <tbody>
              <tr><th>Name</th><td>${student.displayName}</td><th>Admission No.</th><td>${student.admissionNumber}</td></tr>
              <tr><th>Class</th><td>${student.className}-${student.section || 'A'}</td><th>Roll No.</th><td>${student.rollNo}</td></tr>
              <tr><th>Father</th><td>${student.fatherName}</td><th>Mother</th><td>${student.motherName}</td></tr>
            </tbody>
          </table>
          <h3 style="margin-top:18px;">Subject Performance</h3>
          <table>
            <thead><tr><th>Subject</th><th>Marks</th><th>Grade</th><th>Remark</th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (row) =>
                    `<tr><td>${row.subject}</td><td>${row.marks}/${row.maxMarks}</td><td>${row.grade}</td><td>${row.remark}</td></tr>`
                )
                .join('')}
            </tbody>
          </table>
          <h2 style="margin-top:18px;">Overall: ${percentage}%</h2>
          <p>${percentage >= 75 ? 'Strong result. Keep revision regular.' : 'Needs focused study in low-scoring subjects.'}</p>
          <div style="display:flex;justify-content:space-between;margin-top:48px;">
            <p>Class Teacher</p>
            <p>Principal</p>
          </div>
        </div>
      `;
    })
    .join('');

const ExaminationHub = ({ role = 'admin', session, activePage = 'Examinations', setActivePage }) => {
  const masterData = useMasterData();
  const {
    classNames: masterClassNames,
    students: masterStudents,
    teachers: masterTeachers,
    subjectsByClass: masterSubjectsByClass,
  } = masterData;
  const [state, setState] = useState(() => readExaminationState());
  const [localSection, setLocalSection] = useState(getDefaultSection(role));
  const [paperToEdit, setPaperToEdit] = useState(null);
  // Top-level desk: 'school' (regular exams for every class) vs 'board' (board
  // classes' final exam — external centre, admin/clerk only). Teachers never see board.
  const canAccessBoardDesk = role === 'admin' || role === 'clerk';
  const [desk, setDesk] = useState('school');
  const routeSection = SECTION_BY_PAGE[activePage];
  const visibleSections = ROLE_SECTIONS[role] || ROLE_SECTIONS.admin;
  const activeSection =
    role === 'student'
      ? 'student-report'
      : routeSection && visibleSections.includes(routeSection)
        ? routeSection
        : localSection && visibleSections.includes(localSection)
          ? localSection
          : getDefaultSection(role);

  useEffect(() => {
    let isActive = true;
    const refreshState = () => {
      fetchExaminationState().then((latestState) => {
        if (isActive) setState(latestState);
      });
    };
    window.addEventListener(EXAMINATION_UPDATED_EVENT, refreshState);
    return () => {
      isActive = false;
      window.removeEventListener(EXAMINATION_UPDATED_EVENT, refreshState);
    };
  }, []);

  useEffect(() => {
    fetchExaminationState().then(setState);
  }, []);

  useEffect(() => {
    configureExaminationMasterData({
      classNames: masterClassNames,
      students: masterStudents,
      teachers: masterTeachers,
      subjectsByClass: masterSubjectsByClass,
    });
  }, [masterClassNames, masterStudents, masterTeachers, masterSubjectsByClass]);

  const actor = useMemo(() => getActor(role, session), [role, session]);

  const navigateSection = (section) => {
    setLocalSection(section);
    const pageName = PAGE_BY_SECTION[section];
    if (pageName && setActivePage) setActivePage(pageName);
  };

  const refreshWith = (nextState) => {
    setState(nextState || readExaminationState());
  };

  const handleReworkPaper = (paper) => {
    setPaperToEdit(paper);
    navigateSection('paper-creation');
  };

  if (role === 'student') {
    return <StudentExamView state={state} session={session} />;
  }

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900">
      <style>{`
        .input-shell {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(255,255,255,0.8);
          background: rgba(255,255,255,0.6);
          padding: 0.75rem;
          outline: none;
        }
        .exam-word-editor img {
          max-width: 100%;
          height: auto;
          margin: 10px 0;
        }
        .exam-word-editor:focus {
          outline: 2px solid rgba(139, 92, 246, 0.28);
          outline-offset: 4px;
        }
      `}</style>
      <section className="glass-card rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#8b5cf6]" /> Examination Desk
            </h2>
            <p className="text-xs font-bold text-slate-400 mt-1">
              Paper workflow, approvals, admit cards, marks entry, and report cards.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 min-w-full xl:min-w-[620px]">
            <SummaryStat label="Exams" value={state.exams.length} icon={CalendarDays} tone="bg-[#FFF8EC] text-[#f59e0b]" />
            <SummaryStat label="Pending Papers" value={state.papers.filter((paper) => paper.status !== 'selected').length} icon={Clock} tone="bg-amber-50 text-amber-700" />
            <SummaryStat label="Selected" value={state.papers.filter((paper) => paper.status === 'selected').length} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-700" />
            <SummaryStat label="Marks Lists" value={state.marks.length} icon={BarChart3} tone="bg-blue-50 text-blue-700" />
          </div>
        </div>

        {canAccessBoardDesk && (
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setDesk('school')}
              className={classNames(
                'flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black transition-all border',
                desk === 'school' ? 'btn-primary border-transparent shadow-sm' : 'bg-white/50 text-slate-500 border-slate-100/80 hover:bg-white/70'
              )}
            >
              <GraduationCap className="w-4 h-4" /> School Examination
            </button>
            <button
              type="button"
              onClick={() => setDesk('board')}
              className={classNames(
                'flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black transition-all border',
                desk === 'board' ? 'btn-primary border-transparent shadow-sm' : 'bg-white/50 text-slate-500 border-slate-100/80 hover:bg-white/70'
              )}
            >
              <Award className="w-4 h-4" /> Board Examination
            </button>
          </div>
        )}

        {desk === 'school' && (
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {visibleSections.map((section) => {
            const tab = TAB_CONFIG[section];
            const Icon = tab.icon;

            return (
              <button
                key={section}
                type="button"
                onClick={() => navigateSection(section)}
                className={classNames(
                  'shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-black transition-all',
                  activeSection === section
                    ? 'btn-primary border-transparent shadow-sm'
                    : 'bg-white/50 text-slate-500 border-slate-100/80 hover:bg-white/70'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
        )}
      </section>

      {desk === 'school' && (
      <>
      {activeSection === 'exam-creation' && (
        <ExamCreationSection state={state} actor={actor} role={role} onRefresh={refreshWith} />
      )}
      {activeSection === 'paper-creation' && (
        <PaperCreationSection
          state={state}
          actor={actor}
          role={role}
          paperToEdit={paperToEdit}
          onConsumedPaperToEdit={() => setPaperToEdit(null)}
          onRefresh={refreshWith}
        />
      )}
      {activeSection === 'paper-analysis' && (
        <PaperAnalysisSection
          state={state}
          actor={actor}
          role={role}
          session={session}
          onRefresh={refreshWith}
          onReworkPaper={handleReworkPaper}
        />
      )}
      {activeSection === 'paper-selected' && <PaperSelectedSection state={state} />}
      {activeSection === 'report-card-management' && (
        <ReportCardManagementSection state={state} role={role} actor={actor} onRefresh={refreshWith} />
      )}
      {activeSection === 'marks-management' && (
        <MarksManagementSection
          state={state}
          actor={actor}
          role={role}
          session={session}
          onRefresh={refreshWith}
        />
      )}
      </>
      )}

      {desk === 'board' && canAccessBoardDesk && (
        <BoardExaminationDesk state={state} role={role} actor={actor} session={session} onRefresh={refreshWith} />
      )}
    </div>
  );
};

const SummaryStat = ({ label, value, icon: Icon, tone }) => (
  <div className="glass-soft rounded-2xl p-3">
    <div className={classNames('w-8 h-8 rounded-xl flex items-center justify-center mb-2', tone)}>
      {React.createElement(Icon, { className: 'w-4 h-4' })}
    </div>
    <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
    <p className="text-lg font-black leading-tight">{value}</p>
  </div>
);

const ExamCreationSection = ({ state, actor, role, onRefresh }) => {
  const [name, setName] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-27');
  const canManage = roleCanManageExams(role);
  const toggleBoardClass = (className) => {
    const nextState = setBoardClassEnabled(className, !isBoardClass(state, className));
    onRefresh(nextState);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const nextState = createExamRecord({
      name: trimmedName,
      academicYear: academicYear.trim() || '2026-27',
      actor,
    });
    onRefresh(nextState);
    setName('');
  };

  return (
    <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-1 glass-card rounded-3xl p-5 shadow-sm h-fit">
        <h3 className="text-sm font-black flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#8b5cf6]" /> Add Examination
        </h3>
        <p className="text-xs font-semibold text-slate-400 mt-1">
          Admin or clerk can create exam cycles like SA-1, SA-2, Half Yearly.
        </p>

        {canManage ? (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs font-bold">
            <div className="space-y-1">
              <label className="text-slate-500">Name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="SA-1"
                className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-3 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-500">Academic Year</label>
              <input
                value={academicYear}
                onChange={(event) => setAcademicYear(event.target.value)}
                className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-3 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full btn-primary px-4 py-3 text-xs font-black"
            >
              Add Examination
            </button>
          </form>
        ) : (
          <div className="mt-5 rounded-2xl glass-soft p-4 text-xs font-bold text-slate-400">
            Your role can view examination cycles but cannot create new ones.
          </div>
        )}
      </div>

      <div className="xl:col-span-1 glass-card rounded-3xl p-5 shadow-sm h-fit">
        <h3 className="text-sm font-black flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Board Exam Classes
        </h3>
        <p className="text-xs font-semibold text-slate-400 mt-1">
          For selected classes, final internal marks entry is replaced by PDF result upload.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
          {allExamClasses.map((classItem) => {
            const checked = isBoardClass(state, classItem);
            return (
              <button
                key={classItem}
                type="button"
                disabled={!canManage}
                onClick={() => toggleBoardClass(classItem)}
                className={classNames(
                  'rounded-2xl border px-3 py-2 text-left text-xs font-black transition-all disabled:opacity-60',
                  checked
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-white/60 text-slate-500 border-slate-100/80'
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={classNames('h-3 w-3 rounded border', checked ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-white/70')} />
                  {classItem}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="xl:col-span-1 grid grid-cols-1 gap-4">
        {state.exams.map((exam) => {
          const papers = state.papers.filter((paper) => paper.examId === exam.id);
          const selectedPapers = papers.filter((paper) => paper.status === 'selected');

          return (
            <div key={exam.id} className="glass-card rounded-3xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">{exam.academicYear}</p>
                  <h3 className="text-lg font-black mt-1">{getExamLabel(exam)}</h3>
                  <p className="text-xs font-semibold text-slate-400 mt-1">
                    Created by {exam.createdByName} on {formatExamDate(exam.createdAt)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-[#F5F3FF] text-[#8b5cf6] flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <MiniMetric label="Papers" value={papers.length} />
                <MiniMetric label="Selected" value={selectedPapers.length} />
                <MiniMetric label="Marks" value={state.marks.filter((item) => item.examId === exam.id).length} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const MiniMetric = ({ label, value }) => (
  <div className="rounded-2xl glass-soft p-3">
    <p className="text-base font-black">{value}</p>
    <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
  </div>
);

const PaperCreationSection = ({
  state,
  actor,
  role,
  paperToEdit,
  onConsumedPaperToEdit,
  onRefresh,
}) => {
  const canCreate = roleCanCreatePapers(role);
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);
  const [examId, setExamId] = useState(state.exams[0]?.id || '');
  const [className, setClassName] = useState('Class 9');
  const subjects = useMemo(() => getSubjectsForClass(className), [className]);
  const [subject, setSubject] = useState(subjects[0]?.subject || 'English');
  const [type, setType] = useState(PAPER_TYPES[0]);
  const [paperId, setPaperId] = useState('');
  const [title, setTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [previewPaper, setPreviewPaper] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!subjects.some((item) => item.subject === subject)) {
      setSubject(subjects[0]?.subject || '');
    }
  }, [subject, subjects]);

  useEffect(() => {
    if (editorRef.current && isEditorOpen && editorRef.current.innerHTML !== editorContent) {
      editorRef.current.innerHTML = editorContent;
    }
  }, [editorContent, isEditorOpen, paperId]);

  useEffect(() => {
    if (!paperToEdit) return;

    setExamId(paperToEdit.examId);
    setClassName(paperToEdit.className);
    setSubject(paperToEdit.subject);
    setType(paperToEdit.type);
    setPaperId(paperToEdit.id);
    setTitle(paperToEdit.title);
    setEditorContent(paperToEdit.content);
    setIsEditorOpen(true);
    onConsumedPaperToEdit();
  }, [onConsumedPaperToEdit, paperToEdit]);

  const selectedExam = state.exams.find((exam) => exam.id === examId) || state.exams[0];
  const boardFinalSelected = isBoardFinalExam(state, selectedExam, className);
  const reworkPapers = state.papers.filter((paper) =>
    ['draft', 'teacher_rejected', 'admin_rejected'].includes(paper.status)
  );

  const openFreshEditor = () => {
    if (!selectedExam || !className || !subject) {
      alert('Please select examination, class, and subject first.');
      return;
    }
    if (boardFinalSelected) {
      alert('Final internal paper creation is disabled for board exam classes. Upload the final PDF result in Report Card Management.');
      return;
    }

    const nextTitle = `${selectedExam.name} ${className} ${subject} Paper`;
    setPaperId(`PAPER-${Date.now()}`);
    setTitle(nextTitle);
    setEditorContent(buildPaperTemplate(selectedExam.name, className, subject, type));
    setIsEditorOpen(true);
    setNotice('');
  };

  const loadPaper = (paper) => {
    setExamId(paper.examId);
    setClassName(paper.className);
    setSubject(paper.subject);
    setType(paper.type);
    setPaperId(paper.id);
    setTitle(paper.title);
    setEditorContent(paper.content);
    setIsEditorOpen(true);
    setNotice('');
  };

  const runEditorCommand = (command, value = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setEditorContent(editorRef.current?.innerHTML || '');
  };

  const insertImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      editorRef.current?.focus();
      document.execCommand('insertImage', false, reader.result);
      setEditorContent(editorRef.current?.innerHTML || '');
    };
    reader.readAsDataURL(file);
  };

  const persistPaper = (status) => {
    if (!paperId || !title.trim() || !editorContent.trim()) {
      alert('Please create the paper page and write content first.');
      return;
    }
    if (boardFinalSelected) {
      alert('Final internal paper saving is disabled for board exam classes. Upload the final PDF result in Report Card Management.');
      return;
    }

    const nextState = savePaperRecord(
      {
        id: paperId,
        examId: selectedExam.id,
        className,
        subject,
        type,
        title: title.trim(),
        content: editorContent,
        status,
      },
      actor
    );

    onRefresh(nextState);
    setNotice(status === 'teacher_review' ? 'Paper sent to subject teacher for approval.' : 'Draft saved.');
  };

  if (!canCreate) {
    return (
      <EmptyAccess
        icon={PenTool}
        title="Paper creation is available to admin and clerk."
        message="Teachers receive submitted papers in Paper Analysis for approval and correction."
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="glass-card rounded-3xl p-5 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 text-xs font-bold">
          <Field label="Examination">
            <select value={examId} onChange={(event) => setExamId(event.target.value)} className="input-shell">
              {state.exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {getExamLabel(exam)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Class">
            <select value={className} onChange={(event) => setClassName(event.target.value)} className="input-shell">
              {allExamClasses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subject">
            <select value={subject} onChange={(event) => setSubject(event.target.value)} className="input-shell">
              {subjects.map((item) => (
                <option key={item.subject} value={item.subject}>
                  {item.subject}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select value={type} onChange={(event) => setType(event.target.value)} className="input-shell">
              {PAPER_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              onClick={openFreshEditor}
              disabled={boardFinalSelected}
              className="w-full rounded-full btn-primary px-4 py-3 text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" /> Create
            </button>
          </div>
        </div>
        {boardFinalSelected && (
          <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs font-bold text-amber-800">
            {className} is configured as a board exam class. The final exam is managed by PDF result upload instead of internal paper creation.
          </div>
        )}
      </div>

      <style>{`
        .input-shell {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(255,255,255,0.8);
          background: rgba(255,255,255,0.6);
          padding: 0.75rem;
          outline: none;
        }
        .exam-word-editor img {
          max-width: 100%;
          height: auto;
          margin: 10px 0;
        }
        .exam-word-editor:focus {
          outline: 2px solid rgba(139, 92, 246, 0.28);
          outline-offset: 4px;
        }
      `}</style>

      {isEditorOpen && (
        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_320px] gap-6">
          <div className="glass-card rounded-3xl shadow-sm overflow-hidden">
            <div className="border-b border-slate-100/80 bg-white/60 p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="min-w-0 flex-1 rounded-2xl border border-slate-100/80 bg-white px-3 py-2 text-sm font-black outline-none"
              />

              <div className="flex flex-wrap items-center gap-2">
                <EditorButton label="Bold" icon={Bold} onClick={() => runEditorCommand('bold')} />
                <EditorButton label="Italic" icon={Italic} onClick={() => runEditorCommand('italic')} />
                <EditorButton label="Underline" icon={Underline} onClick={() => runEditorCommand('underline')} />
                <EditorButton label="Heading" icon={Heading1} onClick={() => runEditorCommand('formatBlock', 'H2')} />
                <EditorButton label="List" icon={List} onClick={() => runEditorCommand('insertOrderedList')} />
                <EditorButton label="Align left" icon={AlignLeft} onClick={() => runEditorCommand('justifyLeft')} />
                <input ref={fileInputRef} type="file" accept="image/*" onChange={insertImage} className="hidden" />
                <EditorButton label="Insert image" icon={ImagePlus} onClick={() => fileInputRef.current?.click()} />
              </div>
            </div>

            <div className="bg-white/40 p-4 sm:p-8 overflow-x-auto">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(event) => setEditorContent(event.currentTarget.innerHTML)}
                className="exam-word-editor mx-auto min-h-[920px] w-full max-w-[794px] bg-white text-[#111] shadow-xl border border-white/70 p-8 sm:p-12 text-sm leading-7"
              />
            </div>

            <div className="border-t border-slate-100/80 bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <p className="text-xs font-bold text-slate-400">
                {notice || 'Use this Word-style page to compose paper text and insert images.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewPaper({ title, content: editorContent })}
                  className="rounded-full border border-white/70 bg-white px-4 py-2 text-xs font-black flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" /> Preview
                </button>
                <button
                  type="button"
                  onClick={() => persistPaper('draft')}
                  className="rounded-full bg-white/60 border border-white/70 px-4 py-2 text-xs font-black flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => persistPaper('teacher_review')}
                  className="rounded-full btn-primary px-4 py-2 text-xs font-black flex items-center gap-2"
                >
                  <Send className="w-4 h-4" /> Send To Teacher
                </button>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-5 shadow-sm h-fit">
            <h3 className="text-sm font-black">Drafts and Rework Queue</h3>
            <p className="text-xs font-semibold text-slate-400 mt-1">
              Rejected papers can be opened, corrected, and resent.
            </p>
            <div className="mt-4 space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {reworkPapers.map((paper) => (
                <PaperTinyCard key={paper.id} paper={paper} state={state} onClick={() => loadPaper(paper)} />
              ))}
              {!reworkPapers.length && (
                <div className="rounded-2xl glass-soft p-4 text-xs font-bold text-slate-400">
                  No drafts or rejected papers currently.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {previewPaper && <PaperPreviewModal paper={previewPaper} onClose={() => setPreviewPaper(null)} />}
    </section>
  );
};

const Field = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-slate-500">{label}</label>
    {children}
  </div>
);

const EditorButton = ({ label, icon: Icon, onClick }) => (
  <button
    type="button"
    title={label}
    onMouseDown={(event) => {
      event.preventDefault();
      onClick();
    }}
    className="w-9 h-9 rounded-xl border border-white/70 bg-white hover:bg-white/70 flex items-center justify-center"
  >
    {React.createElement(Icon, { className: 'w-4 h-4' })}
  </button>
);

const PaperTinyCard = ({ paper, state, onClick }) => {
  const exam = state.exams.find((item) => item.id === paper.examId);
  const meta = getPaperStatusMeta(paper.status);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-slate-100/80 bg-white/60 p-3 text-left hover:border-[#8b5cf6] transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black truncate">{paper.title}</p>
        <span className={classNames('shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black', meta.tone)}>
          {meta.label}
        </span>
      </div>
      <p className="mt-1 text-[11px] font-bold text-slate-400">
        {getExamLabel(exam)} | {paper.className} | {paper.subject}
      </p>
    </button>
  );
};

const PaperAnalysisSection = ({ state, actor, role, session, onRefresh, onReworkPaper }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [previewPaper, setPreviewPaper] = useState(null);

  const visiblePapers = useMemo(() => {
    let papers = state.papers;

    if (role === 'teacher') {
      const teacherAssignments = getTeacherExamAssignments(session);
      papers = papers.filter(
        (paper) =>
          paper.teacherUsername === session?.username ||
          paper.teacherName === session?.displayName ||
          paper.createdByUsername === session?.username ||
          teacherAssignments.some(
            (assignment) =>
              assignment.className === paper.className && assignment.subject === paper.subject
          )
      );
    } else if (role === 'admin') {
      // Admin sees anything except lingering "not-yet-sent" drafts; keeping
      // "draft" out here matches the existing rich-flow behaviour.
      papers = papers.filter((paper) => paper.status !== 'draft');
    }

    if (statusFilter !== 'all') {
      papers = papers.filter((paper) => paper.status === statusFilter);
    }

    return papers.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [role, session, state.papers, statusFilter]);

  const updateComment = (paperId, value) => {
    setCommentDrafts((prev) => ({ ...prev, [paperId]: value }));
  };

  const decide = (paper, decision, requiresComment = false) => {
    const comment = commentDrafts[paper.id]?.trim() || '';
    if (requiresComment && !comment) {
      alert('Please write a correction comment before rejecting or returning the paper.');
      return;
    }

    const nextState = addPaperDecision(paper.id, decision, actor, comment);
    onRefresh(nextState);
    updateComment(paper.id, '');
  };

  // Simple approval workflow: draft → pending_admin → approved|rejected.
  // Hits the dedicated PATCH endpoints so the server can notify admins/teachers.
  const runWorkflow = async (paper, action) => {
    try {
      if (action === 'submit') {
        const nextState = await submitPaperForApproval(paper.id);
        onRefresh(nextState);
        return;
      }

      if (action === 'approve' || action === 'reject') {
        const comment = commentDrafts[paper.id]?.trim() || '';
        if (action === 'reject' && !comment) {
          alert('Please write a rejection comment before rejecting this paper.');
          return;
        }
        const nextState = await decideAdminOnPaper(
          paper.id,
          action === 'approve' ? 'approved' : 'rejected',
          comment
        );
        onRefresh(nextState);
        updateComment(paper.id, '');
      }
    } catch (error) {
      alert(error.message || 'Workflow action failed.');
    }
  };

  return (
    <section className="space-y-5">
      <div className="glass-card rounded-3xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-black flex items-center gap-2">
            <Search className="w-4 h-4 text-[#8b5cf6]" /> Paper Analysis
          </h3>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            Approval cycle between clerk, subject teacher, and admin.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-xs font-black outline-none"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_admin">Pending admin approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="teacher_review">Pending teacher approval</option>
          <option value="teacher_rejected">Teacher rejected</option>
          <option value="teacher_approved">Teacher approved</option>
          <option value="admin_review">Pending admin approval (legacy)</option>
          <option value="admin_rejected">Admin rejected (legacy)</option>
          <option value="selected">Selected</option>
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {visiblePapers.map((paper) => {
          const exam = state.exams.find((item) => item.id === paper.examId);
          const meta = getPaperStatusMeta(paper.status);
          const comment = commentDrafts[paper.id] || '';

          return (
            <div key={paper.id} className="glass-card rounded-3xl p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="min-w-0">
                  <span
                    className={classNames(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black',
                      meta.tone
                    )}
                  >
                    <span
                      className={classNames('h-2 w-2 rounded-full', getPaperStatusDot(paper.status))}
                    />
                    {meta.label}
                  </span>
                  <h3 className="mt-3 text-base font-black truncate">{paper.title}</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1">
                    {getExamLabel(exam)} | {paper.className} | {paper.subject} | Revision {paper.revision || 1}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewPaper(paper)}
                  className="rounded-full border border-white/70 px-3 py-2 text-xs font-black flex items-center gap-2 self-start"
                >
                  <Eye className="w-4 h-4" /> Preview
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-bold">
                <InfoPill label="Teacher" value={paper.teacherName} />
                <InfoPill label="Creator" value={paper.createdByName} />
                <InfoPill label="Updated" value={formatExamDateTime(paper.updatedAt)} />
                <InfoPill label="Status" value={meta.description} />
              </div>

              <div className="mt-4 rounded-2xl glass-soft p-3">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Workflow Comments</p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {(paper.comments || []).length ? (
                    paper.comments.map((item) => (
                      <div key={item.id} className="bg-white border border-slate-100/80 rounded-xl p-2">
                        <p className="text-[11px] font-black">
                          {item.action} by {item.actorName}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-400">{item.comment || 'No comment added.'}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] font-bold text-slate-400">No comments yet.</p>
                  )}
                </div>
              </div>

              {(role === 'admin' && paper.status === 'pending_admin') ||
              (role !== 'clerk' && paper.status !== 'selected' && !['approved', 'rejected', 'pending_admin'].includes(paper.status)) ? (
                <textarea
                  value={comment}
                  onChange={(event) => updateComment(paper.id, event.target.value)}
                  placeholder={
                    paper.status === 'pending_admin'
                      ? 'Optional comment on approve, required to reject...'
                      : 'Write mistake/correction comment...'
                  }
                  rows={3}
                  className="mt-4 w-full rounded-2xl border border-white/70 bg-white/60 p-3 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
                />
              ) : null}

              <PaperActionBar
                paper={paper}
                role={role}
                onDecision={(decision, requiresComment) => decide(paper, decision, requiresComment)}
                onWorkflow={(action) => runWorkflow(paper, action)}
                onRework={() => onReworkPaper(paper)}
              />
            </div>
          );
        })}

        {!visiblePapers.length && (
          <div className="xl:col-span-2">
            <EmptyAccess
              icon={ClipboardList}
              title="No papers found"
              message="No papers are currently waiting for teacher or admin approval."
            />
          </div>
        )}
      </div>

      {previewPaper && <PaperPreviewModal paper={previewPaper} onClose={() => setPreviewPaper(null)} />}
    </section>
  );
};

const InfoPill = ({ label, value }) => (
  <div className="rounded-2xl glass-soft p-3">
    <p className="text-[9px] font-black uppercase text-slate-400">{label}</p>
    <p className="mt-1 text-slate-900">{value}</p>
  </div>
);

const PaperActionBar = ({ paper, role, onDecision, onWorkflow, onRework }) => {
  const actions = [];
  const workflowActions = [];

  // ------ Simple approval workflow (draft → pending_admin → approved|rejected)
  if (paper.status === 'draft' && ['teacher', 'admin', 'clerk'].includes(role)) {
    workflowActions.push({
      label: 'Submit for approval',
      tone: 'border-indigo-200 bg-indigo-50 text-indigo-700',
      action: 'submit',
    });
  }

  if (paper.status === 'pending_admin' && role === 'admin') {
    workflowActions.push({
      label: 'Reject',
      tone: 'border-rose-200 bg-rose-50 text-rose-700',
      action: 'reject',
    });
    workflowActions.push({
      label: 'Approve',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      action: 'approve',
    });
  }

  if (role === 'teacher' && paper.status === 'teacher_review') {
    actions.push({
      label: 'Reject To Clerk',
      tone: 'border-rose-200 bg-rose-50 text-rose-700',
      decision: { status: 'teacher_rejected', action: 'Teacher Rejected' },
      requiresComment: true,
    });
    actions.push({
      label: 'Approve',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      decision: { status: 'teacher_approved', action: 'Teacher Approved' },
    });
  }

  if (role === 'teacher' && paper.status === 'teacher_approved') {
    actions.push({
      label: 'Send To Admin',
      tone: 'border-blue-200 bg-blue-50 text-blue-700',
      decision: { status: 'admin_review', action: 'Sent To Admin' },
    });
  }

  if (role === 'teacher' && paper.status === 'admin_rejected') {
    actions.push({
      label: 'Return To Clerk',
      tone: 'border-orange-200 bg-orange-50 text-orange-700',
      decision: { status: 'teacher_rejected', action: 'Returned To Clerk' },
      requiresComment: true,
    });
  }

  if (role === 'admin' && paper.status === 'admin_review') {
    actions.push({
      label: 'Reject To Teacher',
      tone: 'border-rose-200 bg-rose-50 text-rose-700',
      decision: { status: 'admin_rejected', action: 'Admin Rejected' },
      requiresComment: true,
    });
    actions.push({
      label: 'Final Approve',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      decision: { status: 'selected', action: 'Admin Approved' },
    });
  }

  const canRework = ['admin', 'clerk'].includes(role) && ['draft', 'teacher_rejected'].includes(paper.status);

  // Contextual footer label — leans on the new simple flow where applicable.
  let footerLabel = 'Awaiting next workflow action';
  if (paper.status === 'selected') footerLabel = 'Paper selected for printing';
  else if (paper.status === 'approved') footerLabel = 'Approved by admin';
  else if (paper.status === 'rejected') footerLabel = 'Rejected — see comments trail';
  else if (paper.status === 'pending_admin' && role !== 'admin') footerLabel = 'Awaiting admin review';

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100/80 pt-4">
      <div className="text-[10px] font-black uppercase text-slate-400">{footerLabel}</div>
      <div className="flex flex-wrap gap-2">
        {canRework && (
          <button
            type="button"
            onClick={onRework}
            className="rounded-full border border-white/70 bg-white px-3 py-2 text-xs font-black flex items-center gap-2"
          >
            <Edit3 className="w-4 h-4" /> Rework
          </button>
        )}
        {workflowActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onWorkflow?.(action.action)}
            className={classNames('rounded-full border px-3 py-2 text-xs font-black', action.tone)}
          >
            {action.label}
          </button>
        ))}
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onDecision(action.decision, action.requiresComment)}
            className={classNames('rounded-full border px-3 py-2 text-xs font-black', action.tone)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const PaperSelectedSection = ({ state }) => {
  const [examId, setExamId] = useState(state.exams[0]?.id || '');
  const [className, setClassName] = useState('Class 9');
  const selectedExam = state.exams.find((exam) => exam.id === examId) || state.exams[0];
  const subjects = getSubjectsForClass(className);
  const selectedPapers = state.papers.filter(
    (paper) => paper.examId === selectedExam?.id && paper.className === className && paper.status === 'selected'
  );

  const printSelectedPapers = () => {
    if (!selectedPapers.length) {
      alert('No selected papers available for this class.');
      return;
    }

    const body = selectedPapers
      .map((paper) => `<div class="page"><h2>${escapeHtmlText(paper.title)}</h2>${sanitizeRichHtml(paper.content)}</div>`)
      .join('');
    openPrintWindow(`${getExamLabel(selectedExam)} ${className} Papers`, body);
  };

  return (
    <section className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
      <div className="space-y-4">
        {state.exams.map((exam) => {
          const papers = state.papers.filter((paper) => paper.examId === exam.id);

          return (
            <button
              key={exam.id}
              type="button"
              onClick={() => setExamId(exam.id)}
              className={classNames(
                'w-full rounded-3xl border p-5 text-left shadow-sm transition-all',
                examId === exam.id ? 'btn-primary border-transparent' : 'bg-white border-slate-100/80 hover:border-[#8b5cf6]'
              )}
            >
              <p className="text-[10px] font-black uppercase opacity-70">{exam.academicYear}</p>
              <h3 className="mt-1 text-lg font-black">{getExamLabel(exam)}</h3>
              <p className="mt-2 text-xs font-bold opacity-80">
                {papers.filter((paper) => paper.status === 'selected').length} selected papers
              </p>
            </button>
          );
        })}
      </div>

      <div className="glass-card rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-600" /> Selected Papers
            </h3>
            <p className="text-xs font-bold text-slate-400 mt-1">{getExamLabel(selectedExam)}</p>
          </div>
          <button
            type="button"
            onClick={printSelectedPapers}
            className="rounded-full btn-primary px-4 py-2 text-xs font-black flex items-center gap-2 self-start"
          >
            <Printer className="w-4 h-4" /> Print Papers
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
          {allExamClasses.map((item) => {
            const classSubjects = getSubjectsForClass(item);
            const selectedCount = state.papers.filter(
              (paper) => paper.examId === selectedExam?.id && paper.className === item && paper.status === 'selected'
            ).length;

            return (
              <button
                key={item}
                type="button"
                onClick={() => setClassName(item)}
                className={classNames(
                  'rounded-2xl border p-3 text-left transition-all',
                  className === item ? 'bg-[#8b5cf6] border-[#8b5cf6] text-white' : 'bg-white/60 border-slate-100/80'
                )}
              >
                <p className="text-xs font-black">{item}</p>
                <p className="text-[10px] font-bold opacity-80 mt-1">
                  {selectedCount}/{classSubjects.length} selected
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-100/80">
          <table className="w-full min-w-[760px] text-left text-xs font-bold">
            <thead className="bg-indigo-50/60 text-slate-500 uppercase text-[10px]">
              <tr>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Teacher</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Paper</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {subjects.map((item) => {
                const paper = state.papers.find(
                  (candidate) =>
                    candidate.examId === selectedExam?.id &&
                    candidate.className === className &&
                    candidate.subject === item.subject
                );
                const meta = getPaperStatusMeta(paper?.status || 'draft');

                return (
                  <tr key={item.subject}>
                    <td className="px-3 py-3 font-black">{item.subject}</td>
                    <td className="px-3 py-3 text-slate-400">{item.teacherName}</td>
                    <td className="px-3 py-3">
                      <span className={classNames('rounded-full border px-2 py-1 text-[10px] font-black', meta.tone)}>
                        {paper?.status === 'selected' ? 'Selected' : paper ? meta.label : 'Not Created'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-400">{paper?.title || 'Awaiting paper'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

const ReportCardManagementSection = ({ state, role, onRefresh }) => {
  const [examId, setExamId] = useState(state.exams[0]?.id || '');
  const [className, setClassName] = useState('Class 9');
  const [scheduleRows, setScheduleRows] = useState([]);
  const [showAdmitPreview, setShowAdmitPreview] = useState(false);
  const selectedExam = state.exams.find((exam) => exam.id === examId) || state.exams[0];
  const students = getStudentsForClass(className);

  useEffect(() => {
    const savedRows = state.schedules.filter(
      (row) => row.examId === examId && row.className === className
    );
    const subjects = getSubjectsForClass(className);
    const nextRows = subjects.map((item) => {
      const savedRow = savedRows.find((row) => row.subject === item.subject);
      return (
        savedRow || {
          id: '',
          examId,
          className,
          subject: item.subject,
          date: getTodayInputValue(),
          startTime: '09:00',
          endTime: '12:00',
        }
      );
    });
    setScheduleRows(nextRows);
  }, [className, examId, state.schedules]);

  if (!roleCanManageReportCards(role)) {
    return (
      <EmptyAccess
        icon={ShieldCheck}
        title="Report Card Management is for admin and clerk."
        message="Teachers can work on papers and marks, while admin and clerk can access admit cards and report cards."
      />
    );
  }

  const updateSchedule = (subject, field, value) => {
    setScheduleRows((rows) =>
      rows.map((row) => (row.subject === subject ? { ...row, [field]: value } : row))
    );
  };

  const saveSchedule = () => {
    const nextState = upsertScheduleRows(examId, className, scheduleRows);
    onRefresh(nextState);
    alert('Exam schedule saved for admit card generation.');
  };

  const printAdmitCards = () => {
    printAdmitCardsForClass({
      students,
      exam: selectedExam,
      schedule: scheduleRows,
      schoolInfo: { academicYear: selectedExam?.academicYear },
    });
  };

  return (
    <section className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-6">
      <div className="glass-card rounded-3xl p-5 shadow-sm h-fit">
        <h3 className="text-sm font-black flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#8b5cf6]" /> Classes
        </h3>
        <div className="mt-4 grid grid-cols-2 xl:grid-cols-1 gap-2 max-h-[620px] overflow-y-auto pr-1">
          {allExamClasses.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setClassName(item)}
              className={classNames(
                'rounded-2xl border px-3 py-3 text-left text-xs font-black',
                className === item ? 'btn-primary border-transparent' : 'bg-white/60 border-slate-100/80'
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="glass-card rounded-3xl p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" /> Admit Card Setup
              </h3>
              <p className="text-xs font-bold text-slate-400 mt-1">
                Select exam, add subject date/time, then generate admit cards.
              </p>
            </div>
            <select
              value={examId}
              onChange={(event) => setExamId(event.target.value)}
              className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-xs font-black outline-none"
            >
              {state.exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {getExamLabel(exam)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-100/80">
            <table className="w-full min-w-[760px] text-left text-xs font-bold">
              <thead className="bg-indigo-50/60 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">End</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {scheduleRows.map((row) => (
                  <tr key={row.subject}>
                    <td className="px-3 py-2 font-black">{row.subject}</td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(event) => updateSchedule(row.subject, 'date', event.target.value)}
                        className="rounded-xl border border-white/70 bg-white/60 px-2 py-2 outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        value={row.startTime}
                        onChange={(event) => updateSchedule(row.subject, 'startTime', event.target.value)}
                        className="rounded-xl border border-white/70 bg-white/60 px-2 py-2 outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        value={row.endTime}
                        onChange={(event) => updateSchedule(row.subject, 'endTime', event.target.value)}
                        className="rounded-xl border border-white/70 bg-white/60 px-2 py-2 outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={saveSchedule}
              className="rounded-full btn-primary px-4 py-2 text-xs font-black flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Schedule
            </button>
            <button
              type="button"
              onClick={() => setShowAdmitPreview(true)}
              className="rounded-full border border-white/70 bg-white px-4 py-2 text-xs font-black flex items-center gap-2"
            >
              <Eye className="w-4 h-4" /> Generate Admit Cards
            </button>
            <button
              type="button"
              onClick={printAdmitCards}
              className="rounded-full btn-primary px-4 py-2 text-xs font-black flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Print All
            </button>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-5 shadow-sm">
          <h3 className="text-sm font-black flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" /> Student List: {className}
          </h3>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100/80">
            <table className="w-full min-w-[920px] text-left text-xs font-bold">
              <thead className="bg-indigo-50/60 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2">Photo</th>
                  <th className="px-3 py-2">Admission No.</th>
                  <th className="px-3 py-2">Roll</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Father</th>
                  <th className="px-3 py-2">Mother</th>
                  <th className="px-3 py-2">Mobile</th>
                  <th className="px-3 py-2">Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {students.map((student) => (
                  <tr key={student.id}>
                    <td className="px-3 py-2">
                      <div className="w-10 h-10 rounded-xl bg-[#F5F3FF] text-[#8b5cf6] flex items-center justify-center font-black">
                        {getInitials(student.displayName)}
                      </div>
                    </td>
                    <td className="px-3 py-2">{student.admissionNumber}</td>
                    <td className="px-3 py-2">{student.rollNo}</td>
                    <td className="px-3 py-2 font-black">{student.displayName}</td>
                    <td className="px-3 py-2">{student.fatherName}</td>
                    <td className="px-3 py-2">{student.motherName}</td>
                    <td className="px-3 py-2">{student.guardianPhone}</td>
                    <td className="px-3 py-2 max-w-[220px] truncate">{student.address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAdmitPreview && (
        <AdmitCardPreviewModal
          exam={selectedExam}
          className={className}
          students={students}
          scheduleRows={scheduleRows}
          onClose={() => setShowAdmitPreview(false)}
          onPrint={printAdmitCards}
        />
      )}
    </section>
  );
};

const MarksManagementSection = ({ state, actor, role, session, onRefresh }) => {
  const teacherAssignments = useMemo(() => getTeacherExamAssignments(session), [session]);
  const [examId, setExamId] = useState(state.exams[0]?.id || '');
  const [className, setClassName] = useState(
    role === 'teacher' ? teacherAssignments[0]?.className || 'Class 9' : 'Class 9'
  );
  const availableSubjects = useMemo(() => {
    if (role !== 'teacher') return getSubjectsForClass(className);
    const teacherSubjects = teacherAssignments.filter((item) => item.className === className);
    return teacherSubjects.length ? teacherSubjects : getSubjectsForClass(className).slice(0, 1);
  }, [className, role, teacherAssignments]);
  const [subject, setSubject] = useState(availableSubjects[0]?.subject || 'English');
  const [maxMarks, setMaxMarks] = useState(100);
  const [rows, setRows] = useState([]);
  const [isSendingReports, setIsSendingReports] = useState(false);

  const selectedExam = state.exams.find((exam) => exam.id === examId) || state.exams[0];
  const boardFinalSelected = isBoardFinalExam(state, selectedExam, className);
  const selectedRecord = state.marks.find(
    (record) => record.examId === examId && record.className === className && record.subject === subject
  );
  const [currentTime, setCurrentTime] = useState(0);
  useEffect(() => {
    setCurrentTime(Date.now());
  }, [selectedRecord?.teacherEditUnlockedUntil, selectedRecord?.submittedAt]);
  const isLocked = isMarksRecordLocked(selectedRecord, role, currentTime);
  const teacherEditUnlocked =
    selectedRecord?.teacherEditUnlockedUntil && isTeacherMarksEditUnlocked(selectedRecord, currentTime);
  const selectableClasses =
    role === 'teacher'
      ? Array.from(new Set(teacherAssignments.map((item) => item.className)))
      : allExamClasses;

  useEffect(() => {
    if (!availableSubjects.some((item) => item.subject === subject)) {
      setSubject(availableSubjects[0]?.subject || '');
    }
  }, [availableSubjects, subject]);

  useEffect(() => {
    const roster = getStudentsForClass(className);
    const record = state.marks.find(
      (item) => item.examId === examId && item.className === className && item.subject === subject
    );
    setMaxMarks(record?.maxMarks || 100);
    setRows(
      roster.map((student) => {
        const savedRow = record?.rows.find(
          (row) => row.studentId === student.id || row.admissionNumber === student.admissionNumber
        );
        return {
          studentId: student.id,
          admissionNumber: student.admissionNumber,
          studentName: student.displayName,
          rollNo: student.rollNo,
          marks: savedRow?.marks || '',
          remark: savedRow?.remark || '',
        };
      })
    );
  }, [className, examId, state.marks, subject]);

  const updateRow = (studentId, field, value) => {
    setRows((currentRows) =>
      currentRows.map((row) => (row.studentId === studentId ? { ...row, [field]: value } : row))
    );
  };

  const saveMarks = () => {
    if (!roleCanEnterMarks(role)) return;
    if (boardFinalSelected) {
      alert('Final internal marks are disabled for board exam classes. Upload the final PDF result in Report Card Management.');
      return;
    }
    if (isLocked) {
      alert('24 hours have passed. This marks list is locked for teacher editing.');
      return;
    }

    const nextState = upsertMarksRecord(
      {
        examId,
        className,
        subject,
        maxMarks,
        rows,
      },
      actor
    );
    onRefresh(nextState);
    alert('Marks saved successfully.');
  };

  const enableTeacherEdit = () => {
    if (role !== 'admin' || !selectedRecord) return;
    const nextState = enableTeacherMarksEdit(selectedRecord.id, actor);
    onRefresh(nextState);
    alert(`Teacher editing enabled for the next ${MARKS_ADMIN_UNLOCK_HOURS} hours.`);
  };

  const printReports = () => {
    // Full-year Annual Progress Report for the whole class (all exams as columns).
    printReportCardsForClass({
      students: getStudentsForClass(className),
      exams: state.exams,
      marks: state.marks,
      className,
      schoolInfo: { academicYear: selectedExam?.academicYear },
    });
  };

  const buildReportText = (students) => [
    'Dear Guardian,',
    '',
    `${getExamLabel(selectedExam)} report card update for ${className}.`,
    '',
    ...students.flatMap((student) => {
      const reportRows = getReportRowsForStudent(state, student, examId);
      const total = reportRows.reduce((sum, row) => sum + Number(row.marks || 0), 0);
      const maxTotal = reportRows.reduce((sum, row) => sum + Number(row.maxMarks || 0), 0);
      const percentage = maxTotal ? Math.round((total / maxTotal) * 100) : 0;

      return [
        `Student: ${student.displayName} (${student.admissionNumber})`,
        `Overall: ${percentage}%`,
        ...reportRows.map((row) => `${row.subject}: ${row.marks}/${row.maxMarks} - ${row.grade}`),
        '',
      ];
    }),
    'Regards,',
    'Examination Department',
    'MGPS ERP Portal',
  ].join('\n');

  const buildReportMessages = (students) => {
    const groupedByEmail = students.reduce((groups, student) => {
      if (!student.guardianEmail) return groups;
      const currentGroup = groups.get(student.guardianEmail) || [];
      groups.set(student.guardianEmail, [...currentGroup, student]);
      return groups;
    }, new Map());

    return Array.from(groupedByEmail.entries()).map(([guardianEmail, groupedStudents]) => ({
      to: guardianEmail,
      subject: `${getExamLabel(selectedExam)} Report Card - ${className}`,
      text: buildReportText(groupedStudents),
    }));
  };

  const sendReports = async (channel) => {
    const students = getStudentsForClass(className);

    if (channel !== 'Gmail') {
      const nextState = recordReportDelivery({ examId, className, channel, actor });
      onRefresh(nextState);
      const groupedContacts = new Set(students.map((student) => student.guardianPhone));
      alert(
        `${channel} report cards prepared for ${groupedContacts.size} parent contact groups. Siblings are grouped by guardian contact.`
      );
      return;
    }

    const messages = buildReportMessages(students);

    if (messages.length === 0) {
      alert('No guardian email addresses found for this class.');
      return;
    }
    
    setIsSendingReports(true);
    try {
      const result = await sendGmailMessages(messages);
      const nextState = recordReportDelivery({ examId, className, channel, actor });
      onRefresh(nextState);
      alert(`Email notices sent successfully to ${result.sent || messages.length} guardian account(s).`);
    } catch (error) {
      alert(`Email dispatch failed: ${error.message}`);
    } finally {
      setIsSendingReports(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="glass-card rounded-3xl p-5 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 text-xs font-bold">
          <Field label="Examination">
            <select value={examId} onChange={(event) => setExamId(event.target.value)} className="input-shell">
              {state.exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {getExamLabel(exam)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Class">
            <select value={className} onChange={(event) => setClassName(event.target.value)} className="input-shell">
              {selectableClasses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subject">
            <select value={subject} onChange={(event) => setSubject(event.target.value)} className="input-shell">
              {availableSubjects.map((item) => (
                <option key={item.subject} value={item.subject}>
                  {item.subject}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Max Marks">
            <input
              type="number"
              value={maxMarks}
              onChange={(event) => setMaxMarks(event.target.value)}
              className="input-shell"
            />
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              onClick={saveMarks}
              disabled={isLocked || boardFinalSelected}
              className={classNames(
                'w-full rounded-full px-4 py-3 text-xs font-black flex items-center justify-center gap-2',
                isLocked || boardFinalSelected ? 'bg-white/50 text-slate-400 cursor-not-allowed' : 'btn-primary'
              )}
            >
              <Save className="w-4 h-4" /> Save Marks
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-slate-400">
          {selectedRecord ? (
            <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1">
              Last saved by {selectedRecord.enteredByName} on {formatExamDateTime(selectedRecord.updatedAt || selectedRecord.submittedAt)}
            </span>
          ) : (
            <span className="rounded-full bg-white/60 border border-slate-100/80 px-3 py-1">No marks submitted yet</span>
          )}
          {isLocked && (
            <span className="rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1">
              Teacher edit window closed after {MARKS_EDIT_LOCK_HOURS} hours
            </span>
          )}
          {teacherEditUnlocked && (
            <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1">
              Teacher editing enabled until {formatExamDateTime(selectedRecord.teacherEditUnlockedUntil)}
            </span>
          )}
          {boardFinalSelected && (
            <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1">
              Board class final result: upload PDF instead of entering internal marks
            </span>
          )}
        </div>
      </div>

      <div className="glass-card rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#8b5cf6]" /> Marks Entry
            </h3>
            <p className="text-xs font-bold text-slate-400 mt-1">
              Teachers can edit for {MARKS_EDIT_LOCK_HOURS} hours after first save. Admin can reopen a locked marks list.
            </p>
          </div>
          {role === 'admin' && (
            <div className="flex flex-wrap gap-2">
              {selectedRecord && (
                <button
                  type="button"
                  onClick={enableTeacherEdit}
                  className="rounded-full bg-violet-50 text-violet-700 border border-violet-200 px-4 py-2 text-xs font-black flex items-center gap-2"
                >
                  <Edit3 className="w-4 h-4" /> Enable Teacher Edit
                </button>
              )}
              <button
                type="button"
                onClick={printReports}
                className="rounded-full border border-white/70 bg-white px-4 py-2 text-xs font-black flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Print Report Cards
              </button>
              <button
                type="button"
                onClick={() => sendReports('WhatsApp')}
                className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 text-xs font-black flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </button>
              <button
                type="button"
                onClick={() => sendReports('Gmail')}
                disabled={isSendingReports}
                className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 text-xs font-black flex items-center gap-2 disabled:opacity-60"
              >
                <Mail className="w-4 h-4" /> {isSendingReports ? 'Sending...' : 'Gmail'}
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-100/80">
          <table className="w-full min-w-[900px] text-left text-xs font-bold">
            <thead className="bg-indigo-50/60 text-slate-500 uppercase text-[10px]">
              <tr>
                <th className="px-3 py-2">Roll</th>
                <th className="px-3 py-2">Admission No.</th>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Marks</th>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {rows.map((row) => (
                <tr key={row.studentId}>
                  <td className="px-3 py-2">{row.rollNo}</td>
                  <td className="px-3 py-2">{row.admissionNumber}</td>
                  <td className="px-3 py-2 font-black">{row.studentName}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      max={maxMarks}
                      value={row.marks}
                      disabled={isLocked || boardFinalSelected}
                      onChange={(event) => updateRow(row.studentId, 'marks', event.target.value)}
                      className="w-24 rounded-xl border border-white/70 bg-white/60 px-2 py-2 outline-none disabled:opacity-60"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 text-[10px] font-black">
                      {row.marks === '' ? '-' : calculateGrade(row.marks, maxMarks)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.remark}
                      disabled={isLocked || boardFinalSelected}
                      onChange={(event) => updateRow(row.studentId, 'remark', event.target.value)}
                      placeholder={row.marks === '' ? 'Remark' : getFocusRemark(row.marks, maxMarks)}
                      className="w-full rounded-xl border border-white/70 bg-white/60 px-2 py-2 outline-none disabled:opacity-60"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

// Board Result PDFs (per-class). Admin/Clerk get an upload form + full list
// (admin can delete); students get their class's list only, with Open PDF.
const BoardResultsSection = ({ state, role, studentClassName, onRefresh }) => {
  const canManage = role === 'admin' || role === 'clerk';
  const canDelete = role === 'admin';

  const [uploadClassName, setUploadClassName] = useState(allExamClasses[0] || 'Class 10');
  const [examTitle, setExamTitle] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const results = useMemo(() => {
    const all = (state.boardResults || []).filter(isClassBoardResult);
    if (canManage) return all;
    if (!studentClassName) return [];
    return all.filter((item) => item.className === studentClassName);
  }, [state.boardResults, canManage, studentClassName]);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) {
      setNotice('Please choose a PDF to upload.');
      return;
    }
    if (!examTitle.trim()) {
      setNotice('Please provide an exam title (e.g. CBSE Class 10 Result 2026).');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      await boardResultsApi.upload({
        file,
        className: uploadClassName,
        examTitle: examTitle.trim(),
      });
      const nextState = await fetchExaminationState({ broadcast: true });
      if (onRefresh) onRefresh(nextState);
      setFile(null);
      setExamTitle('');
      setNotice('Board result published to the class.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    if (!canDelete) return;
    if (!window.confirm('Delete this board result PDF?')) return;
    try {
      await boardResultsApi.remove(id);
      const nextState = await fetchExaminationState({ broadcast: true });
      if (onRefresh) onRefresh(nextState);
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <section className="glass-card rounded-3xl p-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-600" /> Board Results
          </h3>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            {canManage
              ? 'Publish a board result PDF for a whole class. Students in that class will see it here.'
              : studentClassName
                ? `Board result PDFs published for ${studentClassName}.`
                : 'Board result PDFs published by the school.'}
          </p>
        </div>
      </div>

      {canManage && (
        <form
          onSubmit={handleUpload}
          className="mt-5 grid grid-cols-1 lg:grid-cols-[220px_1fr_240px_140px] gap-3 text-xs font-bold items-end"
        >
          <div className="space-y-1">
            <label className="text-slate-500">Class</label>
            <select
              value={uploadClassName}
              onChange={(event) => setUploadClassName(event.target.value)}
              className="input-shell"
            >
              {allExamClasses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-slate-500">Exam Title</label>
            <input
              value={examTitle}
              onChange={(event) => setExamTitle(event.target.value)}
              placeholder="CBSE Class 10 Result 2026"
              className="input-shell"
            />
          </div>
          <div className="space-y-1">
            <label className="text-slate-500">Result PDF (max 10MB)</label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="w-full text-[11px] font-bold"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full btn-primary px-4 py-3 text-xs font-black flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <FileText className="w-4 h-4" /> {busy ? 'Uploading...' : 'Publish'}
          </button>
        </form>
      )}

      {!!notice && (
        <p className="mt-3 text-[11px] font-bold text-slate-500">{notice}</p>
      )}

      <div className="mt-5 space-y-2">
        {results.length === 0 ? (
          <div className="rounded-2xl glass-soft p-4 text-xs font-bold text-slate-400">
            No board result PDFs published yet.
          </div>
        ) : (
          results.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-100/80 bg-white/60 p-3 flex flex-col md:flex-row md:items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black truncate">{item.examTitle}</p>
                <p className="text-[11px] font-bold text-slate-400 mt-1">
                  {item.className} · {item.pdfName} ·{' '}
                  {formatBoardResultDate(item.publishedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openBoardResultPdf(item.id)}
                  className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-1.5 text-[10px] font-black"
                >
                  Open PDF
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="rounded-full border border-rose-200 bg-rose-50 text-rose-700 px-3 py-1.5 text-[10px] font-black"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

const StudentExamView = ({ state, session }) => {
  const activeStudent = session?.activeStudent || session?.studentProfiles?.[0] || {
    displayName: session?.displayName || 'Student',
    className: '',
    section: '',
    rollNo: '',
    admissionNumber: '',
  };
  const roster = ensureStudentInRoster(activeStudent);
  const student =
    roster.find(
      (item) => item.id === activeStudent.id || item.admissionNumber === activeStudent.admissionNumber
    ) || activeStudent;
  const reportOptions = useMemo(
    () => {
      const internalOptions = getSavedReportOptionsForStudent(state, student);
      const boardOptions = (state.boardResults || [])
        .filter(
          (result) =>
            (result.admissionNumber && result.admissionNumber === student.admissionNumber) ||
            (result.studentId && result.studentId === student.id) ||
            (result.studentName && result.studentName === student.displayName)
        )
        .map((result) => ({
          examId: result.examId,
          className: result.className,
          updatedAt: result.uploadedAt,
          type: 'board',
        }));

      return [...internalOptions, ...boardOptions].sort(
        (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
      );
    },
    [state, student]
  );
  const fallbackOption = useMemo(
    () => ({
      examId: state.exams[0]?.id || '',
      className: student.className || 'Class 9',
      updatedAt: '',
    }),
    [state.exams, student.className]
  );
  const [reportOptionKey, setReportOptionKey] = useState('');

  useEffect(() => {
    const availableOptions = reportOptions.length ? reportOptions : [fallbackOption];
    const availableKeys = availableOptions.map(getReportOptionKey);
    if (!availableKeys.includes(reportOptionKey)) {
      setReportOptionKey(availableKeys[0] || '');
    }
  }, [fallbackOption, reportOptionKey, reportOptions]);

  const selectedOption =
    reportOptions.find((option) => getReportOptionKey(option) === reportOptionKey) ||
    reportOptions[0] ||
    fallbackOption;
  const reportStudent = { ...student, reportClassName: selectedOption.className };
  const selectedExam = state.exams.find((exam) => exam.id === selectedOption.examId) || state.exams[0];
  const selectedBoardResult = getBoardResultForStudent(state, student, selectedExam?.id, selectedOption.className);
  const isBoardReport = Boolean(selectedBoardResult?.dataUrl);
  const rows = getReportRowsForStudent(state, reportStudent, selectedExam?.id);
  const total = rows.reduce((sum, row) => sum + Number(row.marks || 0), 0);
  const maxTotal = rows.reduce((sum, row) => sum + Number(row.maxMarks || 0), 0);
  const percentage = maxTotal ? Math.round((total / maxTotal) * 100) : 0;
  const focusRows = [...rows].sort((a, b) => a.marks / a.maxMarks - b.marks / b.maxMarks).slice(0, 2);

  const printReport = () => {
    // Full-year progress report (all exams as columns), matching the school's
    // official Annual Progress Report layout.
    printReportCard({
      student,
      exams: state.exams,
      marks: state.marks,
      className: selectedOption.className,
      schoolInfo: { academicYear: selectedExam?.academicYear },
    });
  };

  // For a board class's FINAL exam the result is an uploaded per-student file
  // (from the Board Examination desk), not a computed report card.
  const isBoardFinal = isBoardFinalExam(state, selectedExam, selectedOption.className);
  const openMyBoardResult = async () => {
    if (!selectedExam?.id) return;
    try {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/examinations/board-student-result/me/${selectedExam.id}`,
        { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!response.ok) {
        alert('Your board result has not been published yet.');
        return;
      }
      const blob = await response.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (error) {
      alert('Could not open your board result. Please try again.');
    }
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900">
      <section className="glass-card rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#8b5cf6]" /> Examinations
            </h2>
            <p className="text-xs font-bold text-slate-400 mt-1">
              {student.displayName} | Viewing {selectedOption.className}-{student.section || 'A'} | Roll {student.rollNo}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={reportOptionKey}
              onChange={(event) => setReportOptionKey(event.target.value)}
              className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-xs font-black outline-none"
            >
              {(reportOptions.length ? reportOptions : [fallbackOption]).map((option) => {
                const exam = state.exams.find((item) => item.id === option.examId);
                return (
                  <option key={getReportOptionKey(option)} value={getReportOptionKey(option)}>
                    {getExamLabel(exam)} | {option.className}
                  </option>
                );
              })}
              {!reportOptions.length && !state.exams.length && (
                <option value="">
                  No report cards
                </option>
              )}
            </select>
            <button
              type="button"
              onClick={
                isBoardFinal
                  ? openMyBoardResult
                  : isBoardReport
                    ? () => window.open(selectedBoardResult.dataUrl, '_blank')
                    : printReport
              }
              className="rounded-full btn-primary px-4 py-2 text-xs font-black flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> {isBoardFinal || isBoardReport ? 'Open Board Result' : 'Print Report Card'}
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryStat label="Overall" value={`${percentage}%`} icon={Award} tone="bg-[#FFF8EC] text-[#f59e0b]" />
          <SummaryStat label="Subjects Marked" value={rows.length} icon={BookOpen} tone="bg-blue-50 text-blue-700" />
          <SummaryStat label="Performance" value={percentage >= 75 ? 'Strong' : 'Focus'} icon={BarChart3} tone="bg-emerald-50 text-emerald-700" />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass-card rounded-3xl p-5 shadow-sm">
          <h3 className="text-sm font-black">Subjectwise Report Card</h3>
          {isBoardReport && (
            <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span>Board result uploaded: {selectedBoardResult.fileName}</span>
              <button
                type="button"
                onClick={() => window.open(selectedBoardResult.dataUrl, '_blank')}
                className="rounded-full bg-white border border-emerald-200 px-4 py-2 text-[10px] font-black text-emerald-700"
              >
                View PDF
              </button>
            </div>
          )}
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100/80">
            <table className="w-full min-w-[760px] text-left text-xs font-bold">
              <thead className="bg-indigo-50/60 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Marks</th>
                  <th className="px-3 py-2">Grade</th>
                  <th className="px-3 py-2">Progress</th>
                  <th className="px-3 py-2">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {rows.map((row) => {
                  const percent = row.maxMarks ? Math.round((row.marks / row.maxMarks) * 100) : 0;
                  return (
                    <tr key={row.subject}>
                      <td className="px-3 py-3 font-black">{row.subject}</td>
                      <td className="px-3 py-3 font-mono">{row.marks}/{row.maxMarks}</td>
                      <td className="px-3 py-3">
                        <span className="bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-md font-black">{row.grade}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 rounded-full bg-slate-100/80 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${percent}%` }} />
                          </div>
                          <span className="font-mono">{percent}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-400">{row.remark}</td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-400" colSpan={5}>
                      Marks are not published for this exam yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-5 shadow-sm">
          <h3 className="text-sm font-black flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#8b5cf6]" /> Performance Trace
          </h3>
          <div className="mt-4 space-y-3">
            {focusRows.map((row) => (
              <div key={row.subject} className="rounded-2xl glass-soft p-3">
                <p className="text-xs font-black">{row.subject}</p>
                <p className="text-[11px] font-bold text-slate-400 mt-1">{row.remark}</p>
              </div>
            ))}
            {!focusRows.length && (
              <div className="rounded-2xl glass-soft p-3 text-xs font-bold text-slate-400">
                Performance trace will appear after marks are uploaded.
              </div>
            )}
          </div>
        </div>
      </section>

      <BoardResultsSection state={state} role="student" studentClassName={student.className} />
    </div>
  );
};

const EmptyAccess = ({ icon: Icon, title, message }) => (
  <div className="glass-card rounded-3xl p-10 shadow-sm text-center">
    <div className="mx-auto w-14 h-14 rounded-2xl bg-[#F5F3FF] text-[#8b5cf6] flex items-center justify-center">
      {React.createElement(Icon, { className: 'w-7 h-7' })}
    </div>
    <h3 className="mt-4 text-base font-black">{title}</h3>
    <p className="mt-2 text-xs font-bold text-slate-400 max-w-md mx-auto">{message}</p>
  </div>
);

const PaperPreviewModal = ({ paper, onClose }) => (
  <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
    <div className="glass-strong animate-scaleUp rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-slate-100/80 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black truncate">{paper.title}</h3>
        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-white/70">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="bg-white/40 p-4 overflow-y-auto max-h-[80vh]">
        <div
          className="mx-auto max-w-[794px] min-h-[900px] bg-white border border-white/70 p-8 sm:p-12 text-sm leading-7 shadow-xl"
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(paper.content) }}
        />
      </div>
    </div>
  </div>
);

const AdmitCardPreviewModal = ({ exam, className, students, scheduleRows, onClose, onPrint }) => (
  <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
    <div className="glass-strong animate-scaleUp rounded-3xl w-full max-w-6xl max-h-[92vh] overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-slate-100/80 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black">{getExamLabel(exam)} Admit Cards</h3>
          <p className="text-xs font-bold text-slate-400">{className} | {students.length} students</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrint}
            className="rounded-full btn-primary px-4 py-2 text-xs font-black flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-white/70">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="bg-white/40 p-4 overflow-y-auto max-h-[80vh] grid grid-cols-1 xl:grid-cols-2 gap-4">
        {students.slice(0, 4).map((student) => (
          <div key={student.id} className="bg-white border border-white/70 rounded-2xl p-5">
            <div className="flex justify-between gap-4 border-b border-slate-100/80 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400">{getExamLabel(exam)}</p>
                <h3 className="text-base font-black mt-1">{student.displayName}</h3>
                <p className="text-xs font-bold text-slate-400">{student.className}-{student.section} | Roll {student.rollNo}</p>
              </div>
              <div className="w-16 h-20 rounded-xl bg-[#F5F3FF] text-[#8b5cf6] flex items-center justify-center font-black">
                {getInitials(student.displayName)}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-bold">
              <InfoPill label="Admission" value={student.admissionNumber} />
              <InfoPill label="Mobile" value={student.guardianPhone} />
              <InfoPill label="Father" value={student.fatherName} />
              <InfoPill label="Mother" value={student.motherName} />
            </div>
            <div className="mt-4 space-y-1 text-[11px] font-bold">
              {scheduleRows.map((row) => (
                <div key={row.subject} className="flex items-center justify-between gap-2 rounded-xl bg-white/60 px-3 py-2">
                  <span>{row.subject}</span>
                  <span className="text-slate-400">{formatExamDate(row.date)} | {row.startTime}-{row.endTime}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default ExaminationHub;
