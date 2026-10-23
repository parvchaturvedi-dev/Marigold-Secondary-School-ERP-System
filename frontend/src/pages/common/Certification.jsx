import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  FileBadge2,
  Medal,
  Printer,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
} from 'lucide-react';
import { MASTER_NAMESPACES, normalizeStudentForDirectory } from '../../components/common/masterData';
import { useMongoState } from '../../components/common/mongoState';
import schoolLogo from '../../assets/logo.png';
import './CertificationPrint.css';

const SETTINGS_NAMESPACE = 'admin-certification-builder-settings';
const CERTIFICATE_TYPES = [
  { id: 'academic', label: 'Academic', icon: BookOpen, color: '#174a73' },
  { id: 'sports', label: 'Sports', icon: Trophy, color: '#17754b' },
  { id: 'bonafide', label: 'Bonafide', icon: ShieldCheck, color: '#5b3a8c' },
  { id: 'achievement', label: 'Achievement', icon: Medal, color: '#a86412' },
];
const DEFAULT_TEMPLATE = {
  academic: {
    title: 'Certificate',
    statement:
      'Of {{className}}, in recognition of {{achievement}}, dedication to learning, and a consistent pursuit of excellence during the academic session {{academicYear}}.',
    accentColor: '#174a73',
    schoolName: 'Marigold Public Secondary School',
    address: 'Behror, Rajasthan',
    achievement: 'outstanding academic performance',
    examName: '',
    academicYear: '',
    percentage: '',
    grade: '',
    signatoryName: '',
    signatoryTitle: 'Principal',
  },
  sports: {
    title: 'Certificate of Sports Achievement',
    statement:
      'This certificate is presented to {{studentName}} of {{className}} for outstanding performance in {{sport}} at {{eventName}}, achieving {{achievement}}.',
    accentColor: '#17754b',
    sport: '',
    eventName: '',
    achievement: '',
    signatoryName: '',
    signatoryTitle: 'Sports Coordinator',
  },
  bonafide: {
    title: 'Bonafide Certificate',
    statement:
      'This is to certify that {{studentName}}, child of {{fatherName}}, is a bonafide student of Marigold Public Secondary School, Behror, studying in {{className}}. This certificate is issued for {{purpose}}.',
    accentColor: '#5b3a8c',
    purpose: '',
    signatoryName: '',
    signatoryTitle: 'Principal',
  },
  achievement: {
    title: 'Certificate of Achievement',
    statement:
      'This certificate is awarded to {{studentName}} of {{className}} in recognition of {{achievement}} at {{eventName}}.',
    accentColor: '#a86412',
    eventName: '',
    achievement: '',
    signatoryName: '',
    signatoryTitle: 'Principal',
  },
};

const today = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const formatDate = (value) => {
  if (!value) return '________________';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
};

const createCertificateNumber = (type) =>
  `MGPS/${type.slice(0, 4).toUpperCase()}/${new Date().getFullYear()}/${String(Date.now()).slice(-6)}`;

const getInitialForm = (type, savedTemplate = {}) => ({
  ...DEFAULT_TEMPLATE[type],
  ...(savedTemplate || {}),
  certificateNumber: createCertificateNumber(type),
  issueDate: today(),
});

const escapeText = (value) => String(value ?? '');

const replaceTokens = (text, values) =>
  String(text || '').replace(/\{\{(\w+)\}\}/g, (_match, key) => escapeText(values[key] || '________________'));

const CertificateField = ({ label, value, onChange, placeholder, type = 'text', min, max, step }) => (
  <label className="block min-w-0 text-xs font-bold text-slate-600">
    <span className="mb-1.5 block">{label}</span>
    <input
      type={type}
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
    />
  </label>
);

const CertificatePreview = ({ template, form, student, result, exam, type, paperRef }) => {
  const values = {
    studentName: student?.displayName || student?.name,
    fatherName: student?.fatherName,
    motherName: student?.motherName,
    className: [student?.className, student?.section && `Section ${student.section}`].filter(Boolean).join(' - '),
    admissionNumber: student?.admissionNumber || student?.id,
    percentage: form.percentage || (result.percentage === null ? '' : result.percentage.toFixed(2)),
    grade: form.grade || result.grade,
    examName: form.examName || exam?.name,
    academicYear: form.academicYear || exam?.academicYear,
    sport: form.sport,
    eventName: form.eventName,
    achievement: form.achievement,
    purpose: form.purpose,
  };
  const title = form.title || template.label;
  const statement = replaceTokens(form.statement, values);

  return (
    <article
      ref={paperRef}
      className={`certificate-builder-paper ${type.id === 'academic' ? 'certificate-builder-paper--academic' : ''}`}
      style={{ '--certificate-accent': form.accentColor }}
    >
      {type.id === 'academic' ? (
        <>
          <header className="certificate-academic-topband">
            <img src={schoolLogo} alt="Marigold school logo" />
            <div className="certificate-academic-school">
              <h2>{form.schoolName || 'Marigold Public Secondary School'}</h2>
              <p>{form.address || 'School Address, City'}</p>
              <span className="certificate-academic-ornament">— ❖ —</span>
            </div>
            <div className="certificate-academic-emblem" aria-label="Learn, grow, achieve">
              <BookOpen aria-hidden="true" />
              <span>LEARN<br />GROW<br />ACHIEVE</span>
            </div>
          </header>
          <div className="certificate-academic-laurel certificate-academic-laurel--left" aria-hidden="true">❧</div>
          <div className="certificate-academic-laurel certificate-academic-laurel--right" aria-hidden="true">❧</div>
          <main className="certificate-academic-content">
            <p className="certificate-academic-eyebrow">HONOURING EXCELLENCE</p>
            <h1>ACADEMIC EXCELLENCE</h1>
            <div className="certificate-academic-certificate-title">
              <span />
              <h2>{title}</h2>
              <span />
            </div>
            <p className="certificate-academic-awarded">THIS CERTIFICATE IS PROUDLY AWARDED TO</p>
            <h3 className="certificate-academic-student-name">
              {student?.displayName || student?.name || 'Student Name'}
            </h3>
            <div className="certificate-academic-gold-line" />
            <p className="certificate-academic-statement">{statement}</p>
            <p className="certificate-academic-message">
              Your hard work, discipline and commitment to success are an inspiration to the school community.
            </p>
            {(form.percentage || result.percentage !== null) && (
              <p className="certificate-academic-result">
                Academic result: <strong>{form.percentage || result.percentage.toFixed(2)}%</strong>
                <span aria-hidden="true"> · </span>
                Grade <strong>{form.grade || result.grade}</strong>
              </p>
            )}
          </main>
          <div className="certificate-academic-seal" aria-label="Excellence award seal">
            <div className="certificate-academic-seal-inner">
              <span>★</span>
              <small>EXCELLENCE</small>
            </div>
          </div>
          <footer className="certificate-academic-signatures">
            <div className="certificate-academic-signature">
              <strong>{form.signatoryName || 'Principal'}</strong>
              <span className="certificate-academic-signature-line" />
              <span>{form.signatoryTitle || 'PRINCIPAL'}</span>
            </div>
            <div className="certificate-academic-certificate-number">
              <span className="certificate-academic-medal-ribbon" aria-hidden="true" />
              <span>{form.certificateNumber || 'CERTIFICATE NUMBER'}</span>
            </div>
            <div className="certificate-academic-signature">
              <strong>{formatDate(form.issueDate)}</strong>
              <span className="certificate-academic-signature-line" />
              <span>DATE</span>
            </div>
          </footer>
        </>
      ) : (
      <div className="certificate-builder-frame">
        <header className="certificate-builder-header">
          <img src={schoolLogo} alt="Marigold school logo" />
          <div className="certificate-builder-school">
            <h1>Marigold Public Secondary School</h1>
            <p>Behror, Rajasthan · Reg. No. 52/ALW/2000</p>
            <p>marigoldvijay@gmail.com · www.marigoldschoolbehror.com</p>
          </div>
          <div className="certificate-builder-number">
            <span>Certificate No.</span>
            <strong>{form.certificateNumber || '________________'}</strong>
          </div>
        </header>

        <div className="certificate-builder-body">
          <div className="certificate-builder-kicker">
            <Sparkles aria-hidden="true" />
            <span>MARIGOLD · {template.label.toUpperCase()}</span>
          </div>
          <h2>{title}</h2>
          <div className="certificate-builder-rule" />

          <div className="certificate-builder-recipient">
            <p>PROUDLY PRESENTED TO</p>
            <h3>{student?.displayName || student?.name || 'Student Name'}</h3>
            <span>
              {student
                ? `${student.className || 'Class'}${student.section ? ` · Section ${student.section}` : ''}`
                : 'Select a student to preview'}
            </span>
          </div>

          <p className="certificate-builder-statement">{statement}</p>

          {type.id === 'academic' && result.subjects.length > 0 && (
            <>
              <div className="certificate-builder-result">
                <div><span>Examination</span><strong>{exam?.name || '—'}</strong></div>
                <div><span>Marks obtained</span><strong>{result.totalMarks} / {result.maxMarks}</strong></div>
                <div><span>Percentage</span><strong>{result.percentage.toFixed(2)}%</strong></div>
                <div><span>Overall grade</span><strong>{result.grade}</strong></div>
              </div>
              <table className="certificate-builder-subjects">
                <thead><tr><th>Subject</th><th>Marks</th><th>Grade</th></tr></thead>
                <tbody>
                  {result.subjects.map((subject) => (
                    <tr key={subject.subject}>
                      <td>{subject.subject}</td>
                      <td>{subject.marks} / {subject.maxMarks}</td>
                      <td>{subject.grade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="certificate-builder-footer">
            <div className="certificate-builder-date">
              <span>Date of issue</span>
              <strong>{formatDate(form.issueDate)}</strong>
            </div>
            <div className="certificate-builder-sign">
              <span className="certificate-builder-signline" />
              <strong>{form.signatoryName || 'Authorized Signatory'}</strong>
              <span>{form.signatoryTitle || 'Principal'}</span>
            </div>
          </div>
        </div>
      </div>
      )}
    </article>
  );
};

const CertificationBuilder = () => {
  const certificateRef = useRef(null);
  const [students, , studentMeta] = useMongoState(MASTER_NAMESPACES.students, []);
  const [savedSettings, setSavedSettings, settingsMeta] = useMongoState(SETTINGS_NAMESPACE, { templates: {} });
  const [activeType, setActiveType] = useState(CERTIFICATE_TYPES[0].id);
  const activeTemplate = CERTIFICATE_TYPES.find((item) => item.id === activeType) || CERTIFICATE_TYPES[0];
  const savedTemplate = useMemo(
    () => savedSettings?.templates?.[activeType] || {},
    [activeType, savedSettings]
  );
  const [form, setForm] = useState(() => getInitialForm(activeType));
  const previousType = useRef(activeType);
  const settingsHydrated = useRef(false);
  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [saveNotice, setSaveNotice] = useState('');

  const directory = useMemo(
    () => (Array.isArray(students) ? students : []).map(normalizeStudentForDirectory),
    [students]
  );
  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return directory;
    return directory.filter((student) =>
      [student.displayName, student.admissionNumber, student.className, student.fatherName]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [directory, search]);
  const student = directory.find((item) => String(item.id) === studentId) || null;
  const selectedExam = null;
  const result = { subjects: [], percentage: null, grade: '—' };

  useEffect(() => {
    const typeChanged = previousType.current !== activeType;
    previousType.current = activeType;

    if (typeChanged || (!settingsMeta.isLoading && !settingsHydrated.current)) {
      setForm(getInitialForm(activeType, savedTemplate));
      if (typeChanged) setSaveNotice('');
    } else if (!settingsMeta.isLoading) {
      setForm((current) => ({
        ...current,
        ...savedTemplate,
        certificateNumber: current.certificateNumber,
        issueDate: current.issueDate,
      }));
    }

    if (!settingsMeta.isLoading) settingsHydrated.current = true;
  }, [activeType, savedTemplate, settingsMeta.isLoading]);

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const updateFormField = (key) => (value) => updateForm(key, value);

  const updateSavedTemplate = (nextTemplate) => {
    const templates = { ...(savedSettings?.templates || {}), [activeType]: nextTemplate };
    setSavedSettings({ ...savedSettings, templates });
  };

  const saveTemplate = () => {
    updateSavedTemplate(form);
    setSaveNotice('Template saved. Your wording and settings will be ready next time.');
  };

  const resetTemplate = () => {
    const nextForm = getInitialForm(activeType);
    setForm(nextForm);
    updateSavedTemplate(nextForm);
    setSaveNotice('This template has been reset to its school default.');
  };

  const canPrint = Boolean(student);

  const printCertificate = () => {
    if (!canPrint) {
      setSaveNotice('Select a student before printing.');
      return;
    }
    const certificate = certificateRef.current;
    if (!certificate) {
      setSaveNotice('The certificate preview is not ready to print.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1200,height=850');
    if (!printWindow) {
      setSaveNotice('Please allow pop-ups to print the certificate.');
      return;
    }
    const pageStyles = [...document.head.querySelectorAll('link[rel="stylesheet"], style')]
      .map((node) => node.outerHTML)
      .join('');
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html><head><meta charset="utf-8"><base href="${document.baseURI}">${pageStyles}
      <style>
        @page { size: A4 landscape; margin: 5mm; }
        html, body { width: 287mm; height: 200mm; margin: 0; padding: 0; background: #fff; }
        body { display: flex; align-items: flex-start; justify-content: flex-start; }
        .certificate-builder-paper {
          position: relative !important;
          top: auto !important;
          left: auto !important;
          width: 287mm !important;
          min-width: 0 !important;
          max-width: 287mm !important;
          height: 200mm !important;
          min-height: 0 !important;
          aspect-ratio: auto !important;
          margin: 0 !important;
          overflow: hidden !important;
          box-shadow: none !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @media print {
          html, body { width: 287mm; height: 200mm; overflow: hidden; }
        }
      </style></head>
      <body>${certificate.outerHTML}
      <script>
        window.addEventListener('load', async () => {
          if (document.fonts) await document.fonts.ready;
          window.focus();
          window.print();
        });
      </script></body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 pb-8 font-sans text-slate-900">
      <section className="glass-card rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-600">
              <FileBadge2 className="h-5 w-5" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Marigold ERP · Document Studio</span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight">Certificate Builder</h1>
            <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-slate-500">
              Choose a certificate style, select any student and personalise every detail before printing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveTemplate}
              disabled={settingsMeta.isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-black text-indigo-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> Save template
            </button>
            <button
              type="button"
              onClick={printCertificate}
              disabled={!canPrint}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-4 w-4" /> Print certificate
            </button>
          </div>
        </div>
        {(saveNotice || settingsMeta.error) && (
          <p className={`mt-3 text-xs font-bold ${settingsMeta.error ? 'text-rose-700' : 'text-emerald-700'}`} role="status">
            {settingsMeta.error || saveNotice}
          </p>
        )}
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
        <section className="glass-card min-w-0 space-y-5 rounded-3xl p-5">
          <div>
            <h2 className="text-sm font-black">Certificate style</h2>
            <div
              className="certificate-type-tabs mt-3"
              role="tablist"
              style={{ '--active-tab': CERTIFICATE_TYPES.findIndex((item) => item.id === activeType) }}
            >
              {CERTIFICATE_TYPES.map((item) => {
                const Icon = item.icon;
                const selected = item.id === activeType;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveType(item.id)}
                    className={`certificate-type-tab ${selected ? 'is-active' : ''}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-black">2 · Select student</h2>
            {studentMeta.error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-700">{studentMeta.error}</p>}
            <label className="relative mt-3 block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search student, admission no. or class"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </label>
            <div className="mt-2 flex items-center gap-2">
              <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
              <select
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                disabled={studentMeta.isLoading}
                className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-400 disabled:opacity-50"
              >
                <option value="">{studentMeta.isLoading ? 'Loading students…' : 'Select a student'}</option>
                {filteredStudents.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.displayName} · {item.admissionNumber || item.id} · {item.className || 'Class unavailable'}
                  </option>
                ))}
              </select>
            </div>
            {!studentMeta.isLoading && !directory.length && (
              <p className="mt-2 text-xs font-semibold text-amber-700">No student records are available.</p>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-black">Certificate details</h2>
            <CertificateField label="Certificate title" value={form.title} onChange={updateFormField('title')} />
            <div className="grid grid-cols-2 gap-3">
              <CertificateField label="Certificate number" value={form.certificateNumber} onChange={updateFormField('certificateNumber')} />
              <CertificateField label="Issue date" type="date" value={form.issueDate} onChange={updateFormField('issueDate')} />
            </div>
            {activeType === 'academic' && (
              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                <CertificateField label="School name" value={form.schoolName} onChange={updateFormField('schoolName')} />
                <CertificateField label="School address" value={form.address} onChange={updateFormField('address')} />
                <CertificateField label="Examination name" value={form.examName} onChange={updateFormField('examName')} placeholder="e.g. Class 10 Board Examination" />
                <CertificateField label="Academic year" value={form.academicYear} onChange={updateFormField('academicYear')} placeholder="e.g. 2025–2026" />
                <CertificateField label="Achievement" value={form.achievement} onChange={updateFormField('achievement')} placeholder="e.g. outstanding academic performance" />
                <CertificateField label="Percentage (optional)" value={form.percentage} onChange={updateFormField('percentage')} placeholder="e.g. 85.67" />
                <CertificateField label="Grade (optional)" value={form.grade} onChange={updateFormField('grade')} placeholder="e.g. A1" />
              </div>
            )}
            {(activeType === 'sports' || activeType === 'achievement') && (
              <>
                {activeType === 'sports' && (
                  <CertificateField label="Sport" value={form.sport} onChange={updateFormField('sport')} placeholder="e.g. Athletics" />
                )}
                <CertificateField label="Event / competition" value={form.eventName} onChange={updateFormField('eventName')} placeholder="e.g. Inter-school sports meet" />
                <CertificateField label="Achievement / position" value={form.achievement} onChange={updateFormField('achievement')} placeholder="e.g. First place" />
              </>
            )}
            {activeType === 'bonafide' && (
              <CertificateField label="Purpose" value={form.purpose} onChange={updateFormField('purpose')} placeholder="e.g. Passport application" />
            )}
            <label className="block text-xs font-bold text-slate-600">
              <span className="mb-1.5 block">Certificate statement</span>
              <textarea
                rows={5}
                value={form.statement}
                onChange={(event) => updateForm('statement', event.target.value)}
                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium leading-6 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
              <span className="mt-1 block font-medium text-slate-400">
                Placeholders: {'{{studentName}}'}, {'{{fatherName}}'}, {'{{className}}'}, {'{{purpose}}'}, {'{{achievement}}'}, {'{{eventName}}'}, {'{{sport}}'}, {'{{percentage}}'}, {'{{grade}}'}, {'{{examName}}'}, {'{{academicYear}}'}.
              </span>
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-3">
              <CertificateField label="Signatory name" value={form.signatoryName} onChange={updateFormField('signatoryName')} placeholder="Optional" />
              <CertificateField label="Accent" type="color" value={form.accentColor} onChange={updateFormField('accentColor')} />
            </div>
            <CertificateField label="Signatory title" value={form.signatoryTitle} onChange={updateFormField('signatoryTitle')} placeholder="e.g. Principal" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] font-semibold text-slate-400">All fields are editable; no eligibility rule is applied.</p>
              <button
                type="button"
                onClick={resetTemplate}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset this template
              </button>
            </div>
          </div>
        </section>

        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <h2 className="text-sm font-black">Live preview</h2>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">Reference-style A4 landscape certificate. Preview updates as you edit.</p>
            </div>
            <span className="rounded-full bg-white/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">A4 · Landscape</span>
          </div>
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-slate-200/70 p-3 sm:p-5">
            <CertificatePreview
              paperRef={certificateRef}
              template={activeTemplate}
              form={form}
              student={student}
              result={result}
              exam={selectedExam}
              type={activeTemplate}
            />
          </div>
        </section>
      </div>
    </div>
  );
};

const Certification = ({ role = 'student' }) => {
  if (!['admin', 'clerk'].includes(role)) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/70 bg-white/70 p-8 text-center shadow-sm">
        <ShieldCheck className="mx-auto h-10 w-10 text-indigo-500" />
        <h1 className="mt-4 text-xl font-black text-slate-900">School Certificates</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Certificate creation and printing are managed by the school office. Please contact the admin or clerk.
        </p>
      </div>
    );
  }
  return <CertificationBuilder />;
};

export default Certification;
