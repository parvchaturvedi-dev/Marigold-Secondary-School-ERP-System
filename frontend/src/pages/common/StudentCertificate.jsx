import React, { useMemo, useState } from 'react';
import { CalendarDays, FileCheck2, GraduationCap, Printer, Search } from 'lucide-react';
import { useMongoState } from '../../components/common/mongoState';
import { MASTER_NAMESPACES, normalizeStudentForDirectory } from '../../components/common/masterData';
import schoolLogo from '../../assets/logo.png';
import './StudentCertificatePrint.css';

const today = () => {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
};

const formatDate = (value) => {
  if (!value) return '________________';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
};

const formatShortDate = (value) => {
  if (!value) return '________________';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getStudentDetails = (student) => {
  const raw = student?.rawProfile || {};
  return {
    name: student?.displayName || student?.name || raw.studentName || '',
    admissionNumber: student?.admissionNumber || student?.id || raw.admissionNumber || '',
    fatherName: student?.fatherName || raw.fatherName || '',
    motherName: student?.motherName || raw.motherName || '',
    className: student?.className || student?.class || raw.targetClass || '',
    section: student?.section || raw.section || '',
    rollNo: student?.rollNo || raw.rollNo || '',
    dob: student?.dob || raw.dob || '',
    dateOfAdmission: student?.dateOfAdmission || raw.dateOfAdmission || '',
    address:
      student?.address ||
      student?.permAddress ||
      student?.tempAddress ||
      raw.permAddress ||
      raw.tempAddress ||
      raw.address ||
      '',
    gender: student?.gender || raw.gender || '',
  };
};

const escapePrintText = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])
  );

const CertificateField = ({ label, value, onChange, type = 'text', placeholder = '' }) => (
  <label className="flex flex-col gap-1.5 text-xs font-bold text-slate-600">
    <span>{label}</span>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
    />
  </label>
);

const CertificatePaper = ({ type, details, form }) => {
  const studentName = escapePrintText(details.name || '________________');
  const admissionNumber = escapePrintText(details.admissionNumber || '________________');
  const fatherName = escapePrintText(details.fatherName || '________________');
  const motherName = escapePrintText(details.motherName || '________________');
  const className = escapePrintText(
    [details.className, details.section && `Section ${details.section}`].filter(Boolean).join(' - ') ||
      '________________'
  );
  const dob = escapePrintText(formatDate(details.dob));
  const admissionDate = escapePrintText(formatDate(details.dateOfAdmission));

  if (type === 'study') {
    const shortName = escapePrintText(details.name || '________________');
    const isFemale = /^(female|f)$/i.test(details.gender);
    const relation = isFemale ? 'Daughter of' : 'Son of';
    const salutation = isFemale ? 'Miss' : 'Mr';
    return (
      <article className="certificate-print-area certificate-study-paper mx-auto w-full max-w-[297mm] border-2 border-[#6b2638] bg-white p-2 text-slate-900 shadow-xl sm:p-3">
        <header className="relative grid min-h-[32mm] grid-cols-[24mm_1fr_24mm] items-center border border-[#555] px-3 py-2 text-center">
          <img src={schoolLogo} alt="School logo" className="h-20 w-20 justify-self-center object-contain" />
          <div className="font-serif">
            <h1 className="text-base font-black uppercase leading-tight sm:text-xl">
              Marigold Public Secondary School, Behror, Kotputli-Behror
            </h1>
            <p className="text-sm font-black">BEHROR</p>
            <p className="mt-1 text-[10px] font-semibold sm:text-xs">
              Near Nagarpalika Board, Hamindpur Road, Behror
            </p>
            <p className="text-[10px] font-semibold sm:text-xs">Ph: 8107464600</p>
            <p className="text-[10px] font-semibold sm:text-xs">
              Email: marigoldvijay@gmail.com | Website: www.marigoldschoolbehror.com
            </p>
          </div>
          <p className="self-start justify-self-end pt-1 text-right text-[8px] font-bold">
            Certificate No.: {escapePrintText(form.certificateNumber || '________')}
          </p>
        </header>

        <div className="relative min-h-[137mm] border-x border-b border-[#555] px-4 pb-5 pt-2 font-serif text-[13px] sm:px-4 sm:text-[15px]">
          <h2 className="text-center font-black">Studying Certificate</h2>
          <p className="mt-3 font-sans text-sm">
            Date: &nbsp; {escapePrintText(formatShortDate(form.issueDate))}
          </p>
          <h3 className="mt-1 text-center text-base font-black underline underline-offset-2">
            TO WHOM IT MAY CONCERN
          </h3>
          <div className="absolute right-5 top-3 flex h-20 w-20 flex-col items-center justify-center border border-slate-300 bg-slate-50 text-slate-900">
            <GraduationCap className="h-12 w-12" strokeWidth={2.5} />
            <span className="text-[8px] font-bold">STUDENT</span>
          </div>

          <div className="mt-5 space-y-1.5 pr-20 leading-6 sm:pr-24">
            <p className="italic">
              This is certified that <span className="certificate-study-value">{shortName}</span>
            </p>
            <p className="italic">
              {salutation} &nbsp; {shortName}
            </p>
            <p className="italic">
              {relation} &nbsp; <span className="certificate-study-value">{fatherName}</span>
            </p>
            <p className="italic">
              Mother Name &nbsp; <span className="certificate-study-value">{motherName}</span>
            </p>
            <p className="italic">
              Address &nbsp; <span className="certificate-study-value">{escapePrintText(details.address || '________________')}</span>
            </p>
            <p className="italic">is the regular student of this institution</p>
            <p className="italic">
              He/She has been studying &nbsp; <span className="certificate-study-value">{className}</span>
              &nbsp; under S.R.No. &nbsp; <span className="certificate-study-value">{admissionNumber}</span>
            </p>
            <p className="italic">in class &nbsp; <span className="certificate-study-value">{className}</span></p>
            <p className="pt-2 italic">
              His/Her date of birth as per our institution record is &nbsp;
              <strong className="underline underline-offset-2">{escapePrintText(formatShortDate(details.dob))}</strong>
            </p>
            {form.purpose && (
              <p className="pt-1 italic">
                Purpose: <span className="certificate-study-value">{escapePrintText(form.purpose)}</span>
              </p>
            )}
          </div>

          <p className="absolute bottom-3 right-5 font-bold italic">
            Initials of the Head of the Institution
          </p>
        </div>
      </article>
    );
  }

  return (
    <article className="certificate-print-area mx-auto min-h-[297mm] w-full max-w-[210mm] border border-slate-200 bg-white p-10 text-slate-900 shadow-xl sm:p-14">
      <header className="border-b-2 border-slate-900 pb-5 text-center">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-indigo-900">MGPS</p>
        <h1 className="mt-2 text-2xl font-black uppercase tracking-wide sm:text-3xl">
          Marigold Secondary School
        </h1>
        <p className="mt-1 text-sm font-semibold">Behror, Rajasthan</p>
        <h2 className="mt-8 inline-block border-y border-slate-800 px-8 py-2 text-xl font-black uppercase tracking-widest">
          {type === 'transfer' ? 'Transfer Certificate' : 'Study Certificate'}
        </h2>
      </header>

      <div className="mt-6 flex flex-wrap justify-between gap-2 text-sm font-semibold">
        <p>Certificate No.: {escapePrintText(form.certificateNumber || '________________')}</p>
        <p>Date: {escapePrintText(formatDate(form.issueDate))}</p>
      </div>

      {type === 'transfer' ? (
        <div className="mt-10 space-y-5 text-[15px] leading-8">
          <p>
            This is to certify that <strong>{studentName}</strong>, child of{' '}
            <strong>{fatherName}</strong> and <strong>{motherName}</strong>, was a student of this
            school.
          </p>
          <dl className="grid grid-cols-[minmax(145px,0.8fr)_1fr] gap-x-4 gap-y-3">
            <dt className="font-bold">Admission number</dt><dd>{admissionNumber}</dd>
            <dt className="font-bold">Class / Section</dt><dd>{className}</dd>
            <dt className="font-bold">Roll number</dt><dd>{escapePrintText(details.rollNo || '________________')}</dd>
            <dt className="font-bold">Date of birth</dt><dd>{dob}</dd>
            <dt className="font-bold">Date of admission</dt><dd>{admissionDate}</dd>
            <dt className="font-bold">Last date attended</dt><dd>{escapePrintText(formatDate(form.leavingDate))}</dd>
            <dt className="font-bold">Reason for leaving</dt><dd>{escapePrintText(form.reason || '________________')}</dd>
            <dt className="font-bold">Conduct</dt><dd>{escapePrintText(form.conduct || '________________')}</dd>
          </dl>
          <p className="pt-3">
            The student is hereby granted this Transfer Certificate on request. The details above
            have been checked against the school records.
          </p>
        </div>
      ) : (
        <div className="mt-12 space-y-8 text-[16px] leading-9">
          <p>
            This is to certify that <strong>{studentName}</strong>, child of{' '}
            <strong>{fatherName}</strong> and <strong>{motherName}</strong>, is / was a bonafide
            student of Marigold Secondary School, Behror.
          </p>
          <p>
            As per the school records, the student was admitted on <strong>{admissionDate}</strong>,
            is / was studying in <strong>{className}</strong>, and the date of birth is{' '}
            <strong>{dob}</strong>. Admission number: <strong>{admissionNumber}</strong>.
          </p>
          <p>
            This certificate is issued on the request of the student / parent for the purpose of{' '}
            <strong>{escapePrintText(form.purpose || '________________')}</strong>.
          </p>
        </div>
      )}

      <footer className="mt-24 flex justify-between gap-10 text-center text-sm font-bold">
        <div className="min-w-40 border-t border-slate-800 pt-2">Class Teacher</div>
        <div className="min-w-40 border-t border-slate-800 pt-2">Principal / Authorized Signatory</div>
      </footer>
    </article>
  );
};

const StudentCertificate = ({ type }) => {
  const [students, , studentMeta] = useMongoState(MASTER_NAMESPACES.students, []);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({
    certificateNumber: '',
    issueDate: today(),
    leavingDate: today(),
    reason: '',
    conduct: 'Good',
    purpose: '',
  });

  const directory = useMemo(
    () => (Array.isArray(students) ? students : []).map(normalizeStudentForDirectory),
    [students]
  );
  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return directory;
    return directory.filter((student) =>
      [
        student.displayName,
        student.admissionNumber,
        student.className,
        student.section,
        student.fatherName,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [directory, search]);
  const selectedStudent =
    directory.find((student) => String(student.id) === selectedId) || null;
  const details = getStudentDetails(selectedStudent);
  const title = type === 'transfer' ? 'Transfer Certificate' : 'Study Certificate';
  const Icon = type === 'transfer' ? FileCheck2 : GraduationCap;

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-6 p-4 font-sans text-slate-900 sm:p-6">
      <style>{`
        .certificate-study-value { display: inline-block; min-width: 150px; max-width: 100%; overflow-wrap: anywhere; border-bottom: 1px dotted #555; padding: 0 6px; font-style: normal; font-weight: 700; }
        @page { size: A4 ${type === 'study' ? 'landscape' : 'portrait'}; margin: 0; }
        @media print {
          html, body, #root { width: ${type === 'study' ? '297mm' : '210mm'}; min-height: ${type === 'study' ? '210mm' : '297mm'}; margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          .certificate-print-area, .certificate-print-area * { visibility: visible !important; }
          .certificate-print-area { position: absolute !important; inset: 0 auto auto 0 !important; width: ${type === 'study' ? '297mm' : '210mm'} !important; min-height: ${type === 'study' ? '210mm' : '297mm'} !important; max-width: none !important; margin: 0 !important; padding: ${type === 'study' ? '8mm' : '18mm'} !important; border: 0 !important; box-shadow: none !important; }
          .certificate-study-paper { border: 2px solid #6b2638 !important; padding: 3mm !important; }
        }
      `}</style>

      <section className="no-print glass-card rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-700"><Icon className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-black">{title}</h1>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Select a student, verify the details and print the certificate. Nothing is saved unless you choose to save it from the print dialog.
            </p>
          </div>
        </div>
      </section>

      <div className="no-print grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <section className="glass-card rounded-3xl p-5">
          <h2 className="mb-4 text-sm font-black uppercase tracking-wider">Student</h2>
          <label className="relative mb-3 block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, admission no., class"
              className="w-full rounded-xl border border-white/80 bg-white/70 py-2.5 pl-10 pr-3 text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />
          </label>
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            className="w-full rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-400"
            disabled={studentMeta.isLoading}
          >
            <option value="">{studentMeta.isLoading ? 'Loading students…' : 'Select a student'}</option>
            {filteredStudents.map((student, index) => (
              <option key={`${student.id}-${index}`} value={String(student.id)}>
                {student.displayName} · {student.admissionNumber || student.id} · {student.className}
              </option>
            ))}
          </select>
          {studentMeta.error && <p role="alert" className="mt-3 text-xs font-semibold text-red-700">{studentMeta.error}</p>}
          {!studentMeta.isLoading && !studentMeta.error && !directory.length && (
            <p className="mt-3 text-xs font-semibold text-amber-700">No student records are available in this session.</p>
          )}
          {selectedStudent && (
            <div className="mt-4 rounded-2xl bg-white/55 p-4 text-xs font-semibold leading-6 text-slate-600">
              <p><strong>Name:</strong> {details.name}</p>
              <p><strong>Admission no.:</strong> {details.admissionNumber || '—'}</p>
              <p><strong>Class:</strong> {[details.className, details.section].filter(Boolean).join(' - ') || '—'}</p>
              <p><strong>Parent:</strong> {details.fatherName || '—'}</p>
            </div>
          )}
        </section>

        <section className="glass-card rounded-3xl p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider">
            <CalendarDays className="h-4 w-4" /> Certificate details
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <CertificateField label="Certificate number (optional)" value={form.certificateNumber} onChange={(value) => updateForm('certificateNumber', value)} />
            <CertificateField label="Issue date" type="date" value={form.issueDate} onChange={(value) => updateForm('issueDate', value)} />
            {type === 'transfer' ? (
              <>
                <CertificateField label="Last date attended" type="date" value={form.leavingDate} onChange={(value) => updateForm('leavingDate', value)} />
                <CertificateField label="Reason for leaving" value={form.reason} onChange={(value) => updateForm('reason', value)} placeholder="e.g. Parent's request" />
                <CertificateField label="Conduct" value={form.conduct} onChange={(value) => updateForm('conduct', value)} />
              </>
            ) : (
              <div className="sm:col-span-2">
                <CertificateField label="Purpose of certificate" value={form.purpose} onChange={(value) => updateForm('purpose', value)} placeholder="e.g. Passport application" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!selectedStudent}
            className="mt-5 inline-flex items-center gap-2 rounded-xl btn-primary px-5 py-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </button>
        </section>
      </div>

      {selectedStudent ? (
        <CertificatePaper type={type} details={details} form={form} />
      ) : (
        <div className="no-print glass-card rounded-3xl p-10 text-center text-sm font-semibold text-slate-500">
          Select a student to preview the certificate.
        </div>
      )}
    </div>
  );
};

export default StudentCertificate;
