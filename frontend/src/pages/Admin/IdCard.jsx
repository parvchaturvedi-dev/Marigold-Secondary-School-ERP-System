import React, { useEffect, useMemo, useState } from 'react';
import { Download, IdCard as IdCardIcon, Printer, Search, UsersRound } from 'lucide-react';
import { apiFetch } from '../../components/common/api';
import { useMasterData, sortClassNames } from '../../components/common/masterData';
import {
  IdCardStyles,
  ResponsiveIdCardPair,
  exportIdCardsPdf,
  normalizeStaffCard,
  normalizeStudentCard,
} from '../../components/common/idCardKit';

const roleTabs = [
  ['students', 'Students'],
  ['teachers', 'Teachers'],
  ['clerks', 'Clerks'],
  ['admins', 'Admins'],
];

const IdCard = () => {
  const masterData = useMasterData();
  const [users, setUsers] = useState([]);
  const [role, setRole] = useState('students');
  const [classFilter, setClassFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let mounted = true;
    apiFetch('/auth/users')
      .then((payload) => mounted && setUsers(Array.isArray(payload) ? payload : []))
      .catch(() => mounted && setUsers([]));
    return () => {
      mounted = false;
    };
  }, []);

  const records = useMemo(() => {
    if (role === 'students') return masterData.students.map(normalizeStudentCard);
    if (role === 'teachers') return masterData.teachers.map((teacher, index) => normalizeStaffCard(teacher, 'teacher', index));
    if (role === 'clerks') return masterData.clerks.map((clerk, index) => normalizeStaffCard(clerk, 'clerk', index));
    return users.filter((user) => user.role === 'admin').map((user, index) => normalizeStaffCard(user, 'admin', index));
  }, [masterData.clerks, masterData.students, masterData.teachers, role, users]);

  const classNames = useMemo(
    () => sortClassNames(records.filter((record) => record.type === 'student').map((record) => record.primaryLine.split('-')[0])),
    [records]
  );

  const visibleRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return records.filter((record) => {
      const classMatch = role !== 'students' || classFilter === 'all' || record.primaryLine.startsWith(classFilter);
      const haystack = [record.displayName, record.id, record.roleLabel, record.primaryLine].join(' ').toLowerCase();
      return classMatch && (!query || haystack.includes(query));
    });
  }, [classFilter, records, role, searchTerm]);

  const activeRecord =
    records.find((record) => record.id === selectedId) ||
    visibleRecords[0] ||
    records[0] ||
    null;

  const fileBase = `mgps-${role}-${classFilter === 'all' ? 'all' : classFilter.toLowerCase().replace(/\s+/g, '-')}-id-cards`;

  return (
    <div className="space-y-6 p-6 font-sans text-slate-900">
      <IdCardStyles />
      <section className="no-print glass-card rounded-2xl p-5 animate-fadeInUp">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
              <IdCardIcon className="w-5 h-5 text-indigo-500" /> ID Card Generation
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              One-click student, teacher, clerk, and admin ID cards from live ERP records. Principal signature is removed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportIdCardsPdf(activeRecord ? [activeRecord] : [], `${activeRecord?.id || 'single'}-id-card.pdf`)}
              disabled={!activeRecord}
              className="inline-flex items-center gap-2 rounded-lg btn-ghost px-4 py-2 text-xs font-black disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Export Selected PDF
            </button>
            <button
              type="button"
              onClick={() => exportIdCardsPdf(visibleRecords, `${fileBase}.pdf`)}
              disabled={!visibleRecords.length}
              className="inline-flex items-center gap-2 rounded-lg btn-primary px-4 py-2 text-xs font-black disabled:opacity-50"
            >
              <Printer className="w-4 h-4" /> Generate All Visible
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <aside className="no-print xl:col-span-4 glass-card rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-100/80 space-y-3">
            <div className="flex glass-soft rounded-xl p-1">
              {roleTabs.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setRole(id);
                    setClassFilter('all');
                    setSelectedId('');
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-black transition ${
                    role === id ? 'btn-primary' : 'text-slate-500 hover:bg-white/60'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {role === 'students' && (
              <select
                value={classFilter}
                onChange={(event) => {
                  setClassFilter(event.target.value);
                  setSelectedId('');
                }}
                className="w-full rounded-xl bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all px-3 py-2 text-xs font-bold"
              >
                <option value="all">All Classes</option>
                {classNames.map((className) => (
                  <option key={className} value={className}>{className}</option>
                ))}
              </select>
            )}
            <div className="relative bg-white/60 rounded-xl border border-white/80 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100 transition-all flex items-center px-3 py-2">
              <Search className="w-4 h-4 text-slate-500 mr-2" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search name, ID, class, role"
                className="bg-transparent outline-none text-xs font-semibold w-full"
              />
            </div>
          </div>

          <div className="max-h-[68vh] overflow-y-auto divide-y divide-slate-100/80">
            {visibleRecords.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => setSelectedId(record.id)}
                className={`w-full text-left p-4 transition flex items-center gap-3 ${
                  activeRecord?.id === record.id ? 'bg-indigo-50/70' : 'hover:bg-white/60'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/25 flex items-center justify-center shrink-0">
                  <UsersRound className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black truncate">{record.displayName}</p>
                  <p className="text-[10px] text-slate-500 font-semibold truncate">
                    {record.id} - {record.primaryLine || record.roleLabel}
                  </p>
                </div>
              </button>
            ))}
            {!visibleRecords.length && (
              <div className="p-8 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
                No synced identities found.
              </div>
            )}
          </div>
        </aside>

        <main className="xl:col-span-8 glass-card rounded-2xl p-6">
          {activeRecord ? (
            <div className="id-print-area flex justify-center pb-2">
              <ResponsiveIdCardPair record={activeRecord} />
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-xs font-black text-neutral-400 uppercase tracking-widest">
              Add ERP users to generate ID cards.
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default IdCard;
