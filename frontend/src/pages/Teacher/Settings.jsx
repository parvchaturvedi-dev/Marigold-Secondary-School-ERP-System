import React, { useState } from 'react';
import { Bell, Lock, Settings as SettingsIcon, ShieldCheck, UserRound } from 'lucide-react';
import {
  getTeacherClassSections,
  getTeacherProfile,
} from './teacherPortalData';

const Settings = ({ session }) => {
  const profile = getTeacherProfile(session);
  const sections = getTeacherClassSections(session);
  const [settings, setSettings] = useState({
    emailAlerts: true,
    smsAlerts: true,
    attendanceReminders: true,
    examReviewAlerts: true,
    assignmentNotifications: true,
  });

  const toggle = (field) => {
    setSettings((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6">
        <h2 className="text-xl font-black flex items-center gap-2">
          <SettingsIcon className="w-5 h-5" /> Settings
        </h2>
        <p className="text-xs font-bold text-[#555555] mt-1">
          Preferences and access controls for {profile.displayName}.
        </p>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-2 bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#EAEAEA] pb-3">
            <UserRound className="w-4 h-4" />
            <h3 className="text-sm font-black">Teacher Scope</h3>
          </div>

          <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-4 text-xs font-bold space-y-2">
            <p><span className="text-[#555555]">Teacher:</span> {profile.displayName}</p>
            <p><span className="text-[#555555]">Employee:</span> {profile.employeeId}</p>
            <p><span className="text-[#555555]">Department:</span> {profile.department}</p>
            <p><span className="text-[#555555]">Class Charge:</span> {profile.classTeacherFor}</p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-xs font-bold text-blue-700 flex gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Teacher permissions are derived from the logged-in username and allotted class list.
          </div>
        </div>

        <div className="xl:col-span-3 bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#EAEAEA] pb-3">
            <Bell className="w-4 h-4" />
            <h3 className="text-sm font-black">Notification Preferences</h3>
          </div>

          <div className="space-y-3">
            <ToggleRow label="Email alerts" description="Receive staff notices and meeting updates on email." checked={settings.emailAlerts} onClick={() => toggle('emailAlerts')} />
            <ToggleRow label="SMS alerts" description="Receive urgent class and leave approval alerts." checked={settings.smsAlerts} onClick={() => toggle('smsAlerts')} />
            <ToggleRow label="Attendance reminders" description="Show daily attendance register reminders." checked={settings.attendanceReminders} onClick={() => toggle('attendanceReminders')} />
            <ToggleRow label="Exam review alerts" description="Notify when papers require teacher review." checked={settings.examReviewAlerts} onClick={() => toggle('examReviewAlerts')} />
            <ToggleRow label="Assignment notifications" description="Notify when assignments are updated or locked." checked={settings.assignmentNotifications} onClick={() => toggle('assignmentNotifications')} />
          </div>
        </div>
      </section>

      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-5">
        <h3 className="text-sm font-black flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4" /> Allotted Access
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {sections.map((section) => (
            <div key={section.id} className="border rounded-2xl p-4 bg-[#F8F8F8] border-[#EAEAEA]">
              <p className="text-xs font-black">{section.label}</p>
              <p className="text-[10px] font-bold text-[#555555] mt-1">{section.room}</p>
              <p className="text-[10px] font-bold text-[#555555] mt-1">{section.subjects.join(', ')}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const ToggleRow = ({ label, description, checked, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-4 flex items-center justify-between gap-4 text-left"
  >
    <span>
      <span className="block text-xs font-black">{label}</span>
      <span className="block text-[10px] font-semibold text-[#555555] mt-1">{description}</span>
    </span>
    <span className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${checked ? 'bg-[#1A1A1A]' : 'bg-[#C8C8C8]'}`}>
      <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </span>
  </button>
);

export default Settings;
