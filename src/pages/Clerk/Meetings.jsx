import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  MapPin,
  Plus,
  Search,
  Video,
} from 'lucide-react';
import {
  CLERK_MEETINGS,
  formatShortDate,
  getClerkProfile,
} from './clerkPortalData';

const statusTone = {
  Scheduled: 'bg-blue-50 text-blue-700 border-blue-100',
  'Pending Notes': 'bg-amber-50 text-amber-700 border-amber-100',
  Done: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const Meetings = ({ session }) => {
  const clerk = getClerkProfile(session);
  const [meetings, setMeetings] = useState(CLERK_MEETINGS);
  const [searchTerm, setSearchTerm] = useState('');
  const [formState, setFormState] = useState({
    title: '',
    audience: 'Class Teachers',
    date: new Date().toISOString().slice(0, 10),
    time: '10:00 AM',
    mode: 'Office Room',
  });

  const filteredMeetings = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return meetings.filter((meeting) =>
      [meeting.title, meeting.audience, meeting.mode, meeting.owner, meeting.status]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [meetings, searchTerm]);

  const updateField = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateMeeting = (event) => {
    event.preventDefault();

    if (!formState.title.trim()) {
      alert('Please enter a meeting title.');
      return;
    }

    const meeting = {
      id: `MTG-${Date.now().toString().slice(-5)}`,
      title: formState.title.trim(),
      audience: formState.audience,
      date: formState.date,
      time: formState.time,
      mode: formState.mode,
      owner: clerk.name,
      status: 'Scheduled',
    };

    setMeetings((prev) => [meeting, ...prev]);
    setFormState({
      title: '',
      audience: 'Class Teachers',
      date: new Date().toISOString().slice(0, 10),
      time: '10:00 AM',
      mode: 'Office Room',
    });
  };

  const markDone = (meetingId) => {
    setMeetings((prev) =>
      prev.map((meeting) =>
        meeting.id === meetingId ? { ...meeting, status: 'Done' } : meeting
      )
    );
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Video className="w-5 h-5" /> Meetings Desk
          </h2>
          <p className="text-xs font-bold text-[#555555] mt-1">
            Schedule office meetings for accounts, records, admissions, parents, and class teachers.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2 text-xs font-bold">
          <Search className="w-4 h-4 text-[#555555]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search meetings..."
            className="bg-transparent outline-none w-48"
          />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleCreateMeeting}
          className="xl:col-span-4 bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-[#EAEAEA] pb-3">
            <Plus className="w-4 h-4" />
            <h3 className="text-sm font-black">Schedule Meeting</h3>
          </div>

          <Field label="Meeting Title">
            <input
              value={formState.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="Example: Fee desk review"
              className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-3 text-xs font-bold outline-none focus:border-black"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Audience">
              <select
                value={formState.audience}
                onChange={(event) => updateField('audience', event.target.value)}
                className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-3 text-xs font-bold outline-none"
              >
                <option>Class Teachers</option>
                <option>Accounts Team</option>
                <option>Admission Team</option>
                <option>Parents</option>
                <option>Admin Office</option>
              </select>
            </Field>

            <Field label="Mode">
              <select
                value={formState.mode}
                onChange={(event) => updateField('mode', event.target.value)}
                className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-3 text-xs font-bold outline-none"
              >
                <option>Office Room</option>
                <option>Records Counter</option>
                <option>Admin Office</option>
                <option>Video Call</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                value={formState.date}
                onChange={(event) => updateField('date', event.target.value)}
                className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-3 text-xs font-bold outline-none"
              />
            </Field>

            <Field label="Time">
              <input
                value={formState.time}
                onChange={(event) => updateField('time', event.target.value)}
                className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-3 text-xs font-bold outline-none"
              />
            </Field>
          </div>

          <button
            type="submit"
            className="w-full bg-[#E1FA6C] border border-[#1A1A1A]/10 rounded-2xl py-3 text-xs font-black flex items-center justify-center gap-2"
          >
            <CalendarClock className="w-4 h-4" /> Add Meeting
          </button>
        </form>

        <div className="xl:col-span-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredMeetings.length === 0 ? (
            <div className="lg:col-span-2 bg-white border border-[#C8C8C8] rounded-3xl p-12 text-center text-xs font-bold text-[#555555]">
              No meetings match the current search.
            </div>
          ) : (
            filteredMeetings.map((meeting) => (
              <article key={meeting.id} className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase text-[#555555]">{meeting.audience}</p>
                    <h3 className="text-base font-black mt-1 leading-tight">{meeting.title}</h3>
                    <p className="text-xs font-bold text-[#555555] mt-1">Owner: {meeting.owner}</p>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-1 rounded-md border ${statusTone[meeting.status]}`}>
                    {meeting.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <MeetingCell label="Date" value={formatShortDate(meeting.date)} />
                  <MeetingCell label="Time" value={meeting.time} />
                  <MeetingCell label="Mode" value={meeting.mode} />
                </div>

                <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3 flex items-center gap-2 text-xs font-bold text-[#555555]">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>Record minutes after completion for office reference.</span>
                </div>

                {meeting.status !== 'Done' && (
                  <button
                    type="button"
                    onClick={() => markDone(meeting.id)}
                    className="w-full bg-[#1A1A1A] text-[#E1FA6C] rounded-2xl py-2.5 text-xs font-black flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Mark Done
                  </button>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

const Field = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-[10px] font-black uppercase text-[#555555]">{label}</span>
    {children}
  </label>
);

const MeetingCell = ({ label, value }) => (
  <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3 text-xs font-bold min-h-16">
    <p className="text-[10px] font-black uppercase text-[#555555]">{label}</p>
    <p className="mt-1">{value}</p>
  </div>
);

export default Meetings;
