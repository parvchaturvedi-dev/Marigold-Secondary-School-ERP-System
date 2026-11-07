import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Image,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import { apiFetch } from '../../services/api';

const SCHOOL_GROUPS = [
  { value: 'students', label: 'Students' },
  { value: 'teachers', label: 'Faculty / Teachers' },
  { value: 'employees', label: 'Employees' },
  { value: 'clerks', label: 'Clerks' },
  { value: 'all', label: 'All school user groups' },
];
const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low (less)' },
];
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']);
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const priorityClass = {
  high: 'bg-rose-100 text-rose-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

const WhatsappMessage = () => {
  const [audience, setAudience] = useState('school');
  const [schoolGroup, setSchoolGroup] = useState('students');
  const [className, setClassName] = useState('');
  const [schoolUsers, setSchoolUsers] = useState([]);
  const [classNames, setClassNames] = useState([]);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([]);
  const [priorities, setPriorities] = useState(['high', 'medium', 'low']);
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState('');
  const fileInput = useRef(null);
  const attachmentPreview = useMemo(
    () => attachment?.type.startsWith('image/') ? URL.createObjectURL(attachment) : '',
    [attachment]
  );

  useEffect(() => () => {
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
  }, [attachmentPreview]);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch('/whatsapp/school-users'),
      apiFetch('/whatsapp/recipients'),
      apiFetch('/whatsapp-integration/config'),
    ])
      .then(([schoolResult, recipientResult, configResult]) => {
        if (!active) return;
        setSchoolUsers(schoolResult.users || []);
        setClassNames(schoolResult.classNames || []);
        setRecipients(recipientResult.recipients || []);
        setConfigured(Boolean(configResult.configured));
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'WhatsApp messaging data could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return schoolUsers.filter((user) =>
      (schoolGroup === 'all' || user.role === schoolGroup) &&
      (!className || user.role !== 'students' || user.className === className) &&
      (!query || `${user.name} ${user.phoneNumber} ${user.className}`.toLowerCase().includes(query))
    );
  }, [schoolUsers, schoolGroup, className, search]);

  const visibleRecipients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return recipients.filter((recipient) =>
      (priorities.includes(recipient.priority)) &&
      (!query || `${recipient.name} ${recipient.phoneNumber}`.toLowerCase().includes(query))
    );
  }, [recipients, priorities, search]);

  const selectedSchoolCount = schoolUsers.filter((user) =>
    (schoolGroup === 'all' || user.role === schoolGroup) &&
    (!className || user.role !== 'students' || user.className === className) &&
    selectedSchoolIds.includes(user.id)
  ).length;
  const selectedRecipientCount = recipients.filter((recipient) =>
    priorities.includes(recipient.priority) && selectedRecipientIds.includes(recipient.id)
  ).length;
  const audienceCount =
    (audience === 'school' || audience === 'all' ? selectedSchoolCount : 0) +
    (audience === 'recipients' || audience === 'all' ? selectedRecipientCount : 0);
  const hasSelection =
    (audience === 'school' && selectedSchoolCount > 0) ||
    (audience === 'recipients' && selectedRecipientCount > 0) ||
    (audience === 'all' &&
      (selectedSchoolCount > 0 || selectedRecipientCount > 0));
  const maxMessageLength = attachment ? 1024 : 4096;

  const changeAudience = (value) => {
    setAudience(value);
    setSearch('');
    setError('');
    setResult(null);
  };

  const toggleSchoolGroup = (value) => {
    setSchoolGroup(value);
    setClassName('');
    setSelectedSchoolIds([]);
    setSearch('');
  };

  const toggleSchoolUser = (id) => {
    setSelectedSchoolIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleAllSchool = () => {
    const visibleIds = new Set(visibleUsers.map((user) => user.id));
    const allVisibleSelected = visibleUsers.length > 0 && visibleUsers.every((user) => selectedSchoolIds.includes(user.id));
    setSelectedSchoolIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.has(id))
        : [...new Set([...current, ...visibleIds])]
    );
  };

  const togglePriority = (value) => {
    setPriorities((current) =>
      current.includes(value) ? current.filter((priority) => priority !== value) : [...current, value]
    );
  };

  const toggleRecipient = (id) => {
    setSelectedRecipientIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleAllRecipients = () => {
    const visibleIds = new Set(visibleRecipients.map((recipient) => recipient.id));
    const allVisibleSelected = visibleRecipients.length > 0 && visibleRecipients.every((recipient) => selectedRecipientIds.includes(recipient.id));
    setSelectedRecipientIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.has(id))
        : [...new Set([...current, ...visibleIds])]
    );
  };

  const chooseAttachment = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    setError('');
    if (!file) return;
    if (!ACCEPTED_TYPES.has(file.type)) {
      setError('Choose a JPG, PNG, WEBP image, MP4 video, or PDF.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('Attachment size must be 16 MB or less.');
      return;
    }
    if (message.trim().length > 1024) {
      setError('Shorten the message to 1,024 characters before attaching media.');
      return;
    }
    setAttachment(file);
    setResult(null);
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    setError('');
    setResult(null);
    if (!configured) {
      setError('Set up WhatsApp credentials first in WhatsApp Desk → WhatsApp Integration.');
      return;
    }
    if (!message.trim()) {
      setError('Message is required, including when you attach a file.');
      return;
    }
    if (!hasSelection) {
      setError('Select at least one school user or recipient.');
      return;
    }
    if ((audience === 'recipients' || audience === 'all') && priorities.length === 0) {
      setError('Choose at least one recipient priority.');
      return;
    }
    if (audienceCount > 100) {
      setError('Select no more than 100 contacts for one send.');
      return;
    }
    if (!window.confirm(`Send this WhatsApp message to up to ${audienceCount} selected contact(s)?`)) return;

    setSending(true);
    try {
      const target = {
        mode: audience,
        role: schoolGroup,
        className,
        userIds: selectedSchoolIds,
        recipientIds: selectedRecipientIds,
        selectAllRecipients: false,
        priorities,
      };
      const body = new FormData();
      body.append('message', message.trim());
      body.append('target', JSON.stringify(target));
      if (attachment) body.append('attachment', attachment);
      const sent = await apiFetch('/whatsapp/send', { method: 'POST', body });
      setResult(sent);
    } catch (sendError) {
      setError(sendError.message || 'WhatsApp message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const AttachmentIcon = attachment?.type.startsWith('image/')
    ? Image
    : attachment?.type.startsWith('video/')
      ? Video
      : FileText;

  return (
    <main className="min-h-screen flex-1 space-y-6 p-4 text-slate-900 sm:p-6">
      <header className="glass-card rounded-3xl p-5 sm:p-6">
        <h1 className="flex items-center gap-2 text-2xl font-black"><MessageSquare className="h-6 w-6 text-emerald-700" /> WhatsApp Message</h1>
        <p className="mt-1 text-sm text-slate-500">Choose school users, saved recipients, or both, then compose a message.</p>
      </header>

      {error && <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      {result && (
        <section role="status" className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4" /> Meta accepted {result.accepted}/{result.total} message(s); {result.failed} failed.</p>
          <p>{result.notice}</p>
          {result.failed > 0 && <div className="max-h-40 overflow-auto border-t border-emerald-200 pt-2">{result.results.filter((item) => item.status === 'failed').map((item) => <p key={`${item.phoneNumber}-${item.error}`} className="py-1 text-red-800">{item.name} (+{item.phoneNumber}): {item.error}</p>)}</div>}
        </section>
      )}

      {!configured && !loading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          Complete and test the WhatsApp integration before sending messages.
        </div>
      )}

      <form onSubmit={sendMessage} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.8fr)]">
        <section className="glass-card space-y-5 rounded-3xl p-5">
          <div>
            <h2 className="font-extrabold">1. Choose recipients</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                { value: 'school', label: 'School users' },
                { value: 'recipients', label: 'Recipients list' },
                { value: 'all', label: 'Both groups' },
              ].map((option) => (
                <label key={option.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-bold ${audience === option.value ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white/70 text-slate-600'}`}>
                  <input type="radio" name="audience" value={option.value} checked={audience === option.value} onChange={() => changeAudience(option.value)} />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          {(audience === 'school' || audience === 'all') && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/50 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-52 flex-1 space-y-1 text-xs font-bold text-slate-600">
                  School group
                  <select value={schoolGroup} onChange={(event) => toggleSchoolGroup(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900">
                    {SCHOOL_GROUPS.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
                  </select>
                </label>
                {schoolGroup !== 'all' && schoolGroup === 'students' && (
                  <label className="min-w-44 flex-1 space-y-1 text-xs font-bold text-slate-600">
                    Class
                    <select value={className} onChange={(event) => { setClassName(event.target.value); setSelectedSchoolIds([]); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900">
                      <option value="">All classes</option>
                      {classNames.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </label>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={visibleUsers.length > 0 && visibleUsers.every((user) => selectedSchoolIds.includes(user.id))} onChange={toggleAllSchool} />
                Select all {visibleUsers.length} displayed school users
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <Users className="h-4 w-4 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find by name, phone, or class" className="w-full bg-transparent text-sm outline-none" />
              </label>
              {loading ? <p className="text-sm text-slate-500">Loading school users…</p> : visibleUsers.length === 0 ? (
                <p className="text-sm text-slate-500">No school contacts with a usable WhatsApp number in this group.</p>
              ) : (
                <div className="max-h-64 space-y-1 overflow-auto">
                  {visibleUsers.map((user) => (
                    <label key={`${user.role}-${user.id}`} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-white">
                      <input type="checkbox" checked={selectedSchoolIds.includes(user.id)} onChange={() => toggleSchoolUser(user.id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{user.name}</span>
                        <span className="block text-xs text-slate-500">+{user.phoneNumber}{user.className ? ` · ${user.className}${user.section ? `-${user.section}` : ''}` : ''}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-500">Contacts without a usable phone number are omitted. Student messages use the available guardian/student contact number.</p>
            </div>
          )}

          {(audience === 'recipients' || audience === 'all') && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/50 p-4">
              <div>
                <p className="text-sm font-bold">Recipient priorities</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRIORITIES.map((item) => (
                    <label key={item.value} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold">
                      <input type="checkbox" checked={priorities.includes(item.value)} onChange={() => togglePriority(item.value)} /> {item.label}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={visibleRecipients.length > 0 && visibleRecipients.every((recipient) => selectedRecipientIds.includes(recipient.id))} onChange={toggleAllRecipients} />
                Select all {visibleRecipients.length} recipients matching these priorities
              </label>
              {loading ? <p className="text-sm text-slate-500">Loading recipients…</p> : visibleRecipients.length === 0 ? (
                <p className="text-sm text-slate-500">No saved recipients match the selected priorities.</p>
              ) : (
                <div className="max-h-64 space-y-1 overflow-auto">
                  {visibleRecipients.map((recipient) => (
                    <label key={recipient.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-white">
                      <input type="checkbox" checked={selectedRecipientIds.includes(recipient.id)} onChange={() => toggleRecipient(recipient.id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{recipient.name}</span>
                        <span className="block text-xs text-slate-500">+{recipient.phoneNumber}</span>
                      </span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${priorityClass[recipient.priority]}`}>{recipient.priority}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="glass-card space-y-5 rounded-3xl p-5">
          <div>
            <h2 className="font-extrabold">2. Compose message</h2>
            <p className="mt-1 text-xs text-slate-500">Message text is required, whether or not a file is attached.</p>
          </div>

          <label className="block space-y-1.5 text-sm font-bold">
            Message
            <textarea required value={message} onChange={(event) => setMessage(event.target.value)} maxLength={maxMessageLength} rows={7} placeholder="Write the WhatsApp message…" className="w-full resize-y rounded-xl border border-slate-200 bg-white/80 px-3 py-3 font-medium outline-none focus:border-emerald-500" />
            <span className="block text-right text-xs font-medium text-slate-500">{message.length}/{maxMessageLength}</span>
          </label>

          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf,.jpg,.jpeg,.png,.webp,.mp4,.pdf" onChange={chooseAttachment} className="hidden" />
          {attachment ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              {attachment.type.startsWith('image/') ? (
                <img src={attachmentPreview} alt="Selected attachment preview" className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><AttachmentIcon className="h-7 w-7" /></span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{attachment.name}</span>
                <span className="text-xs text-slate-500">{(attachment.size / (1024 * 1024)).toFixed(2)} MB · Caption required</span>
              </span>
              <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment" className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold hover:bg-slate-50">
              <Paperclip className="h-4 w-4" /> Attach image, MP4, or PDF
            </button>
          )}
          <p className="text-xs leading-5 text-slate-500">One optional attachment, up to 16 MB: JPG/PNG/WEBP, MP4, or PDF. Meta must accept the file type and size for the selected number.</p>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            WhatsApp requires an approved message template when contacting people outside the 24-hour customer-service window. Send only to contacts who have agreed to receive school messages. This tool sends direct API messages, not group chats.
          </div>

          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <span className="text-sm font-bold text-slate-700">Selected contacts</span>
            <span className={`rounded-full px-3 py-1 text-sm font-black ${audienceCount > 100 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>{audienceCount}</span>
          </div>
            {audienceCount > 100 && <p className="text-xs font-semibold text-red-700">One send can include up to 100 unique phone numbers.</p>}

            <button type="submit" disabled={sending || loading || !configured || !hasSelection || audienceCount > 100} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Sending messages…' : `Send WhatsApp${audienceCount ? ` to ${audienceCount}` : ''}`}
          </button>
        </section>
      </form>
    </main>
  );
};

export default WhatsappMessage;
