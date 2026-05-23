import React, { useState } from 'react';
import { BellRing, CalendarDays, Megaphone, Send } from 'lucide-react';
import {
  getTeacherClassSections,
  getTeacherNotices,
  getTeacherProfile,
} from './teacherPortalData';

const Notices = ({ session }) => {
  const profile = getTeacherProfile(session);
  const sections = getTeacherClassSections(session);
  const [notices, setNotices] = useState(() => getTeacherNotices(session));
  const [form, setForm] = useState({
    title: '',
    scope: sections[0]?.label || 'Faculty',
    body: '',
    priority: 'Normal',
  });

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      alert('Please enter notice title and body.');
      return;
    }

    setNotices((prev) => [
      {
        id: `notice-local-${Date.now()}`,
        title: form.title.trim(),
        scope: form.scope,
        date: 'Today',
        priority: form.priority,
        body: form.body.trim(),
      },
      ...prev,
    ]);
    setForm((prev) => ({ ...prev, title: '', body: '' }));
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6">
        <h2 className="text-xl font-black flex items-center gap-2">
          <BellRing className="w-5 h-5" /> Notices
        </h2>
        <p className="text-xs font-bold text-[#555555] mt-1">
          Faculty and class notices relevant to {profile.displayName}.
        </p>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 space-y-4">
          {notices.map((notice) => (
            <article key={notice.id} className="bg-white border border-[#C8C8C8] rounded-3xl p-5 flex flex-col md:flex-row md:items-start gap-4">
              <span className="w-12 h-12 rounded-2xl bg-[#E1FA6C] border border-[#1A1A1A]/10 flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-[9px] font-black uppercase bg-[#EAEAEA] text-[#555555] px-2 py-1 rounded-md">
                    {notice.scope}
                  </span>
                  <span className={`text-[9px] font-black uppercase border px-2 py-1 rounded-md ${
                    notice.priority === 'High'
                      ? 'bg-rose-50 text-rose-700 border-rose-100'
                      : 'bg-blue-50 text-blue-700 border-blue-100'
                  }`}>
                    {notice.priority}
                  </span>
                  <span className="text-[9px] font-black uppercase bg-white text-[#555555] border border-[#EAEAEA] px-2 py-1 rounded-md flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> {notice.date}
                  </span>
                </div>
                <h3 className="text-sm font-black">{notice.title}</h3>
                <p className="text-xs font-semibold text-[#555555] leading-relaxed mt-2">{notice.body}</p>
              </div>
            </article>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="xl:col-span-2 bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-[#EAEAEA] pb-3">
            <Send className="w-4 h-4" />
            <h3 className="text-sm font-black">Create Class Notice</h3>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-[#555555]">Title</label>
            <input
              value={form.title}
              onChange={(event) => updateForm('title', event.target.value)}
              placeholder="Notebook submission / class update"
              className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2.5 text-xs font-bold outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-[#555555]">Scope</label>
              <select
                value={form.scope}
                onChange={(event) => updateForm('scope', event.target.value)}
                className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2.5 text-xs font-bold outline-none"
              >
                <option>Faculty</option>
                {sections.map((section) => (
                  <option key={section.id}>{section.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-[#555555]">Priority</label>
              <select
                value={form.priority}
                onChange={(event) => updateForm('priority', event.target.value)}
                className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2.5 text-xs font-bold outline-none"
              >
                <option>Normal</option>
                <option>High</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-[#555555]">Notice Body</label>
            <textarea
              value={form.body}
              onChange={(event) => updateForm('body', event.target.value)}
              rows={7}
              placeholder="Write notice details..."
              className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-3 text-xs font-semibold outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#E1FA6C] rounded-2xl text-xs font-black border border-[#1A1A1A]/10"
          >
            <Send className="w-4 h-4" /> Publish Notice
          </button>
        </form>
      </section>
    </div>
  );
};

export default Notices;
