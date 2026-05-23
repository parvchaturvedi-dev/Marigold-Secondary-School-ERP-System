import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  CalendarClock,
  Check,
  GraduationCap,
  Search,
  User,
  X,
} from 'lucide-react';
import {
  LEAVE_REQUEST_UPDATED_EVENT,
  LEAVE_STATUS,
  LEAVE_STATUS_LABELS,
  TERMINAL_LEAVE_STATUSES,
  adminActionLeaveRequest,
  fetchLeaveRequests,
  formatLeaveDate,
  getLeaveDurationLabel,
  getLeaveRequestsForSession,
} from '../../components/common/leaveRequestStore';

const statusTone = {
  [LEAVE_STATUS.pendingAdmin]: 'bg-amber-50 text-amber-700 border-amber-200',
  [LEAVE_STATUS.pendingClassTeacher]: 'bg-blue-50 text-blue-700 border-blue-200',
  [LEAVE_STATUS.forwardedAdmin]: 'bg-purple-50 text-purple-700 border-purple-200',
  [LEAVE_STATUS.approvedByAdmin]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  [LEAVE_STATUS.rejectedByAdmin]: 'bg-red-50 text-red-700 border-red-200',
  [LEAVE_STATUS.approvedByTeacher]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  [LEAVE_STATUS.rejectedByTeacher]: 'bg-red-50 text-red-700 border-red-200',
};

const roleTone = {
  student: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  teacher: 'bg-pink-50 text-pink-700 border-pink-200',
  clerk: 'bg-teal-50 text-teal-700 border-teal-200',
};

const roleIcons = {
  student: GraduationCap,
  teacher: User,
  clerk: Briefcase,
};

const roleLabels = {
  student: 'Student',
  teacher: 'Teacher',
  clerk: 'Clerk',
};

const tabs = ['All', 'Teacher', 'Clerk', 'Student'];

const LeaveRequests = ({ session }) => {
  const [, setRequestVersion] = useState(0);
  const [activeTab, setActiveTab] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const leaveRequests = getLeaveRequestsForSession(session);

  useEffect(() => {
    const refreshRequests = () => setRequestVersion((version) => version + 1);
    window.addEventListener(LEAVE_REQUEST_UPDATED_EVENT, refreshRequests);

    return () => {
      window.removeEventListener(LEAVE_REQUEST_UPDATED_EVENT, refreshRequests);
    };
  }, []);

  useEffect(() => {
    fetchLeaveRequests({ ...session, role: 'admin' }, null).then(() =>
      setRequestVersion((version) => version + 1)
    );
  }, [session]);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return leaveRequests.filter((request) => {
      const requestRole = roleLabels[request.applicantRole] || request.applicantRole;
      const matchesTab = activeTab === 'All' || requestRole === activeTab;
      const searchBlob = [
        request.id,
        request.title,
        request.description,
        request.applicantName,
        request.className,
        request.metaInfo,
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !normalizedSearch || searchBlob.includes(normalizedSearch);

      return matchesTab && matchesSearch;
    });
  }, [activeTab, leaveRequests, searchTerm]);

  const handleAdminAction = async (requestId, action) => {
    await adminActionLeaveRequest({
      requestId,
      action,
      adminUsername: session?.username || 'ADM',
    });
    await fetchLeaveRequests({ ...session, role: 'admin' }, null);
  };

  const getPipelineNote = (request) => {
    if (request.status === LEAVE_STATUS.pendingClassTeacher) {
      return (
        <span className="text-blue-600 flex items-center gap-1">
          With Class Teacher. Admin override available. <ArrowRight className="w-3 h-3" />
        </span>
      );
    }

    if (request.status === LEAVE_STATUS.forwardedAdmin) {
      return <span className="text-purple-600 font-black">Forwarded by Class Teacher.</span>;
    }

    if (request.status === LEAVE_STATUS.pendingAdmin) {
      return <span className="text-amber-600 font-black">Direct Admin Route Review</span>;
    }

    if (request.status === LEAVE_STATUS.approvedByAdmin) {
      return <span className="text-emerald-600 font-black">Approved by Admin</span>;
    }

    if (request.status === LEAVE_STATUS.rejectedByAdmin) {
      return <span className="text-red-600 font-black">Rejected by Admin</span>;
    }

    if (request.status === LEAVE_STATUS.approvedByTeacher) {
      return <span className="text-emerald-600 font-black">Closed by Class Teacher</span>;
    }

    if (request.status === LEAVE_STATUS.rejectedByTeacher) {
      return <span className="text-red-600 font-black">Rejected by Class Teacher</span>;
    }

    return null;
  };

  return (
    <div className="flex-1 min-h-screen bg-[#D9D9D9] p-6 font-sans select-none text-[#1A1A1A]">
      <div className="bg-white p-6 rounded-3xl border border-[#C8C8C8] mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-[#1A1A1A]" /> Leave Approval Desk
          </h3>
          <p className="text-xs text-[#555555] mt-1">
            Review staff requests, student class-teacher routing, and forwarded admin approvals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-[#EAEAEA] px-3.5 py-2 rounded-xl border border-[#C8C8C8]/60 text-xs">
            <Search className="w-4 h-4 text-[#555555]" />
            <input
              type="text"
              placeholder="Search applicant, title, or ID..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="bg-transparent border-none outline-none w-44 md:w-56 font-bold text-[#1A1A1A]"
            />
          </div>

          <div className="bg-[#EAEAEA] p-1 rounded-xl border border-[#C8C8C8]/60 flex gap-0.5 text-[11px] font-black">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === tab ? 'bg-white text-black shadow-xs' : 'text-[#555555] hover:text-black'
                }`}
              >
                {tab === 'All' ? 'All' : `${tab}s`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center text-xs text-[#555555] font-semibold border border-[#C8C8C8]">
          No leave requests match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {filteredRequests.map((request) => {
            const RoleIcon = roleIcons[request.applicantRole] || User;
            const isClosed = TERMINAL_LEAVE_STATUSES.includes(request.status);

            return (
              <div
                key={request.id}
                className={`bg-white border rounded-3xl p-5 flex flex-col justify-between min-h-[250px] transition-all relative ${
                  request.status.includes('approved')
                    ? 'border-emerald-500/30'
                    : request.status.includes('rejected')
                      ? 'border-red-500/30'
                      : 'border-[#C8C8C8] hover:border-black'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[9px] bg-[#EAEAEA] border border-[#C8C8C8]/60 text-[#1A1A1A] px-2 py-0.5 rounded font-black uppercase">
                        {request.id}
                      </span>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-tight flex items-center gap-1 border ${
                          roleTone[request.applicantRole] || roleTone.student
                        }`}
                      >
                        <RoleIcon className="w-3 h-3" />
                        {roleLabels[request.applicantRole] || request.applicantRole}
                      </span>
                    </div>

                    <span className={`text-[9px] font-black px-2.5 py-0.5 rounded border uppercase tracking-wide ${statusTone[request.status]}`}>
                      {LEAVE_STATUS_LABELS[request.status]}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-[#1A1A1A] leading-tight">{request.title}</h4>
                    <p className="text-[11px] text-[#555555] font-bold mt-1">
                      {request.applicantName} - {request.metaInfo || request.className}
                    </p>
                    {request.applicantRole === 'student' && (
                      <p className="text-[10px] text-[#777777] font-bold mt-1">
                        Class Teacher: {request.classTeacherName || 'Assigned Teacher'}
                      </p>
                    )}
                  </div>

                  <hr className="border-[#EAEAEA]" />

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-[#1A1A1A] bg-[#EAEAEA]/30 p-2.5 rounded-xl border border-[#EAEAEA]/60 leading-relaxed">
                      {request.description}
                    </p>
                    <p className="text-[10px] text-[#555555] font-bold font-mono flex flex-wrap items-center gap-1">
                      <span>Leave Dates:</span>
                      <span className="text-[#1A1A1A] font-black">{getLeaveDurationLabel(request)}</span>
                    </p>
                    <p className="text-[10px] text-[#777777] font-bold">
                      Submitted: {formatLeaveDate(request.createdAt?.slice(0, 10))}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-[#EAEAEA] flex items-center justify-between gap-4 flex-wrap">
                  <div className="text-[10px] text-[#555555] font-bold max-w-[62%]">
                    {getPipelineNote(request)}
                  </div>

                  {!isClosed ? (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        type="button"
                        onClick={() => handleAdminAction(request.id, 'reject')}
                        className="p-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-xl transition-all"
                        title="Reject"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdminAction(request.id, 'approve')}
                        className="bg-[#E1FA6C] text-[#1A1A1A] border border-[#1A1A1A]/10 px-3 py-1.5 rounded-xl font-black text-[10px] flex items-center gap-1 hover:bg-[#d4ee59] transition-all shadow-xs uppercase tracking-tight"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Approve
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono font-bold text-[#555555]/50 uppercase select-none">
                      Closed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LeaveRequests;
