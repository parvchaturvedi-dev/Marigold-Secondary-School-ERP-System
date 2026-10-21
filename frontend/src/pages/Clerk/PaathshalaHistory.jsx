import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Database,
  GraduationCap,
  Search,
  UserRound,
} from 'lucide-react';

const PAGE_SIZE = 25;
const EMPTY_ROWS = [];
const STUDENT_ID_FIELDS = ['sid', 'studentid', 'stuid', 'student'];
const STUDENT_TABLES = ['SAdmission', 'C_SAdmission'];
const HIDDEN_PROFILE_FIELDS = new Set(['stuimage', 'gphoto']);
const LEGACY_ID_LABELS = {
  admintype: 'Admission Type ID (legacy code; label unavailable)',
  category: 'Category ID (legacy code; label unavailable)',
  faculty: 'Faculty ID (legacy code; label unavailable)',
  house: 'House ID (legacy code; label unavailable)',
  section: 'Section ID (legacy code; label unavailable)',
};

const normalizeField = (field) => field.replace(/[^a-z0-9]/gi, '').toLowerCase();

const findField = (record, candidates) => {
  if (!record) return undefined;
  const candidateSet = new Set(candidates.map(normalizeField));
  return Object.keys(record).find((key) => candidateSet.has(normalizeField(key)));
};

const getStudentId = (record) => {
  const key = findField(record, STUDENT_ID_FIELDS);
  return key ? record[key] : undefined;
};

const getStudentName = (record) => {
  const key = findField(record, ['StuName', "Student's Name", 'StudentName', 'Name']);
  return key && record[key] ? String(record[key]).trim() : '';
};

const formatCell = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const humanizeField = (field, value) =>
  (normalizeField(field) === 'class' &&
    value !== null &&
    value !== undefined &&
    value !== '' &&
    Number.isFinite(Number(value))
    ? 'Class ID (legacy code; class name unavailable)'
    : LEGACY_ID_LABELS[normalizeField(field)]) ||
  field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const PaathshalaHistory = ({ setActivePage }) => {
  const [archive, setArchive] = useState(null);
  const [availableArchives, setAvailableArchives] = useState([]);
  const [history, setHistory] = useState(null);
  const [view, setView] = useState('students');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    if (!window.mgpsDesktop?.isDesktop) {
      setError('Paathshala history is available in Clerk desktop archives only.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const [archives, activeArchive] = await Promise.all([
        window.mgpsDesktop.archives.list(),
        window.mgpsDesktop.archives.getActive(),
      ]);
      const paathshalaArchives = archives.filter(
        (item) => item.kind === 'snapshot' && item.name.startsWith('Paathshala ')
      );
      setAvailableArchives(paathshalaArchives);
      const selectedArchive =
        paathshalaArchives.find((item) => item.id === activeArchive?.id) ||
        paathshalaArchives[0] ||
        null;
      setArchive(selectedArchive);
      if (!selectedArchive) {
        setHistory(null);
        return;
      }
      setHistory(
        await window.mgpsDesktop.archives.readCollection(
          selectedArchive.id,
          'paathshala-history'
        )
      );
    } catch (loadError) {
      setError(loadError.message || 'Unable to read this local history archive.');
      setHistory(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const selectArchive = async (archiveId) => {
    const nextArchive = availableArchives.find((item) => item.id === archiveId);
    if (!nextArchive) return;
    setIsLoading(true);
    setError('');
    setArchive(nextArchive);
    try {
      setHistory(
        await window.mgpsDesktop.archives.readCollection(
          nextArchive.id,
          'paathshala-history'
        )
      );
    } catch (loadError) {
      setError(loadError.message || 'Unable to read this local history archive.');
      setHistory(null);
    } finally {
      setIsLoading(false);
    }
  };

  const tables = useMemo(
    () =>
      Object.entries(history?.tables || {})
        .filter(([, rows]) => Array.isArray(rows))
        .sort(([left], [right]) => left.localeCompare(right)),
    [history]
  );

  const students = useMemo(() => {
    const records = STUDENT_TABLES.flatMap((tableName) => {
      const table = tables.find(([name]) => name.toLowerCase() === tableName.toLowerCase());
      return table?.[1] || [];
    });
    const uniqueStudents = new Map();
    records.forEach((record, index) => {
      const id = getStudentId(record);
      const name = getStudentName(record);
      const key = id === undefined || id === null || id === '' ? `record-${index}` : String(id);
      const existing = uniqueStudents.get(key);
      if (!existing || (!getStudentName(existing) && name)) uniqueStudents.set(key, record);
    });
    return [...uniqueStudents.entries()]
      .map(([id, record]) => ({ id, record }))
      .sort((left, right) =>
        (getStudentName(left.record) || left.id).localeCompare(
          getStudentName(right.record) || right.id
        )
      );
  }, [tables]);

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return students;
    return students.filter(({ id, record }) =>
      [id, ...Object.values(record || {})]
        .map(formatCell)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [students, studentSearch]);

  const selectedStudent =
    filteredStudents.find(({ id }) => id === selectedStudentId) ||
    filteredStudents[0] ||
    null;

  useEffect(() => {
    if (selectedStudent && !students.some(({ id }) => id === selectedStudentId)) {
      setSelectedStudentId(selectedStudent.id);
    }
  }, [selectedStudent, selectedStudentId, students]);

  const studentRecords = useMemo(() => {
    if (!selectedStudent) return [];
    const selectedId = String(getStudentId(selectedStudent.record) ?? selectedStudent.id);
    return tables.flatMap(([name, rows]) => {
      if (STUDENT_TABLES.some((tableName) => tableName.toLowerCase() === name.toLowerCase())) {
        return [];
      }
      const matches = rows.filter((row) => {
        const idField = findField(row, STUDENT_ID_FIELDS);
        return idField && String(row[idField]) === selectedId;
      });
      return matches.map((record) => ({ table: name, record }));
    });
  }, [selectedStudent, tables]);

  const activeTable = tables.find(([name]) => name === selectedTable) || tables[0];
  const rows = activeTable?.[1] ?? EMPTY_ROWS;
  const columns = useMemo(
    () => [...new Set(rows.slice(0, 100).flatMap((row) => Object.keys(row || {})))],
    [rows]
  );
  const filteredRows = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      Object.values(row || {}).some((value) => formatCell(value).toLowerCase().includes(query))
    );
  }, [rows, tableSearch]);
  const pageCount = Math.ceil(filteredRows.length / PAGE_SIZE);
  const visibleRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const profileFields = selectedStudent
    ? Object.entries(selectedStudent.record).filter(
        ([field, value]) =>
          !HIDDEN_PROFILE_FIELDS.has(normalizeField(field)) &&
          value !== null &&
          value !== undefined &&
          value !== ''
      )
    : [];

  const openCertificate = (pageName) => {
    if (!selectedStudent || !archive || !setActivePage) return;
    window.sessionStorage.setItem(
      'mgps-paathshala-certificate-source',
      JSON.stringify({
        archiveId: archive.id,
        studentId: String(getStudentId(selectedStudent.record) ?? selectedStudent.id),
      })
    );
    setActivePage(pageName);
  };

  useEffect(() => {
    if (!tables.some(([name]) => name === selectedTable)) {
      setSelectedTable(tables[0]?.[0] || '');
    }
    setPage(0);
  }, [selectedTable, tables]);

  useEffect(() => setPage(0), [tableSearch, selectedTable]);

  if (isLoading) {
    return <div className="glass-card rounded-3xl p-8 text-sm font-bold text-slate-500">Loading local history…</div>;
  }

  if (error) {
    return (
      <div className="glass-card rounded-3xl p-6 text-sm font-bold text-rose-700" role="alert">
        {error}
      </div>
    );
  }

  if (!archive) {
    return (
      <div className="glass-card rounded-3xl p-8 text-center">
        <Archive className="mx-auto h-8 w-8 text-indigo-500" />
        <h2 className="mt-3 text-lg font-black text-slate-900">Choose a local past session</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Select a Paathshala archive from Clerk Settings to view its imported history.
        </p>
      </div>
    );
  }

  if (!history) {
    return (
      <div className="glass-card rounded-3xl p-8 text-center">
        <Database className="mx-auto h-8 w-8 text-slate-400" />
        <h2 className="mt-3 text-lg font-black text-slate-900">{archive.name}</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          This archive does not contain an imported Paathshala history dataset.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8 text-slate-900">
      <section className="glass-card rounded-3xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
              Local, read-only archive
            </p>
            <h1 className="mt-1 text-2xl font-black">
              {history.sourceSessionYear || archive.name}
            </h1>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {students.length.toLocaleString()} students · {Number(history.recordCount || 0).toLocaleString()} imported rows
              {history.startDate ? ` · ${history.startDate} – ${history.endDate || ''}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Paathshala session archive"
              className="input-shell min-w-56"
              onChange={(event) => selectArchive(event.target.value)}
              value={archive.id}
            >
              {availableArchives.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <button
              aria-pressed={view === 'students'}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black ${
                view === 'students' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setView('students')}
              type="button"
            >
              <UserRound className="h-4 w-4" />
              Students
            </button>
            <button
              aria-pressed={view === 'tables'}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black ${
                view === 'tables' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setView('tables')}
              type="button"
            >
              <Database className="h-4 w-4" />
              All records
            </button>
          </div>
        </div>
        <p className="mt-4 text-xs font-medium text-slate-500">
          Student profiles and linked academic records are read-only in this encrypted local archive.
          Photo files were not copied into each session.
        </p>
      </section>

      {view === 'students' ? (
        <section className="grid gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,2fr)]">
          <div className="glass-card rounded-3xl p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                aria-label="Search students"
                className="input-shell w-full pl-10"
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Search name, admission no., parent…"
                value={studentSearch}
              />
            </label>
            <p className="px-2 pb-2 pt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
              {filteredStudents.length.toLocaleString()} students
            </p>
            <div className="max-h-[68vh] space-y-1 overflow-y-auto">
              {filteredStudents.map(({ id, record }) => {
                const name = getStudentName(record) || `Student ${id}`;
                const classField = findField(record, ['Class', 'ClassName']);
                const rollField = findField(record, ['SrNo', 'FormNo', 'Adm No#']);
                return (
                  <button
                    aria-pressed={selectedStudent?.id === id}
                    className={`w-full rounded-xl px-3 py-3 text-left ${
                      selectedStudent?.id === id ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'
                    }`}
                    key={id}
                    onClick={() => setSelectedStudentId(id)}
                    type="button"
                  >
                    <span className="block truncate text-sm font-black text-slate-800">{name}</span>
                    <span className="mt-1 block truncate text-[11px] font-semibold text-slate-500">
                      {rollField ? `Admission / Sr. No. ${formatCell(record[rollField])}` : `Student ID ${id}`}
                      {classField ? ` · Class ${formatCell(record[classField])}` : ''}
                    </span>
                  </button>
                );
              })}
              {filteredStudents.length === 0 && (
                <p className="px-3 py-8 text-center text-sm font-bold text-slate-500">
                  {students.length
                    ? 'No students match your search.'
                    : 'No student profiles were included in this session archive.'}
                </p>
              )}
            </div>
          </div>

          {selectedStudent ? (
            <div className="space-y-5">
              <section className="glass-card rounded-3xl p-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
                    <GraduationCap className="h-7 w-7" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black">
                      {getStudentName(selectedStudent.record) || `Student ${selectedStudent.id}`}
                    </h2>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      Paathshala student ID {formatCell(getStudentId(selectedStudent.record) ?? selectedStudent.id)}
                    </p>
                  </div>
                </div>
                <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {profileFields.map(([field, value]) => (
                    <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-3" key={field}>
                      <dt className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                        {humanizeField(field, value)}
                      </dt>
                      <dd className="mt-1 break-words text-sm font-bold text-slate-800">
                        {formatCell(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
                  Faculty, section, class, category, house and admission-type numbers are legacy IDs.
                  Their name lookup tables were not present in the source database.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="btn-primary rounded-xl px-4 py-2 text-xs font-black"
                    onClick={() => openCertificate('Transfer Certificate')}
                    type="button"
                  >
                    Create Transfer Certificate
                  </button>
                  <button
                    className="btn-secondary rounded-xl px-4 py-2 text-xs font-black"
                    onClick={() => openCertificate('Study Certificate')}
                    type="button"
                  >
                    Create Study Certificate
                  </button>
                </div>
              </section>

              <section className="glass-card rounded-3xl p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-black">Academic & session records</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {studentRecords.length.toLocaleString()} linked legacy records in this session
                    </p>
                  </div>
                </div>
                {studentRecords.length ? (
                  <div className="space-y-3">
                    {studentRecords.map(({ table, record }, index) => (
                      <details className="rounded-xl border border-slate-200" key={`${table}-${record.Id || record.id || index}`}>
                        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-indigo-700">
                          {table}
                          <span className="ml-2 text-[10px] font-bold text-slate-400">
                            {Object.keys(record).length} fields
                          </span>
                        </summary>
                        <dl className="grid gap-2 border-t border-slate-100 p-4 sm:grid-cols-2">
                          {Object.entries(record).map(([field, value]) => (
                            <div className="min-w-0" key={field}>
                              <dt className="text-[10px] font-bold uppercase text-slate-400">
                                {humanizeField(field, value)}
                              </dt>
                              <dd className="break-words text-xs font-semibold text-slate-700">
                                {formatCell(value)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                    No marks, attendance, fee, or other rows in this session match this student ID.
                  </p>
                )}
              </section>
            </div>
          ) : (
            <div className="glass-card flex min-h-64 items-center justify-center rounded-3xl p-8 text-center text-sm font-bold text-slate-500">
              No student profile is available in this session archive.
            </div>
          )}
        </section>
      ) : (
        <section className="glass-card space-y-4 rounded-3xl p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(180px,280px)_1fr]">
            <select
              aria-label="Paathshala data table"
              className="input-shell"
              value={activeTable?.[0] || ''}
              onChange={(event) => setSelectedTable(event.target.value)}
            >
              {tables.map(([name, tableRows]) => (
                <option key={name} value={name}>
                  {name} ({tableRows.length.toLocaleString()})
                </option>
              ))}
            </select>
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                aria-label="Search rows"
                className="input-shell w-full pl-10"
                onChange={(event) => setTableSearch(event.target.value)}
                placeholder="Search this table…"
                value={tableSearch}
              />
            </label>
          </div>

          {tables.length === 0 ? (
            <p className="py-10 text-center text-sm font-bold text-slate-500">
              No imported table records are available for this session.
            </p>
          ) : (
            <>
              <div className="overflow-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      {columns.map((column) => (
                        <th className="whitespace-nowrap px-3 py-3" key={column}>{humanizeField(column)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleRows.map((row, index) => (
                      <tr className="align-top hover:bg-indigo-50/40" key={row.Id || row.id || `${page}-${index}`}>
                        {columns.map((column) => {
                          const fullValue = formatCell(row?.[column]);
                          return (
                            <td className="max-w-xs px-3 py-2 font-medium text-slate-700" key={column} title={fullValue}>
                              <span className="line-clamp-2 break-words">{fullValue}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {visibleRows.length === 0 && (
                      <tr>
                        <td className="px-4 py-10 text-center font-bold text-slate-500" colSpan={columns.length || 1}>
                          No rows match this search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-500">
                <span>
                  {filteredRows.length.toLocaleString()} rows
                  {tableSearch.trim() ? ` matching “${tableSearch.trim()}”` : ''}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    aria-label="Previous page"
                    className="btn-secondary rounded-lg p-2 disabled:opacity-40"
                    disabled={page <= 0}
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                    type="button"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span>{pageCount ? page + 1 : 0} / {pageCount}</span>
                  <button
                    aria-label="Next page"
                    className="btn-secondary rounded-lg p-2 disabled:opacity-40"
                    disabled={page + 1 >= pageCount}
                    onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                    type="button"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
};

export default PaathshalaHistory;
