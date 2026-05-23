import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Save,
  Search,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react';
import {
  CLERK_ATTENDANCE_REGISTERS,
  CLERK_STUDENTS,
  formatShortDate,
} from './clerkPortalData';
import { useMasterData } from '../../components/common/masterData';

const statusStyles = {
  present: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  absent: 'bg-red-50 text-red-700 border-red-100',
  late: 'bg-amber-50 text-amber-700 border-amber-100',
};

const registerTone = {
  Submitted: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Review: 'bg-amber-50 text-amber-700 border-amber-100',
  Pending: 'bg-red-50 text-red-700 border-red-100',
};

const Attendance = () => {
  const { classNames, students } = useMasterData();
  const today = new Date().toISOString().slice(0, 10);
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [searchTerm, setSearchTerm] = useState('');
  const [roster, setRoster] = useState(() =>
    (students.length ? students : CLERK_STUDENTS).map((student, index) => ({
      ...student,
      attendanceStatus: index === 4 ? 'absent' : index === 2 ? 'late' : 'present',
      note: index === 2 ? 'Lab duty' : '',
    }))
  );

  useEffect(() => {
    if (!students.length) return;
    setRoster((currentRoster) =>
      students.map((student, index) => {
        const existing = currentRoster.find((item) => item.id === student.id);
        return {
          ...student,
          attendanceStatus: existing?.attendanceStatus || 'present',
          note: existing?.note || '',
        };
      })
    );
  }, [students]);
  const availableClasses = classNames.length
    ? classNames
    : [...new Set(roster.map((student) => student.className).filter(Boolean))];

  const filteredRoster = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return roster.filter((student) => {
      const matchesClass =
        selectedClass === 'All Classes' || student.className === selectedClass;
      const searchBlob = [
        student.name,
        student.admissionNumber,
        student.className,
        student.section,
        student.guardian,
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !normalizedSearch || searchBlob.includes(normalizedSearch);

      return matchesClass && matchesSearch;
    });
  }, [roster, searchTerm, selectedClass]);

  const summary = useMemo(
    () =>
      filteredRoster.reduce(
        (acc, student) => ({
          ...acc,
          total: acc.total + 1,
          [student.attendanceStatus]: acc[student.attendanceStatus] + 1,
        }),
        { total: 0, present: 0, absent: 0, late: 0 }
      ),
    [filteredRoster]
  );

  const updateAttendance = (studentId, attendanceStatus) => {
    setRoster((prev) =>
      prev.map((student) =>
        student.id === studentId
          ? {
              ...student,
              attendanceStatus,
            }
          : student
      )
    );
  };

  const updateNote = (studentId, note) => {
    setRoster((prev) =>
      prev.map((student) => (student.id === studentId ? { ...student, note } : student))
    );
  };

  const markFilteredRoster = (attendanceStatus) => {
    const filteredIds = new Set(filteredRoster.map((student) => student.id));
    setRoster((prev) =>
      prev.map((student) =>
        filteredIds.has(student.id) ? { ...student, attendanceStatus } : student
      )
    );
  };

  const handleSaveRegister = () => {
    alert(
      `Attendance saved for ${selectedClass} on ${formatShortDate(attendanceDate)}. Present: ${summary.present}, Absent: ${summary.absent}, Late: ${summary.late}.`
    );
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <CalendarCheck2 className="w-5 h-5" /> Attendance Desk
          </h2>
          <p className="text-xs font-bold text-[#555555] mt-1">
            Review, correct, and save daily attendance registers for class teachers.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2 text-xs font-bold">
            <Search className="w-4 h-4 text-[#555555]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search student..."
              className="bg-transparent outline-none w-44"
            />
          </div>

          <select
            value={selectedClass}
            onChange={(event) => setSelectedClass(event.target.value)}
            className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2 text-xs font-bold outline-none"
          >
            <option>All Classes</option>
            {availableClasses.map((className) => (
              <option key={className}>{className}</option>
            ))}
          </select>

          <input
            type="date"
            value={attendanceDate}
            onChange={(event) => setAttendanceDate(event.target.value)}
            className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2 text-xs font-bold outline-none"
          />
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <SummaryCard icon={Users} label="Roster" value={summary.total} tone="bg-blue-50 text-blue-700 border-blue-100" />
        <SummaryCard icon={UserCheck} label="Present" value={summary.present} tone="bg-emerald-50 text-emerald-700 border-emerald-100" />
        <SummaryCard icon={UserMinus} label="Absent" value={summary.absent} tone="bg-red-50 text-red-700 border-red-100" />
        <SummaryCard icon={Clock3} label="Late" value={summary.late} tone="bg-amber-50 text-amber-700 border-amber-100" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#EAEAEA] pb-3">
            <div>
              <h3 className="text-sm font-black">Live Attendance Register</h3>
              <p className="text-[10px] font-bold text-[#555555] mt-1">
                Current scope: {selectedClass} | {formatShortDate(attendanceDate)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => markFilteredRoster('present')}
                className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[10px] font-black"
              >
                Mark All Present
              </button>
              <button
                type="button"
                onClick={handleSaveRegister}
                className="px-4 py-2 bg-[#E1FA6C] border border-[#1A1A1A]/10 rounded-xl text-[10px] font-black flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" /> Save Register
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#EAEAEA]">
            <table className="w-full min-w-[780px] text-left text-xs font-bold">
              <thead className="bg-[#EAEAEA] text-[#555555] uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-3">Student</th>
                  <th className="px-3 py-3">Class</th>
                  <th className="px-3 py-3">Guardian</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Office Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {filteredRoster.map((student) => (
                  <tr key={student.id} className="bg-white">
                    <td className="px-3 py-3">
                      <p className="font-black">{student.name}</p>
                      <p className="text-[10px] font-mono text-[#555555] mt-0.5">{student.admissionNumber}</p>
                    </td>
                    <td className="px-3 py-3">
                      {student.className}-{student.section}
                      <p className="text-[10px] text-[#555555] mt-0.5">Roll {student.rollNo}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p>{student.guardian}</p>
                      <p className="text-[10px] text-[#555555] mt-0.5">{student.phone}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {['present', 'absent', 'late'].map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => updateAttendance(student.id, status)}
                            className={`px-2.5 py-1 rounded-lg border text-[10px] font-black capitalize ${
                              student.attendanceStatus === status
                                ? statusStyles[status]
                                : 'bg-[#F8F8F8] text-[#555555] border-[#EAEAEA]'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        value={student.note}
                        onChange={(event) => updateNote(student.id, event.target.value)}
                        placeholder="Optional note"
                        className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-xl px-3 py-2 text-[11px] font-semibold outline-none focus:border-black"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="xl:col-span-4 space-y-6">
          <div className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3">
              <h3 className="text-sm font-black">Teacher Submissions</h3>
              <CheckCircle2 className="w-4 h-4 text-[#555555]" />
            </div>

            <div className="space-y-3">
              {CLERK_ATTENDANCE_REGISTERS.map((register) => (
                <article key={register.id} className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black">{register.className}-{register.section}</p>
                      <p className="text-[10px] font-bold text-[#555555] mt-0.5">{register.teacher}</p>
                    </div>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${registerTone[register.status]}`}>
                      {register.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <MiniCount label="P" value={register.present} />
                    <MiniCount label="A" value={register.absent} />
                    <MiniCount label="L" value={register.late} />
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-3">
            <h3 className="text-sm font-black">Register Notes</h3>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-xs font-semibold text-amber-800 leading-relaxed">
              Absent and late entries should be checked against leave requests before final monthly locking.
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-xs font-semibold text-blue-800 leading-relaxed">
              Teacher submissions marked Review remain editable by the clerk desk until admin export.
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
};

const SummaryCard = ({ icon, label, value, tone }) => (
  <div className="bg-white border border-[#C8C8C8] rounded-3xl p-4 min-h-28 flex items-center gap-3">
    <span className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${tone}`}>
      {React.createElement(icon, { className: 'w-5 h-5' })}
    </span>
    <div>
      <p className="text-[10px] font-black uppercase text-[#555555]">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
  </div>
);

const MiniCount = ({ label, value }) => (
  <div className="bg-white border border-[#EAEAEA] rounded-xl p-2">
    <p className="text-[9px] font-black text-[#555555]">{label}</p>
    <p className="text-xs font-black">{value}</p>
  </div>
);

export default Attendance;
