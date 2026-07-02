import React, { useState } from 'react';
import {
  BookOpen,
  FileText,
  GraduationCap,
  IdCard,
  UserRound,
  Users,
} from 'lucide-react';
import ProfilePhotoUploader from '../../components/common/ProfilePhotoUploader';
import {
  getTeacherClassSections,
  getTeacherDocuments,
  getTeacherMetrics,
  getTeacherProfile,
  getTeacherSubjectLoad,
} from './teacherPortalData';

const Profile = ({ session }) => {
  const profile = getTeacherProfile(session);
  const metrics = getTeacherMetrics(session);
  const sections = getTeacherClassSections(session);
  const subjects = getTeacherSubjectLoad(session);
  const documents = getTeacherDocuments(session);
  const [activeTab, setActiveTab] = useState('personal');

  const tabs = [
    { id: 'personal', label: 'Personal', icon: UserRound },
    { id: 'teaching', label: 'Teaching', icon: GraduationCap },
    { id: 'classes', label: 'Classes', icon: Users },
    { id: 'documents', label: 'Documents', icon: FileText },
  ];

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900">
      <section className="glass-card rounded-3xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 text-center space-y-4">
          <div className="relative">
            <ProfilePhotoUploader session={{ ...session, displayName: profile.displayName }} />
            <span className="absolute -bottom-2 bg-indigo-100 text-indigo-700 border-indigo-200 text-[9px] font-black px-2 py-1 rounded-md">
              FACULTY
            </span>
          </div>

          <div>
            <h2 className="text-xl font-black">{profile.displayName}</h2>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {profile.employeeId} | {profile.department}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-left">
            <MiniStat label="Classes" value={metrics.classes} />
            <MiniStat label="Students" value={metrics.students} />
            <MiniStat label="Subjects" value={metrics.subjects} />
            <MiniStat label="Attendance" value={`${metrics.attendanceAverage}%`} />
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="glass-soft rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Account Scope</p>
            <p className="text-xs font-semibold leading-relaxed">
              This profile controls teacher-only access for attendance, assignment publishing,
              paper review, and marks entry across the allotted class list.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-2 flex flex-wrap gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-colors ${
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-white/70'
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
                  ['Full Name', profile.displayName],
                  ['Employee ID', profile.employeeId],
                  ['Username', profile.username],
                  ['Designation', profile.designation],
                  ['Qualification', profile.qualification],
                  ['Department', profile.department],
                  ['Date of Birth', profile.dob],
                  ['Gender', profile.gender],
                  ['Blood Group', profile.bloodGroup],
                  ['Joined On', profile.joiningDate],
                  ['Phone', profile.phone],
                  ['Email', profile.email],
                  ['Address', profile.address],
                  ['Emergency Contact', profile.emergencyContact],
                ]}
              />
            )}

            {activeTab === 'teaching' && (
              <div className="space-y-4">
                <InfoGrid
                  items={[
                    ['Class Teacher Charge', profile.classTeacherFor],
                    ['Periods Today', metrics.periodsToday],
                    ['Active Assignments', metrics.activeAssignments],
                    ['Pending Paper Reviews', metrics.pendingPapers],
                  ]}
                />

                <div className="overflow-x-auto rounded-2xl border border-slate-100/80">
                  <table className="w-full min-w-[680px] text-left text-xs font-bold">
                    <thead className="bg-indigo-50/60 text-slate-500 uppercase text-[10px]">
                      <tr>
                        <th className="px-3 py-2">Class</th>
                        <th className="px-3 py-2">Subject</th>
                        <th className="px-3 py-2">Room</th>
                        <th className="px-3 py-2">Weekly Periods</th>
                        <th className="px-3 py-2">Syllabus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {subjects.map((item) => (
                        <tr key={`${item.className}-${item.subject}`}>
                          <td className="px-3 py-2">{item.className}-{item.section}</td>
                          <td className="px-3 py-2">{item.subject}</td>
                          <td className="px-3 py-2 text-slate-500">{item.room}</td>
                          <td className="px-3 py-2 font-mono">{item.weeklyPeriods}</td>
                          <td className="px-3 py-2 font-mono">{item.syllabusProgress}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'classes' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sections.map((section) => (
                  <div key={section.id} className="glass-soft rounded-2xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black">{section.label}</p>
                        <p className="text-[10px] font-bold text-slate-500 mt-1">
                          {section.room} | {section.students} students
                        </p>
                      </div>
                      <BookOpen className="w-4 h-4 text-slate-500" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 mt-3">
                      {section.subjects.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {documents.map((doc) => (
                  <div key={doc.name} className="glass-soft rounded-2xl p-4 flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-xs font-black truncate">{doc.name}</span>
                      <span className="block text-[10px] font-bold text-slate-500 mt-1">{doc.updatedAt}</span>
                    </span>
                    <span className={`text-[9px] font-black border px-2 py-1 rounded-md shrink-0 ${
                      doc.status === 'Verified'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {doc.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="glass-card rounded-3xl p-5">
        <h3 className="text-sm font-black flex items-center gap-2 mb-4">
          <IdCard className="w-4 h-4" /> Faculty Permission Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {['Attendance Register', 'Assignment Publishing', 'Paper Analysis', 'Marks Management'].map((item) => (
            <div key={item} className="glass-soft rounded-2xl p-4">
              <p className="text-xs font-black">{item}</p>
              <p className="text-[10px] font-bold text-emerald-700 mt-1">Enabled</p>
            </div>
          ))}
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
