import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  CalendarClock,
  Check,
  ClipboardList,
  GraduationCap,
  Send,
  User,
  UserRound,
  X,
} from 'lucide-react';
import {
  LEAVE_REQUEST_UPDATED_EVENT,
  LEAVE_STATUS,
  LEAVE_STATUS_LABELS,
  TERMINAL_LEAVE_STATUSES,
  createLeaveRequest,
  fetchLeaveRequests,
  formatLeaveDate,
  getLeaveDemoIdentity,
  getLeaveDurationLabel,
  getLeaveRequestsForSession,
  teacherActionLeaveRequest,
} from './leaveRequestStore';
import { useMasterData } from './masterData';

const statusTone = {
  [LEAVE_STATUS.pendingAdmin]: 'bg-amber-50 text-amber-700 border-amber-100',
  [LEAVE_STATUS.pendingClassTeacher]: 'bg-blue-50 text-blue-700 border-blue-100',
  [LEAVE_STATUS.forwardedAdmin]: 'bg-purple-50 text-purple-700 border-purple-100',
  [LEAVE_STATUS.approvedByAdmin]: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  [LEAVE_STATUS.rejectedByAdmin]: 'bg-rose-50 text-rose-700 border-rose-100',
  [LEAVE_STATUS.approvedByTeacher]: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  [LEAVE_STATUS.rejectedByTeacher]: 'bg-rose-50 text-rose-700 border-rose-100',
};

const roleMeta = {
  student: {
    label: 'Student',
    icon: GraduationCap,
    tone: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  },
  teacher: {
    label: 'Teacher',
    icon: User,
    tone: 'bg-pink-50 text-pink-700 border-pink-100',
  },
  clerk: {
    label: 'Clerk',
    icon: Briefcase,
    tone: 'bg-teal-50 text-teal-700 border-teal-100',
  },
};

const initialFormState = {
  title: '',
  description: '',
  leaveMode: 'single',
  startDate: '',
  endDate: '',
};

const LeaveCard = ({ request, actions }) => {
  const RoleIcon = roleMeta[request.applicantRole]?.icon || UserRound;
  const isClosed = TERMINAL_LEAVE_STATUSES.includes(request.status);

  return (
    <div className="glass-card rounded-3xl p-4 space-y-4">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] px-2 py-0.5 rounded-md bg-white/60 border border-white/80 text-slate-500 font-black uppercase">
              {request.id}
            </span>
            <span
              className={`text-[9px] px-2 py-0.5 rounded-md border font-black uppercase flex items-center gap-1 ${
                roleMeta[request.applicantRole]?.tone || roleMeta.student.tone
              }`}
            >
              <RoleIcon className="w-3 h-3" />
              {roleMeta[request.applicantRole]?.label || request.applicantRole}
            </span>
            <span className={`text-[9px] px-2 py-0.5 rounded-md border font-black uppercase ${statusTone[request.status]}`}>
              {LEAVE_STATUS_LABELS[request.status]}
            </span>
          </div>

          <div>
            <h4 className="text-sm font-black text-slate-900 leading-tight">{request.title}</h4>
            <p className="text-[11px] text-gray-500 mt-1 font-bold">
              {request.applicantName} - {request.metaInfo || request.className}
            </p>
          </div>
        </div>

        <span className="text-[10px] font-bold text-gray-400 shrink-0">
          {formatLeaveDate(request.createdAt?.slice(0, 10))}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-slate-700 glass-soft rounded-2xl p-3">
        {request.description}
      </p>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-gray-100 pt-3">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase text-gray-400">Leave Dates</p>
          <p className="text-xs font-black text-slate-900 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-gray-500" />
            {getLeaveDurationLabel(request)}
          </p>
          {request.applicantRole === 'student' && (
            <p className="text-[11px] font-bold text-gray-500">
              Class Teacher: {request.classTeacherName || 'Assigned Teacher'}
            </p>
          )}
        </div>

        {actions && !isClosed && <div className="flex flex-wrap gap-2 justify-end">{actions}</div>}
        {isClosed && (
          <span className="text-[10px] font-black uppercase text-gray-400">Closed</span>
        )}
      </div>
    </div>
  );
};

const LeaveRequestUserHub = ({ session, role }) => {
  const masterData = useMasterData();
  const identityConfig = useMemo(() => getLeaveDemoIdentity(session), [session]);
  const [selectedIdentityId, setSelectedIdentityId] = useState(identityConfig.members[0]?.id || '');
  const selectedIdentity =
    identityConfig.members.find((member) => member.id === selectedIdentityId) ||
    identityConfig.members[0];
  const [, setRequestVersion] = useState(0);
  const [formState, setFormState] = useState(initialFormState);
  const requests = getLeaveRequestsForSession(session, selectedIdentity);
  const classTeacher = useMemo(() => {
    const className = selectedIdentity?.className || '';
    if (!className) return { username: '', name: '' };

    const classRecord = masterData.classes.find((item) => item.name === className) || {};
    const teacher =
      masterData.teachers.find(
        (item) =>
          item.id === classRecord.classTeacherId ||
          item.empId === classRecord.classTeacherId ||
          item.name === classRecord.classTeacherName ||
          item.assignedClassTeacherFor === className
      ) || {};

    return {
      username: teacher.id || teacher.empId || classRecord.classTeacherId || '',
      name: teacher.name || classRecord.classTeacherName || '',
    };
  }, [masterData.classes, masterData.teachers, selectedIdentity?.className]);

  useEffect(() => {
    let isActive = true;
    const refreshRequests = () => {
      fetchLeaveRequests(session, selectedIdentity).then(() => {
        if (isActive) setRequestVersion((version) => version + 1);
      });
    };
    window.addEventListener(LEAVE_REQUEST_UPDATED_EVENT, refreshRequests);

    return () => {
      isActive = false;
      window.removeEventListener(LEAVE_REQUEST_UPDATED_EVENT, refreshRequests);
    };
  }, [session, selectedIdentity]);

  useEffect(() => {
    fetchLeaveRequests(session, selectedIdentity).then(() =>
      setRequestVersion((version) => version + 1)
    );
  }, [session, selectedIdentity]);

  const updateField = (field, value) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'leaveMode' && value === 'single' ? { endDate: '' } : {}),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formState.title.trim() || !formState.description.trim()) {
      alert('Please add title and description.');
      return;
    }

    if (!formState.startDate || (formState.leaveMode === 'multiple' && !formState.endDate)) {
      alert('Please select leave date.');
      return;
    }

    if (formState.leaveMode === 'multiple' && formState.endDate < formState.startDate) {
      alert('To date should be after from date.');
      return;
    }

    await createLeaveRequest({
      title: formState.title.trim(),
      description: formState.description.trim(),
      applicantRole: role,
      applicantName: selectedIdentity?.name || session?.username,
      applicantUsername: session?.username,
      applicantIdentityId: selectedIdentity?.id || '',
      applicantIdentity: selectedIdentity?.name || '',
      className: selectedIdentity?.className || '',
      classTeacherUsername: classTeacher.username,
      classTeacherName: classTeacher.name,
      metaInfo: selectedIdentity?.metaInfo || selectedIdentity?.className || '',
      leaveMode: formState.leaveMode,
      startDate: formState.startDate,
      endDate: formState.leaveMode === 'single' ? formState.startDate : formState.endDate,
    });

    setFormState(initialFormState);
    await fetchLeaveRequests(session, selectedIdentity);
  };

  const handleTeacherAction = async (requestId, action) => {
    await teacherActionLeaveRequest({
      requestId,
      action,
      teacherUsername: session?.username,
    });
    await fetchLeaveRequests(session, selectedIdentity);
  };

  const ownRequests = requests.filter(
    (request) =>
      request.applicantUsername === session?.username &&
      request.applicantRole === role &&
      (!selectedIdentity?.id ||
        !request.applicantIdentityId ||
        request.applicantIdentityId === selectedIdentity.id ||
        request.applicantIdentity === selectedIdentity.name)
  );
  const teacherReviewRequests = requests.filter(
    (request) =>
      role === 'teacher' &&
      request.applicantRole === 'student' &&
      request.applicantUsername !== session?.username
  );

  return (
    <div className="space-y-6 pb-8 select-none font-sans">
      <div className="glass-card p-5 rounded-3xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-[#8b5cf6]" /> Leave Request Desk
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {role === 'student'
                ? 'Student leave goes to Class Teacher first and remains visible to Admin.'
                : 'Staff leave goes directly to Admin.'}
            </p>
          </div>

          <div className="px-3 py-2 rounded-full bg-white/60 border border-white/80 text-[11px] font-bold text-slate-500">
            {`${ownRequests.length} submitted`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <form
          onSubmit={handleSubmit}
          className="xl:col-span-2 glass-card p-5 rounded-3xl space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Send className="w-4 h-4 text-[#8b5cf6]" />
            <h4 className="text-sm font-black text-slate-900">New Leave Request</h4>
          </div>

          {identityConfig.isSiblingAccount && (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400">Who is sending?</label>
              <select
                value={selectedIdentityId}
                onChange={(event) => setSelectedIdentityId(event.target.value)}
                className="w-full bg-white/60 border border-white/80 rounded-2xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
              >
                {identityConfig.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} - {member.className}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!identityConfig.isSiblingAccount && (
            <div className="bg-white/60 border border-white/80 rounded-2xl px-3 py-2.5 text-xs font-bold flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-slate-900 min-w-0">
                <UserRound className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="truncate">{selectedIdentity?.name}</span>
              </span>
              <span className="text-gray-400 shrink-0">{selectedIdentity?.metaInfo || selectedIdentity?.className}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-400">Title</label>
            <input
              value={formState.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="Example: Medical leave request"
              className="w-full bg-white/60 border border-white/80 rounded-2xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-400">Description</label>
            <textarea
              value={formState.description}
              onChange={(event) => updateField('description', event.target.value)}
              rows={6}
              placeholder="Write the leave reason..."
              className="w-full bg-white/60 border border-white/80 rounded-2xl px-3 py-3 text-xs font-medium outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all resize-none leading-relaxed"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400">Leave Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateField('leaveMode', 'single')}
                className={`py-2.5 rounded-xl text-xs font-black border ${
                  formState.leaveMode === 'single'
                    ? 'btn-primary border-transparent'
                    : 'bg-white/60 border-white/80 text-slate-500'
                }`}
              >
                Single Day
              </button>
              <button
                type="button"
                onClick={() => updateField('leaveMode', 'multiple')}
                className={`py-2.5 rounded-xl text-xs font-black border ${
                  formState.leaveMode === 'multiple'
                    ? 'btn-primary border-transparent'
                    : 'bg-white/60 border-white/80 text-slate-500'
                }`}
              >
                Multiple Days
              </button>
            </div>
          </div>

          {formState.leaveMode === 'single' ? (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400">Date</label>
              <input
                type="date"
                value={formState.startDate}
                onChange={(event) => updateField('startDate', event.target.value)}
                className="w-full bg-white/60 border border-white/80 rounded-2xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400">From</label>
                <input
                  type="date"
                  value={formState.startDate}
                  onChange={(event) => updateField('startDate', event.target.value)}
                  className="w-full bg-white/60 border border-white/80 rounded-2xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400">To</label>
                <input
                  type="date"
                  value={formState.endDate}
                  onChange={(event) => updateField('endDate', event.target.value)}
                  className="w-full bg-white/60 border border-white/80 rounded-2xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3 btn-primary rounded-2xl text-xs font-black shadow-sm transition-colors"
          >
            <Send className="w-4 h-4" /> Send Leave Request
          </button>
        </form>

        <div className="xl:col-span-3 space-y-6">
          {role === 'teacher' && (
            <div className="glass-card p-5 rounded-3xl">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[#8b5cf6]" /> Class Teacher Review
                </h4>
                <span className="text-[10px] font-bold text-gray-400">
                  {teacherReviewRequests.length} records
                </span>
              </div>

              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {teacherReviewRequests.length === 0 && (
                  <div className="p-8 text-center text-gray-400">
                    <ClipboardList className="w-10 h-10 mx-auto mb-2 stroke-[1.4]" />
                    <p className="text-xs font-black text-slate-900">No student leave requests</p>
                  </div>
                )}

                {teacherReviewRequests.map((request) => {
                  const canTeacherAct = request.status === LEAVE_STATUS.pendingClassTeacher;

                  return (
                    <LeaveCard
                      key={request.id}
                      request={request}
                      actions={
                        canTeacherAct ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTeacherAction(request.id, 'reject')}
                              className="p-2 bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 rounded-xl transition-colors"
                              title="Reject"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTeacherAction(request.id, 'forward')}
                              className="px-3 py-2 bg-purple-50 text-purple-700 border border-purple-100 hover:bg-purple-100 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-colors"
                            >
                              <ArrowRight className="w-3.5 h-3.5" /> Forward
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTeacherAction(request.id, 'approve')}
                              className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                          </>
                        ) : null
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className="glass-card p-5 rounded-3xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#8b5cf6]" /> Submitted Leave Requests
              </h4>
              <span className="text-[10px] font-bold text-gray-400">
                {`${ownRequests.length} records`}
              </span>
            </div>

            <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
              {ownRequests.length === 0 && (
                <div className="p-8 text-center text-gray-400">
                  <CalendarClock className="w-10 h-10 mx-auto mb-2 stroke-[1.4]" />
                  <p className="text-xs font-black text-slate-900">No leave requests yet</p>
                </div>
              )}

              {ownRequests.map((request) => (
                <LeaveCard key={request.id} request={request} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestUserHub;
