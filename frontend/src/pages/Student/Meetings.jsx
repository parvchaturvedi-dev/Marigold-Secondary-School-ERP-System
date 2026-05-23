import React from 'react';
import { CalendarClock, MapPin, Video } from 'lucide-react';
import { getClassLabel, getMeetings, getPortalStudent } from './studentPortalData';

const Meetings = ({ session }) => {
  const student = getPortalStudent(session);
  const meetings = getMeetings(student);

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6">
        <h2 className="text-xl font-black flex items-center gap-2">
          <Video className="w-5 h-5" /> Meetings
        </h2>
        <p className="text-xs font-bold text-[#555555] mt-1">
          Meeting schedule for {student.displayName} | {getClassLabel(student)}
        </p>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

            <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3 flex items-center gap-2 text-xs font-bold text-[#555555]">
              <MapPin className="w-4 h-4 shrink-0" />
              <span>
                Please carry the student diary and latest assignment notebook for this meeting.
              </span>
            </div>
          </article>
        ))}
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

export default Meetings;
