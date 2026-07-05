import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Bot, User, CheckCircle2, XCircle, Loader2, AlertTriangle, Wallet, Megaphone } from 'lucide-react';
import { apiFetch } from '../../components/common/api';
import { useMongoState } from '../../components/common/mongoState';
import {
  getClassOrder,
  collectStudentPayment,
  getStudentAdmissionNumber,
  getStudentDisplayName,
  formatCurrency,
} from '../../components/common/financeData';

const WELCOME_MESSAGE = {
  role: 'model',
  content:
    "Hello! I'm your MGPS assistant. I can collect a student fee payment or broadcast a notice for you. Just tell me what you need — for example, \"Collect 5000 fees from admission MGPS-101\" or \"Send a notice about the annual sports day\".",
};

const AiAssistant = () => {
  // Chat transcript (persisted to backend contract shape: role user|model)
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Live master data blobs (reuse the same namespaces the finance & notice pages use).
  const [students, setStudents] = useMongoState('admin-student-management-students', []);
  const [classPreferences] = useMongoState('admin-class-preferences', []);
  const [, setNoticesList] = useMongoState('admin-notices-list', []);

  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingAction, isSending]);

  // Push a plain assistant message into the transcript.
  const appendModelMessage = (content) => {
    setMessages((prev) => [...prev, { role: 'model', content }]);
  };

  const handleSend = async (event) => {
    event?.preventDefault?.();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    // Drop any stale pending action when the user types a new instruction.
    setPendingAction(null);

    const nextMessages = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setIsSending(true);

    try {
      const payload = await apiFetch('/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (payload?.reply) {
        appendModelMessage(payload.reply);
      }
      if (payload?.pendingAction) {
        setPendingAction(payload.pendingAction);
      }
    } catch (error) {
      const message = String(error?.message || '');
      // Backend returns 503 when GEMINI_API_KEY is missing.
      if (message.includes('503') || /not configured|GEMINI/i.test(message)) {
        appendModelMessage(
          'The AI assistant is not configured yet. Please ask your administrator to set the GEMINI_API_KEY environment variable on the server, then try again.'
        );
      } else {
        appendModelMessage(`Sorry, something went wrong: ${message || 'the request failed.'} Please try again.`);
      }
    } finally {
      setIsSending(false);
    }
  };

  // --- CONFIRM: collect_fee (reuses the tested finance ledger logic) ---
  const runCollectFee = (args) => {
    const admissionNumber = String(args?.admissionNumber || '').trim();
    const amount = Number(args?.amount) || 0;
    const note = String(args?.note || '').trim();

    if (!admissionNumber || amount <= 0) {
      appendModelMessage('I could not process that payment — a valid admission number and amount are required.');
      return;
    }

    const list = Array.isArray(students) ? students : [];
    const index = list.findIndex(
      (student) =>
        String(getStudentAdmissionNumber(student)).trim().toLowerCase() === admissionNumber.toLowerCase()
    );

    if (index === -1) {
      appendModelMessage(`No student found with admission number "${admissionNumber}". Please double-check and try again.`);
      return;
    }

    const classOrder = getClassOrder(classPreferences);
    const receiptNo = `REC-${Date.now().toString().slice(-6)}`;
    const { student: updatedStudent, breakdown, remaining } = collectStudentPayment(
      list[index],
      amount,
      classOrder,
      receiptNo,
      new Date().toISOString()
    );

    const nextStudents = list.map((student, i) => (i === index ? updatedStudent : student));
    setStudents(nextStudents);

    const studentName = getStudentDisplayName(list[index]);
    const collected = amount - Math.max(0, remaining);
    const breakdownLines = (breakdown || [])
      .map((row) => `  • ${row.className}: ${formatCurrency(row.amount)}`)
      .join('\n');

    const receiptLines = [
      `Payment recorded successfully.`,
      ``,
      `Receipt No: ${receiptNo}`,
      `Student: ${studentName} (${admissionNumber})`,
      `Amount collected: ${formatCurrency(collected)}`,
      breakdownLines ? `Allocated to:\n${breakdownLines}` : '',
      Math.max(0, remaining) > 0 ? `Unallocated (no pending dues): ${formatCurrency(remaining)}` : '',
      note ? `Note: ${note}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    appendModelMessage(receiptLines);
  };

  // --- CONFIRM: send_notice (mirrors Notices.jsx publish flow) ---
  const runSendNotice = (args) => {
    const title = String(args?.title || '').trim();
    const description = String(args?.description || '').trim();
    const targetClass = String(args?.targetClass || '').trim();

    if (!title) {
      appendModelMessage('I could not publish the notice — a title is required.');
      return;
    }

    const targetClasses = targetClass ? [targetClass] : ['ALL CLASSES'];
    const formattedNotice = {
      id: `NTC-2026-${Math.floor(100 + Math.random() * 900)}`,
      title,
      description,
      category: 'General',
      date: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      targetClasses,
    };

    setNoticesList((prev) => [formattedNotice, ...(Array.isArray(prev) ? prev : [])]);

    // Fan out a push notification (empty className = every student).
    apiFetch('/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Notice',
        description: title || description,
        type: 'notice',
        linkPage: 'Notices',
        recipientRole: 'student',
        recipientClassName: targetClass,
      }),
    }).catch((error) => {
      console.warn('Failed to send notice notification', error);
    });

    appendModelMessage(
      `Notice published successfully.\n\nTitle: ${title}\nAudience: ${
        targetClass || 'All classes'
      }${description ? `\nDetails: ${description}` : ''}`
    );
  };

  const handleConfirm = () => {
    if (!pendingAction || isConfirming) return;
    setIsConfirming(true);
    try {
      if (pendingAction.type === 'collect_fee') {
        runCollectFee(pendingAction.args || {});
      } else if (pendingAction.type === 'send_notice') {
        runSendNotice(pendingAction.args || {});
      } else {
        appendModelMessage(`I don't know how to perform the action "${pendingAction.type}".`);
      }
    } finally {
      setPendingAction(null);
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    setPendingAction(null);
    appendModelMessage('Okay, I have cancelled that action. Let me know if there is anything else.');
  };

  const pendingIcon =
    pendingAction?.type === 'collect_fee' ? (
      <Wallet className="w-4 h-4" />
    ) : pendingAction?.type === 'send_notice' ? (
      <Megaphone className="w-4 h-4" />
    ) : (
      <AlertTriangle className="w-4 h-4" />
    );

  return (
    <div className="flex-1 min-h-screen p-6 font-sans text-slate-900 flex flex-col">
      {/* HEADER */}
      <div className="glass-card p-6 rounded-3xl mb-6 flex items-center gap-3 shrink-0">
        <div className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-md">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">AI Assistant</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Ask me to collect a fee or broadcast a notice. I&apos;ll always confirm with you before acting.
          </p>
        </div>
      </div>

      {/* CHAT PANEL */}
      <div className="glass-card rounded-3xl flex-1 flex flex-col overflow-hidden min-h-[420px]">
        {/* MESSAGE LIST */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
          {messages.map((message, index) => {
            const isUser = message.role === 'user';
            return (
              <div key={index} className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-sm">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-[13px] font-medium leading-relaxed whitespace-pre-line shadow-sm ${
                    isUser
                      ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-br-md'
                      : 'glass-soft text-slate-800 rounded-bl-md border border-white/70'
                  }`}
                >
                  {message.content}
                </div>
                {isUser && (
                  <div className="w-8 h-8 shrink-0 rounded-full bg-white/70 border border-white/80 flex items-center justify-center shadow-sm">
                    <User className="w-4 h-4 text-slate-600" />
                  </div>
                )}
              </div>
            );
          })}

          {/* PENDING ACTION CONFIRMATION CARD */}
          {pendingAction && (
            <div className="flex items-end gap-2.5 justify-start">
              <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <div className="max-w-[85%] w-full glass-strong border-2 border-amber-300/70 rounded-2xl rounded-bl-md p-4 shadow-md">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-amber-700 mb-2">
                  {pendingIcon} Confirm Action
                </div>
                <p className="text-[13px] font-semibold text-slate-800 leading-relaxed whitespace-pre-line">
                  {pendingAction.summary || 'Please confirm this action.'}
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isConfirming}
                    className="flex items-center gap-1.5 text-xs font-black px-5 py-2.5 rounded-xl transition-all shadow-xs btn-primary disabled:opacity-60"
                  >
                    {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isConfirming}
                    className="flex items-center gap-1.5 text-xs font-black px-5 py-2.5 rounded-xl transition-all bg-white/60 border border-slate-200/80 text-slate-600 hover:text-red-600 hover:border-red-200 disabled:opacity-60"
                  >
                    <XCircle className="w-4 h-4" /> Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TYPING / LOADING INDICATOR */}
          {isSending && (
            <div className="flex items-end gap-2.5 justify-start">
              <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-sm">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="glass-soft border border-white/70 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* INPUT BAR */}
        <form
          onSubmit={handleSend}
          className="shrink-0 border-t border-white/60 p-3.5 flex items-center gap-2.5 bg-white/30"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the assistant to collect a fee or send a notice..."
            disabled={isSending}
            className="flex-1 px-4 py-3 bg-white/70 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-2xl font-semibold text-[13px] text-slate-900 placeholder:text-slate-400 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="flex items-center justify-center gap-1.5 text-xs font-black px-5 py-3 rounded-2xl transition-all shadow-xs btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default AiAssistant;
