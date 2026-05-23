import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Save,
  Users,
  XCircle,
} from 'lucide-react';
import {
  getTeacherAttendanceRows,
  getTeacherClassSections,
  getTeacherProfile,
  getTeacherRoster,
} from './teacherPortalData';

const attendanceOptions = [
  { id: 'Present', label: 'P', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { id: 'Absent', label: 'A', tone: 'bg-rose-50 text-rose-700 border-rose-100' },
  { id: 'Late', label: 'L', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
  { id: 'Leave', label: 'Lv', tone: 'bg-blue-50 text-blue-700 border-blue-100' },
];

const Attendance = ({ session }) => {
  const profile = getTeacherProfile(session);
  const sections = getTeacherClassSections(session);
  const classRows = getTeacherAttendanceRows(session);
  const [selectedClass, setSelectedClass] = useState(sections[0]?.className || 'Class 9');
  const [statusByStudent, setStatusByStudent] = useState({});
  const roster = getTeacherRoster(session, selectedClass);

  const summary = useMemo(() => {
    const counts = roster.reduce(
      (total, student) => {
        const status = statusByStudent[student.id] || student.attendanceStatus || 'Present';
        total[status] = (total[status] || 0) + 1;
        return total;
      },
      { Present: 0, Absent: 0, Late: 0, Leave: 0 }
    );

    const effectivePresent = counts.Present + counts.Late;
    const percentage = roster.length ? Math.round((effectivePresent / roster.length) * 100) : 0;

    return { ...counts, percentage, total: roster.length };
  }, [roster, statusByStudent]);

  const setStudentStatus = (studentId, status) => {
    setStatusByStudent((prev) => ({ ...prev, [studentId]: status }));
  };

  const markAllPresent = () => {
    setStatusByStudent((prev) => ({
      ...prev,
      ...Object.fromEntries(roster.map((student) => [student.id, 'Present'])),
    }));
  };

  const handleSave = () => {
    alert(`${selectedClass} attendance saved for ${profile.displayName}.`);
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <CalendarCheck className="w-5 h-5" /> Attendance Register
          </h2>
          <p className="text-xs font-bold text-[#555555] mt-1">
            Mark daily attendance for allotted classes | {profile.employeeId}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 min-w-full lg:min-w-[420px]">
          <Summary label="Present" value={summary.Present} icon={CheckCircle2} tone="text-emerald-700 bg-emerald-50 border-emerald-100" />
          <Summary label="Absent" value={summary.Absent} icon={XCircle} tone="text-rose-700 bg-rose-50 border-rose-100" />
          <Summary label="Ratio" value={`${summary.percentage}%`} icon={Clock} tone="text-blue-700 bg-blue-50 border-blue-100" />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white border border-[#C8C8C8] rounded-3xl p-5">
            <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3 mb-4">
              <h3 className="text-sm font-black">Class Summary</h3>
              <span className="text-[10px] font-black text-[#555555]">Today</span>
            </div>

            <div className="space-y-3">
              {classRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedClass(row.className)}
                  className={`w-full text-left rounded-2xl border p-3 transition-colors ${
                    selectedClass === row.className
                      ? 'bg-[#E1FA6C] border-[#1A1A1A]/10'
                      : 'bg-[#F8F8F8] border-[#EAEAEA] hover:border-[#C8C8C8]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black">{row.label}</p>
                      <p className="text-[10px] font-bold text-[#555555] mt-1">
                        {row.present}/{row.total} present | {row.late} late
                      </p>
                    </div>
                    <span className="text-sm font-black">{row.percentage}%</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-black">Selected Class Health</h3>
            <div className="w-full aspect-square max-w-60 mx-auto rounded-full border-[16px] border-[#EAEAEA] flex items-center justify-center">
              <div className="text-center">
                <p className="text-4xl font-black">{summary.percentage}%</p>
                <p className="text-[10px] font-black uppercase text-[#555555]">Attendance</p>
              </div>
            </div>
            {summary.percentage < 75 ? (
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 text-xs font-bold text-rose-700 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Attendance is below the minimum threshold.
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-xs font-bold text-emerald-700 flex gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Attendance is healthy for this class.
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-8 bg-white border border-[#C8C8C8] rounded-3xl p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#EAEAEA] pb-3 mb-4 gap-3">
            <div>
              <h3 className="text-sm font-black flex items-center gap-2">
                <Users className="w-4 h-4" /> {selectedClass} Daily Sheet
              </h3>
              <p className="text-[10px] font-bold text-[#555555] mt-1">
                Present includes on-time and late arrivals in ratio.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={markAllPresent}
                className="px-4 py-2 rounded-full bg-[#F8F8F8] border border-[#EAEAEA] text-xs font-black"
              >
                Mark All Present
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-full bg-[#E1FA6C] border border-[#1A1A1A]/10 text-xs font-black flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Register
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#EAEAEA]">
            <table className="w-full min-w-[760px] text-left text-xs font-bold">
              <thead className="bg-[#EAEAEA] text-[#555555] uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2">Roll</th>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Admission No.</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Guardian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {roster.map((student) => {
                  const status = statusByStudent[student.id] || student.attendanceStatus || 'Present';

                  return (
                    <tr key={student.id} className="hover:bg-[#F8F8F8]">
                      <td className="px-3 py-3 font-mono">{student.rollNo}</td>
                      <td className="px-3 py-3 font-black">{student.displayName}</td>
                      <td className="px-3 py-3 font-mono text-[#555555]">{student.admissionNumber}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {attendanceOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setStudentStatus(student.id, option.id)}
                              className={`w-9 h-8 rounded-xl border text-[10px] font-black transition-colors ${
                                status === option.id
                                  ? option.tone
                                  : 'bg-white text-[#555555] border-[#EAEAEA] hover:border-[#C8C8C8]'
                              }`}
                              title={option.id}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[#555555]">{student.guardianPhone}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

const Summary = ({ label, value, icon, tone }) => (
  <div className={`border rounded-2xl p-3 ${tone}`}>
    {React.createElement(icon, { className: 'w-4 h-4 mb-2' })}
    <p className="text-[10px] font-black uppercase">{label}</p>
    <p className="text-lg font-black mt-0.5">{value}</p>
  </div>
);

export default Attendance;
