import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  MessageSquareReply,
  Send,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  Users,
} from 'lucide-react';
import {
  APPLICATION_CATEGORIES,
  APPLICATION_UPDATED_EVENT,
  STATUS_LABELS,
  createApplication,
  fetchApplications,
  formatApplicationDate,
  getConsensusMetrics,
  getDemoIdentity,
  voteOnApplication,
} from './applicationStore';

const kindOptions = [
  { id: 'simple', label: 'Simple Application' },
  { id: 'request', label: 'Approval Request' },
];

const statusTone = {
  collecting_consensus: 'bg-purple-50 text-purple-700 border-purple-100',
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  rejected: 'bg-rose-50 text-rose-700 border-rose-100',
  replied: 'bg-blue-50 text-blue-700 border-blue-100',
};

const ApplicationUserHub = ({ session, role }) => {
  const identityConfig = useMemo(() => getDemoIdentity(session), [session]);
  const [selectedIdentityId, setSelectedIdentityId] = useState(identityConfig.members[0]?.id || '');
  const selectedIdentity =
    identityConfig.members.find((member) => member.id === selectedIdentityId) ||
    identityConfig.members[0];
  const selectedClassName = selectedIdentity?.className || '';
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formState, setFormState] = useState({
    title: '',
    category: APPLICATION_CATEGORIES[0],
    kind: 'simple',
    audienceMode: 'individual',
    totalClassMembers: 40,
    message: '',
  });

  const canUseClassConsensus = role === 'student' && formState.kind === 'request';

  const loadApplications = async () => {
    setIsLoading(true);
    const latestApplications = await fetchApplications(session, selectedIdentity);
    setApplications(latestApplications);
    setIsLoading(false);
  };

  useEffect(() => {
    let isActive = true;
    const identityScope = { className: selectedClassName };
    const sessionScope = { role: session?.role, username: session?.username };

    fetchApplications(sessionScope, identityScope).then((latestApplications) => {
      if (isActive) setApplications(latestApplications);
    });

    return () => {
      isActive = false;
    };
  }, [selectedClassName, selectedIdentityId, session?.role, session?.username]);

  useEffect(() => {
    const refreshApplications = () => {
      const identityScope = { className: selectedClassName };
      const sessionScope = { role: session?.role, username: session?.username };
      fetchApplications(sessionScope, identityScope).then((latestApplications) => {
        setApplications(latestApplications);
      });
    };

    window.addEventListener(APPLICATION_UPDATED_EVENT, refreshApplications);

    return () => {
      window.removeEventListener(APPLICATION_UPDATED_EVENT, refreshApplications);
    };
  }, [selectedClassName, selectedIdentityId, session?.role, session?.username]);

  const updateField = (field, value) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'kind' && value === 'simple' ? { audienceMode: 'individual' } : {}),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formState.title.trim() || !formState.message.trim()) {
      alert('Please add title and application message.');
      return;
    }

    const payload = {
      title: formState.title.trim(),
      category: formState.category,
      kind: formState.kind,
      message: formState.message.trim(),
      senderRole: role,
      senderName: selectedIdentity?.name || session?.username,
      senderUsername: session?.username,
      senderIdentityId: selectedIdentity?.id || '',
      senderIdentity: selectedIdentity?.name || '',
      className: selectedIdentity?.className || '',
      audienceMode: canUseClassConsensus ? formState.audienceMode : 'individual',
      targetClassName:
        canUseClassConsensus && formState.audienceMode === 'all-class'
          ? selectedIdentity?.className
          : '',
      totalClassMembers: Number(formState.totalClassMembers) || 40,
    };

    await createApplication(payload);
    setFormState({
      title: '',
      category: APPLICATION_CATEGORIES[0],
      kind: 'simple',
      audienceMode: 'individual',
      totalClassMembers: 40,
      message: '',
    });
    await loadApplications();
  };

  const handleVote = async (application, decision) => {
    await voteOnApplication({
      applicationId: application.id,
      username: selectedIdentity?.id || session?.username,
      name: selectedIdentity?.name || session?.username,
      decision,
    });
    await loadApplications();
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans">
      <div className="bg-white p-5 rounded-3xl border border-[#EAEAEA] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[#1A1A1A] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#8b5cf6]" /> Application Desk
            </h3>
            <p className="text-xs text-[#666666] mt-0.5">
              Send complaints, safety concerns, infrastructure issues, or approval requests to Admin.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-rose-50 text-rose-700 border border-rose-100 text-[11px] font-bold">
            <ShieldAlert className="w-3.5 h-3.5" /> Leave requests are handled separately.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <form
          onSubmit={handleSubmit}
          className="xl:col-span-2 bg-white p-5 rounded-3xl border border-[#EAEAEA] shadow-sm space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Send className="w-4 h-4 text-[#8b5cf6]" />
            <h4 className="text-sm font-black text-[#1A1A1A]">New Application</h4>
          </div>

          {identityConfig.isSiblingAccount && (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400">Who is sending?</label>
              <select
                value={selectedIdentityId}
                onChange={(event) => setSelectedIdentityId(event.target.value)}
                className="w-full bg-[#F8F8F8] border border-gray-200 rounded-2xl px-3 py-2.5 text-xs font-bold outline-none focus:border-[#8b5cf6]"
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
            <div className="bg-[#F8F8F8] border border-gray-200 rounded-2xl px-3 py-2.5 text-xs font-bold flex items-center justify-between">
              <span className="flex items-center gap-2 text-[#1A1A1A]">
                <UserRound className="w-4 h-4 text-gray-500" /> {selectedIdentity?.name}
              </span>
              <span className="text-gray-400">{selectedIdentity?.className}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400">Application Type</label>
              <select
                value={formState.kind}
                onChange={(event) => updateField('kind', event.target.value)}
                className="w-full bg-[#F8F8F8] border border-gray-200 rounded-2xl px-3 py-2.5 text-xs font-bold outline-none focus:border-[#8b5cf6]"
              >
                {kindOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400">Category</label>
              <select
                value={formState.category}
                onChange={(event) => updateField('category', event.target.value)}
                className="w-full bg-[#F8F8F8] border border-gray-200 rounded-2xl px-3 py-2.5 text-xs font-bold outline-none focus:border-[#8b5cf6]"
              >
                {APPLICATION_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {canUseClassConsensus && (
            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-3 space-y-3">
              <label className="text-[10px] font-black uppercase text-purple-700">Request Scope</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateField('audienceMode', 'individual')}
                  className={`py-2 rounded-xl text-xs font-black border ${
                    formState.audienceMode === 'individual'
                      ? 'bg-white border-purple-300 text-purple-700'
                      : 'bg-transparent border-purple-100 text-purple-400'
                  }`}
                >
                  Direct to Admin
                </button>
                <button
                  type="button"
                  onClick={() => updateField('audienceMode', 'all-class')}
                  className={`py-2 rounded-xl text-xs font-black border ${
                    formState.audienceMode === 'all-class'
                      ? 'bg-white border-purple-300 text-purple-700'
                      : 'bg-transparent border-purple-100 text-purple-400'
                  }`}
                >
                  Through All Class
                </button>
              </div>

              {formState.audienceMode === 'all-class' && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-500" />
                  <input
                    type="number"
                    min="1"
                    value={formState.totalClassMembers}
                    onChange={(event) => updateField('totalClassMembers', event.target.value)}
                    className="w-24 bg-white border border-purple-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                  <span className="text-[11px] text-purple-700 font-bold">
                    students in {selectedIdentity?.className}; 80% Join sends it to Admin.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-400">Title</label>
            <input
              value={formState.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="Example: Class 9th farewell request for Class 10th"
              className="w-full bg-[#F8F8F8] border border-gray-200 rounded-2xl px-3 py-2.5 text-xs font-bold outline-none focus:border-[#8b5cf6]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-400">Application Message</label>
            <textarea
              value={formState.message}
              onChange={(event) => updateField('message', event.target.value)}
              rows={7}
              placeholder="Type the full application here..."
              className="w-full bg-[#F8F8F8] border border-gray-200 rounded-2xl px-3 py-3 text-xs font-medium outline-none focus:border-[#8b5cf6] resize-none leading-relaxed"
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#E1FA6C] text-[#1A1A1A] rounded-2xl text-xs font-black shadow-sm hover:bg-[#d2eb5b] transition-colors"
          >
            <Send className="w-4 h-4" /> Send Application
          </button>
        </form>

        <div className="xl:col-span-3 space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-[#EAEAEA] shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
              <h4 className="text-sm font-black text-[#1A1A1A] flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[#8b5cf6]" /> Application Timeline
              </h4>
              <span className="text-[10px] font-bold text-gray-400">
                {isLoading ? 'Syncing...' : `${applications.length} records`}
              </span>
            </div>

            <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
              {applications.length === 0 && (
                <div className="p-8 text-center text-gray-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 stroke-[1.4]" />
                  <p className="text-xs font-black text-[#1A1A1A]">No applications yet</p>
                  <p className="text-[11px] mt-1">Submitted applications and class consent requests will appear here.</p>
                </div>
              )}

              {applications.map((application) => {
                const metrics = getConsensusMetrics(application);
                const myVote = application.votes?.find(
                  (vote) => vote.username === (selectedIdentity?.id || session?.username)
                );
                const canVote =
                  role === 'student' &&
                  application.audienceMode === 'all-class' &&
                  application.status === 'collecting_consensus' &&
                  application.targetClassName === selectedIdentity?.className;

                return (
                  <div key={application.id} className="bg-[#F8F8F8] border border-gray-200 rounded-3xl p-4 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-[9px] px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-500 font-black uppercase">
                            {application.category}
                          </span>
                          <span className="text-[9px] px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-500 font-black uppercase">
                            {application.kind === 'request' ? 'Request' : 'Simple'}
                          </span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-md border font-black uppercase ${statusTone[application.status]}`}>
                            {STATUS_LABELS[application.status]}
                          </span>
                        </div>
                        <h5 className="text-sm font-black text-[#1A1A1A]">{application.title}</h5>
                        <p className="text-[11px] text-gray-500 mt-1">
                          By {application.senderIdentity || application.senderName} - {application.className || application.senderRole}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 shrink-0">
                        {formatApplicationDate(application.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs leading-relaxed text-gray-700 bg-white border border-gray-100 rounded-2xl p-3">
                      {application.message}
                    </p>

                    {application.audienceMode === 'all-class' && (
                      <div className="bg-white border border-purple-100 rounded-2xl p-3 space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                          <p className="text-xs font-black text-[#1A1A1A] flex items-center gap-2">
                            <Users className="w-4 h-4 text-purple-500" />
                            {application.targetClassName} class consent
                          </p>
                          <span className="text-[10px] font-black text-purple-700">
                            {metrics.consensusPercent}% Join - 80% required
                          </span>
                        </div>

                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
                          <div className="h-full bg-emerald-500" style={{ width: `${metrics.consensusPercent}%` }} />
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-center text-[11px] font-bold">
                          <div className="bg-emerald-50 text-emerald-700 rounded-xl p-2">
                            Join: {metrics.acceptedCount}
                          </div>
                          <div className="bg-rose-50 text-rose-700 rounded-xl p-2">
                            I&apos;m Out: {metrics.rejectedCount}
                          </div>
                        </div>

                        {canVote && (
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-purple-50 pt-3">
                            <span className="text-[11px] font-bold text-gray-500">
                              Your vote: {myVote ? (myVote.decision === 'in' ? 'Join' : "I'm Out") : 'Not selected'}
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleVote(application, 'in')}
                                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-xs font-black"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" /> Join
                              </button>
                              <button
                                type="button"
                                onClick={() => handleVote(application, 'out')}
                                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-xs font-black"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" /> I&apos;m Out
                              </button>
                            </div>
                          </div>
                        )}

                        {application.status === 'pending' && (
                          <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Class threshold complete. Sent to Admin.
                          </p>
                        )}
                      </div>
                    )}

                    {application.adminReply && (
                      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-xs text-blue-900">
                        <p className="font-black flex items-center gap-2 mb-1">
                          <MessageSquareReply className="w-4 h-4" /> Admin Reply
                        </p>
                        <p className="leading-relaxed">{application.adminReply}</p>
                      </div>
                    )}

                    {application.category === 'Violence / Safety Concern' && (
                      <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-2xl p-3 text-[11px] text-rose-700 font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Safety applications are shown as high priority in Admin inbox.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicationUserHub;
