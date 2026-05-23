import React, { useState } from 'react';
import { Bell, Lock, Settings as SettingsIcon, ShieldCheck, UserRound } from 'lucide-react';
import { getClassLabel, getPortalStudent } from './studentPortalData';

const Settings = ({ session }) => {
  const student = getPortalStudent(session);
  const [settings, setSettings] = useState({
    emailAlerts: true,
    smsAlerts: true,
    assignmentReminders: true,
    meetingReminders: true,
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
          Preferences for {student.displayName} | {getClassLabel(student)}
        </p>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-2 bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#EAEAEA] pb-3">
            <UserRound className="w-4 h-4" />
            <h3 className="text-sm font-black">Active Student Scope</h3>
          </div>

          <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-4 text-xs font-bold space-y-2">
            <p><span className="text-[#555555]">Student:</span> {student.displayName}</p>
            <p><span className="text-[#555555]">Admission:</span> {student.admissionNumber}</p>
            <p><span className="text-[#555555]">Class:</span> {getClassLabel(student)}</p>
            <p><span className="text-[#555555]">Account:</span> {session?.isSiblingAccount ? session.accountDisplayName : 'Solo student account'}</p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-xs font-bold text-blue-700 flex gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Student records remain separated by admission number, class, and roll number.
          </div>
        </div>

        <div className="xl:col-span-3 bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#EAEAEA] pb-3">
            <Bell className="w-4 h-4" />
            <h3 className="text-sm font-black">Notification Preferences</h3>
          </div>

          <div className="space-y-3">
            <ToggleRow label="Email alerts" description="Receive school notices on registered email." checked={settings.emailAlerts} onClick={() => toggle('emailAlerts')} />
            <ToggleRow label="SMS alerts" description="Receive important attendance and fee updates." checked={settings.smsAlerts} onClick={() => toggle('smsAlerts')} />
            <ToggleRow label="Assignment reminders" description="Show assignment deadline nudges in portal." checked={settings.assignmentReminders} onClick={() => toggle('assignmentReminders')} />
            <ToggleRow label="Meeting reminders" description="Notify before scheduled meetings." checked={settings.meetingReminders} onClick={() => toggle('meetingReminders')} />
          </div>
        </div>
      </section>

      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-5">
        <h3 className="text-sm font-black flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4" /> Linked User Differentiation
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {(session?.studentProfiles || [student]).map((item) => (
            <div
              key={item.id}
              className={`border rounded-2xl p-4 ${
                item.id === student.id ? 'bg-[#E1FA6C] border-[#1A1A1A]/10' : 'bg-[#F8F8F8] border-[#EAEAEA]'
              }`}
            >
              <p className="text-xs font-black">{item.displayName}</p>
              <p className="text-[10px] font-mono text-[#555555] mt-1">{item.admissionNumber}</p>
              <p className="text-[10px] font-bold text-[#555555] mt-1">{getClassLabel(item)}</p>
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
