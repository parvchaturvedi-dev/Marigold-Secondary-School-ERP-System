import React, { useMemo, useState } from 'react';
import { CalendarCheck2, Fingerprint, Search, Users } from 'lucide-react';
import { useMasterData } from '../../components/common/masterData';

const getAttendanceStatus = (student = {}) =>
  String(student.attendanceStatus || student.todayAttendance || student.rawProfile?.attendanceStatus || 'unmarked')
    .trim()
    .toLowerCase();

const getStatusLabel = (status) => {
  if (status === 'present') return 'Present';
  if (status === 'absent') return 'Absent';
  if (status === 'leave') return 'Leave';
  return 'Unmarked';
};

const Attendance = () => {
  const masterData = useMasterData();
  const [selectedClassName, setSelectedClassName] = useState(masterData.classNames[0] || '');
  const [searchTerm, setSearchTerm] = useState('');

  const classSummaries = useMemo(
    () =>
      masterData.classNames.map((className) => {
        const students = masterData.students.filter((student) => student.className === className);
        const present = students.filter((student) => getAttendanceStatus(student) === 'present').length;
        const absent = students.filter((student) => getAttendanceStatus(student) === 'absent').length;
        const leave = students.filter((student) => getAttendanceStatus(student) === 'leave').length;
        return {
          className,
          total: students.length,
          present,
          absent,
          leave,
          unmarked: Math.max(0, students.length - present - absent - leave),
        };
      }),
    [masterData.classNames, masterData.students]
  );

  const visibleStudents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return masterData.students
      .filter((student) => !selectedClassName || student.className === selectedClassName)
      .filter((student) => {
        const haystack = [student.displayName, student.admissionNumber, student.fatherName]
          .join(' ')
          .toLowerCase();
        return !normalizedSearch || haystack.includes(normalizedSearch);
      })
      .sort((a, b) => Number(a.rollNo || 0) - Number(b.rollNo || 0) || a.displayName.localeCompare(b.displayName));
  }, [masterData.students, searchTerm, selectedClassName]);

  const totals = classSummaries.reduce(
    (acc, item) => ({
      total: acc.total + item.total,
      present: acc.present + item.present,
      absent: acc.absent + item.absent,
      leave: acc.leave + item.leave,
      unmarked: acc.unmarked + item.unmarked,
    }),
    { total: 0, present: 0, absent: 0, leave: 0, unmarked: 0 }
  );

  return (
    <div className="space-y-6 p-6 font-sans select-none text-[#1A1A1A]">
      <div className="bg-white border border-[#C8C8C8] rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
              <CalendarCheck2 className="w-5 h-5 text-emerald-700" /> Attendance Tracker
            </h2>
            <p className="text-xs text-[#555555] font-semibold mt-1">
              Live roster sync from Student Management and Class Management.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              ['Students', totals.total],
              ['Present', totals.present],
              ['Absent', totals.absent],
              ['Unmarked', totals.unmarked],
            ].map(([label, value]) => (
              <div key={label} className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-xl px-4 py-2">
                <p className="text-[10px] font-black uppercase text-[#555555]">{label}</p>
                <p className="text-lg font-black">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 bg-white border border-[#C8C8C8] rounded-2xl p-4 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-[#555555] mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Classes
          </h3>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {classSummaries.map((summary) => (
              <button
                key={summary.className}
                type="button"
                onClick={() => setSelectedClassName(summary.className)}
                className={`w-full text-left border rounded-xl p-3 transition ${
                  selectedClassName === summary.className
                    ? 'bg-[#1A1A1A] text-white border-black'
                    : 'bg-[#F8F8F8] border-[#EAEAEA] hover:border-black'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black">{summary.className}</span>
                  <span className="text-[10px] font-mono">{summary.total}</span>
                </div>
                <p className={`text-[10px] mt-1 ${selectedClassName === summary.className ? 'text-neutral-300' : 'text-[#555555]'}`}>
                  P {summary.present} / A {summary.absent} / L {summary.leave} / U {summary.unmarked}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white border border-[#C8C8C8] rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#EAEAEA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black">{selectedClassName || 'All Classes'} Roster</h3>
              <p className="text-[10px] text-[#555555] font-semibold">Attendance status follows each student record when available.</p>
            </div>
            <div className="relative bg-[#F8F8F8] rounded-xl border border-[#D9D9D9] flex items-center px-3 py-2 w-full sm:w-72">
              <Search className="w-4 h-4 text-[#555555] mr-2" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search student"
                className="bg-transparent outline-none text-xs font-semibold w-full"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-[#F8F8F8] text-[10px] uppercase tracking-wider text-[#555555] font-black">
                <tr>
                  <th className="px-4 py-3">Roll</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Admission</th>
                  <th className="px-4 py-3">Guardian</th>
                  <th className="px-4 py-3 text-center">Today</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {visibleStudents.map((student) => {
                  const status = getAttendanceStatus(student);
                  return (
                    <tr key={student.id} className="hover:bg-[#F8F8F8]">
                      <td className="px-4 py-3 font-mono font-black">{student.rollNo || '-'}</td>
                      <td className="px-4 py-3 font-bold">{student.displayName}</td>
                      <td className="px-4 py-3 font-mono text-[#555555]">{student.admissionNumber || '-'}</td>
                      <td className="px-4 py-3 text-[#555555]">{student.fatherName || student.motherName || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-black ${
                          status === 'present'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : status === 'absent'
                              ? 'bg-rose-50 text-rose-700 border-rose-100'
                              : status === 'leave'
                                ? 'bg-blue-50 text-blue-700 border-blue-100'
                                : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                        }`}>
                          <Fingerprint className="w-3 h-3" /> {getStatusLabel(status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!visibleStudents.length && (
                  <tr>
                    <td colSpan="5" className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
                      No synced students found for this class.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
