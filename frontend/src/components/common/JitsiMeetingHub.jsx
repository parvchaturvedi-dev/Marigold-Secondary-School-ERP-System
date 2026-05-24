import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  DoorOpen,
  MonitorUp,
  School,
  Search,
  Users,
  Video,
  XCircle,
} from 'lucide-react';
import {
  canHostClassMeeting,
  createJitsiRoomName,
  getMeetingAudienceLabel,
  getMeetingClassesForRole,
  getMeetingIdentity,
  getStudentMeetingStatus,
  getStudentsForMeeting,
  isMeetingForClass,
  isMeetingForStudent,
  useMeetingsDatabase,
  useMeetingDirectory,
} from './meetingStore';
import { getActiveStudent } from './auth';

const todayInput = () => new Date().toISOString().slice(0, 10);
const timeInput = () => new Date().toTimeString().slice(0, 5);

const formatMeetingDateTime = (meeting = {}) => {
  if (!meeting.date && !meeting.time) return 'Live now';

  const date = meeting.date
    ? new Date(`${meeting.date}T${meeting.time || '00:00'}`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Today';

  return `${date} at ${meeting.time || 'Now'}`;
};

const buildMeeting = ({ form, session, selectedClass }) => {
  const identity = getMeetingIdentity(session);
  const scopeType = session.role === 'teacher' ? 'class' : form.scopeType;
  const targetClasses =
    scopeType === 'class'
      ? form.targetClasses.length
        ? form.targetClasses
        : [selectedClass].filter(Boolean)
      : [];

  return {
    id: `jitsi-${Date.now()}`,
    title: form.title.trim(),
    description: form.description.trim(),
    scopeType,
    targetClasses,
    date: form.date || todayInput(),
    time: form.time || timeInput(),
    status: 'ongoing',
    hostRole: identity.role,
    hostUsername: identity.username,
    hostName: identity.displayName,
    roomName: createJitsiRoomName({
      title: form.title,
      className: targetClasses[0] || scopeType,
      hostUsername: identity.username,
    }),
    attendance: {},
    createdAt: new Date().toISOString(),
  };
};

const getMeetingCounts = (meeting, students, classNames) => {
  const roster = getStudentsForMeeting(meeting, students, classNames);
  const present = roster.filter((student) => getStudentMeetingStatus(meeting, student) === 'present').length;
  const rejected = roster.filter((student) => getStudentMeetingStatus(meeting, student) === 'rejected').length;

  return {
    total: roster.length,
    present,
    rejected,
    absent: Math.max(roster.length - present - rejected, 0),
  };
};

const JitsiMeetingHub = ({ session, role = session?.role }) => {
  const directory = useMeetingDirectory();
  const {
    meetings,
    isLoading: meetingsLoading,
    error: meetingError,
    createMeeting,
    updateAttendance,
    endMeeting: endMeetingInDatabase,
  } = useMeetingsDatabase(session);
  const availableClasses = getMeetingClassesForRole(session, directory.classNames);
  const firstClass = availableClasses[0] || directory.classNames[0] || 'Class 9';
  const [selectedClass, setSelectedClass] = useState(firstClass);
  const [activeMeetingId, setActiveMeetingId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const activeStudent = getActiveStudent(session) || session?.activeStudent || session?.studentProfiles?.[0] || null;
  const isStudent = role === 'student';
  const canManage = role === 'admin' || role === 'clerk' || role === 'teacher';
  const [form, setForm] = useState({
    title: '',
    description: '',
    scopeType: role === 'teacher' ? 'class' : 'class',
    targetClasses: firstClass ? [firstClass] : [],
    date: todayInput(),
    time: timeInput(),
  });

  const ongoingMeetings = useMemo(
    () => meetings.filter((meeting) => meeting.status !== 'ended'),
    [meetings]
  );

  const selectedClassMeetings = useMemo(
    () => ongoingMeetings.filter((meeting) => isMeetingForClass(meeting, selectedClass)),
    [ongoingMeetings, selectedClass]
  );

  const visibleMeetings = useMemo(() => {
    if (isStudent && activeStudent) {
      return ongoingMeetings.filter((meeting) => isMeetingForStudent(meeting, activeStudent));
    }

    if (role === 'teacher') {
      return ongoingMeetings.filter(
        (meeting) =>
          meeting.hostUsername === session?.username ||
          meeting.targetClasses?.some((className) => availableClasses.includes(className)) ||
          meeting.scopeType === 'staff'
      );
    }

    return ongoingMeetings;
  }, [activeStudent, availableClasses, isStudent, ongoingMeetings, role, session?.username]);

  const filteredMeetings = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return visibleMeetings;

    return visibleMeetings.filter((meeting) =>
      [
        meeting.title,
        meeting.description,
        meeting.hostName,
        getMeetingAudienceLabel(meeting),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [searchTerm, visibleMeetings]);

  const activeMeeting = meetings.find((meeting) => meeting.id === activeMeetingId);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleTargetClass = (className) => {
    setForm((prev) => {
      const exists = prev.targetClasses.includes(className);
      return {
        ...prev,
        targetClasses: exists
          ? prev.targetClasses.filter((item) => item !== className)
          : [...prev.targetClasses, className],
      };
    });
  };

  const startMeeting = async (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      alert('Please enter a meeting title.');
      return;
    }

    const targetClass = form.targetClasses[0] || selectedClass;
    if (form.scopeType === 'class' && !canHostClassMeeting(session, targetClass)) {
      alert('Only assigned teachers can start meetings for their assigned classes.');
      return;
    }

    if (form.scopeType === 'class' && !form.targetClasses.length) {
      alert('Please select at least one class.');
      return;
    }

    const meeting = buildMeeting({ form, session, selectedClass });
    try {
      const savedMeeting = await createMeeting(meeting);
      setActiveMeetingId(savedMeeting.id);
      setSelectedClass(savedMeeting.targetClasses[0] || selectedClass);
      setForm((prev) => ({
        ...prev,
        title: '',
        description: '',
        time: timeInput(),
      }));
    } catch (error) {
      alert(error.message);
    }
  };

  const markStudentResponse = async (meetingId, status) => {
    if (!activeStudent) return;
    const studentId = activeStudent.id || activeStudent.admissionNumber;

    try {
      await updateAttendance(meetingId, {
        status,
        studentId,
        studentName: activeStudent.displayName,
        className: activeStudent.className,
        section: activeStudent.section,
        respondedAt: new Date().toISOString(),
      });

      if (status === 'present') setActiveMeetingId(meetingId);
    } catch (error) {
      alert(error.message);
    }
  };

  const endMeeting = async (meetingId) => {
    try {
      await endMeetingInDatabase(meetingId);
      if (activeMeetingId === meetingId) setActiveMeetingId('');
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Video className="w-5 h-5" /> Jitsi Video Meetings
          </h2>
          <p className="text-xs font-bold text-[#555555] mt-1">
            {isStudent
              ? 'Review meeting notifications, join live classes, or reject invitations.'
              : role === 'teacher'
                ? 'Start live meetings only for your assigned classes.'
                : 'Host class, staff, or whole-school meetings and monitor live attendance.'}
          </p>
          {meetingError && (
            <p className="text-xs font-black text-red-600 mt-2">{meetingError}</p>
          )}
          {meetingsLoading && (
            <p className="text-xs font-black text-[#555555] mt-2">Loading meetings from database...</p>
          )}
        </div>

        {!isStudent && (
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
        )}
      </section>

      {!isStudent && (
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {availableClasses.map((className) => {
            const ongoing = ongoingMeetings.find((meeting) => isMeetingForClass(meeting, className));
            const isActive = selectedClass === className;

            return (
              <button
                type="button"
                key={className}
                onClick={() => {
                  setSelectedClass(className);
                  updateForm('targetClasses', [className]);
                }}
                className={`text-left bg-white border rounded-2xl p-4 min-h-28 transition ${
                  isActive ? 'border-[#1A1A1A] shadow-sm' : 'border-[#C8C8C8]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <School className="w-5 h-5" />
                  <span
                    className={`text-[9px] font-black px-2 py-1 rounded-md border ${
                      ongoing
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-[#F8F8F8] text-[#555555] border-[#EAEAEA]'
                    }`}
                  >
                    {ongoing ? 'LIVE' : 'READY'}
                  </span>
                </div>
                <h3 className="text-sm font-black mt-4">{className}</h3>
                <p className="text-[11px] font-bold text-[#555555] mt-1">
                  {ongoing ? ongoing.title : role === 'teacher' ? 'Assigned class' : 'Click to inspect or host'}
                </p>
              </button>
            );
          })}
        </section>
      )}

      {isStudent ? (
        <StudentMeetingDesk
          activeMeeting={activeMeeting}
          activeStudent={activeStudent}
          meetings={filteredMeetings}
          onJoin={(meetingId) => markStudentResponse(meetingId, 'present')}
          onReject={(meetingId) => markStudentResponse(meetingId, 'rejected')}
          onLeave={() => setActiveMeetingId('')}
        />
      ) : (
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-4 space-y-4">
            <MeetingCreator
              availableClasses={availableClasses}
              canManage={canManage}
              form={form}
              role={role}
              selectedClass={selectedClass}
              onSubmit={startMeeting}
              onToggleClass={toggleTargetClass}
              onUpdate={updateForm}
            />

            <ClassMeetingPanel
              meetings={selectedClassMeetings}
              selectedClass={selectedClass}
              onEnter={setActiveMeetingId}
              onEnd={endMeeting}
            />
          </div>

          <div className="xl:col-span-8 space-y-4">
            {activeMeeting ? (
              <JitsiFrame meeting={activeMeeting} session={session} onLeave={() => setActiveMeetingId('')} />
            ) : (
              <div className="bg-white border border-[#C8C8C8] rounded-3xl p-8 text-center">
                <MonitorUp className="w-8 h-8 mx-auto" />
                <h3 className="text-base font-black mt-3">No meeting opened</h3>
                <p className="text-xs font-bold text-[#555555] mt-1">
                  Enter an ongoing meeting or start a new one to open the Jitsi room here.
                </p>
              </div>
            )}

            <MeetingList
              classNames={directory.classNames}
              meetings={filteredMeetings}
              role={role}
              students={directory.students}
              onEnter={setActiveMeetingId}
              onEnd={endMeeting}
            />
          </div>
        </section>
      )}
    </div>
  );
};

const MeetingCreator = ({
  availableClasses,
  form,
  role,
  selectedClass,
  onSubmit,
  onToggleClass,
  onUpdate,
}) => (
  <form onSubmit={onSubmit} className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
    <div className="flex items-center gap-2 border-b border-[#EAEAEA] pb-3">
      <CalendarClock className="w-4 h-4" />
      <h3 className="text-sm font-black">{role === 'teacher' ? `Host ${selectedClass}` : 'Create Meeting'}</h3>
    </div>

    <Field label="Title">
      <input
        value={form.title}
        onChange={(event) => onUpdate('title', event.target.value)}
        placeholder="Example: Class revision meeting"
        className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-3 text-xs font-bold outline-none focus:border-black"
      />
    </Field>

    <Field label="Description">
      <textarea
        value={form.description}
        onChange={(event) => onUpdate('description', event.target.value)}
        placeholder="Agenda students will see before joining"
        rows={3}
        className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-3 text-xs font-bold outline-none resize-none focus:border-black"
      />
    </Field>

    {role !== 'teacher' && (
      <Field label="Audience">
        <select
          value={form.scopeType}
          onChange={(event) => onUpdate('scopeType', event.target.value)}
          className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-3 text-xs font-bold outline-none"
        >
          <option value="class">Selected Classes</option>
          <option value="staff">Staff Meeting</option>
          <option value="school">Entire School</option>
        </select>
      </Field>
    )}

    {(role === 'teacher' || form.scopeType === 'class') && (
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase text-[#555555]">Class Invites</p>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-auto pr-1">
          {availableClasses.map((className) => (
            <label
              key={className}
              className="flex items-center gap-2 bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2 text-xs font-bold"
            >
              <input
                type="checkbox"
                checked={form.targetClasses.includes(className)}
                disabled={role === 'teacher' && className !== selectedClass}
                onChange={() => onToggleClass(className)}
              />
              <span>{className}</span>
            </label>
          ))}
        </div>
      </div>
    )}

    <div className="grid grid-cols-2 gap-3">
      <Field label="Date">
        <input
          type="date"
          value={form.date}
          onChange={(event) => onUpdate('date', event.target.value)}
          className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-3 text-xs font-bold outline-none"
        />
      </Field>
      <Field label="Time">
        <input
          type="time"
          value={form.time}
          onChange={(event) => onUpdate('time', event.target.value)}
          className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-3 text-xs font-bold outline-none"
        />
      </Field>
    </div>

    <button
      type="submit"
      className="w-full bg-[#E1FA6C] border border-[#1A1A1A]/10 rounded-2xl py-3 text-xs font-black flex items-center justify-center gap-2"
    >
      <Video className="w-4 h-4" /> Start Jitsi Meeting
    </button>
  </form>
);

const ClassMeetingPanel = ({ meetings, selectedClass, onEnter, onEnd }) => (
  <div className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-3">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-black">{selectedClass} Live Room</h3>
      <span className="text-[10px] font-black text-[#555555]">{meetings.length} ongoing</span>
    </div>

    {meetings.length ? (
      meetings.map((meeting) => (
        <MeetingSummaryCard
          key={meeting.id}
          meeting={meeting}
          onEnter={() => onEnter(meeting.id)}
          onEnd={() => onEnd(meeting.id)}
        />
      ))
    ) : (
      <p className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-4 text-xs font-bold text-[#555555]">
        No ongoing class meeting. Start one from the form above.
      </p>
    )}
  </div>
);

const MeetingList = ({ classNames, meetings, role, students, onEnter, onEnd }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    {meetings.length === 0 ? (
      <div className="lg:col-span-2 bg-white border border-[#C8C8C8] rounded-3xl p-8 text-center text-xs font-bold text-[#555555]">
        No ongoing meetings found.
      </div>
    ) : (
      meetings.map((meeting) => {
        const counts = getMeetingCounts(meeting, students, classNames);
        return (
          <article key={meeting.id} className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
            <MeetingHeader meeting={meeting} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Metric label="Present" value={counts.present} tone="text-emerald-700" />
              <Metric label="Absent" value={counts.absent} tone="text-amber-700" />
              <Metric label="Rejected" value={counts.rejected} tone="text-red-700" />
              <Metric label="Total" value={counts.total || (meeting.scopeType === 'staff' ? 'Staff' : 0)} />
            </div>
            <AttendanceTable meeting={meeting} students={students} classNames={classNames} />
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => onEnter(meeting.id)}
                className="flex-1 bg-[#1A1A1A] text-[#E1FA6C] rounded-2xl py-2.5 text-xs font-black flex items-center justify-center gap-2"
              >
                <DoorOpen className="w-4 h-4" /> Enter Meeting
              </button>
              {(role === 'admin' || role === 'clerk' || meeting.hostRole === role) && (
                <button
                  type="button"
                  onClick={() => onEnd(meeting.id)}
                  className="flex-1 bg-red-50 text-red-700 border border-red-100 rounded-2xl py-2.5 text-xs font-black flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" /> End
                </button>
              )}
            </div>
          </article>
        );
      })
    )}
  </div>
);

const StudentMeetingDesk = ({ activeMeeting, activeStudent, meetings, onJoin, onReject, onLeave }) => (
  <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
    <div className="xl:col-span-5 space-y-4">
      {meetings.length === 0 ? (
        <div className="bg-white border border-[#C8C8C8] rounded-3xl p-8 text-center text-xs font-bold text-[#555555]">
          No meeting notifications for {activeStudent?.displayName || 'this student'}.
        </div>
      ) : (
        meetings.map((meeting) => {
          const status = getStudentMeetingStatus(meeting, activeStudent);
          return (
            <article key={meeting.id} className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
              <MeetingHeader meeting={meeting} />
              <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase text-[#555555]">Notification</p>
                <h3 className="text-sm font-black mt-1">{meeting.title}</h3>
                <p className="text-xs font-bold text-[#555555] mt-2">
                  {meeting.description || 'Please review the meeting details before joining.'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                <Metric label="Class" value={activeStudent?.className || '-'} />
                <Metric label="Status" value={status} />
                <Metric label="Host" value={meeting.hostRole} />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => onJoin(meeting.id)}
                  className="flex-1 bg-[#E1FA6C] border border-[#1A1A1A]/10 rounded-2xl py-2.5 text-xs font-black flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Join
                </button>
                <button
                  type="button"
                  onClick={() => onReject(meeting.id)}
                  disabled={status === 'present'}
                  className="flex-1 bg-red-50 text-red-700 border border-red-100 rounded-2xl py-2.5 text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </div>
            </article>
          );
        })
      )}
    </div>

    <div className="xl:col-span-7">
      {activeMeeting ? (
        <JitsiFrame meeting={activeMeeting} session={{ ...activeStudent, displayName: activeStudent?.displayName }} onLeave={onLeave} />
      ) : (
        <div className="bg-white border border-[#C8C8C8] rounded-3xl p-8 text-center">
          <Video className="w-8 h-8 mx-auto" />
          <h3 className="text-base font-black mt-3">Waiting for a meeting</h3>
          <p className="text-xs font-bold text-[#555555] mt-1">
            Join a notification to open the live Jitsi classroom here.
          </p>
        </div>
      )}
    </div>
  </section>
);

const JitsiFrame = ({ meeting, session, onLeave }) => {
  const displayName = encodeURIComponent(session?.displayName || session?.name || 'MGPS User');
  const roomUrl = `https://meet.jit.si/${encodeURIComponent(meeting.roomName)}#userInfo.displayName="${displayName}"`;

  return (
    <div className="bg-white border border-[#C8C8C8] rounded-3xl p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <MeetingHeader meeting={meeting} compact />
        <button
          type="button"
          onClick={onLeave}
          className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-4 py-2 text-xs font-black"
        >
          Leave View
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-black aspect-video">
        <iframe
          title={meeting.title}
          src={roomUrl}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="w-full h-full"
        />
      </div>
    </div>
  );
};

const MeetingSummaryCard = ({ meeting, onEnter, onEnd }) => (
  <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-4 space-y-3">
    <MeetingHeader meeting={meeting} compact />
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onEnter}
        className="flex-1 bg-[#1A1A1A] text-[#E1FA6C] rounded-2xl py-2 text-xs font-black"
      >
        Enter
      </button>
      <button
        type="button"
        onClick={onEnd}
        className="flex-1 bg-white border border-red-100 text-red-700 rounded-2xl py-2 text-xs font-black"
      >
        End
      </button>
    </div>
  </div>
);

const MeetingHeader = ({ meeting, compact = false }) => (
  <div className="flex items-start justify-between gap-3">
    <div>
      <p className="text-[10px] font-black uppercase text-[#555555]">{getMeetingAudienceLabel(meeting)}</p>
      <h3 className={`${compact ? 'text-sm' : 'text-base'} font-black mt-1 leading-tight`}>{meeting.title}</h3>
      <p className="text-xs font-bold text-[#555555] mt-1">
        Hosted by {meeting.hostName} | {formatMeetingDateTime(meeting)}
      </p>
    </div>
    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black px-2 py-1 rounded-md">
      LIVE
    </span>
  </div>
);

const AttendanceTable = ({ meeting, students, classNames }) => {
  const roster = getStudentsForMeeting(meeting, students, classNames);

  if (!roster.length) {
    return (
      <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3 flex items-center gap-2 text-xs font-bold text-[#555555]">
        <Users className="w-4 h-4" />
        <span>{meeting.scopeType === 'staff' ? 'Staff attendance is tracked in the live room.' : 'No student roster found.'}</span>
      </div>
    );
  }

  return (
    <div className="max-h-52 overflow-auto border border-[#EAEAEA] rounded-2xl">
      <table className="w-full text-xs">
        <thead className="bg-[#F8F8F8] text-[#555555] sticky top-0">
          <tr>
            <th className="text-left px-3 py-2 font-black">Class</th>
            <th className="text-left px-3 py-2 font-black">Student</th>
            <th className="text-left px-3 py-2 font-black">Status</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((student) => {
            const status = getStudentMeetingStatus(meeting, student);
            return (
              <tr key={student.id} className="border-t border-[#EAEAEA]">
                <td className="px-3 py-2 font-bold">{student.className}-{student.section || 'A'}</td>
                <td className="px-3 py-2 font-bold">{student.displayName}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-black uppercase ${statusTone(status)}`}>{status}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const statusTone = (status) => {
  if (status === 'present') return 'text-emerald-700';
  if (status === 'rejected') return 'text-red-700';
  return 'text-amber-700';
};

const Metric = ({ label, value, tone = 'text-[#1A1A1A]' }) => (
  <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3 min-h-16">
    <p className="text-[10px] font-black uppercase text-[#555555]">{label}</p>
    <p className={`mt-1 text-xs font-black capitalize ${tone}`}>{value}</p>
  </div>
);

const Field = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-[10px] font-black uppercase text-[#555555]">{label}</span>
    {children}
  </label>
);

export default JitsiMeetingHub;
