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
  enableTeacherMarksEdit,
  ensureStudentInRoster,
  fetchExaminationState,
  formatExamDate,
  formatExamDateTime,
  getActor,
  getExamLabel,
  getFocusRemark,
  getPaperStatusMeta,
  getPrintDocument,
  getReportRowsForStudent,
  getSavedReportOptionsForStudent,
  getStudentsForClass,
  getSubjectsForClass,
  getTeacherExamAssignments,
  isMarksRecordLocked,
  isTeacherMarksEditUnlocked,
  readExaminationState,
  recordReportDelivery,
  roleCanCreatePapers,
  roleCanEnterMarks,
  roleCanManageExams,
  roleCanManageReportCards,
  savePaperRecord,
  upsertMarksRecord,
  upsertScheduleRows,
} from './examinationStore';
import { sendGmailMessages } from './gmail';
import { useMasterData } from './masterData';

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
  const [state, setState] = useState(() => readExaminationState());
  const [localSection, setLocalSection] = useState(getDefaultSection(role));
  const [paperToEdit, setPaperToEdit] = useState(null);
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
    const refreshState = () => setState(readExaminationState());
    window.addEventListener(EXAMINATION_UPDATED_EVENT, refreshState);
    return () => window.removeEventListener(EXAMINATION_UPDATED_EVENT, refreshState);
  }, []);

  useEffect(() => {
    fetchExaminationState().then(setState);
  }, []);

  useEffect(() => {
    configureExaminationMasterData(masterData);
  }, [
    masterData.classNames,
    masterData.students,
    masterData.teachers,
    masterData.subjectsByClass,
  ]);

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
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <style>{`
        .input-shell {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid #C8C8C8;
          background: #F8F8F8;
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
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#8b5cf6]" /> Examination Desk
            </h2>
            <p className="text-xs font-bold text-[#666666] mt-1">
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
                    ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-sm'
                    : 'bg-[#F8F8F8] text-[#555555] border-[#EAEAEA] hover:bg-[#EAEAEA]'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

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
        <ReportCardManagementSection state={state} role={role} onRefresh={refreshWith} />
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
    </div>
  );
};

const SummaryStat = ({ label, value, icon: Icon, tone }) => (
  <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3">
    <div className={classNames('w-8 h-8 rounded-xl flex items-center justify-center mb-2', tone)}>
      {React.createElement(Icon, { className: 'w-4 h-4' })}
    </div>
    <p className="text-[10px] font-black uppercase text-[#666666]">{label}</p>
    <p className="text-lg font-black leading-tight">{value}</p>
  </div>
);

const ExamCreationSection = ({ state, actor, role, onRefresh }) => {
  const [name, setName] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-27');
  const canManage = roleCanManageExams(role);

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
      <div className="xl:col-span-1 bg-white border border-[#EAEAEA] rounded-3xl p-5 shadow-sm h-fit">
        <h3 className="text-sm font-black flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#8b5cf6]" /> Add Examination
        </h3>
        <p className="text-xs font-semibold text-[#666666] mt-1">
          Admin or clerk can create exam cycles like SA-1, SA-2, Half Yearly.
        </p>

        {canManage ? (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs font-bold">
            <div className="space-y-1">
              <label className="text-[#555555]">Name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="SA-1"
                className="w-full rounded-2xl border border-[#C8C8C8] bg-[#F8F8F8] px-3 py-3 outline-none focus:border-[#8b5cf6]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[#555555]">Academic Year</label>
              <input
                value={academicYear}
                onChange={(event) => setAcademicYear(event.target.value)}
                className="w-full rounded-2xl border border-[#C8C8C8] bg-[#F8F8F8] px-3 py-3 outline-none focus:border-[#8b5cf6]"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-[#E1FA6C] px-4 py-3 text-xs font-black text-[#1A1A1A] hover:scale-[1.01] transition-all"
            >
              Add Examination
            </button>
          </form>
        ) : (
          <div className="mt-5 rounded-2xl bg-[#F8F8F8] border border-[#EAEAEA] p-4 text-xs font-bold text-[#666666]">
            Your role can view examination cycles but cannot create new ones.
          </div>
        )}
      </div>

      <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
        {state.exams.map((exam) => {
          const papers = state.papers.filter((paper) => paper.examId === exam.id);
          const selectedPapers = papers.filter((paper) => paper.status === 'selected');

          return (
            <div key={exam.id} className="bg-white border border-[#EAEAEA] rounded-3xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase text-[#666666]">{exam.academicYear}</p>
                  <h3 className="text-lg font-black mt-1">{getExamLabel(exam)}</h3>
                  <p className="text-xs font-semibold text-[#666666] mt-1">
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
  <div className="rounded-2xl bg-[#F8F8F8] border border-[#EAEAEA] p-3">
    <p className="text-base font-black">{value}</p>
    <p className="text-[10px] font-black uppercase text-[#666666]">{label}</p>
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
  const reworkPapers = state.papers.filter((paper) =>
    ['draft', 'teacher_rejected', 'admin_rejected'].includes(paper.status)
  );

  const openFreshEditor = () => {
    if (!selectedExam || !className || !subject) {
      alert('Please select examination, class, and subject first.');
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
      <div className="bg-white border border-[#EAEAEA] rounded-3xl p-5 shadow-sm">
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
              className="w-full rounded-full bg-[#1A1A1A] px-4 py-3 text-xs font-black text-white flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" /> Create
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .input-shell {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid #C8C8C8;
          background: #F8F8F8;
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
          <div className="bg-white border border-[#C8C8C8] rounded-3xl shadow-sm overflow-hidden">
            <div className="border-b border-[#EAEAEA] bg-[#F8F8F8] p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="min-w-0 flex-1 rounded-2xl border border-[#EAEAEA] bg-white px-3 py-2 text-sm font-black outline-none"
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

            <div className="bg-[#D9D9D9] p-4 sm:p-8 overflow-x-auto">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(event) => setEditorContent(event.currentTarget.innerHTML)}
                className="exam-word-editor mx-auto min-h-[920px] w-full max-w-[794px] bg-white text-[#111] shadow-xl border border-[#C8C8C8] p-8 sm:p-12 text-sm leading-7"
              />
            </div>

            <div className="border-t border-[#EAEAEA] bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <p className="text-xs font-bold text-[#666666]">
                {notice || 'Use this Word-style page to compose paper text and insert images.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewPaper({ title, content: editorContent })}
                  className="rounded-full border border-[#C8C8C8] bg-white px-4 py-2 text-xs font-black flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" /> Preview
                </button>
                <button
                  type="button"
                  onClick={() => persistPaper('draft')}
                  className="rounded-full bg-[#F8F8F8] border border-[#C8C8C8] px-4 py-2 text-xs font-black flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => persistPaper('teacher_review')}
                  className="rounded-full bg-[#E1FA6C] px-4 py-2 text-xs font-black flex items-center gap-2"
                >
                  <Send className="w-4 h-4" /> Send To Teacher
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#EAEAEA] rounded-3xl p-5 shadow-sm h-fit">
            <h3 className="text-sm font-black">Drafts and Rework Queue</h3>
            <p className="text-xs font-semibold text-[#666666] mt-1">
              Rejected papers can be opened, corrected, and resent.
            </p>
            <div className="mt-4 space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {reworkPapers.map((paper) => (
                <PaperTinyCard key={paper.id} paper={paper} state={state} onClick={() => loadPaper(paper)} />
              ))}
              {!reworkPapers.length && (
                <div className="rounded-2xl bg-[#F8F8F8] border border-[#EAEAEA] p-4 text-xs font-bold text-[#666666]">
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
    <label className="text-[#555555]">{label}</label>
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
    className="w-9 h-9 rounded-xl border border-[#C8C8C8] bg-white hover:bg-[#EAEAEA] flex items-center justify-center"
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
      className="w-full rounded-2xl border border-[#EAEAEA] bg-[#F8F8F8] p-3 text-left hover:border-[#8b5cf6] transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black truncate">{paper.title}</p>
        <span className={classNames('shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black', meta.tone)}>
          {meta.label}
        </span>
      </div>
      <p className="mt-1 text-[11px] font-bold text-[#666666]">
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
          teacherAssignments.some(
            (assignment) =>
              assignment.className === paper.className && assignment.subject === paper.subject
          )
      );
    } else if (role === 'admin') {
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

  return (
    <section className="space-y-5">
      <div className="bg-white border border-[#EAEAEA] rounded-3xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-black flex items-center gap-2">
            <Search className="w-4 h-4 text-[#8b5cf6]" /> Paper Analysis
          </h3>
          <p className="text-xs font-semibold text-[#666666] mt-1">
            Approval cycle between clerk, subject teacher, and admin.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-2xl border border-[#C8C8C8] bg-[#F8F8F8] px-3 py-2 text-xs font-black outline-none"
        >
          <option value="all">All statuses</option>
          <option value="teacher_review">Pending teacher approval</option>
          <option value="teacher_rejected">Teacher rejected</option>
          <option value="teacher_approved">Teacher approved</option>
          <option value="admin_review">Pending admin approval</option>
          <option value="admin_rejected">Admin rejected</option>
          <option value="selected">Selected</option>
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {visiblePapers.map((paper) => {
          const exam = state.exams.find((item) => item.id === paper.examId);
          const meta = getPaperStatusMeta(paper.status);
          const comment = commentDrafts[paper.id] || '';

          return (
            <div key={paper.id} className="bg-white border border-[#EAEAEA] rounded-3xl p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className={classNames('inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black', meta.tone)}>
                    {meta.label}
                  </span>
                  <h3 className="mt-3 text-base font-black truncate">{paper.title}</h3>
                  <p className="text-xs font-bold text-[#666666] mt-1">
                    {getExamLabel(exam)} | {paper.className} | {paper.subject} | Revision {paper.revision || 1}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewPaper(paper)}
                  className="rounded-full border border-[#C8C8C8] px-3 py-2 text-xs font-black flex items-center gap-2 self-start"
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

              <div className="mt-4 rounded-2xl bg-[#F8F8F8] border border-[#EAEAEA] p-3">
                <p className="text-[10px] font-black uppercase text-[#666666] mb-2">Workflow Comments</p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {(paper.comments || []).length ? (
                    paper.comments.map((item) => (
                      <div key={item.id} className="bg-white border border-[#EAEAEA] rounded-xl p-2">
                        <p className="text-[11px] font-black">
                          {item.action} by {item.actorName}
                        </p>
                        <p className="text-[11px] font-semibold text-[#666666]">{item.comment || 'No comment added.'}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] font-bold text-[#666666]">No comments yet.</p>
                  )}
                </div>
              </div>

              {role !== 'clerk' && paper.status !== 'selected' && (
                <textarea
                  value={comment}
                  onChange={(event) => updateComment(paper.id, event.target.value)}
                  placeholder="Write mistake/correction comment..."
                  rows={3}
                  className="mt-4 w-full rounded-2xl border border-[#C8C8C8] bg-[#F8F8F8] p-3 text-xs font-bold outline-none focus:border-[#8b5cf6]"
                />
              )}

              <PaperActionBar
                paper={paper}
                role={role}
                onDecision={(decision, requiresComment) => decide(paper, decision, requiresComment)}
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
              message="Papers will appear here after they are sent for teacher or admin approval."
            />
          </div>
        )}
      </div>

      {previewPaper && <PaperPreviewModal paper={previewPaper} onClose={() => setPreviewPaper(null)} />}
    </section>
  );
};

const InfoPill = ({ label, value }) => (
  <div className="rounded-2xl bg-[#F8F8F8] border border-[#EAEAEA] p-3">
    <p className="text-[9px] font-black uppercase text-[#666666]">{label}</p>
    <p className="mt-1 text-[#1A1A1A]">{value}</p>
  </div>
);

const PaperActionBar = ({ paper, role, onDecision, onRework }) => {
  const actions = [];

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

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#EAEAEA] pt-4">
      <div className="text-[10px] font-black uppercase text-[#666666]">
        {paper.status === 'selected' ? 'Paper selected for printing' : 'Awaiting next workflow action'}
      </div>
      <div className="flex flex-wrap gap-2">
        {canRework && (
          <button
            type="button"
            onClick={onRework}
            className="rounded-full border border-[#C8C8C8] bg-white px-3 py-2 text-xs font-black flex items-center gap-2"
          >
            <Edit3 className="w-4 h-4" /> Rework
          </button>
        )}
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
      .map((paper) => `<div class="page"><h2>${paper.title}</h2>${paper.content}</div>`)
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
                examId === exam.id ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white border-[#EAEAEA] hover:border-[#8b5cf6]'
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

      <div className="bg-white border border-[#EAEAEA] rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-600" /> Selected Papers
            </h3>
            <p className="text-xs font-bold text-[#666666] mt-1">{getExamLabel(selectedExam)}</p>
          </div>
          <button
            type="button"
            onClick={printSelectedPapers}
            className="rounded-full bg-[#E1FA6C] px-4 py-2 text-xs font-black flex items-center gap-2 self-start"
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
                  className === item ? 'bg-[#8b5cf6] border-[#8b5cf6] text-white' : 'bg-[#F8F8F8] border-[#EAEAEA]'
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

        <div className="mt-6 overflow-x-auto rounded-2xl border border-[#EAEAEA]">
          <table className="w-full min-w-[760px] text-left text-xs font-bold">
            <thead className="bg-[#EAEAEA] text-[#555555] uppercase text-[10px]">
              <tr>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Teacher</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Paper</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAEAEA]">
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
                    <td className="px-3 py-3 text-[#666666]">{item.teacherName}</td>
                    <td className="px-3 py-3">
                      <span className={classNames('rounded-full border px-2 py-1 text-[10px] font-black', meta.tone)}>
                        {paper?.status === 'selected' ? 'Selected' : paper ? meta.label : 'Not Created'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[#666666]">{paper?.title || 'Awaiting paper'}</td>
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
    openPrintWindow(
      `${getExamLabel(selectedExam)} Admit Cards`,
      buildAdmitCardHtml(selectedExam, className, students, scheduleRows)
    );
  };

  return (
    <section className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-6">
      <div className="bg-white border border-[#EAEAEA] rounded-3xl p-5 shadow-sm h-fit">
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
                className === item ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-[#F8F8F8] border-[#EAEAEA]'
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white border border-[#EAEAEA] rounded-3xl p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" /> Admit Card Setup
              </h3>
              <p className="text-xs font-bold text-[#666666] mt-1">
                Select exam, add subject date/time, then generate admit cards.
              </p>
            </div>
            <select
              value={examId}
              onChange={(event) => setExamId(event.target.value)}
              className="rounded-2xl border border-[#C8C8C8] bg-[#F8F8F8] px-3 py-2 text-xs font-black outline-none"
            >
              {state.exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {getExamLabel(exam)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-[#EAEAEA]">
            <table className="w-full min-w-[760px] text-left text-xs font-bold">
              <thead className="bg-[#EAEAEA] text-[#555555] uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">End</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {scheduleRows.map((row) => (
                  <tr key={row.subject}>
                    <td className="px-3 py-2 font-black">{row.subject}</td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(event) => updateSchedule(row.subject, 'date', event.target.value)}
                        className="rounded-xl border border-[#C8C8C8] bg-[#F8F8F8] px-2 py-2 outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        value={row.startTime}
                        onChange={(event) => updateSchedule(row.subject, 'startTime', event.target.value)}
                        className="rounded-xl border border-[#C8C8C8] bg-[#F8F8F8] px-2 py-2 outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        value={row.endTime}
                        onChange={(event) => updateSchedule(row.subject, 'endTime', event.target.value)}
                        className="rounded-xl border border-[#C8C8C8] bg-[#F8F8F8] px-2 py-2 outline-none"
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
              className="rounded-full bg-[#1A1A1A] text-white px-4 py-2 text-xs font-black flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Schedule
            </button>
            <button
              type="button"
              onClick={() => setShowAdmitPreview(true)}
              className="rounded-full border border-[#C8C8C8] bg-white px-4 py-2 text-xs font-black flex items-center gap-2"
            >
              <Eye className="w-4 h-4" /> Generate Admit Cards
            </button>
            <button
              type="button"
              onClick={printAdmitCards}
              className="rounded-full bg-[#E1FA6C] px-4 py-2 text-xs font-black flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Print All
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#EAEAEA] rounded-3xl p-5 shadow-sm">
          <h3 className="text-sm font-black flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" /> Student List: {className}
          </h3>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#EAEAEA]">
            <table className="w-full min-w-[920px] text-left text-xs font-bold">
              <thead className="bg-[#EAEAEA] text-[#555555] uppercase text-[10px]">
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
              <tbody className="divide-y divide-[#EAEAEA]">
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
    const students = getStudentsForClass(className);
    openPrintWindow(
      `${getExamLabel(selectedExam)} ${className} Report Cards`,
      buildReportCardHtml(state, selectedExam, students)
    );
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
      alert('No guardian Gmail addresses found for this class.');
      return;
    }

    setIsSendingReports(true);
    try {
      const result = await sendGmailMessages(messages);
      const nextState = recordReportDelivery({ examId, className, channel, actor });
      onRefresh(nextState);
      alert(`Gmail report cards sent successfully to ${result.sent} parent email group(s).`);
    } catch (error) {
      alert(`Report card Gmail failed: ${error.message}`);
    } finally {
      setIsSendingReports(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="bg-white border border-[#EAEAEA] rounded-3xl p-5 shadow-sm">
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
              disabled={isLocked}
              className={classNames(
                'w-full rounded-full px-4 py-3 text-xs font-black flex items-center justify-center gap-2',
                isLocked ? 'bg-[#EAEAEA] text-[#666666] cursor-not-allowed' : 'bg-[#E1FA6C] text-[#1A1A1A]'
              )}
            >
              <Save className="w-4 h-4" /> Save Marks
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-[#666666]">
          {selectedRecord ? (
            <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1">
              Last saved by {selectedRecord.enteredByName} on {formatExamDateTime(selectedRecord.updatedAt || selectedRecord.submittedAt)}
            </span>
          ) : (
            <span className="rounded-full bg-[#F8F8F8] border border-[#EAEAEA] px-3 py-1">No marks submitted yet</span>
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
        </div>
      </div>

      <div className="bg-white border border-[#EAEAEA] rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#8b5cf6]" /> Marks Entry
            </h3>
            <p className="text-xs font-bold text-[#666666] mt-1">
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
                className="rounded-full border border-[#C8C8C8] bg-white px-4 py-2 text-xs font-black flex items-center gap-2"
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

        <div className="mt-5 overflow-x-auto rounded-2xl border border-[#EAEAEA]">
          <table className="w-full min-w-[900px] text-left text-xs font-bold">
            <thead className="bg-[#EAEAEA] text-[#555555] uppercase text-[10px]">
              <tr>
                <th className="px-3 py-2">Roll</th>
                <th className="px-3 py-2">Admission No.</th>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Marks</th>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAEAEA]">
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
                      disabled={isLocked}
                      onChange={(event) => updateRow(row.studentId, 'marks', event.target.value)}
                      className="w-24 rounded-xl border border-[#C8C8C8] bg-[#F8F8F8] px-2 py-2 outline-none disabled:opacity-60"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-[#E1FA6C] px-2 py-1 text-[10px] font-black">
                      {row.marks === '' ? '-' : calculateGrade(row.marks, maxMarks)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.remark}
                      disabled={isLocked}
                      onChange={(event) => updateRow(row.studentId, 'remark', event.target.value)}
                      placeholder={row.marks === '' ? 'Remark' : getFocusRemark(row.marks, maxMarks)}
                      className="w-full rounded-xl border border-[#C8C8C8] bg-[#F8F8F8] px-2 py-2 outline-none disabled:opacity-60"
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
    () => getSavedReportOptionsForStudent(state, student),
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
  const rows = getReportRowsForStudent(state, reportStudent, selectedExam?.id);
  const total = rows.reduce((sum, row) => sum + Number(row.marks || 0), 0);
  const maxTotal = rows.reduce((sum, row) => sum + Number(row.maxMarks || 0), 0);
  const percentage = maxTotal ? Math.round((total / maxTotal) * 100) : 0;
  const focusRows = [...rows].sort((a, b) => a.marks / a.maxMarks - b.marks / b.maxMarks).slice(0, 2);

  const printReport = () => {
    openPrintWindow(
      `${getExamLabel(selectedExam)} ${student.displayName} Report Card`,
      buildReportCardHtml(state, selectedExam, [reportStudent])
    );
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#8b5cf6]" /> Examinations
            </h2>
            <p className="text-xs font-bold text-[#666666] mt-1">
              {student.displayName} | Viewing {selectedOption.className}-{student.section || 'A'} | Roll {student.rollNo}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={reportOptionKey}
              onChange={(event) => setReportOptionKey(event.target.value)}
              className="rounded-2xl border border-[#C8C8C8] bg-[#F8F8F8] px-3 py-2 text-xs font-black outline-none"
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
              onClick={printReport}
              className="rounded-full bg-[#E1FA6C] px-4 py-2 text-xs font-black flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Print Report Card
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
        <div className="xl:col-span-2 bg-white border border-[#EAEAEA] rounded-3xl p-5 shadow-sm">
          <h3 className="text-sm font-black">Subjectwise Report Card</h3>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#EAEAEA]">
            <table className="w-full min-w-[760px] text-left text-xs font-bold">
              <thead className="bg-[#EAEAEA] text-[#555555] uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Marks</th>
                  <th className="px-3 py-2">Grade</th>
                  <th className="px-3 py-2">Progress</th>
                  <th className="px-3 py-2">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {rows.map((row) => {
                  const percent = row.maxMarks ? Math.round((row.marks / row.maxMarks) * 100) : 0;
                  return (
                    <tr key={row.subject}>
                      <td className="px-3 py-3 font-black">{row.subject}</td>
                      <td className="px-3 py-3 font-mono">{row.marks}/{row.maxMarks}</td>
                      <td className="px-3 py-3">
                        <span className="bg-[#E1FA6C] px-2 py-1 rounded-md font-black">{row.grade}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 rounded-full bg-[#EAEAEA] overflow-hidden">
                            <div className="h-full bg-[#1A1A1A]" style={{ width: `${percent}%` }} />
                          </div>
                          <span className="font-mono">{percent}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[#666666]">{row.remark}</td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td className="px-3 py-8 text-center text-[#666666]" colSpan={5}>
                      Marks are not published for this exam yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-[#EAEAEA] rounded-3xl p-5 shadow-sm">
          <h3 className="text-sm font-black flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#8b5cf6]" /> Performance Trace
          </h3>
          <div className="mt-4 space-y-3">
            {focusRows.map((row) => (
              <div key={row.subject} className="rounded-2xl bg-[#F8F8F8] border border-[#EAEAEA] p-3">
                <p className="text-xs font-black">{row.subject}</p>
                <p className="text-[11px] font-bold text-[#666666] mt-1">{row.remark}</p>
              </div>
            ))}
            {!focusRows.length && (
              <div className="rounded-2xl bg-[#F8F8F8] border border-[#EAEAEA] p-3 text-xs font-bold text-[#666666]">
                Performance trace will appear after marks are uploaded.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

const EmptyAccess = ({ icon: Icon, title, message }) => (
  <div className="bg-white border border-[#EAEAEA] rounded-3xl p-10 shadow-sm text-center">
    <div className="mx-auto w-14 h-14 rounded-2xl bg-[#F5F3FF] text-[#8b5cf6] flex items-center justify-center">
      {React.createElement(Icon, { className: 'w-7 h-7' })}
    </div>
    <h3 className="mt-4 text-base font-black">{title}</h3>
    <p className="mt-2 text-xs font-bold text-[#666666] max-w-md mx-auto">{message}</p>
  </div>
);

const PaperPreviewModal = ({ paper, onClose }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl border border-[#EAEAEA]">
      <div className="p-4 border-b border-[#EAEAEA] flex items-center justify-between gap-3">
        <h3 className="text-sm font-black truncate">{paper.title}</h3>
        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-[#EAEAEA]">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="bg-[#D9D9D9] p-4 overflow-y-auto max-h-[80vh]">
        <div
          className="mx-auto max-w-[794px] min-h-[900px] bg-white border border-[#C8C8C8] p-8 sm:p-12 text-sm leading-7 shadow-xl"
          dangerouslySetInnerHTML={{ __html: paper.content }}
        />
      </div>
    </div>
  </div>
);

const AdmitCardPreviewModal = ({ exam, className, students, scheduleRows, onClose, onPrint }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[92vh] overflow-hidden shadow-2xl border border-[#EAEAEA]">
      <div className="p-4 border-b border-[#EAEAEA] flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black">{getExamLabel(exam)} Admit Cards</h3>
          <p className="text-xs font-bold text-[#666666]">{className} | {students.length} students</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrint}
            className="rounded-full bg-[#E1FA6C] px-4 py-2 text-xs font-black flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-[#EAEAEA]">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="bg-[#D9D9D9] p-4 overflow-y-auto max-h-[80vh] grid grid-cols-1 xl:grid-cols-2 gap-4">
        {students.slice(0, 4).map((student) => (
          <div key={student.id} className="bg-white border border-[#C8C8C8] rounded-2xl p-5">
            <div className="flex justify-between gap-4 border-b border-[#EAEAEA] pb-4">
              <div>
                <p className="text-[10px] font-black uppercase text-[#666666]">{getExamLabel(exam)}</p>
                <h3 className="text-base font-black mt-1">{student.displayName}</h3>
                <p className="text-xs font-bold text-[#666666]">{student.className}-{student.section} | Roll {student.rollNo}</p>
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
                <div key={row.subject} className="flex items-center justify-between gap-2 rounded-xl bg-[#F8F8F8] px-3 py-2">
                  <span>{row.subject}</span>
                  <span className="text-[#666666]">{formatExamDate(row.date)} | {row.startTime}-{row.endTime}</span>
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
