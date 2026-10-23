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
 *   - Grade thresholds use the saved A–F scale, with A–E minimum percentages
 *     configured by the school and F as the remaining range.
 *
 * Exports:
 *   - computeReportRows({ student, exams, marks, className })  -> structured rows
 *   - printReportCard({ student, exams, marks, className, schoolInfo, ... }) -> void
 */
import schoolLogo from '../../assets/logo.png';
import {
  assignClasswiseAlphabeticalRollNumbers,
  getAlphabeticalRollNumber,
} from '../../utils/studentRollNumbers';

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
const studentRoll = (student = {}, students = []) =>
  getAlphabeticalRollNumber(student, students) || student.rollNo || student.roll || '';

/**
 * Grade thresholds — identical to `calculateGrade` in examinationStore.js.
 * Kept local so this file stays self-contained (no cross-imports).
 */
const DEFAULT_GRADE_SCALE = [
  { grade: 'A', minPercentage: 90 },
  { grade: 'B', minPercentage: 80 },
  { grade: 'C', minPercentage: 70 },
  { grade: 'D', minPercentage: 60 },
  { grade: 'E', minPercentage: 50 },
  { grade: 'F', minPercentage: 0 },
];

const gradeFromPercentage = (percentage, gradeScale = DEFAULT_GRADE_SCALE) => {
  if (!Number.isFinite(percentage)) return '—';
  const scale = Array.isArray(gradeScale) && gradeScale.length
    ? [...gradeScale].sort((a, b) => Number(b.minPercentage) - Number(a.minPercentage))
    : DEFAULT_GRADE_SCALE;
  return scale.find((item) => percentage >= Number(item.minPercentage))?.grade || 'F';
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
export function computeReportRows({ student, exams, marks, className, examId, gradeScale }) {
  const safeExams = Array.isArray(exams) ? exams : [];
  const safeMarks = Array.isArray(marks) ? marks : [];
  const cls = className || student?.className || student?.reportClassName || '';
  const selectedExams = examId
    ? safeExams.filter((exam) => String(exam?.id) === String(examId))
    : safeExams;

  // Only the marks records for THIS class (defensive against undefined class).
  const classMarks = safeMarks.filter(
    (record) =>
      (!cls || record?.className === cls) &&
      (!examId || String(record?.examId) === String(examId))
  );

  // Discover every subject taught to this student in this class. We derive the
  // subject set from all records for the selected exam so every student in the
  // class is scored against the same subject maximums.
  const subjectSet = new Set();
  classMarks.forEach((record) => {
    if (!record?.subject) return;
    subjectSet.add(record.subject);
  });

  const subjects = [...subjectSet].sort((a, b) => a.localeCompare(b));

  // Running per-exam totals (across all subjects).
  const perExamTotals = selectedExams.map((exam) => ({ examId: exam?.id, max: 0, obt: 0 }));

  const subjectRows = subjects.map((subject) => {
    let total = 0;
    let totalMax = 0;

    const perExam = selectedExams.map((exam, examIndex) => {
      // The marks record for this exam + subject (+ class).
      const record = classMarks.find(
        (item) => item?.examId === exam?.id && item?.subject === subject
      );

      let max = null;
      let obt = null;

      if (record) {
        const studentRow = (record.rows || []).find((row) => rowBelongsToStudent(row, student));
        max = toNumberOrNull(record.maxMarks);
        obt = studentRow ? toNumberOrNull(studentRow.marks) : null;
      }

      if (max !== null) totalMax += max;
      if (obt !== null) total += obt;

      if (max !== null) perExamTotals[examIndex].max += max;
      if (obt !== null) perExamTotals[examIndex].obt += obt;

      return { examId: exam?.id, max, obt };
    });

    const subjectPct = totalMax > 0 ? (total / totalMax) * 100 : NaN;
    const grade = gradeFromPercentage(subjectPct, gradeScale);

    return { subject, perExam, total, totalMax, grade };
  });

  const grandMax = perExamTotals.reduce((sum, column) => sum + column.max, 0);
  const grandObtained = perExamTotals.reduce((sum, column) => sum + column.obt, 0);
  const percentage = grandMax > 0 ? (grandObtained / grandMax) * 100 : 0;
  const overallGrade = grandMax > 0 ? gradeFromPercentage(percentage, gradeScale) : '—';

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
  regNo: '52/ALW/2000',
  email: 'marigoldvijay@gmail.com',
  website: 'www.marigoldschoolbehror.com',
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
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Georgia, serif;
      color: #000; background: #fff; margin: 0; padding: 0;
    }
    .report-page {
      height: 281mm;
      display: grid;
      grid-template-rows: repeat(2, 140.5mm);
      align-content: start;
      break-after: page;
      page-break-after: always;
    }
    .report-page:last-child { break-after: auto; page-break-after: auto; }
    .sheet {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 140.5mm;
      overflow: hidden;
      border: 2px solid #000;
      padding: 5mm;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    /* --- Top bar: logo (left), reg no (right) --- */
    .topbar { display: flex; align-items: center; justify-content: space-between; }
    .logo-box {
      width: 56px; height: 56px; border: 0; display: flex;
      align-items: center; justify-content: center; font-size: 9px; text-align: center;
      overflow: hidden;
    }
    .logo-box img { width: 100%; height: 100%; object-fit: contain; }
    .regno { font-size: 9px; font-weight: bold; white-space: nowrap; }
    .report-page > .sheet:first-child:not(:only-child) { border-bottom-width: 1px; }
    .sheet + .sheet { border-top-width: 1px; }
    /* --- Centered school identity --- */
    .school { text-align: center; flex: 1; padding: 0 8px; }
    .school .line-sm { font-size: 9px; }
    .school .contact { font-size: 8px; }
    .school .name { font-size: 16px; font-weight: bold; margin: 2px 0; letter-spacing: .3px; }
    .report-title {
      flex: 0 0 auto;
      text-align: center; font-weight: bold; font-size: 11px; margin: 5px 0;
      border: 1px solid #000; padding: 3px 0;
    }
    /* --- Student info block --- */
    .info { display: flex; flex: 0 0 auto; gap: 8px; margin-bottom: 4px; }
    .info-cols { display: flex; flex: 1; gap: 10px; min-width: 0; }
    .info-col { flex: 1; }
    .info-col div { font-size: 9px; padding: 1px 0; }
    .info-col b { display: inline-block; min-width: 72px; }
    .photo {
      width: 72px; height: 88px; flex: 0 0 72px; border: 1px solid #000; display: flex;
      align-items: center; justify-content: center; font-size: 8px; color: #555; overflow: hidden;
    }
    .photo img { width: 100%; height: 100%; object-fit: cover; }
    /* --- Marks table --- */
    table.marks { width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 2px; }
    table.marks th, table.marks td { border: 1px solid #000; padding: 2px 3px; font-size: 8px; overflow-wrap: anywhere; }
    table.marks th { background: #f0f0f0; text-align: center; font-weight: bold; }
    table.marks th.exam-h { font-size: 8px; }
    table.marks th.sub-h { font-size: 7px; font-weight: normal; }
    td.subj { text-align: left; font-weight: bold; width: 24%; }
    td.num { text-align: center; }
    td.grade { font-weight: bold; }
    td.total { font-weight: bold; width: 10%; }
    tr.grand td { background: #f0f0f0; font-weight: bold; }
    /* --- Footer summary --- */
    .footer {
      display: flex; flex-wrap: wrap; flex: 0 0 auto; border: 1px solid #000; border-top: 0;
      font-size: 8px;
    }
    .footer .cell { flex: 1 1 33%; padding: 3px 5px; border-top: 1px solid #000; }
    .footer .cell b { font-weight: bold; }
    /* --- Signatures --- */
    .signs { display: flex; flex: 0 0 auto; justify-content: space-between; margin-top: auto; padding-top: 14mm; }
    .sign { flex: 1; position: relative; text-align: center; font-size: 9px; }
    .sign img {
      position: absolute; top: -40px; left: 50%; transform: translateX(-50%);
      width: 120px; height: 36px; object-fit: contain;
    }
    .sign .line { border-top: 1px solid #000; margin: 0 18px 4px; padding-top: 4px; }
    @media print {
      body { padding: 0; }
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
  examId,
  gradeScale,
  students = [],
  result = '—',
  rank = '—',
  attendancePresent,
  attendanceTotal,
  studentCount,
  principalSignature,
}) {
  // Each student's className for lookups falls back to the passed-in className.
  const cls = className || student?.reportClassName || student?.className || '';
  const safeExams = Array.isArray(exams) ? exams : [];

  // Compute the structured data once (shared with computeReportRows).
  const report = computeReportRows({
    student,
    exams: safeExams,
    marks,
    className: cls,
    examId,
    gradeScale,
  });

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
              <td class="num total">${esc(subjectRow.total)} / ${esc(subjectRow.totalMax)}</td>
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
  const activeExam = safeExams.find((exam) => String(exam?.id) === String(examId)) || safeExams[0];
  const examTitle = safeExams.length > 1 ? 'ANNUAL PROGRESS' : activeExam?.name || 'ANNUAL PROGRESS REPORT';
  const rankEntries = students
    .map((entry) => {
      const studentReport = computeReportRows({
        student: entry,
        exams: safeExams,
        marks,
        className: entry?.className || cls,
        examId,
        gradeScale,
      });
      return {
        student: entry,
        percentage: studentReport.percentage,
        hasMarks: studentReport.grandMax > 0,
      };
    })
    .filter((entry) => entry.hasMarks)
    .sort((a, b) =>
      b.percentage - a.percentage ||
      studentName(a.student).localeCompare(studentName(b.student), undefined, { sensitivity: 'base' }) ||
      String(studentAdmission(a.student)).localeCompare(String(studentAdmission(b.student)))
    );
  rankEntries.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  const rankEntry = rankEntries.find(({ student: entry }) =>
    (entry?.id && student?.id && entry.id === student.id) ||
    (entry?.admissionNumber && student?.admissionNumber && entry.admissionNumber === student.admissionNumber) ||
    (entry?.displayName && entry.displayName === studentName(student))
  );
  const suppliedRank = Number(rank);
  const candidateRank = rankEntry?.rank ?? (Number.isInteger(suppliedRank) && suppliedRank > 0 ? suppliedRank : null);
  const resolvedRank = candidateRank && candidateRank <= 3 ? candidateRank : '—';

  // ----- Single card markup (no document / <style> wrapper) ------------------
  return `
    <div class="sheet">
      <!-- Top bar -->
      <div class="topbar">
        <div class="logo-box"><img src="${esc(schoolLogo)}" alt="Marigold school logo" /></div>
        <div class="school">
          <div class="line-sm">${esc(info.line1)}</div>
          <div class="name">${esc(info.name)}</div>
          <div class="line-sm">${esc(info.line2)}</div>
          <div class="contact">${esc(info.email)} · ${esc(info.website)}</div>
        </div>
        <div class="regno">Reg No:<br/>${esc(info.regNo || '—')}</div>
      </div>

      <div class="report-title">${esc(examTitle)} REPORT CARD : ${esc(info.academicYear)}</div>

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
            <div><b>Roll No :</b> ${esc(studentRoll(student, students) || '—')}</div>
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
        <div class="cell"><b>Rank in Class :</b> ${esc(resolvedRank || '—')}</div>
        <div class="cell"><b>Over All Grade :</b> ${esc(report.overallGrade)}</div>
      </div>

      <!-- Signatures -->
      <div class="signs">
        <div class="sign"><div class="line">Class Teacher Signature</div></div>
        <div class="sign"><div class="line">Exam Incharge Signature</div></div>
        <div class="sign">
          ${principalSignature ? `<img src="${esc(principalSignature)}" alt="Principal signature" />` : ''}
          <div class="line">Principal/Headmaster Signature</div>
        </div>
      </div>
    </div>`;
}

/**
 * Wrap one or more `.sheet` blocks in a full printable document (shared <style>,
 * body onload -> print + close). Used by both single and bulk print paths.
 */
const buildPrintDocument = (title, sheetsHtml, isBulk = false) =>
  `<!doctype html><html><head><meta charset="utf-8">
  <title>${esc(title)}</title>
  <style>${REPORT_CARD_STYLES}</style></head>
  <body class="${isBulk ? 'bulk-print' : ''}" onload="window.print(); setTimeout(function(){ window.close(); }, 400);">
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
  examId,
  gradeScale,
  students = [],
  schoolInfo = {},
  result = '—',
  rank = '—',
  attendancePresent,
  attendanceTotal,
  studentCount,
  principalSignature,
}) {
  const info = { ...DEFAULT_SCHOOL_INFO, ...(schoolInfo || {}) };

  const sheetHtml = buildReportCardSheet({
    student,
    exams,
    marks,
    className,
    info,
    examId,
    gradeScale,
    students,
    result,
    rank,
    attendancePresent,
    attendanceTotal,
    studentCount,
    principalSignature,
  });

  const title = `Progress Report - ${studentName(student) || 'Student'}`;
  openPrintWindow(buildPrintDocument(title, `<div class="report-page">${sheetHtml}</div>`, true));
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
  examId,
  gradeScale,
  schoolInfo = {},
  principalSignature = '',
}) {
  const info = { ...DEFAULT_SCHOOL_INFO, ...(schoolInfo || {}) };
  const roster = Array.isArray(students) ? students : [];

  if (!roster.length) {
    alert('No students to print report cards for.');
    return;
  }

  // The class total is known here, so fill "No. of Students" for every card.
  const studentCount = roster.length;

  const assignedRoster = assignClasswiseAlphabeticalRollNumbers(roster);
  const orderedRoster = assignedRoster.sort((a, b) => {
    const classA = String(a.className || className || '');
    const classB = String(b.className || className || '');
    return classA.localeCompare(classB) || Number(a.rollNo || 0) - Number(b.rollNo || 0);
  });
  const sheetsHtml = Array.from({ length: Math.ceil(orderedRoster.length / 2) }, (_, pageIndex) => {
    const sheets = orderedRoster
      .slice(pageIndex * 2, pageIndex * 2 + 2)
      .map((student) =>
        buildReportCardSheet({
          student: student || {},
          exams,
          marks,
          className, // each student's className falls back to this inside the helper
          info,
          examId,
          gradeScale,
          students: orderedRoster,
          studentCount,
          principalSignature,
        })
      )
      .join('\n');
    return `<div class="report-page">${sheets}</div>`;
  }).join('\n');

  const title = `Progress Reports - ${className || info.academicYear}`;
  openPrintWindow(buildPrintDocument(title, sheetsHtml, true));
}
