import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
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

const REPLY_EDIT_WINDOW_MS = 5 * 60 * 1000;

const getReplyStatus = (application) => {
  if (!application?.adminReply) return null;
  if (application.replyReadAt) return 'read';
  if (application.replyRecipientActiveAt) return 'active';
  if (application.replyDeliveredAt) return 'online';
  return 'sent';
};

const ReplyTicks = ({ status }) => {
  const count = status === 'sent' ? 1 : status === 'online' ? 2 : 3;
  const isRead = status === 'read';

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${isRead ? 'text-blue-600' : 'text-gray-400'}`}
      title={
        status === 'sent'
          ? 'Sent while recipient is offline'
          : status === 'online'
            ? 'Recipient data is online'
            : status === 'active'
              ? 'Recipient is active on ERP'
              : 'Recipient read this reply'
      }
    >
      {Array.from({ length: count }).map((_, index) => (
        <Check key={index} className="w-3.5 h-3.5 stroke-[3]" />
      ))}
    </span>
  );
};

const AdminApplicationInbox = ({ session }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [applications, setApplications] = useState([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

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

  useEffect(() => {
    setCurrentTimeMs(Date.now());
    const timerId = window.setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

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
  const replyStatus = getReplyStatus(selectedApplication);
  const replyActionAt = selectedApplication?.adminReplyEditedAt || selectedApplication?.adminActionAt;
  const canEditReply =
    Boolean(selectedApplication?.adminReply && replyActionAt) &&
    currentTimeMs - new Date(replyActionAt).getTime() <= REPLY_EDIT_WINDOW_MS;
  const hasSentReply = Boolean(selectedApplication?.adminReply);
  const isReplyLocked = hasSentReply && !canEditReply;

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
      <div className="glass-card p-5 rounded-3xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#8b5cf6]" /> Admin Application Inbox
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Review problems, safety concerns, infrastructure complaints, and approval requests. Leave requests are not shown here.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1 bg-white/50 p-1 rounded-2xl border border-white/70 max-w-full overflow-hidden">
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
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-normal text-center ${
                    activeTab === tab.id
                      ? 'btn-primary shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
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
        <div className="lg:col-span-1 bg-white/50 p-4 rounded-3xl flex flex-col gap-3 shadow-sm h-[680px] overflow-y-auto">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold text-slate-900 capitalize">{activeTab} Inbox</h4>
            <span className="text-[10px] font-bold text-gray-400">
              {isLoading ? 'Syncing...' : `${filteredApplications.length} items`}
            </span>
          </div>

          {filteredApplications.length === 0 && (
            <div className="glass-soft rounded-2xl p-6 text-center text-slate-400">
              <FileText className="w-9 h-9 mx-auto mb-2 stroke-[1.4]" />
              <p className="text-xs font-black text-slate-900">No applications</p>
            </div>
          )}

          {filteredApplications.map((application) => (
            <button
              type="button"
              key={application.id}
              onClick={() => setSelectedApplicationId(application.id)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all bg-white/60 hover:scale-[1.01] text-left ${
                selectedApplication?.id === application.id
                  ? 'border-indigo-400 ring-2 ring-indigo-100'
                  : 'border-white/80'
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

              <h5 className="text-xs font-bold text-slate-900 line-clamp-2">{application.title}</h5>
              <p className="text-[11px] text-gray-400 mt-1">
                By: {application.senderIdentity || application.senderName} ({application.className || application.senderRole})
              </p>
              <p className="text-[10px] text-gray-400 font-medium text-right mt-2">
                {formatApplicationDate(application.createdAt)}
              </p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2 glass-card p-5 rounded-3xl min-h-[680px]">
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
                  <h4 className="text-base font-black text-slate-900">{selectedApplication.title}</h4>
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

              <div className="p-4 glass-soft rounded-2xl text-xs text-slate-700 leading-relaxed font-medium">
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
                  <h5 className="text-xs font-black text-slate-900">Admin Reply</h5>
                </div>
                <textarea
                  value={reply}
                  disabled={isReplyLocked}
                  onChange={(event) =>
                    setReplyDrafts((prev) => ({
                      ...prev,
                      [selectedApplication.id]: event.target.value,
                    }))
                  }
                  rows={5}
                  placeholder="Type Admin response here..."
                  className="w-full bg-white/60 border border-white/80 rounded-2xl px-3 py-3 text-xs font-medium outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all resize-none leading-relaxed disabled:text-gray-500 disabled:cursor-not-allowed"
                />

                {hasSentReply && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-900">
                    <span className="flex flex-wrap items-center gap-2">
                      Reply sent
                      {selectedApplication.adminReplyEditedAt && (
                        <span className="rounded-md border border-blue-200 bg-white px-2 py-0.5 text-[9px] font-black uppercase text-blue-700">
                          Edited
                        </span>
                      )}
                      {canEditReply ? 'Editable for five minutes after sending.' : 'Five-minute edit window closed.'}
                    </span>
                    {replyStatus && (
                      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide">
                        <ReplyTicks status={replyStatus} />
                        {replyStatus === 'sent'
                          ? 'Offline'
                          : replyStatus === 'online'
                            ? 'Data online'
                            : replyStatus === 'active'
                              ? 'Active'
                              : 'Read'}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-3">
                  {selectedApplication.kind === 'request' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => runAdminAction('rejected')}
                        disabled={isReplyLocked}
                        className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 rounded-full text-xs font-bold transition-all"
                      >
                        <XCircle className="w-4 h-4" /> Reject Request
                      </button>
                      <button
                        type="button"
                        onClick={() => runAdminAction('approved')}
                        disabled={isReplyLocked}
                        className="flex items-center gap-2 px-6 py-2.5 btn-primary rounded-full text-xs font-bold transition-all shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve Request
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => runAdminAction('replied')}
                      disabled={isReplyLocked}
                      className="flex items-center gap-2 px-6 py-2.5 btn-primary rounded-full text-xs font-bold transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <MessageSquareReply className="w-4 h-4" /> {hasSentReply ? 'Update Reply' : 'Send Reply'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[620px] flex flex-col items-center justify-center text-center text-gray-400">
              <FileText className="w-12 h-12 stroke-[1.2] mb-2" />
              <p className="text-xs font-bold text-slate-900">No Application Selected</p>
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
        <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-purple-500" />
          {application.targetClassName} Engagement Breakdown
        </h5>
        <span className="text-[10px] font-black text-purple-700">
          {metrics.consensusPercent}% support from {metrics.totalClassMembers} students
        </span>
      </div>

      <div className="w-full bg-white/60 h-3 rounded-full overflow-hidden flex">
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
