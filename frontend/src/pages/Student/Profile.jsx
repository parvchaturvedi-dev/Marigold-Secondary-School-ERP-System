import React, { useState } from 'react';
import {
  FileText,
  GraduationCap,
  UserRound,
  Users,
} from 'lucide-react';
import ProfilePhotoUploader from '../../components/common/ProfilePhotoUploader';
import {
  getClassLabel,
  getDocumentStatus,
  getExamRecords,
  getFeeSummary,
  getPortalStudent,
  getStudentMetrics,
} from './studentPortalData';

const Profile = ({ session }) => {
  const student = getPortalStudent(session);
  const metrics = getStudentMetrics(student);
  const feeSummary = getFeeSummary(student);
  const exams = getExamRecords(student);
  const documents = getDocumentStatus(student);
  const [activeTab, setActiveTab] = useState('personal');

  const tabs = [
    { id: 'personal', label: 'Personal', icon: UserRound },
    { id: 'academic', label: 'Academic', icon: GraduationCap },
    { id: 'family', label: 'Family', icon: Users },
    { id: 'documents', label: 'Documents', icon: FileText },
  ];

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
      <section className="glass-card rounded-3xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 text-center space-y-4">
          <div className="relative">
            <ProfilePhotoUploader session={{ ...session, displayName: student.displayName }} />
            <span className="absolute -bottom-2 bg-indigo-100 text-indigo-700 border border-indigo-200 text-[9px] font-black px-2 py-1 rounded-md">
              ACTIVE USER
            </span>
          </div>

          <div>
            <h2 className="text-xl font-black">{student.displayName}</h2>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {student.admissionNumber} | {getClassLabel(student)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-left">
            <MiniStat label="Roll No" value={student.rollNo} />
            <MiniStat label="House" value={student.house} />
            <MiniStat label="Attendance" value={`${metrics.attendance}%`} />
            <MiniStat label="Fee" value={feeSummary.status} />
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="glass-soft rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Account Scope</p>
            <p className="text-xs font-semibold leading-relaxed">
              {session?.isSiblingAccount
                ? `${session.accountDisplayName} has ${session.studentProfiles?.length || 0} linked students. Current records belong to ${student.displayName}.`
                : 'Current records belong to this student account.'}
            </p>
          </div>

          <div className="bg-white/60 border border-white/70 rounded-2xl p-2 flex flex-wrap gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-colors ${
                    isActive ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white' : 'text-slate-500 hover:bg-white/70'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {tab.label}
                </button>
              );
            })}
          </div>

          <div className="glass-card rounded-3xl p-5 min-h-[340px]">
            {activeTab === 'personal' && (
              <InfoGrid
                items={[
                  ['Full Name', student.displayName],
                  ['Admission Number', student.admissionNumber],
                  ['Date of Birth', student.dob],
                  ['Gender', student.gender],
                  ['Blood Group', student.bloodGroup],
                  ['Bus Route', student.busRoute],
                ]}
              />
            )}

            {activeTab === 'academic' && (
              <div className="space-y-4">
                <InfoGrid
                  items={[
                    ['Class', getClassLabel(student)],
                    ['Roll Number', student.rollNo],
                    ['Attendance', `${metrics.presentDays}/${metrics.workingDays} days`],
                    ['Assignment Completion', `${metrics.assignmentCompletion}%`],
                  ]}
                />

                <div className="overflow-x-auto rounded-2xl border border-slate-100/80">
                  <table className="w-full min-w-[640px] text-left text-xs font-bold">
                    <thead className="bg-indigo-50/60 text-slate-500 uppercase text-[10px]">
                      <tr>
                        <th className="px-3 py-2">Subject</th>
                        <th className="px-3 py-2">Teacher</th>
                        <th className="px-3 py-2">Marks</th>
                        <th className="px-3 py-2">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {exams.map((exam) => (
                        <tr key={exam.subject}>
                          <td className="px-3 py-2">{exam.subject}</td>
                          <td className="px-3 py-2 text-slate-500">{exam.teacher}</td>
                          <td className="px-3 py-2 font-mono">{exam.marks}/100</td>
                          <td className="px-3 py-2">{exam.grade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'family' && (
              <div className="space-y-4">
                <InfoGrid
                  items={[
                    ['Father Name', student.fatherName],
                    ['Mother Name', student.motherName],
                    ['Guardian Phone', student.guardianPhone],
                    ['Address', student.address],
                  ]}
                />

                {session?.studentProfiles?.length > 1 && (
                  <div className="border-t border-slate-100/80 pt-4">
                    <p className="text-xs font-black mb-3">Linked Siblings</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {session.studentProfiles.map((item) => (
                        <div
                          key={item.id}
                          className={`p-3 rounded-2xl border ${
                            item.id === student.id
                              ? 'bg-indigo-100 border-indigo-200'
                              : 'glass-soft'
                          }`}
                        >
                          <p className="text-xs font-black">{item.displayName}</p>
                          <p className="text-[10px] font-mono text-slate-500 mt-1">
                            {item.admissionNumber} | {getClassLabel(item)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="glass-soft rounded-2xl p-4 flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-xs font-black truncate">{doc.name}</span>
                      <span className="block text-[10px] font-bold text-slate-500 mt-1 truncate">{doc.updatedOn}</span>
                    </span>
                    <span className={`text-[9px] font-black border px-2 py-1 rounded-md shrink-0 ${
                      doc.status === 'Verified'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {doc.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

const MiniStat = ({ label, value }) => (
  <div className="glass-soft rounded-2xl p-3">
    <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
    <p className="text-xs font-black mt-1 truncate">{value}</p>
  </div>
);

const InfoGrid = ({ items }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold">
    {items.map(([label, value]) => (
      <div key={label} className="glass-soft rounded-2xl p-3">
        <p className="text-[10px] font-black uppercase text-slate-500 mb-1">{label}</p>
        <p className="text-slate-900 break-words">{value}</p>
      </div>
    ))}
  </div>
);

export default Profile;
