import React, { useState } from 'react';
import { MessageSquare, Reply, Send, UserRound } from 'lucide-react';
import { getClassLabel, getMessages, getPortalStudent } from './studentPortalData';

const Communication = ({ session }) => {
  const student = getPortalStudent(session);
  const messages = getMessages(student);
  const [draft, setDraft] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!draft.trim()) {
      alert('Please type a message.');
      return;
    }

    alert(`Message queued from ${student.displayName}.`);
    setDraft('');
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6">
        <h2 className="text-xl font-black flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> Communication
        </h2>
        <p className="text-xs font-bold text-[#555555] mt-1">
          Messages and replies are scoped to {student.displayName} | {getClassLabel(student)}
        </p>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 bg-white border border-[#C8C8C8] rounded-3xl p-5">
          <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3 mb-4">
            <h3 className="text-sm font-black">Inbox</h3>
            <span className="text-[10px] font-black text-[#555555]">{messages.length} messages</span>
          </div>

          <div className="space-y-3">
            {messages.map((message) => (
              <article key={message.id} className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-3xl p-4 space-y-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-9 h-9 rounded-2xl bg-white border border-[#C8C8C8] flex items-center justify-center shrink-0">
                      <UserRound className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate">{message.title}</p>
                      <p className="text-[10px] font-bold text-[#555555] truncate">From {message.from}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#555555]">{message.time}</span>
                </div>
                <p className="text-xs leading-relaxed font-semibold text-[#555555]">{message.body}</p>
              </article>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="xl:col-span-2 bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-[#EAEAEA] pb-3">
            <Reply className="w-4 h-4" />
            <h3 className="text-sm font-black">Send Message</h3>
          </div>

          <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3 text-xs font-bold">
            <p className="text-[10px] font-black uppercase text-[#555555] mb-1">Sender</p>
            <p>{student.displayName}</p>
            <p className="text-[10px] text-[#555555] mt-1">{student.admissionNumber} | {getClassLabel(student)}</p>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-[#555555]">Recipient</label>
            <select className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2.5 text-xs font-bold outline-none">
              <option>Class Teacher</option>
              <option>Accounts Desk</option>
              <option>Transport Desk</option>
              <option>Library</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-[#555555]">Message</label>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={7}
              placeholder="Type your message..."
              className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-3 text-xs font-semibold outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#E1FA6C] rounded-2xl text-xs font-black border border-[#1A1A1A]/10"
          >
            <Send className="w-4 h-4" /> Send Message
          </button>
        </form>
      </section>
    </div>
  );
};

export default Communication;
