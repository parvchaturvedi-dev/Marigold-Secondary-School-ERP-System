import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  GraduationCap,
  MessageSquareReply,
  ShieldAlert,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import {
  APPLICATION_UPDATED_EVENT,
  STATUS_LABELS,
  adminActionApplication,
  fetchApplications,
  formatApplicationDate,
  getConsensusMetrics,
} from './applicationStore';

const inboxTabs = [
  { id: 'all', label: 'All', icon: FileText },
  { id: 'student', label: 'Students', icon: User },
  { id: 'teacher', label: 'Teachers', icon: GraduationCap },
  { id: 'clerk', label: 'Clerks', icon: User },
  { id: 'class', label: 'Class Requests', icon: Users },
  { id: 'safety', label: 'Safety', icon: ShieldAlert },
];

const statusTone = {
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  rejected: 'bg-rose-50 text-rose-700 border-rose-100',
  replied: 'bg-blue-50 text-blue-700 border-blue-100',
};

const AdminApplicationInbox = ({ session }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [applications, setApplications] = useState([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const loadApplications = async () => {
    setIsLoading(true);
    const latestApplications = await fetchApplications({ ...session, role: 'admin' }, null);
    setApplications(latestApplications);
    setIsLoading(false);
  };

  useEffect(() => {
    let isActive = true;
    const adminSession = { role: 'admin', username: session?.username };

    fetchApplications(adminSession, null).then((latestApplications) => {
      if (isActive) setApplications(latestApplications);
    });

    return () => {
      isActive = false;
    };
  }, [session?.username]);

  useEffect(() => {
    const refreshApplications = () => {
      const adminSession = { role: 'admin', username: session?.username };
      fetchApplications(adminSession, null).then((latestApplications) => {
        setApplications(latestApplications);
      });
    };

    window.addEventListener(APPLICATION_UPDATED_EVENT, refreshApplications);

    return () => {
      window.removeEventListener(APPLICATION_UPDATED_EVENT, refreshApplications);
    };
  }, [session?.role, session?.username]);

  const filteredApplications = useMemo(() => {
    if (activeTab === 'all') return applications;
    if (activeTab === 'class') {
      return applications.filter((application) => application.audienceMode === 'all-class');
    }
    if (activeTab === 'safety') {
      return applications.filter((application) => application.category === 'Violence / Safety Concern');
    }
    return applications.filter((application) => application.senderRole === activeTab);
  }, [activeTab, applications]);

  const selectedApplication =
    applications.find((application) => application.id === selectedApplicationId) ||
    filteredApplications[0] ||
    null;
  const reply =
    selectedApplication
      ? replyDrafts[selectedApplication.id] ?? selectedApplication.adminReply ?? ''
      : '';

  const runAdminAction = async (action) => {
    if (!selectedApplication) return;
    if (!reply.trim()) {
      alert('Please type an admin reply before sending.');
      return;
    }

    const updatedApplication = await adminActionApplication({
      applicationId: selectedApplication.id,
      action,
      reply: reply.trim(),
      adminUsername: session?.username || 'Admin',
    });

    if (updatedApplication) {
      setApplications((prev) =>
        prev.map((application) =>
          application.id === updatedApplication.id ? updatedApplication : application
        )
      );
      setSelectedApplicationId(updatedApplication.id);
      await loadApplications();
    }
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans">
      <div className="bg-white p-5 rounded-3xl border border-[#EAEAEA] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[#1A1A1A] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#8b5cf6]" /> Admin Application Inbox
            </h3>
            <p className="text-xs text-[#666666] mt-0.5">
              Review problems, safety concerns, infrastructure complaints, and approval requests. Leave requests are not shown here.
            </p>
          </div>

          <div className="flex bg-[#EAEAEA] p-1 rounded-full border border-gray-300 overflow-x-auto max-w-full">
            {inboxTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSelectedApplicationId('');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-[#E1FA6C] text-[#1A1A1A] shadow-sm'
                      : 'text-gray-600 hover:text-[#1A1A1A]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-[#EAEAEA] p-4 rounded-3xl flex flex-col gap-3 shadow-sm h-[680px] overflow-y-auto">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold text-[#1A1A1A] capitalize">{activeTab} Inbox</h4>
            <span className="text-[10px] font-bold text-gray-400">
              {isLoading ? 'Syncing...' : `${filteredApplications.length} items`}
            </span>
          </div>

          {filteredApplications.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-gray-400">
              <FileText className="w-9 h-9 mx-auto mb-2 stroke-[1.4]" />
              <p className="text-xs font-black text-[#1A1A1A]">No applications</p>
            </div>
          )}

          {filteredApplications.map((application) => (
            <button
              type="button"
              key={application.id}
              onClick={() => setSelectedApplicationId(application.id)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all bg-white hover:scale-[1.01] text-left ${
                selectedApplication?.id === application.id
                  ? 'border-[#8b5cf6] ring-2 ring-purple-100'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-gray-50 text-gray-600 border border-gray-200">
                  {application.category}
                </span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${statusTone[application.status]}`}>
                  {STATUS_LABELS[application.status]}
                </span>
              </div>

              <h5 className="text-xs font-bold text-[#1A1A1A] line-clamp-2">{application.title}</h5>
              <p className="text-[11px] text-gray-400 mt-1">
                By: {application.senderIdentity || application.senderName} ({application.className || application.senderRole})
              </p>
              <p className="text-[10px] text-gray-400 font-medium text-right mt-2">
                {formatApplicationDate(application.createdAt)}
              </p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-[#EAEAEA] shadow-sm min-h-[680px]">
          {selectedApplication ? (
            <div className="space-y-5">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-gray-100 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">
                      {selectedApplication.id} // {selectedApplication.kind === 'request' ? 'Approval Request' : 'Simple Application'}
                    </span>
                    {selectedApplication.category === 'Violence / Safety Concern' && (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-100">
                        HIGH PRIORITY
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-black text-[#1A1A1A]">{selectedApplication.title}</h4>
                  <p className="text-xs font-medium text-gray-500 mt-1">
                    Applicant: <b>{selectedApplication.senderIdentity || selectedApplication.senderName}</b> | Role:{' '}
                    <b>{selectedApplication.senderRole}</b> | Scope:{' '}
                    <b>{selectedApplication.className || selectedApplication.senderRole}</b>
                  </p>
                </div>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border ${statusTone[selectedApplication.status]}`}>
                  {STATUS_LABELS[selectedApplication.status]}
                </span>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-[#333333] leading-relaxed font-medium">
                {selectedApplication.message}
              </div>

              {selectedApplication.audienceMode === 'all-class' && (
                <ClassConsensusBlock application={selectedApplication} />
              )}

              {selectedApplication.category === 'Violence / Safety Concern' && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-2xl p-3 text-[11px] text-rose-700 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Treat this as a safety-sensitive application. Reply should include next action or escalation.
                </div>
              )}

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquareReply className="w-4 h-4 text-[#8b5cf6]" />
                  <h5 className="text-xs font-black text-[#1A1A1A]">Admin Reply</h5>
                </div>
                <textarea
                  value={reply}
                  onChange={(event) =>
                    setReplyDrafts((prev) => ({
                      ...prev,
                      [selectedApplication.id]: event.target.value,
                    }))
                  }
                  rows={5}
                  placeholder="Type Admin response here..."
                  className="w-full bg-[#F8F8F8] border border-gray-200 rounded-2xl px-3 py-3 text-xs font-medium outline-none focus:border-[#8b5cf6] resize-none leading-relaxed"
                />

                <div className="flex flex-wrap items-center justify-end gap-3">
                  {selectedApplication.kind === 'request' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => runAdminAction('rejected')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 rounded-full text-xs font-bold transition-all"
                      >
                        <XCircle className="w-4 h-4" /> Reject Request
                      </button>
                      <button
                        type="button"
                        onClick={() => runAdminAction('approved')}
                        className="flex items-center gap-2 px-6 py-2.5 bg-[#E1FA6C] hover:bg-[#d2eb5b] text-[#1A1A1A] rounded-full text-xs font-bold transition-all shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve Request
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => runAdminAction('replied')}
                      className="flex items-center gap-2 px-6 py-2.5 bg-[#E1FA6C] hover:bg-[#d2eb5b] text-[#1A1A1A] rounded-full text-xs font-bold transition-all shadow-sm"
                    >
                      <MessageSquareReply className="w-4 h-4" /> Send Reply
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[620px] flex flex-col items-center justify-center text-center text-gray-400">
              <FileText className="w-12 h-12 stroke-[1.2] mb-2" />
              <p className="text-xs font-bold text-[#1A1A1A]">No Application Selected</p>
              <p className="text-[10px] text-gray-400 mt-0.5 max-w-xs">
                Select an entry from the inbox to review details, reply, approve, or reject.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ClassConsensusBlock = ({ application }) => {
  const metrics = getConsensusMetrics(application);
  const acceptedList = application.votes?.filter((vote) => vote.decision === 'in') || [];
  const rejectedList = application.votes?.filter((vote) => vote.decision === 'out') || [];

  return (
    <div className="space-y-4 bg-purple-50/50 border border-purple-100 rounded-2xl p-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <h5 className="text-xs font-bold text-[#1A1A1A] flex items-center gap-1.5">
          <Users className="w-4 h-4 text-purple-500" />
          {application.targetClassName} Engagement Breakdown
        </h5>
        <span className="text-[10px] font-black text-purple-700">
          {metrics.consensusPercent}% support from {metrics.totalClassMembers} students
        </span>
      </div>

      <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden flex">
        <div style={{ width: `${metrics.consensusPercent}%` }} className="bg-emerald-500 h-full" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
        <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
          <p className="text-[11px] font-bold text-emerald-600">
            Join ({metrics.acceptedCount})
          </p>
          <p className="text-[10px] text-gray-400 font-medium mt-1 truncate">
            {acceptedList.map((vote) => vote.name).join(', ') || 'No votes yet'}
          </p>
        </div>
        <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-100">
          <p className="text-[11px] font-bold text-rose-600">
            I&apos;m Out ({metrics.rejectedCount})
          </p>
          <p className="text-[10px] text-gray-400 font-medium mt-1 truncate">
            {rejectedList.map((vote) => vote.name).join(', ') || 'No opt-outs yet'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminApplicationInbox;
