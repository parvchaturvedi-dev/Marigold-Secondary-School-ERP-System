import React from 'react';
import { AlertTriangle, CalendarCheck, CheckCircle2, Clock } from 'lucide-react';
import {
  getAttendanceRows,
  getClassLabel,
  getPortalStudent,
  getStudentMetrics,
} from './studentPortalData';

const Attendance = ({ session }) => {
  const student = getPortalStudent(session);
  const rows = getAttendanceRows(student);
  const metrics = getStudentMetrics(student);

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <CalendarCheck className="w-5 h-5" /> Attendance Register
          </h2>
          <p className="text-xs font-bold text-[#555555] mt-1">
            {student.displayName} | {getClassLabel(student)} | {student.admissionNumber}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 min-w-full lg:min-w-[420px]">
          <Summary label="Present" value={metrics.presentDays} icon={CheckCircle2} tone="text-emerald-700 bg-emerald-50 border-emerald-100" />
          <Summary label="Working" value={metrics.workingDays} icon={Clock} tone="text-blue-700 bg-blue-50 border-blue-100" />
          <Summary label="Ratio" value={`${metrics.attendance}%`} icon={CalendarCheck} tone="text-purple-700 bg-purple-50 border-purple-100" />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
          <h3 className="text-sm font-black">Attendance Health</h3>
          <div className="w-full aspect-square max-w-64 mx-auto rounded-full border-[18px] border-[#EAEAEA] flex items-center justify-center relative">
            <div
              className="absolute inset-[-18px] rounded-full border-[18px] border-[#E1FA6C]"
              style={{
                clipPath: `polygon(50% 50%, 50% 0, ${50 + metrics.attendance / 2}% 0, 100% 50%, 50% 50%)`,
              }}
            />
            <div className="relative text-center">
              <p className="text-4xl font-black">{metrics.attendance}%</p>
              <p className="text-[10px] font-black uppercase text-[#555555]">Current Year</p>
            </div>
          </div>

          {metrics.attendance < 75 ? (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 text-xs font-bold text-rose-700 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> Below minimum attendance requirement.
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-xs font-bold text-emerald-700 flex gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Attendance is above the minimum requirement.
            </div>
          )}
        </div>

        <div className="xl:col-span-8 bg-white border border-[#C8C8C8] rounded-3xl p-5">
          <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3 mb-4">
            <h3 className="text-sm font-black">Monthly Attendance Sheet</h3>
            <span className="text-[10px] font-black text-[#555555]">Scoped to active student</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#EAEAEA]">
            <table className="w-full min-w-[720px] text-left text-xs font-bold">
              <thead className="bg-[#EAEAEA] text-[#555555] uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2">Working Days</th>
                  <th className="px-3 py-2">Present</th>
                  <th className="px-3 py-2">Absent</th>
                  <th className="px-3 py-2">Late</th>
                  <th className="px-3 py-2">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {rows.map((row) => {
                  const percentage = Math.round((row.present / row.workingDays) * 100);

                  return (
                    <tr key={row.month} className="hover:bg-[#F8F8F8]">
                      <td className="px-3 py-3 font-black">{row.month}</td>
                      <td className="px-3 py-3">{row.workingDays}</td>
                      <td className="px-3 py-3 text-emerald-700">{row.present}</td>
                      <td className="px-3 py-3 text-rose-700">{row.absent}</td>
                      <td className="px-3 py-3">{row.late}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-[#EAEAEA] rounded-full overflow-hidden">
                            <div className="h-full bg-[#1A1A1A]" style={{ width: `${percentage}%` }} />
                          </div>
                          <span className="font-mono">{percentage}%</span>
                        </div>
                      </td>
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
