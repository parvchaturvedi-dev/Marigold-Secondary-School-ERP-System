// admitCard.js
// ---------------------------------------------------------------------------
// Self-contained utility for printing a student's exam ADMIT CARD in a clean,
// official paper format (same visual family as an RBSE / school admit card).
//
// It opens a fresh print window, writes inline HTML/CSS (no external assets,
// no dependencies) and triggers window.print(). Pure vanilla JS.
//
// Exports:
//   printAdmitCard({ student, exam, schedule, schoolInfo })
//   printAdmitCardsForClass({ students, exam, schedule, schoolInfo })
//
// Data shapes (all fields are read defensively):
//   student   : { admissionNumber, rollNo, name, fatherName, motherName,
//                 className, section, photoDataUrl? }
//   exam      : { id, name, academicYear }
//   schedule  : [{ subject, date, startTime, endTime, examId?, className? }]
//   schoolInfo: { name, line1, line2, regNo }
// ---------------------------------------------------------------------------

// Marigold defaults used whenever the caller omits schoolInfo fields.
const DEFAULT_SCHOOL_INFO = {
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
  const info = { ...DEFAULT_SCHOOL_INFO, ...(schoolInfo || {}) };

  // Defensive field lookups across the various possible property names.
  const studentName = pick(student?.name, student?.displayName);
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
            ${fieldRow("Student's Name", studentName)}
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

// Wrap one or more card blocks into a full printable HTML document, then open a
// print window, write it, and trigger printing on load.
const openPrintWindow = (title, bodyHtml) => {
  const printWindow = window.open('', '_blank', 'width=900,height=1000');

  // Pop-up blocked (or otherwise unavailable) — tell the user instead of failing
  // silently.
  if (!printWindow) {
    alert('Unable to open the print window. Please allow pop-ups for this site and try again.');
    return null;
  }

  const documentHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>${cardStyles}</style>
  </head>
  <body onload="window.focus(); window.print(); setTimeout(function(){ window.close(); }, 500);">
    ${bodyHtml}
  </body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(documentHtml);
  printWindow.document.close();
  return printWindow;
};

// -- public API -------------------------------------------------------------

/**
 * Print a single student's admit card.
 * @param {Object}   params
 * @param {Object}   params.student    Student details (see file header).
 * @param {Object}   params.exam       Exam details { id, name, academicYear }.
 * @param {Array}    params.schedule   Date-sheet rows for this class+exam.
 * @param {Object}   [params.schoolInfo] School header overrides.
 */
export function printAdmitCard({ student, exam, schedule, schoolInfo } = {}) {
  if (!student) {
    alert('No student selected for the admit card.');
    return;
  }

  const bodyHtml = buildCardHtml({ student, exam, schedule, schoolInfo });
  const title = `Admit Card - ${pick(student?.name, student?.displayName, 'Student')}`;
  openPrintWindow(title, bodyHtml);
}

/**
 * Print one admit card per student (page-break between them) in a single
 * print window — used for bulk / whole-class generation.
 * @param {Object}   params
 * @param {Array}    params.students   Array of student objects.
 * @param {Object}   params.exam       Exam details { id, name, academicYear }.
 * @param {Array}    params.schedule   Date-sheet rows (shared across the class).
 * @param {Object}   [params.schoolInfo] School header overrides.
 */
export function printAdmitCardsForClass({ students, exam, schedule, schoolInfo } = {}) {
  const list = Array.isArray(students) ? students.filter(Boolean) : [];

  if (!list.length) {
    alert('No students available to print admit cards.');
    return;
  }

  const bodyHtml = list
    .map((student) => buildCardHtml({ student, exam, schedule, schoolInfo }))
    .join('\n');

  const title = `Admit Cards - ${pick(exam?.name, 'Examination')} (${list.length})`;
  openPrintWindow(title, bodyHtml);
}
