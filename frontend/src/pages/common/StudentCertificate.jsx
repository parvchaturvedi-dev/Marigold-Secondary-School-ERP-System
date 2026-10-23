import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const asDateInputValue = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value).slice(0, 10) : parsed.toISOString().slice(0, 10);
};

const normalizePaathshalaStudent = (record) => {
  const id =
    record.SID ??
    record.sid ??
    record.StudentId ??
    record.studentId ??
    record['Adm No#'] ??
    record.FormNo ??
    record.SrNo ??
    '';
  const name = record.StuName || record["Student's Name"] || record.StudentName || '';
  const classId = record.Class ?? record.class ?? '';
  const sectionId = record.Section ?? record.section ?? '';
  const rawProfile = {
    studentName: name,
    admissionNumber: record.FormNo || record.SrNo || id,
    fatherName: record.FatherName || record["Father's Name"] || '',
    motherName: record.mothername || record.MotherName || record["Mother's Name"] || '',
    targetClass: classId ? `Class ID ${classId} (source class name unavailable)` : '',
    section: sectionId ? `Section ID ${sectionId} (source section name unavailable)` : '',
    rollNo: record.SrNo || '',
    dob: asDateInputValue(record.Dob || record.DOB),
    dateOfAdmission: asDateInputValue(record.AdminDate || record["Date Of Adm#"]),
    permAddress: record.ParmanentAdd || record.Address || '',
    tempAddress: record.CorrsAdd || '',
    gender: record.Gender || record.Sex || '',
  };
  return {
    id: `paathshala:${id}`,
    sourceStudentId: String(id),
    displayName: name || `Student ${id}`,
    admissionNumber: rawProfile.admissionNumber,
    fatherName: rawProfile.fatherName,
    motherName: rawProfile.motherName,
    className: rawProfile.targetClass,
    section: rawProfile.section,
    rollNo: rawProfile.rollNo,
    dob: rawProfile.dob,
    dateOfAdmission: rawProfile.dateOfAdmission,
    address: rawProfile.permAddress || rawProfile.tempAddress,
    gender: rawProfile.gender,
    rawProfile,
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

        <div className="certificate-study-content relative min-h-[170mm] border-x border-b border-[#555] px-4 pb-5 pt-2 font-serif text-[13px] sm:px-4 sm:text-[15px]">
          <h2 className="text-center font-black">Studying Certificate</h2>
          <p className="mt-3 font-sans text-sm">
            Date: &nbsp; {escapePrintText(formatShortDate(form.issueDate))}
          </p>
          <h3 className="mt-1 text-center text-base font-black underline underline-offset-2">
            TO WHOM IT MAY CONCERN
          </h3>
          <div className="certificate-student-mark absolute right-5 top-3 flex h-20 w-20 flex-col items-center justify-center border border-slate-300 bg-slate-50 text-slate-900">
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

  const transferFields = [
    ['Admission Number', admissionNumber],
    ['Student Name', studentName],
    ['Father’s Name', fatherName],
    ['Mother’s Name', motherName],
    ['Date of Birth', dob],
    ['Date of Admission', admissionDate],
    ['Class / Section', className],
    ['Roll Number', escapePrintText(details.rollNo || '________________')],
    ['Last Date Attended', escapePrintText(formatDate(form.leavingDate))],
    ['Reason for Leaving', escapePrintText(form.reason || '________________')],
    ['Conduct', escapePrintText(form.conduct || 'Good')],
  ];

  return (
    <article className="certificate-print-area certificate-transfer-paper mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white p-3 text-slate-900 shadow-xl sm:p-4">
      <div className="certificate-transfer-frame flex min-h-[288mm] flex-col border-[3px] border-[#6b2638] p-4 sm:p-5">
        <header className="grid grid-cols-[19mm_1fr_28mm] items-center gap-2 border-b-2 border-[#6b2638] pb-3 text-center">
          <img src={schoolLogo} alt="School logo" className="h-[17mm] w-[17mm] object-contain" />
          <div className="font-serif">
            <h1 className="text-[15px] font-black uppercase leading-tight sm:text-xl">Marigold Public Secondary School</h1>
            <p className="mt-0.5 text-[11px] font-black uppercase tracking-[0.18em] sm:text-xs">Behror, Kotputli-Behror</p>
            <p className="mt-1 text-[8px] font-semibold sm:text-[10px]">Near Nagarpalika Board, Hamindpur Road, Behror</p>
            <p className="text-[8px] font-semibold sm:text-[10px]">Ph: 8107464600 · marigoldvijay@gmail.com</p>
          </div>
          <div className="self-start text-right text-[8px] font-bold leading-4">
            <p>Certificate No.</p>
            <p className="border-b border-slate-700 pb-0.5">{escapePrintText(form.certificateNumber || '__________')}</p>
          </div>
        </header>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="border-y border-[#6b2638] px-5 py-1.5 font-serif text-base font-black uppercase tracking-[0.13em] text-[#6b2638]">
            Transfer Certificate
          </div>
          <p className="pt-2 text-[10px] font-bold">Date: {escapePrintText(formatDate(form.issueDate))}</p>
        </div>

        <p className="mt-5 font-serif text-[13px] leading-6">
          This is to certify that the following particulars of the student have been verified from the
          school records and are found correct.
        </p>

        <dl className="certificate-transfer-details mt-4 border border-[#6b2638] text-[11px] leading-5 sm:text-[13px]">
          {transferFields.map(([label, value], index) => (
            <div key={label} className="grid grid-cols-[8mm_minmax(42mm,0.78fr)_1fr] border-b border-[#9b7180] last:border-b-0">
              <dt className="border-r border-[#9b7180] px-1.5 py-1.5 text-center font-bold">{index + 1}</dt>
              <dt className="border-r border-[#9b7180] px-2 py-1.5 font-bold">{label}</dt>
              <dd className="px-2 py-1.5 font-semibold">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 space-y-3 font-serif text-[12px] leading-6">
          <p>
            The student is hereby granted this Transfer Certificate on the request of the parent / guardian.
          </p>
          <p>We wish the student every success in future studies and endeavours.</p>
        </div>

        <footer className="mt-auto grid grid-cols-3 gap-5 pt-12 text-center text-[10px] font-bold sm:text-xs">
          <div className="border-t border-slate-800 pt-2">Prepared By</div>
          <div className="border-t border-slate-800 pt-2">Checked By</div>
          <div className="border-t border-slate-800 pt-2">Principal / Authorized Signatory</div>
        </footer>
      </div>
    </article>
  );
};

const StudentCertificate = ({ type }) => {
  const certificateRef = useRef(null);
  const [students, , studentMeta] = useMongoState(MASTER_NAMESPACES.students, []);
  const [paathshalaArchives, setPaathshalaArchives] = useState([]);
  const [selectedArchiveId, setSelectedArchiveId] = useState('');
  const [paathshalaHistory, setPaathshalaHistory] = useState(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [requestedStudentId, setRequestedStudentId] = useState('');
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

  useEffect(() => {
    let request = null;
    try {
      request = JSON.parse(
        window.sessionStorage.getItem('mgps-paathshala-certificate-source') || 'null'
      );
      window.sessionStorage.removeItem('mgps-paathshala-certificate-source');
    } catch (error) {
      console.error('Unable to read the selected Paathshala certificate student:', error);
    }
    if (request?.studentId) setRequestedStudentId(String(request.studentId));

    const archivesApi = window.mgpsDesktop?.archives;
    if (!archivesApi) return undefined;
    let isMounted = true;
    const loadArchives = async () => {
      setArchiveLoading(true);
      setArchiveError('');
      try {
        const [allArchives, activeArchive] = await Promise.all([
          archivesApi.list(),
          archivesApi.getActive(),
        ]);
        if (!isMounted) return;
        const archives = allArchives.filter(
          (item) => item.kind === 'snapshot' && item.name.startsWith('Paathshala ')
        );
        setPaathshalaArchives(archives);
        const preferredId = request?.archiveId || activeArchive?.id;
        const initialArchive =
          archives.find((item) => item.id === preferredId) || archives[0];
        if (initialArchive) {
          setSelectedArchiveId(initialArchive.id);
          const history = await archivesApi.readCollection(
            initialArchive.id,
            'paathshala-history'
          );
          if (isMounted) setPaathshalaHistory(history);
        }
      } catch (error) {
        if (isMounted) setArchiveError(error.message || 'Unable to load Paathshala student archives.');
      } finally {
        if (isMounted) setArchiveLoading(false);
      }
    };
    loadArchives();
    return () => {
      isMounted = false;
    };
  }, []);

  const selectPaathshalaArchive = async (archiveId) => {
    setSelectedArchiveId(archiveId);
    setPaathshalaHistory(null);
    if (!archiveId) return;
    setArchiveLoading(true);
    setArchiveError('');
    try {
      const history = await window.mgpsDesktop.archives.readCollection(
        archiveId,
        'paathshala-history'
      );
      setPaathshalaHistory(history);
    } catch (error) {
      setArchiveError(error.message || 'Unable to load this session’s student records.');
    } finally {
      setArchiveLoading(false);
    }
  };

  const directory = useMemo(
    () => (Array.isArray(students) ? students : []).map(normalizeStudentForDirectory),
    [students]
  );
  const historicalDirectory = useMemo(() => {
    const table = Object.entries(paathshalaHistory?.tables || {}).find(
      ([name]) => ['sadmission', 'c_sadmission'].includes(name.toLowerCase())
    );
    const rows = table?.[1] || [];
    const unique = new Map();
    rows.forEach((record) => {
      const student = normalizePaathshalaStudent(record);
      const key = student.sourceStudentId || student.id;
      if (key && !unique.has(key)) unique.set(key, student);
    });
    return [...unique.values()];
  }, [paathshalaHistory]);
  const activeDirectory = selectedArchiveId ? historicalDirectory : directory;
  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activeDirectory;
    return activeDirectory.filter((student) =>
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
  }, [activeDirectory, search]);
  const selectedStudent =
    activeDirectory.find((student) => String(student.id) === selectedId) ||
    filteredStudents[0] ||
    null;
  const details = getStudentDetails(selectedStudent);
  const title = type === 'transfer' ? 'Transfer Certificate' : 'Study Certificate';
  const Icon = type === 'transfer' ? FileCheck2 : GraduationCap;

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const printCertificate = () => {
    const certificate = certificateRef.current?.querySelector('.certificate-print-area');
    if (!certificate) return;

    const printWindow = window.open('', '_blank', 'width=1200,height=850');
    if (!printWindow) {
      window.print();
      return;
    }

    const pageStyles = [...document.head.querySelectorAll('link[rel="stylesheet"], style')]
      .map((node) => node.outerHTML)
      .join('');
    const isStudyCertificate = type === 'study';
    const printPaper = isStudyCertificate
      ? { orientation: 'landscape', margin: '5mm', width: '269mm', height: '200mm', padding: '6mm' }
      : { orientation: 'portrait', margin: '8mm', width: '194mm', height: '281mm', padding: '5mm' };
    const printStyles = `
      <style>
        @page { size: A4 ${printPaper.orientation}; margin: ${printPaper.margin}; }
        html, body { margin: 0; padding: 0; background: #fff; }
        body { display: flex; justify-content: center; align-items: flex-start; }
        .certificate-print-area {
          box-sizing: border-box !important;
          position: static !important;
          width: ${printPaper.width} !important;
          max-width: ${printPaper.width} !important;
          height: ${printPaper.height} !important;
          min-height: 0 !important;
          margin: 0 !important;
          padding: ${printPaper.padding} !important;
          overflow: visible !important;
          transform: none !important;
          border: 1px solid #6b2638 !important;
          box-shadow: none !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .certificate-study-paper {
          left: auto !important;
          transform: none !important;
        }
        .certificate-study-paper > header {
          min-height: 34mm !important;
          grid-template-columns: 25mm minmax(0, 1fr) 30mm !important;
          padding: 3mm !important;
        }
        .certificate-study-paper > header img { width: 22mm !important; height: 22mm !important; }
        .certificate-study-paper > header h1 { font-size: 16pt !important; }
        .certificate-study-paper > header p { font-size: 8pt !important; line-height: 1.3 !important; }
        .certificate-study-paper > div { flex: 1 !important; min-height: 0 !important; padding: 5mm 8mm !important; font-size: 12pt !important; line-height: 1.6 !important; }
        .certificate-study-paper > div > div { padding-right: 25mm !important; line-height: 1.7 !important; }
        .certificate-study-paper > div > div > p { break-inside: avoid; }
        .certificate-study-content { position: relative !important; }
        .certificate-student-mark { position: absolute !important; top: 5mm !important; right: 8mm !important; width: 22mm !important; height: 22mm !important; }
        .certificate-study-value { display: inline-block; min-width: 32mm; max-width: 100%; overflow-wrap: anywhere; border-bottom: 1px dotted #555; padding: 0 6px; font-style: normal; font-weight: 700; }
        .certificate-transfer-paper .certificate-transfer-frame { box-sizing: border-box !important; min-height: 0 !important; height: 271mm !important; padding: 5mm !important; }
        .certificate-transfer-paper .certificate-transfer-details { font-size: 10pt !important; line-height: 1.35 !important; }
        .certificate-transfer-paper footer { padding-top: 18mm !important; }
      </style>`;

    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><base href="${document.baseURI}">${pageStyles}${printStyles}</head><body>${certificate.outerHTML}<script>window.addEventListener('load', async () => { if (document.fonts) await document.fonts.ready; window.focus(); window.print(); });</script></body></html>`);
    printWindow.document.close();
  };

  useEffect(() => {
    if (!selectedArchiveId || !selectedStudent || !paathshalaHistory) return;
    const studentId = selectedStudent.sourceStudentId;
    const matchingRows = (tableName) =>
      (paathshalaHistory.tables?.[tableName] || []).filter(
        (record) => String(record.Sid ?? record.sid ?? record.SID ?? '') === studentId
      );
    const latest = (records, dateFields) =>
      records
        .slice()
        .sort((left, right) => {
          const leftDate = dateFields.map((field) => left[field]).find(Boolean) || '';
          const rightDate = dateFields.map((field) => right[field]).find(Boolean) || '';
          return String(rightDate).localeCompare(String(leftDate));
        })[0];
    const tcRecord = latest(matchingRows('tccc'), ['TcDate', 'LeaveDate']);
    const tcDetail = latest(matchingRows('tcDetail'), ['SDate', 'PDate']);
    setForm((current) => ({
      ...current,
      leavingDate: asDateInputValue(tcRecord?.LeaveDate || tcRecord?.TcDate) || current.leavingDate,
      reason: tcRecord?.CauseRemoval || current.reason,
      conduct: tcDetail?.Conduct || current.conduct,
    }));
  }, [paathshalaHistory, selectedArchiveId, selectedStudent]);

  useEffect(() => {
    if (!requestedStudentId || !activeDirectory.length) return;
    const requested = activeDirectory.find(
      (student) => student.sourceStudentId === requestedStudentId
    );
    if (requested) {
      setSelectedId(String(requested.id));
      setRequestedStudentId('');
    }
  }, [activeDirectory, requestedStudentId]);

  useEffect(() => {
    if (selectedStudent && String(selectedStudent.id) !== selectedId) {
      setSelectedId(String(selectedStudent.id));
    }
  }, [selectedId, selectedStudent]);

  return (
    <div className="space-y-6 p-4 font-sans text-slate-900 sm:p-6">
      <style>{`
        .certificate-study-value { display: inline-block; min-width: 150px; max-width: 100%; overflow-wrap: anywhere; border-bottom: 1px dotted #555; padding: 0 6px; font-style: normal; font-weight: 700; }
        .certificate-study-content { position: relative; }
        .certificate-student-mark { position: absolute; top: 5mm; right: 8mm; width: 22mm; height: 22mm; }
        @page {
          size: A4 ${type === 'study' ? 'landscape' : 'portrait'};
          margin: ${type === 'study' ? '5mm' : '8mm'};
        }
        @media print {
          html, body {
            width: 100% !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          body * { visibility: hidden !important; }
          .certificate-print-area,
          .certificate-print-area * { visibility: visible !important; }
          .certificate-print-area {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: none !important;
            min-height: 0 !important;
            margin: 0 !important;
            border: 1px solid #6b2638 !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          .certificate-study-paper {
            display: flex !important;
            flex-direction: column !important;
            /* 269mm is the safe printable width for both A4 and Letter in landscape. */
            width: 269mm !important;
            height: 200mm !important;
            max-width: 269mm !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            transform-origin: top center !important;
            padding: 6mm !important;
            font-size: 12pt !important;
          }
          .certificate-study-paper > header {
            min-height: 34mm !important;
            grid-template-columns: 25mm minmax(0, 1fr) 30mm !important;
            padding: 3mm !important;
          }
          .certificate-study-paper > header img {
            width: 22mm !important;
            height: 22mm !important;
          }
          .certificate-study-paper > header h1 {
            font-size: 16pt !important;
          }
          .certificate-study-paper > header p {
            font-size: 8pt !important;
            line-height: 1.3 !important;
          }
          .certificate-study-paper > div {
            flex: 1 !important;
            min-height: 0 !important;
            padding: 5mm 8mm !important;
            font-size: 12pt !important;
            line-height: 1.6 !important;
          }
          .certificate-study-paper .certificate-study-value {
            min-width: 32mm;
          }
          .certificate-study-paper > div > div {
            padding-right: 25mm !important;
            line-height: 1.7 !important;
          }
          .certificate-study-paper > div > div > p {
            break-inside: avoid;
          }
          .certificate-study-content {
            position: relative !important;
          }
          .certificate-student-mark {
            position: absolute !important;
            top: 5mm !important;
            right: 8mm !important;
            width: 22mm !important;
            height: 22mm !important;
          }
        }
      `}</style>

      <section className="no-print glass-card rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-700"><Icon className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-black">{title}</h1>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Select a current or Paathshala history student, verify the details and print. Archived
              student details are read-only; the certificate is not saved unless you save it from the
              print dialog.
            </p>
          </div>
        </div>
      </section>

      <div className="no-print grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <section className="glass-card rounded-3xl p-5">
          <h2 className="mb-4 text-sm font-black uppercase tracking-wider">Student</h2>
          {window.mgpsDesktop?.isDesktop && paathshalaArchives.length > 0 && (
            <label className="mb-3 block text-xs font-bold text-slate-600">
              <span className="mb-1.5 block">Student data source</span>
              <select
                aria-label="Student data source"
                className="w-full rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-400"
                onChange={(event) => selectPaathshalaArchive(event.target.value)}
                value={selectedArchiveId}
              >
                <option value="">Current ERP session</option>
                {paathshalaArchives.map((archive) => (
                  <option key={archive.id} value={archive.id}>{archive.name}</option>
                ))}
              </select>
            </label>
          )}
          {selectedArchiveId && paathshalaHistory && (
            <p className="mb-3 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800">
              Using archived Paathshala records: {paathshalaHistory.sourceSessionYear || 'Unlabelled session'}.
              Verify every certificate field before printing.
            </p>
          )}
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
            disabled={archiveLoading || (!selectedArchiveId && studentMeta.isLoading)}
          >
            <option value="">
              {archiveLoading || (!selectedArchiveId && studentMeta.isLoading)
                ? 'Loading students…'
                : 'Select a student'}
            </option>
            {filteredStudents.map((student, index) => (
              <option key={`${student.id}-${index}`} value={String(student.id)}>
                {student.displayName} · {student.admissionNumber || student.id} · {student.className}
              </option>
            ))}
          </select>
          {archiveError && <p role="alert" className="mt-3 text-xs font-semibold text-red-700">{archiveError}</p>}
          {!selectedArchiveId && studentMeta.error && <p role="alert" className="mt-3 text-xs font-semibold text-red-700">{studentMeta.error}</p>}
          {!archiveLoading && !activeDirectory.length && (
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
            onClick={printCertificate}
            disabled={!selectedStudent}
            className="mt-5 inline-flex items-center gap-2 rounded-xl btn-primary px-5 py-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </button>
        </section>
      </div>

      {selectedStudent ? (
        <div ref={certificateRef}>
          <CertificatePaper type={type} details={details} form={form} />
        </div>
      ) : (
        <div className="no-print glass-card rounded-3xl p-10 text-center text-sm font-semibold text-slate-500">
          Select a student to preview the certificate.
        </div>
      )}
    </div>
  );
};

export default StudentCertificate;
