import React, { useEffect, useMemo, useState } from 'react';
import { Download, IdCard as IdCardIcon, Printer, Search } from 'lucide-react';
import { apiFetch } from '../../components/common/api';
import { sortClassNames, useMasterData } from '../../components/common/masterData';
import {
  IdCardStyles,
  ResponsiveIdCardPair,
  exportIdCardsPdf,
  normalizeStaffCard,
  normalizeStudentCard,
} from '../../components/common/idCardKit';

const tabs = [
  ['students', 'Students'],
  ['teachers', 'Teachers'],
  ['clerks', 'Clerks'],
  ['admins', 'Admins'],
];

const IdCard = () => {
  const masterData = useMasterData();
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('students');
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
    if (tab === 'students') return masterData.students.map(normalizeStudentCard);
    if (tab === 'teachers') return masterData.teachers.map((teacher, index) => normalizeStaffCard(teacher, 'teacher', index));
    if (tab === 'clerks') return masterData.clerks.map((clerk, index) => normalizeStaffCard(clerk, 'clerk', index));
    return users.filter((user) => user.role === 'admin').map((user, index) => normalizeStaffCard(user, 'admin', index));
  }, [masterData.clerks, masterData.students, masterData.teachers, tab, users]);

  const classNames = useMemo(
    () => sortClassNames(records.filter((record) => record.type === 'student').map((record) => record.primaryLine.split('-')[0])),
    [records]
  );

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return records.filter((record) => {
      const classMatch = tab !== 'students' || classFilter === 'all' || record.primaryLine.startsWith(classFilter);
      const haystack = [record.displayName, record.id, record.primaryLine, record.roleLabel].join(' ').toLowerCase();
      return classMatch && (!query || haystack.includes(query));
    });
  }, [classFilter, records, searchTerm, tab]);

  const activeRecord =
    records.find((record) => record.id === selectedId) ||
    filteredRecords[0] ||
    records[0] ||
    null;

  return (
    <div className="space-y-6 pb-8 font-sans text-[#1A1A1A]">
      <IdCardStyles />
      <section className="no-print bg-white border border-[#C8C8C8] rounded-3xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <IdCardIcon className="w-5 h-5" /> ID Card Studio
          </h2>
          <p className="text-xs font-bold text-[#555555] mt-1">
            Generate every visible ERP user card in one click, or export a single selected card.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportIdCardsPdf(activeRecord ? [activeRecord] : [], `${activeRecord?.id || 'selected'}-id-card.pdf`)}
            disabled={!activeRecord}
            className="inline-flex items-center justify-center gap-2 border border-[#1A1A1A] bg-white px-4 py-2.5 rounded-xl text-xs font-black disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Export Selected
          </button>
          <button
            type="button"
            onClick={() => exportIdCardsPdf(filteredRecords, `mgps-${tab}-id-cards.pdf`)}
            disabled={!filteredRecords.length}
            className="inline-flex items-center justify-center gap-2 bg-[#1A1A1A] text-[#E1FA6C] px-4 py-2.5 rounded-xl text-xs font-black disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> Generate All Visible
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <aside className="no-print xl:col-span-4 bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
          <div className="grid grid-cols-4 gap-1 bg-[#EAEAEA] p-1 rounded-2xl border border-[#C8C8C8]">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id);
                  setClassFilter('all');
                  setSelectedId('');
                }}
                className={`px-2 py-2 rounded-xl text-[10px] font-black ${
                  tab === id ? 'bg-[#E1FA6C] text-[#1A1A1A] shadow-sm' : 'text-[#555555]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'students' && (
            <select
              value={classFilter}
              onChange={(event) => {
                setClassFilter(event.target.value);
                setSelectedId('');
              }}
              className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2 text-xs font-bold outline-none"
            >
              <option value="all">All Classes</option>
              {classNames.map((className) => (
                <option key={className} value={className}>{className}</option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2 bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2 text-xs font-bold">
            <Search className="w-4 h-4 text-[#555555]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search ID cards..."
              className="bg-transparent outline-none w-full"
            />
          </div>

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {filteredRecords.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => setSelectedId(record.id)}
                className={`w-full text-left rounded-2xl border p-3 transition-all ${
                  activeRecord?.id === record.id
                    ? 'bg-[#1A1A1A] text-white border-black'
                    : 'bg-[#F8F8F8] text-[#1A1A1A] border-[#EAEAEA] hover:border-black'
                }`}
              >
                <span className="block text-xs font-black truncate">{record.displayName}</span>
                <span className={`block text-[10px] font-mono mt-0.5 truncate ${activeRecord?.id === record.id ? 'text-neutral-300' : 'text-[#555555]'}`}>
                  {record.id} | {record.primaryLine || record.roleLabel}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="xl:col-span-8 bg-white border border-[#C8C8C8] rounded-3xl p-6">
          {activeRecord ? (
            <div className="id-print-area flex justify-center pb-2">
              <ResponsiveIdCardPair record={activeRecord} />
            </div>
          ) : (
            <div className="h-80 grid place-items-center text-xs font-black text-neutral-400 uppercase tracking-widest">
              No identity record found.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default IdCard;
