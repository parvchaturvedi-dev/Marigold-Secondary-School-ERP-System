/**
 * printDocs.js  (mobile)
 * ----------------------------------------------------------------------------
 * Mobile port of the web report-card / admit-card printers
 * (frontend/src/components/common/reportCard.js + admitCard.js).
 *
 * The HTML/CSS is kept BYTE-FOR-BYTE identical to the web versions so the
 * printed / shared PDF matches the exact format the school expects. The ONLY
 * difference from web is the delivery mechanism: instead of window.open + a
 * body onload=window.print(), we generate a PDF with expo-print's
 * `Print.printToFileAsync({ html })` and hand it to `Sharing.shareAsync(uri)`
 * (falling back to the native `Print.printAsync({ html })` dialog when sharing
 * is unavailable).
 *
 * Data shapes (same as web):
 *   - A marks RECORD: { id, examId, className, subject, maxMarks, rows: [...] }
 *   - A row inside record.rows: { studentId, admissionNumber, studentName, marks, remark }
 *     => OBTAINED marks live on `row.marks`; MAX lives on `record.maxMarks`.
 *   - exams:    { id, name, academicYear }
 *   - schedule: [{ subject, date, startTime, endTime, examId?, className? }]
 *   - student:  { admissionNumber, displayName/name, rollNo, fatherName,
 *                 motherName, dob, className, section, photoDataUrl? }
 *
 * Exports:
 *   - computeReportRows({ student, exams, marks, className })       (re-exported for reuse)
 *   - printReportCard({ student, exams, marks, className, schoolInfo, ... })
 *   - printReportCardsForClass({ students, exams, marks, className, schoolInfo })
 *   - printAdmitCard({ student, exam, schedule, schoolInfo })
 *   - printAdmitCardsForClass({ students, exam, schedule, schoolInfo })
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// ===========================================================================
// Shared delivery: build a PDF from an HTML document string, then share it.
// (Replaces web's window.open / body onload=window.print().)
// ===========================================================================

/**
 * Turn a full HTML document string into a PDF and surface it to the user.
 * Tries share-sheet first (so the user can save / print / send); falls back to
 * the native print dialog when sharing is not available on the device.
 *
 * Failures (including a user cancelling the share sheet) are swallowed so the
 * caller never crashes; a genuine generation failure is re-thrown as a clean
 * Error the caller can catch and message.
 *
 * @param {string} html - a complete <!doctype html>...</html> document
 * @returns {Promise<void>}
 */
async function deliverPdf(html) {
  try {
    const { uri } = await Print.printToFileAsync({ html });

    let canShare = false;
    try {
      canShare = await Sharing.isAvailableAsync();
    } catch {
      canShare = false;
    }

    if (canShare && uri) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share document',
        UTI: 'com.adobe.pdf',
      });
      return;
    }

    // Sharing not available — fall back to the native print dialog.
    await Print.printAsync({ html });
  } catch (error) {
    // A cancelled share sheet rejects on some platforms — treat cancellation as
    // a no-op, but re-throw anything that looks like a real failure.
    const message = String(error?.message || error || '');
    if (/cancel/i.test(message)) return;
    throw new Error(`Failed to generate document: ${message}`);
  }
}

// ===========================================================================
// SECTION 1 — REPORT CARD  (ported from reportCard.js)
// ===========================================================================

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** HTML-escape any interpolated text so student data can never break markup. */
const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])
  );

/** Defensive lookups so we tolerate slightly different field names. */
const studentAdmission = (student = {}) =>
  student.admissionNumber || student.admNo || student.id || '';
const studentName = (student = {}) => student.name || student.displayName || '';
const studentRoll = (student = {}) => student.rollNo || student.roll || '';

/**
 * Grade thresholds — identical to `calculateGrade` in examinationStore.js.
 * Kept local so this file stays self-contained (no cross-imports).
 */
const gradeFromPercentage = (percentage) => {
  if (!Number.isFinite(percentage)) return '—';
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  return 'Needs Support';
};

/**
 * Does a marks `row` belong to this student? Matches defensively on
 * studentId / admissionNumber / studentName (same logic the store uses).
 */
const rowBelongsToStudent = (row = {}, student = {}) => {
  const admission = studentAdmission(student);
  const name = studentName(student);
  return Boolean(
    (row.studentId && student.id && row.studentId === student.id) ||
      (row.admissionNumber && admission && row.admissionNumber === admission) ||
      (row.studentName && name && row.studentName === name)
  );
};

/** Convert a maybe-number to a finite Number or null (blank cells stay blank). */
const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// ---------------------------------------------------------------------------
// Core computation (exported so it is testable / reusable)
// ---------------------------------------------------------------------------

/**
 * Build the structured rows behind the report table.
 *
 * @param {object}   args
 * @param {object}   args.student    - the student whose report we build
 * @param {object[]} args.exams      - the year's exams, in display order (column groups)
 * @param {object[]} args.marks      - the FULL state.marks array (filtered here)
 * @param {string}   args.className  - class to scope marks to (falls back to student.className)
 * @returns {object} structured report rows / totals (see reportCard.js for the full shape)
 */
export function computeReportRows({ student, exams, marks, className }) {
  const safeExams = Array.isArray(exams) ? exams : [];
  const safeMarks = Array.isArray(marks) ? marks : [];
  const cls = className || student?.className || student?.reportClassName || '';

  // Only the marks records for THIS class (defensive against undefined class).
  const classMarks = safeMarks.filter((record) => !cls || record?.className === cls);

  // Discover every subject taught to this student in this class. We derive the
  // subject set from marks records that contain a row for this student — but
  // fall back to every subject in the class if none match by student (so an
  // empty-but-valid report still lists the subjects).
  const subjectSet = new Set();
  const subjectHasStudent = new Set();
  classMarks.forEach((record) => {
    if (!record?.subject) return;
    subjectSet.add(record.subject);
    if ((record.rows || []).some((row) => rowBelongsToStudent(row, student))) {
      subjectHasStudent.add(record.subject);
    }
  });

  // Prefer subjects that actually have a row for this student; otherwise show
  // all subjects found for the class.
  const subjects = (subjectHasStudent.size ? [...subjectHasStudent] : [...subjectSet]).sort(
    (a, b) => a.localeCompare(b)
  );

  // Running per-exam totals (across all subjects).
  const perExamTotals = safeExams.map((exam) => ({ examId: exam?.id, max: 0, obt: 0 }));

  const subjectRows = subjects.map((subject) => {
    let total = 0;
    let totalMax = 0;

    const perExam = safeExams.map((exam, examIndex) => {
      // The marks record for this exam + subject (+ class).
      const record = classMarks.find(
        (item) => item?.examId === exam?.id && item?.subject === subject
      );

      let max = null;
      let obt = null;

      if (record) {
        const studentRow = (record.rows || []).find((row) => rowBelongsToStudent(row, student));
        max = toNumberOrNull(record.maxMarks);
        // Obtained marks live on `row.marks` (per the store's row shape).
        obt = studentRow ? toNumberOrNull(studentRow.marks) : null;
      }

      // Accumulate subject totals (only count real numbers).
      if (obt !== null) total += obt;
      if (max !== null && obt !== null) totalMax += max;

      // Accumulate per-exam column grand totals.
      if (max !== null) perExamTotals[examIndex].max += max;
      if (obt !== null) perExamTotals[examIndex].obt += obt;

      return { examId: exam?.id, max, obt };
    });

    const subjectPct = totalMax > 0 ? (total / totalMax) * 100 : NaN;
    const grade = gradeFromPercentage(subjectPct);

    return { subject, perExam, total, totalMax, grade };
  });

  const grandMax = perExamTotals.reduce((sum, column) => sum + column.max, 0);
  const grandObtained = perExamTotals.reduce((sum, column) => sum + column.obt, 0);
  const percentage = grandMax > 0 ? (grandObtained / grandMax) * 100 : 0;
  const overallGrade = grandMax > 0 ? gradeFromPercentage(percentage) : '—';

  return {
    subjects: subjectRows,
    perExamTotals,
    grandMax,
    grandObtained,
    percentage,
    overallGrade,
  };
}

// ---------------------------------------------------------------------------
// Report-card markup
// ---------------------------------------------------------------------------

/** Default school identity (Marigold) — used when schoolInfo fields are missing. */
const DEFAULT_REPORT_SCHOOL_INFO = {
  name: 'MARIGOLD PUBLIC SECONDARY SCHOOL, BEHROR, KOTPUTLI-BEHROR',
  line1: '(Recognized by Govt. of Rajasthan / Affiliated to RBSE Board)',
  line2: 'NEAR NAGARPALIKA BOARD, HAMINDPUR ROAD BEHROR',
  semisCode: '',
  regNo: '',
  academicYear: '2025-2026',
};

/** Render a numeric cell, blank when null/undefined. */
const numCell = (value) => (value === null || value === undefined ? '' : esc(value));

/**
 * The shared print-document CSS. Defined once and reused by both the single
 * and bulk print paths so every report card looks identical. The `.sheet`
 * rule carries the per-page break used when printing many students at once.
 */
const REPORT_CARD_STYLES = `
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Georgia, serif;
      color: #000; background: #fff; margin: 0; padding: 12px;
    }
    .sheet { border: 2px solid #000; padding: 10px 14px; }
    /* Each student's report starts on a fresh page when printing a whole class. */
    .sheet + .sheet { margin-top: 24px; }
    /* --- Top bar: logo + semis (left), reg no (right) --- */
    .topbar { display: flex; align-items: center; justify-content: space-between; }
    .logo-box {
      width: 58px; height: 58px; border: 1px solid #000; display: flex;
      align-items: center; justify-content: center; font-size: 9px; text-align: center;
    }
    .semis, .regno { font-size: 11px; font-weight: bold; white-space: nowrap; }
    /* --- Centered school identity --- */
    .school { text-align: center; flex: 1; padding: 0 8px; }
    .school .line-sm { font-size: 11px; }
    .school .name { font-size: 19px; font-weight: bold; margin: 2px 0; letter-spacing: .5px; }
    .report-title {
      text-align: center; font-weight: bold; font-size: 14px; margin: 8px 0 6px;
      border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0;
    }
    /* --- Student info block --- */
    .info { display: flex; gap: 8px; margin-bottom: 8px; }
    .info-cols { display: flex; flex: 1; gap: 24px; }
    .info-col { flex: 1; }
    .info-col div { font-size: 12px; padding: 2px 0; }
    .info-col b { display: inline-block; min-width: 96px; }
    .photo {
      width: 92px; height: 108px; border: 1px solid #000; display: flex;
      align-items: center; justify-content: center; font-size: 10px; color: #555; overflow: hidden;
    }
    .photo img { width: 100%; height: 100%; object-fit: cover; }
    /* --- Marks table --- */
    table.marks { width: 100%; border-collapse: collapse; margin-top: 4px; }
    table.marks th, table.marks td { border: 1px solid #000; padding: 4px 6px; font-size: 12px; }
    table.marks th { background: #f0f0f0; text-align: center; font-weight: bold; }
    table.marks th.exam-h { font-size: 12px; }
    table.marks th.sub-h { font-size: 11px; font-weight: normal; }
    td.subj { text-align: left; font-weight: bold; }
    td.num { text-align: center; }
    td.grade { font-weight: bold; }
    td.total { font-weight: bold; }
    tr.grand td { background: #f0f0f0; font-weight: bold; }
    /* --- Footer summary --- */
    .footer {
      display: flex; flex-wrap: wrap; border: 1px solid #000; border-top: 0;
      font-size: 12px;
    }
    .footer .cell { flex: 1 1 33%; padding: 5px 8px; border-top: 1px solid #000; }
    .footer .cell b { font-weight: bold; }
    /* --- Signatures --- */
    .signs { display: flex; justify-content: space-between; margin-top: 34px; }
    .sign { flex: 1; text-align: center; font-size: 12px; }
    .sign .line { border-top: 1px solid #000; margin: 0 18px 4px; padding-top: 4px; }
    @media print {
      body { padding: 0; }
      .sheet { border: 0; }
      /* Force a page break BEFORE every report except the first, so bulk
         printing yields exactly one report card per page. */
      .sheet { break-inside: avoid; page-break-inside: avoid; }
      .sheet + .sheet { break-before: page; page-break-before: always; margin-top: 0; }
    }
`;

/**
 * Build the single report-card markup (the `<div class="sheet">...</div>`),
 * WITHOUT the surrounding document / <style>. Shared by the single-print and
 * whole-class-print paths so both render an identical card.
 *
 * @param {object}   args
 * @param {object}   args.student     - one student
 * @param {object[]} args.exams       - the year's exams (column groups)
 * @param {object[]} args.marks       - the FULL state.marks array (filtered internally)
 * @param {string}   [args.className] - class to scope to (defaults to student's class)
 * @param {object}   args.info        - resolved school info (defaults already merged in)
 * @param {string}   [args.result]    - Result text (default '—')
 * @param {string|number} [args.rank] - Rank in Class (default '—')
 * @param {number}   [args.attendancePresent]
 * @param {number}   [args.attendanceTotal]
 * @param {number}   [args.studentCount]
 * @returns {string} HTML for one `.sheet` block
 */
function buildReportCardSheet({
  student = {},
  exams = [],
  marks = [],
  className,
  info,
  result = '—',
  rank = '—',
  attendancePresent,
  attendanceTotal,
  studentCount,
}) {
  // Each student's className for lookups falls back to the passed-in className.
  const cls = student?.className || className || '';
  const safeExams = Array.isArray(exams) ? exams : [];

  // Compute the structured data once (shared with computeReportRows).
  const report = computeReportRows({ student, exams: safeExams, marks, className: cls });

  // ----- Header rows for the marks table -------------------------------------
  // Row 1: SUBJECT | <ExamName colSpan=2> ... | GRADE | TOTAL
  const examGroupHeaders = safeExams
    .map((exam) => `<th colspan="2" class="exam-h">${esc(exam?.name || 'Exam')}</th>`)
    .join('');
  // Row 2: (blank under subject) | Max | Obt (per exam) | (blank under grade/total)
  const maxObtHeaders = safeExams
    .map(() => `<th class="sub-h">Max</th><th class="sub-h">Obt</th>`)
    .join('');

  // ----- Subject rows --------------------------------------------------------
  const subjectRowsHtml = report.subjects.length
    ? report.subjects
        .map((subjectRow) => {
          const examCells = subjectRow.perExam
            .map(
              (cell) =>
                `<td class="num">${numCell(cell.max)}</td><td class="num">${numCell(cell.obt)}</td>`
            )
            .join('');
          return `
            <tr>
              <td class="subj">${esc(subjectRow.subject)}</td>
              ${examCells}
              <td class="num grade">${esc(subjectRow.grade)}</td>
              <td class="num total">${esc(subjectRow.total)}</td>
            </tr>`;
        })
        .join('')
    : `<tr><td class="subj" colspan="${2 + safeExams.length * 2 + 2}">No marks recorded for this student.</td></tr>`;

  // ----- Grand total row -----------------------------------------------------
  const grandExamCells = report.perExamTotals
    .map((column) => `<td class="num">${esc(column.max)}</td><td class="num">${esc(column.obt)}</td>`)
    .join('');
  const grandTotalRow = `
    <tr class="grand">
      <td class="subj">GRAND TOTAL</td>
      ${grandExamCells}
      <td class="num">${esc(report.overallGrade)}</td>
      <td class="num">${esc(report.grandObtained)} / ${esc(report.grandMax)}</td>
    </tr>`;

  // ----- Derived footer values ----------------------------------------------
  const percentageText = `${report.percentage.toFixed(1)}%`;
  const attendanceText =
    attendancePresent !== undefined && attendanceTotal !== undefined
      ? `${esc(attendancePresent)} Out of ${esc(attendanceTotal)}`
      : '____ Out of ____';
  const studentCountText = studentCount !== undefined ? esc(studentCount) : '—';

  // Photo box: use a data URL if present, else an empty placeholder.
  const photoDataUrl = student.photoDataUrl || '';
  const photoHtml = photoDataUrl
    ? `<img src="${esc(photoDataUrl)}" alt="Student photo" />`
    : 'PHOTO';

  // ----- Single card markup (no document / <style> wrapper) ------------------
  return `
    <div class="sheet">
      <!-- Top bar -->
      <div class="topbar">
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="logo-box">LOGO</div>
          <div class="semis">SEMIS CODE:<br/>${esc(info.semisCode || '—')}</div>
        </div>
        <div class="school">
          <div class="line-sm">${esc(info.line1)}</div>
          <div class="name">${esc(info.name)}</div>
          <div class="line-sm">${esc(info.line2)}</div>
        </div>
        <div class="regno">Reg No:<br/>${esc(info.regNo || '—')}</div>
      </div>

      <div class="report-title">ANNUAL PROGRESS REPORT : ${esc(info.academicYear)}</div>

      <!-- Student info -->
      <div class="info">
        <div class="info-cols">
          <div class="info-col">
            <div><b>SR No :</b> ${esc(studentAdmission(student) || '—')}</div>
            <div><b>Name :</b> ${esc(studentName(student) || '—')}</div>
            <div><b>Mother's Name :</b> ${esc(student.motherName || '—')}</div>
            <div><b>Class :</b> ${esc(student.className || cls || '—')}</div>
          </div>
          <div class="info-col">
            <div><b>Roll No :</b> ${esc(studentRoll(student) || '—')}</div>
            <div><b>Father's Name :</b> ${esc(student.fatherName || '—')}</div>
            <div><b>Date of Birth :</b> ${esc(student.dob || '—')}</div>
            <div><b>Faculty :</b> COMMON / section ${esc(student.section || '—')}</div>
          </div>
        </div>
        <div class="photo">${photoHtml}</div>
      </div>

      <!-- Marks table -->
      <table class="marks">
        <thead>
          <tr>
            <th rowspan="2">SUBJECT NAME</th>
            ${examGroupHeaders}
            <th rowspan="2">GRADE</th>
            <th rowspan="2">TOTAL</th>
          </tr>
          <tr>
            ${maxObtHeaders}
          </tr>
        </thead>
        <tbody>
          ${subjectRowsHtml}
          ${grandTotalRow}
        </tbody>
      </table>

      <!-- Footer summary -->
      <div class="footer">
        <div class="cell"><b>Result :</b> ${esc(result || '—')}</div>
        <div class="cell"><b>Attendance :</b> ${attendanceText}</div>
        <div class="cell"><b>No. of Students :</b> ${studentCountText}</div>
        <div class="cell"><b>Percentage :</b> ${esc(percentageText)}</div>
        <div class="cell"><b>Rank in Class :</b> ${esc(rank || '—')}</div>
        <div class="cell"><b>Over All Grade :</b> ${esc(report.overallGrade)}</div>
      </div>

      <!-- Signatures -->
      <div class="signs">
        <div class="sign"><div class="line">Class Teacher Signature</div></div>
        <div class="sign"><div class="line">Exam Incharge Signature</div></div>
        <div class="sign"><div class="line">Principal/Headmaster Signature</div></div>
      </div>
    </div>`;
}

/**
 * Wrap one or more `.sheet` blocks in a full printable document (shared <style>).
 * NOTE: unlike web, no `body onload=window.print()` — expo-print rasterises the
 * document directly, so the auto-print hook is neither needed nor supported.
 */
const buildReportPrintDocument = (title, sheetsHtml) =>
  `<!doctype html><html><head><meta charset="utf-8">
  <title>${esc(title)}</title>
  <style>${REPORT_CARD_STYLES}</style></head>
  <body>
    ${sheetsHtml}
  </body></html>`;

/**
 * Generate + share a SINGLE student's Annual Progress Report as a PDF.
 *
 * @param {object}   args
 * @param {object}   args.student     - { admissionNumber, rollNo, name, fatherName,
 *                                        motherName, dob, className, section, photoDataUrl? }
 * @param {object[]} args.exams       - the year's exam records, in display order (column groups)
 * @param {object[]} args.marks       - the FULL state.marks array (filtered internally)
 * @param {string}   [args.className] - class to scope to (defaults to student's class)
 * @param {object}   [args.schoolInfo]- { name, line1, line2, semisCode, regNo, academicYear }
 * @param {string}   [args.result]    - optional Result text (default '—')
 * @param {string|number} [args.rank] - optional Rank in Class (default '—')
 * @param {number}   [args.attendancePresent] - optional present days
 * @param {number}   [args.attendanceTotal]   - optional total working days
 * @param {number}   [args.studentCount]      - optional No. of Students in class
 * @returns {Promise<void>}
 */
export async function printReportCard({
  student = {},
  exams = [],
  marks = [],
  className,
  schoolInfo = {},
  result = '—',
  rank = '—',
  attendancePresent,
  attendanceTotal,
  studentCount,
}) {
  const info = { ...DEFAULT_REPORT_SCHOOL_INFO, ...(schoolInfo || {}) };

  const sheetHtml = buildReportCardSheet({
    student,
    exams,
    marks,
    className,
    info,
    result,
    rank,
    attendancePresent,
    attendanceTotal,
    studentCount,
  });

  const title = `Progress Report - ${studentName(student) || 'Student'}`;
  await deliverPdf(buildReportPrintDocument(title, sheetHtml));
}

/**
 * Generate + share an Annual Progress Report for EVERY student in `students`,
 * one report card per page (CSS page-break between them). Reuses the exact same
 * card markup as printReportCard via buildReportCardSheet.
 *
 * @param {object}   args
 * @param {object[]} args.students    - the class roster to print
 * @param {object[]} args.exams       - the year's exam records (column groups)
 * @param {object[]} args.marks       - the FULL state.marks array (filtered per student)
 * @param {string}   [args.className] - default class for students that have none
 * @param {object}   [args.schoolInfo]- { name, line1, line2, semisCode, regNo, academicYear }
 * @returns {Promise<void>}
 */
export async function printReportCardsForClass({
  students = [],
  exams = [],
  marks = [],
  className,
  schoolInfo = {},
}) {
  const info = { ...DEFAULT_REPORT_SCHOOL_INFO, ...(schoolInfo || {}) };
  const roster = Array.isArray(students) ? students : [];

  if (!roster.length) {
    throw new Error('No students to print report cards for.');
  }

  // The class total is known here, so fill "No. of Students" for every card.
  const studentCount = roster.length;

  // Build one `.sheet` per student and join them — the shared @media print
  // rule (`.sheet + .sheet { break-before: page }`) puts each on its own page.
  const sheetsHtml = roster
    .map((student) =>
      buildReportCardSheet({
        student: student || {},
        exams,
        marks,
        className, // each student's className falls back to this inside the helper
        info,
        studentCount,
      })
    )
    .join('\n');

  const title = `Progress Reports - ${className || info.academicYear}`;
  await deliverPdf(buildReportPrintDocument(title, sheetsHtml));
}

// ===========================================================================
// SECTION 2 — ADMIT CARD  (ported from admitCard.js)
// ===========================================================================

// Marigold defaults used whenever the caller omits schoolInfo fields.
const DEFAULT_ADMIT_SCHOOL_INFO = {
  name: 'MARIGOLD PUBLIC SECONDARY SCHOOL, BEHROR',
  line1: '(Recognized by Govt. of Rajasthan / Affiliated to RBSE Board)',
  line2: '',
  regNo: '',
};

// -- helpers ----------------------------------------------------------------

// Escape any user/data supplied text before it is dropped into HTML so a stray
// "<", "&" or quote can never break the markup or inject anything.
const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Return the first supplied argument that is a non-empty value. Lets us try a
// chain of possible field names, e.g. pick(student.name, student.displayName).
const pick = (...values) => {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
};

// Human-friendly date (e.g. "05 Jul 2026"). Falls back to the raw string when
// the value is not a parseable date so nothing is silently lost.
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return String(dateValue);
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// Turn a { startTime, endTime } pair into "09:00 – 12:00" (en-dash). Tolerates
// missing halves gracefully.
const formatTimeRange = (startTime, endTime) => {
  const start = String(startTime || '').trim();
  const end = String(endTime || '').trim();
  if (start && end) return `${escapeHtml(start)} &ndash; ${escapeHtml(end)}`;
  if (start) return escapeHtml(start);
  if (end) return escapeHtml(end);
  return '&mdash;';
};

// Normalise + filter + sort the schedule rows for one card.
// - Tolerates an unfiltered array: drops rows whose examId / className exist
//   but do not match this exam / student class.
// - Sorts by date then startTime so the date sheet reads top-to-bottom.
const buildScheduleRows = (schedule, exam, student) => {
  const rows = Array.isArray(schedule) ? schedule : [];
  const examId = pick(exam?.id);
  const className = pick(student?.className);

  const matching = rows.filter((row) => {
    if (!row) return false;
    // Only reject on fields that are actually present on the row.
    if (row.examId && examId && String(row.examId) !== String(examId)) return false;
    if (row.className && className && String(row.className) !== String(className)) return false;
    return true;
  });

  return matching.slice().sort((a, b) => {
    const dateA = new Date(a?.date || 0).getTime() || 0;
    const dateB = new Date(b?.date || 0).getTime() || 0;
    if (dateA !== dateB) return dateA - dateB;
    return String(a?.startTime || '').localeCompare(String(b?.startTime || ''));
  });
};

// -- markup builders --------------------------------------------------------

// The <style> block. Kept in one place so both single + bulk printing share it.
const cardStyles = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', Georgia, serif;
    margin: 0;
    color: #000;
    background: #fff;
  }
  .admit-card {
    width: 190mm;
    margin: 10mm auto;
    padding: 8mm;
    border: 2px solid #000;
    page-break-after: always;
  }
  .admit-card:last-child { page-break-after: auto; }

  /* Header */
  .ac-header {
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 2px solid #000;
    padding-bottom: 8px;
  }
  .ac-logo {
    width: 70px;
    height: 70px;
    border: 1.5px solid #000;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: bold;
    text-align: center;
    flex: 0 0 auto;
    line-height: 1.1;
  }
  .ac-head-text { flex: 1; text-align: center; }
  .ac-school-name { font-size: 21px; font-weight: bold; letter-spacing: 0.5px; margin: 0; }
  .ac-school-line { font-size: 11px; margin: 2px 0 0; }
  .ac-reg { font-size: 10px; margin: 2px 0 0; }

  .ac-title {
    text-align: center;
    font-size: 15px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 10px 0;
    padding: 4px;
    border: 1.5px solid #000;
    background: #f0f0f0;
  }

  /* Student block */
  .ac-student { display: flex; gap: 12px; margin-bottom: 10px; }
  .ac-fields { flex: 1; }
  .ac-fields table { width: 100%; border-collapse: collapse; }
  .ac-fields td { padding: 4px 6px; font-size: 13px; vertical-align: top; }
  .ac-fields td.label { width: 38%; font-weight: bold; }
  .ac-fields td.sep { width: 12px; }
  .ac-photo {
    width: 100px;
    height: 120px;
    border: 1.5px solid #000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: #444;
    text-align: center;
    flex: 0 0 auto;
    overflow: hidden;
  }
  .ac-photo img { width: 100%; height: 100%; object-fit: cover; }

  /* Date sheet */
  .ac-section-title {
    font-size: 13px;
    font-weight: bold;
    text-transform: uppercase;
    margin: 12px 0 6px;
    border-bottom: 1px solid #000;
    padding-bottom: 3px;
  }
  table.ac-datesheet { width: 100%; border-collapse: collapse; }
  table.ac-datesheet th, table.ac-datesheet td {
    border: 1px solid #000;
    padding: 6px 8px;
    font-size: 12.5px;
    text-align: left;
  }
  table.ac-datesheet th { background: #e8e8e8; }
  table.ac-datesheet td.center, table.ac-datesheet th.center { text-align: center; }
  table.ac-datesheet .empty { text-align: center; font-style: italic; color: #666; }

  /* Instructions */
  .ac-instructions { margin-top: 12px; }
  .ac-instructions ol { margin: 4px 0 0; padding-left: 20px; }
  .ac-instructions li { font-size: 11.5px; margin-bottom: 3px; }

  /* Signatures */
  .ac-signs {
    display: flex;
    justify-content: space-between;
    margin-top: 28px;
    gap: 24px;
  }
  .ac-sign {
    flex: 1;
    text-align: center;
    font-size: 12px;
    font-weight: bold;
  }
  .ac-sign .line {
    border-top: 1px solid #000;
    margin-bottom: 4px;
    padding-top: 4px;
  }

  @media print {
    body { margin: 0; }
    .admit-card { margin: 0 auto; border: 2px solid #000; }
    @page { size: A4 portrait; margin: 8mm; }
  }
`;

// Standard admit-card instructions.
const INSTRUCTIONS = [
  'This Admit Card must be brought to the examination hall on every exam day. No student will be permitted without it.',
  'Reach the examination centre at least 30 minutes before the scheduled start time.',
  'Mobile phones, smart watches, calculators (unless permitted) and any other electronic devices are strictly prohibited.',
  'Carry your own writing materials and geometry box; borrowing is not allowed during the examination.',
  'Follow all instructions given by the invigilator. Any form of malpractice will lead to disqualification.',
  'Preserve this Admit Card until the declaration of results.',
];

// Build the inner HTML for a single admit card (one .admit-card block).
const buildCardHtml = ({ student, exam, schedule, schoolInfo }) => {
  const info = { ...DEFAULT_ADMIT_SCHOOL_INFO, ...(schoolInfo || {}) };

  // Defensive field lookups across the various possible property names.
  const admitStudentName = pick(student?.name, student?.displayName);
  const fatherName = pick(student?.fatherName, student?.guardianName);
  const motherName = pick(student?.motherName);
  const className = pick(student?.className);
  const section = pick(student?.section);
  const rollNo = pick(student?.rollNo, student?.roll);
  const admissionNumber = pick(student?.admissionNumber, student?.admNo, student?.id);
  const photoDataUrl = pick(student?.photoDataUrl);

  const examName = pick(exam?.name, 'Examination');
  const academicYear = pick(exam?.academicYear);

  const classAndSection = [className, section].filter(Boolean).join(' - ');

  // Date-sheet rows.
  const rows = buildScheduleRows(schedule, exam, student);
  const datesheetBody = rows.length
    ? rows
        .map(
          (row) => `
            <tr>
              <td>${escapeHtml(pick(row?.subject, '—'))}</td>
              <td class="center">${escapeHtml(formatDate(row?.date)) || '&mdash;'}</td>
              <td class="center">${formatTimeRange(row?.startTime, row?.endTime)}</td>
            </tr>`
        )
        .join('')
    : `<tr><td class="empty" colspan="3">Date sheet not yet published.</td></tr>`;

  // A single labelled field row inside the student details table.
  const fieldRow = (label, value) => `
    <tr>
      <td class="label">${escapeHtml(label)}</td>
      <td class="sep">:</td>
      <td>${escapeHtml(value) || '&mdash;'}</td>
    </tr>`;

  const titleLine = academicYear
    ? `Admit Card &mdash; ${escapeHtml(examName)} (${escapeHtml(academicYear)})`
    : `Admit Card &mdash; ${escapeHtml(examName)}`;

  const regLine = info.regNo ? `<p class="ac-reg">Reg. No: ${escapeHtml(info.regNo)}</p>` : '';
  const line2 = info.line2 ? `<p class="ac-school-line">${escapeHtml(info.line2)}</p>` : '';

  return `
    <div class="admit-card">
      <div class="ac-header">
        <div class="ac-logo">LOGO</div>
        <div class="ac-head-text">
          <p class="ac-school-name">${escapeHtml(info.name)}</p>
          <p class="ac-school-line">${escapeHtml(info.line1)}</p>
          ${line2}
          ${regLine}
        </div>
      </div>

      <div class="ac-title">${titleLine}</div>

      <div class="ac-student">
        <div class="ac-fields">
          <table>
            ${fieldRow("Student's Name", admitStudentName)}
            ${fieldRow("Father's Name", fatherName)}
            ${fieldRow("Mother's Name", motherName)}
            ${fieldRow('Class & Section', classAndSection)}
            ${fieldRow('Roll No', rollNo)}
            ${fieldRow('Admission No', admissionNumber)}
          </table>
        </div>
        <div class="ac-photo">
          ${
            photoDataUrl
              ? `<img src="${escapeHtml(photoDataUrl)}" alt="Student photo" />`
              : 'Affix recent<br/>passport size<br/>photograph'
          }
        </div>
      </div>

      <div class="ac-section-title">Date Sheet</div>
      <table class="ac-datesheet">
        <thead>
          <tr>
            <th>Subject</th>
            <th class="center">Date</th>
            <th class="center">Time</th>
          </tr>
        </thead>
        <tbody>${datesheetBody}</tbody>
      </table>

      <div class="ac-instructions">
        <div class="ac-section-title">Instructions</div>
        <ol>
          ${INSTRUCTIONS.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
        </ol>
      </div>

      <div class="ac-signs">
        <div class="ac-sign"><div class="line">&nbsp;</div>Student Signature</div>
        <div class="ac-sign"><div class="line">&nbsp;</div>Principal Signature</div>
      </div>
    </div>
  `;
};

// Wrap one or more card blocks into a full printable HTML document.
// NOTE: unlike web, no `body onload=window.print()` — expo-print rasterises the
// document directly.
const buildAdmitPrintDocument = (title, bodyHtml) =>
  `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>${cardStyles}</style>
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>`;

// -- public API -------------------------------------------------------------

/**
 * Generate + share a single student's admit card as a PDF.
 * @param {Object}   params
 * @param {Object}   params.student    Student details (see file header).
 * @param {Object}   params.exam       Exam details { id, name, academicYear }.
 * @param {Array}    params.schedule   Date-sheet rows for this class+exam.
 * @param {Object}   [params.schoolInfo] School header overrides.
 * @returns {Promise<void>}
 */
export async function printAdmitCard({ student, exam, schedule, schoolInfo } = {}) {
  if (!student) {
    throw new Error('No student selected for the admit card.');
  }

  const bodyHtml = buildCardHtml({ student, exam, schedule, schoolInfo });
  const title = `Admit Card - ${pick(student?.name, student?.displayName, 'Student')}`;
  await deliverPdf(buildAdmitPrintDocument(title, bodyHtml));
}

/**
 * Generate + share one admit card per student (page-break between them) as a
 * single PDF — used for bulk / whole-class generation.
 * @param {Object}   params
 * @param {Array}    params.students   Array of student objects.
 * @param {Object}   params.exam       Exam details { id, name, academicYear }.
 * @param {Array}    params.schedule   Date-sheet rows (shared across the class).
 * @param {Object}   [params.schoolInfo] School header overrides.
 * @returns {Promise<void>}
 */
export async function printAdmitCardsForClass({ students, exam, schedule, schoolInfo } = {}) {
  const list = Array.isArray(students) ? students.filter(Boolean) : [];

  if (!list.length) {
    throw new Error('No students available to print admit cards.');
  }

  const bodyHtml = list
    .map((student) => buildCardHtml({ student, exam, schedule, schoolInfo }))
    .join('\n');

  const title = `Admit Cards - ${pick(exam?.name, 'Examination')} (${list.length})`;
  await deliverPdf(buildAdmitPrintDocument(title, bodyHtml));
}
