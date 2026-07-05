/**
 * reportCard.js
 * ----------------------------------------------------------------------------
 * Self-contained utility to print a student's ANNUAL PROGRESS REPORT in an
 * exact paper (landscape A4) format that mirrors a real RBSE progress report.
 *
 * There are NO external dependencies here — pure vanilla JS that builds an
 * inline HTML/CSS string and opens a fresh print window (same approach as the
 * receipt print in Finance.jsx / the ExaminationHub print window).
 *
 * Data shapes (confirmed by reading examinationStore.js):
 *   - A marks RECORD (an item of `state.marks`) looks like:
 *       { id, examId, className, subject, maxMarks, rows: [...] }
 *   - A `row` inside `record.rows` (one per student) looks like:
 *       { studentId, admissionNumber, studentName, marks, remark }
 *     => the OBTAINED marks live on `row.marks`; the MAX lives on the
 *        record as `record.maxMarks`.
 *   - Grade thresholds mirror `calculateGrade` in examinationStore.js:
 *       >=90 A+, >=80 A, >=70 B+, >=60 B, >=50 C, else 'Needs Support'.
 *
 * Exports:
 *   - computeReportRows({ student, exams, marks, className })  -> structured rows
 *   - printReportCard({ student, exams, marks, className, schoolInfo, ... }) -> void
 */

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
 *
 * @returns {{
 *   subjects: Array<{
 *     subject: string,
 *     perExam: Array<{ examId: string, max: (number|null), obt: (number|null) }>,
 *     total: number,          // sum of obtained across exams
 *     totalMax: number,       // sum of max across exams
 *     grade: string           // grade from total obtained vs total max
 *   }>,
 *   perExamTotals: Array<{ examId: string, max: number, obt: number }>,
 *   grandMax: number,
 *   grandObtained: number,
 *   percentage: number,       // grandObtained / grandMax * 100 (may be 0)
 *   overallGrade: string
 * }}
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
// Printing
// ---------------------------------------------------------------------------

/** Default school identity (Marigold) — used when schoolInfo fields are missing. */
const DEFAULT_SCHOOL_INFO = {
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
  const maxObtHeaders = safeExams.map(() => `<th class="sub-h">Max</th><th class="sub-h">Obt</th>`).join('');

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
 * Wrap one or more `.sheet` blocks in a full printable document (shared <style>,
 * body onload -> print + close). Used by both single and bulk print paths.
 */
const buildPrintDocument = (title, sheetsHtml) =>
  `<!doctype html><html><head><meta charset="utf-8">
  <title>${esc(title)}</title>
  <style>${REPORT_CARD_STYLES}</style></head>
  <body onload="window.print(); setTimeout(function(){ window.close(); }, 400);">
    ${sheetsHtml}
  </body></html>`;

/** Open a fresh print window and write a document (receipt-print style). */
const openPrintWindow = (documentHtml) => {
  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) {
    alert('Please allow pop-ups to print the progress report.');
    return;
  }
  printWindow.document.write(documentHtml);
  printWindow.document.close();
};

/**
 * Open a clean print window and print a SINGLE student's Annual Progress Report.
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
 */
export function printReportCard({
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
  const info = { ...DEFAULT_SCHOOL_INFO, ...(schoolInfo || {}) };

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
  openPrintWindow(buildPrintDocument(title, sheetHtml));
}

/**
 * Open ONE print window and print an Annual Progress Report for EVERY student in
 * `students`, one report card per page (CSS page-break between them). Reuses the
 * exact same card markup as printReportCard via buildReportCardSheet.
 *
 * @param {object}   args
 * @param {object[]} args.students    - the class roster to print
 * @param {object[]} args.exams       - the year's exam records (column groups)
 * @param {object[]} args.marks       - the FULL state.marks array (filtered per student)
 * @param {string}   [args.className] - default class for students that have none
 * @param {object}   [args.schoolInfo]- { name, line1, line2, semisCode, regNo, academicYear }
 */
export function printReportCardsForClass({
  students = [],
  exams = [],
  marks = [],
  className,
  schoolInfo = {},
}) {
  const info = { ...DEFAULT_SCHOOL_INFO, ...(schoolInfo || {}) };
  const roster = Array.isArray(students) ? students : [];

  if (!roster.length) {
    alert('No students to print report cards for.');
    return;
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
  openPrintWindow(buildPrintDocument(title, sheetsHtml));
}
