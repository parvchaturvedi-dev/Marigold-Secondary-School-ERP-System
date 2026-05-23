import React, { useState } from 'react';
import { CalendarClock, MapPin, Plus, Video } from 'lucide-react';
import {
  getTeacherClassSections,
  getTeacherMeetings,
  getTeacherProfile,
} from './teacherPortalData';

const Meetings = ({ session }) => {
  const profile = getTeacherProfile(session);
  const sections = getTeacherClassSections(session);
  const [meetings, setMeetings] = useState(() => getTeacherMeetings(session));
  const [form, setForm] = useState({
    title: '',
    scope: sections[0]?.label || 'Faculty',
    date: '',
    time: '',
    mode: 'On Campus',
  });

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.date || !form.time) {
      alert('Please enter meeting title, date, and time.');
      return;
    }

    setMeetings((prev) => [
      {
        id: `meet-local-${Date.now()}`,
        title: form.title.trim(),
        owner: profile.displayName,
        date: form.date,
        time: form.time,
        mode: form.mode,
        scope: form.scope,
        agenda: 'Teacher-created meeting from portal.',
      },
      ...prev,
    ]);
    setForm((prev) => ({ ...prev, title: '', date: '', time: '' }));
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6">
        <h2 className="text-xl font-black flex items-center gap-2">
          <Video className="w-5 h-5" /> Meetings
        </h2>
        <p className="text-xs font-bold text-[#555555] mt-1">
          Meeting schedule and quick planning for {profile.displayName}.
        </p>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {meetings.map((meeting) => (
            <article key={meeting.id} className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase text-[#555555]">{meeting.scope}</p>
                  <h3 className="text-base font-black mt-1">{meeting.title}</h3>
                  <p className="text-xs font-bold text-[#555555] mt-1">Hosted by {meeting.owner}</p>
                </div>
                <span className="bg-[#E1FA6C] border border-[#1A1A1A]/10 rounded-2xl p-2">
                  <CalendarClock className="w-5 h-5" />
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-bold">
                <MeetingCell label="Date" value={meeting.date} />
                <MeetingCell label="Time" value={meeting.time} />
                <MeetingCell label="Mode" value={meeting.mode} />
              </div>

              <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3 flex items-start gap-2 text-xs font-bold text-[#555555]">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{meeting.agenda}</span>
              </div>
            </article>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="xl:col-span-2 bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-[#EAEAEA] pb-3">
            <Plus className="w-4 h-4" />
            <h3 className="text-sm font-black">Schedule Meeting</h3>
          </div>

          <InputField
            label="Title"
            value={form.title}
            onChange={(value) => updateForm('title', value)}
            placeholder="Parent interaction / faculty review"
          />

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-[#555555]">Scope</label>
            <select
              value={form.scope}
              onChange={(event) => updateForm('scope', event.target.value)}
              className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2.5 text-xs font-bold outline-none"
            >
              <option>Faculty</option>
              <option>Examination Cell</option>
              {sections.map((section) => (
                <option key={section.id}>{section.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <InputField label="Date" type="date" value={form.date} onChange={(value) => updateForm('date', value)} />
            <InputField label="Time" type="time" value={form.time} onChange={(value) => updateForm('time', value)} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-[#555555]">Mode</label>
            <select
              value={form.mode}
              onChange={(event) => updateForm('mode', event.target.value)}
              className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2.5 text-xs font-bold outline-none"
            >
              <option>On Campus</option>
              <option>Staff Room</option>
              <option>Conference Room</option>
              <option>Online</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#E1FA6C] rounded-2xl text-xs font-black border border-[#1A1A1A]/10"
          >
            <CalendarClock className="w-4 h-4" /> Add Meeting
          </button>
        </form>
      </section>
    </div>
  );
};

const MeetingCell = ({ label, value }) => (
  <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3">
    <p className="text-[10px] font-black uppercase text-[#555555]">{label}</p>
    <p className="mt-1 text-[#1A1A1A]">{value}</p>
  </div>
);

const InputField = ({ label, value, onChange, placeholder = '', type = 'text' }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black uppercase text-[#555555]">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2.5 text-xs font-bold outline-none"
    />
  </div>
);

export default Meetings;
