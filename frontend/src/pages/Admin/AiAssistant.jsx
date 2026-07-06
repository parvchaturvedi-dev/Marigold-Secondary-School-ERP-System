import React, { useEffect, useRef, useState, Suspense, lazy } from 'react';
import {
  ShieldCheck, Wifi, Mic, MicOff, Phone, Camera,
  Cpu, MemoryStick, Thermometer, Monitor, Activity, Server, Globe,
  Terminal, History, Send, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Wallet, Megaphone, BatteryCharging,
} from 'lucide-react';
import { apiFetch } from '../../components/common/api';
import { useMongoState } from '../../components/common/mongoState';
import {
  getClassOrder,
  collectStudentPayment,
  getStudentAdmissionNumber,
  getStudentDisplayName,
  formatCurrency,
} from '../../components/common/financeData';

import OrbBoundary from '../../components/iris/OrbBoundary';
import irisVoice from '../../components/iris/irisVoice';

// Orb is R3F/WebGL — lazy-load so the page shell paints instantly.
const IrisSphere = lazy(() => import('../../components/iris/IrisSphere'));

// Best-effort read of the logged-in user for the assistant persona.
const readAuthUser = () => {
  try {
    const s = JSON.parse(localStorage.getItem('mgps_erp_auth_session') || '{}');
    return {
      userName: s?.user?.displayName || s?.user?.name || s?.displayName || s?.username || '',
      role: s?.user?.role || s?.role || 'admin',
    };
  } catch {
    return { userName: '', role: 'admin' };
  }
};

const glassPanel = 'bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl';

const WELCOME_MESSAGE = {
  role: 'model',
  content:
    "Hello! I'm your MGPS assistant. I can collect a student fee payment or broadcast a notice for you. Just tell me what you need — for example, \"Collect 5000 fees from admission MGPS-101\" or \"Send a notice about the annual sports day\".",
};

const AiAssistant = () => {
  // ---- Chat / assistant state (backend contract: role user|model) ---------
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // ---- IRIS visual state --------------------------------------------------
  const [isSystemActive, setIsSystemActive] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [time, setTime] = useState(new Date());
  const [metrics, setMetrics] = useState({ cpu: 0, ram: 0, temp: 0 });
  const [net, setNet] = useState({ ping: 0, rate: 0, tx: 0, rx: 0 });

  // ---- Live master data (same namespaces the finance & notice pages use) --
  const [students, setStudents] = useMongoState('admin-student-management-students', []);
  const [classPreferences] = useMongoState('admin-class-preferences', []);
  const [, setNoticesList] = useMongoState('admin-notices-list', []);

  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, pendingAction, isSending]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Wire the IRIS voice engine to component state.
  useEffect(() => {
    irisVoice.onOpen = () => { setIsSystemActive(true); setIsMicMuted(false); };
    irisVoice.onClose = () => { setIsSystemActive(false); setIsMicMuted(true); };
    irisVoice.onUserText = (t) => setMessages((prev) => [...prev, { role: 'user', content: t }]);
    irisVoice.onAiText = (t) => setMessages((prev) => [...prev, { role: 'model', content: t }]);
    irisVoice.onError = (m) => appendModelMessage(`⚠ ${m}`);
    // A voice fee/notice request surfaces the same on-screen confirm card.
    irisVoice.onPendingAction = (pa) => setPendingAction(pa);
    return () => {
      irisVoice.disconnect();
      irisVoice.onOpen = irisVoice.onClose = null;
      irisVoice.onUserText = irisVoice.onAiText = irisVoice.onError = null;
      irisVoice.onPendingAction = null;
    };
  }, []);

  // Engage / disengage the live voice session (the round phone button).
  const handleToggleVoice = async () => {
    if (isSystemActive) { irisVoice.disconnect(); return; }
    const who = readAuthUser();
    try {
      await irisVoice.connect(who);
    } catch (err) {
      if (String(err?.message) === 'NO_API_KEY') {
        const entered = window.prompt('Enter your Gemini API key to enable IRIS voice:');
        if (entered && entered.trim()) {
          localStorage.setItem('iris_gemini_key', entered.trim());
          try {
            await irisVoice.connect(who);
          } catch (err2) {
            appendModelMessage(`Voice connection failed: ${err2?.message || 'unknown error'}.`);
          }
        }
      } else {
        appendModelMessage(`Voice connection failed: ${err?.message || 'unknown error'}.`);
      }
    }
  };

  const handleToggleMic = () => {
    if (!isSystemActive) return;
    const next = !isMicMuted;
    setIsMicMuted(next);
    irisVoice.setMute(next);
  };

  // Ambient telemetry — browsers can't read host CPU/RAM/temp, so these are
  // animated for the IRIS look and only "live" while the assistant is engaged.
  useEffect(() => {
    if (!isSystemActive) {
      setMetrics({ cpu: 0, ram: 0, temp: 0 });
      setNet({ ping: 0, rate: 0, tx: 0, rx: 0 });
      return;
    }
    const interval = setInterval(() => {
      setMetrics({
        cpu: Math.floor(Math.random() * 35) + 15,
        ram: Math.floor(Math.random() * 30) + 40,
        temp: Math.floor(Math.random() * 20) + 45,
      });
      setNet({
        ping: Math.floor(Math.random() * 33) + 12,
        rate: +(Math.random() * 8.5 + 0.5).toFixed(2),
        tx: Math.floor(Math.random() * 100),
        rx: Math.floor(Math.random() * 100),
      });
    }, 1700);
    return () => clearInterval(interval);
  }, [isSystemActive]);

  const appendModelMessage = (content) =>
    setMessages((prev) => [...prev, { role: 'model', content }]);

  // ---- Send a message to the server-side Gemini assistant ------------------
  const handleSend = async (event) => {
    event?.preventDefault?.();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setPendingAction(null);

    // If a live voice session is active, route typed text into it so IRIS
    // replies out loud instead of hitting the text endpoint.
    if (isSystemActive && irisVoice.isConnected) {
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
      setInput('');
      irisVoice.sendText(trimmed);
      return;
    }

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
      if (payload?.reply) appendModelMessage(payload.reply);
      if (payload?.pendingAction) setPendingAction(payload.pendingAction);
    } catch (error) {
      const message = String(error?.message || '');
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

  // ---- CONFIRM: collect_fee (reuses the tested finance ledger logic) ------
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
      list[index], amount, classOrder, receiptNo, new Date().toISOString()
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
    ].filter(Boolean).join('\n');

    appendModelMessage(receiptLines);
  };

  // ---- CONFIRM: send_notice (mirrors Notices.jsx publish flow) ------------
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
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      targetClasses,
    };
    setNoticesList((prev) => [formattedNotice, ...(Array.isArray(prev) ? prev : [])]);

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
    }).catch((error) => console.warn('Failed to send notice notification', error));

    appendModelMessage(
      `Notice published successfully.\n\nTitle: ${title}\nAudience: ${targetClass || 'All classes'}${description ? `\nDetails: ${description}` : ''}`
    );
  };

  const handleConfirm = () => {
    if (!pendingAction || isConfirming) return;
    setIsConfirming(true);
    try {
      if (pendingAction.type === 'collect_fee') runCollectFee(pendingAction.args || {});
      else if (pendingAction.type === 'send_notice') runSendNotice(pendingAction.args || {});
      else appendModelMessage(`I don't know how to perform the action "${pendingAction.type}".`);
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
    pendingAction?.type === 'collect_fee' ? <Wallet className="w-4 h-4" />
      : pendingAction?.type === 'send_notice' ? <Megaphone className="w-4 h-4" />
      : <AlertTriangle className="w-4 h-4" />;

  const systemMetrics = [
    { icon: <Cpu size={16} />, label: 'CPU LOAD', val: isSystemActive ? `${metrics.cpu}%` : '--', raw: metrics.cpu, colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500', shadowClass: 'shadow-[0_0_8px_#10b981]', bgGradient: 'from-emerald-950/30 to-black/60' },
    { icon: <MemoryStick size={16} />, label: 'RAM USAGE', val: isSystemActive ? `${metrics.ram}%` : '--', raw: metrics.ram, colorClass: 'text-cyan-400', bgClass: 'bg-cyan-500', shadowClass: 'shadow-[0_0_8px_#06b6d4]', bgGradient: 'from-cyan-950/30 to-black/60' },
    { icon: <Thermometer size={16} />, label: 'TEMP', val: isSystemActive ? `${metrics.temp}°C` : '--', raw: Math.min((metrics.temp / 90) * 100, 100), colorClass: 'text-orange-400', bgClass: 'bg-orange-500', shadowClass: 'shadow-[0_0_8px_#f97316]', bgGradient: 'from-orange-950/30 to-black/60' },
    { icon: <Monitor size={16} />, label: 'PORTAL', val: isSystemActive ? 'ONLINE' : '--', raw: 0, colorClass: 'text-purple-400', bgClass: 'bg-purple-500', shadowClass: '', bgGradient: 'from-purple-950/30 to-black/60', hideBar: true },
  ];

  return (
    <div className="w-full p-4">
      <div className="h-[calc(100vh-6.5rem)] min-h-[600px] w-full bg-black text-zinc-100 font-sans overflow-hidden select-none flex flex-col relative rounded-2xl border border-emerald-500/20 shadow-2xl">
        {/* ===== TOP BAR (IRIS chrome) ===== */}
        <div className="h-14 w-full flex items-center justify-between px-6 bg-zinc-950/80 border-b border-white/5 z-50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-emerald-500 text-xl animate-pulse" size={22} />
            <div className="flex flex-col leading-none">
              <span className="font-black tracking-[0.2em] text-sm text-zinc-100">IRIS AI</span>
              <span className="text-[11px] font-mono text-emerald-500/60 tracking-widest">NEURAL INTERFACE</span>
            </div>
          </div>
          <div className="flex items-center gap-6 text-[11px] font-mono font-bold opacity-60">
            <div className={`flex items-center gap-2 ${isSystemActive ? 'text-emerald-500' : 'text-zinc-600'}`}>
              <Wifi size={14} /> <span>{isSystemActive ? 'LINKED' : 'STANDBY'}</span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <BatteryCharging size={14} /> <span>100%</span>
            </div>
            <div className="bg-zinc-800 px-2 py-1 rounded text-zinc-300">{time.toLocaleTimeString()}</div>
          </div>
        </div>

        {/* ===== BODY GRID ===== */}
        <div className="flex-1 overflow-hidden relative bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-zinc-900/50 via-black to-black">
          <div className="flex-1 p-4 grid grid-cols-12 gap-4 h-full overflow-hidden relative w-full">

            {/* ---- LEFT: telemetry ---- */}
            <div className="hidden lg:flex col-span-3 flex-col gap-4 h-full z-40">
              {/* Network telemetry */}
              <div className={`${glassPanel} h-32 shrink-0 p-4 flex flex-col justify-between relative overflow-hidden`}>
                <div className={`absolute inset-0 bg-linear-to-r from-emerald-500/5 to-transparent transition-opacity duration-1000 ${isSystemActive ? 'opacity-100' : 'opacity-0'}`} />
                <div className="flex items-center justify-between border-b border-white/10 pb-2 relative z-10">
                  <span className="text-[10px] font-bold tracking-widest text-zinc-400 flex items-center gap-1">
                    <Activity size={12} className={isSystemActive ? 'text-emerald-500 animate-pulse' : ''} /> NETWORK TELEMETRY
                  </span>
                  <span className={`text-[8px] px-2 py-0.5 rounded-full font-mono font-bold border ${isSystemActive ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-zinc-600 border-zinc-800 bg-zinc-900'}`}>
                    {isSystemActive ? 'SECURE UPLINK' : 'STANDBY'}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 relative z-10">
                  <div className="flex flex-col">
                    <span className="text-[8px] text-zinc-600 font-mono tracking-widest">WSS LATENCY</span>
                    <span className="text-xs font-bold text-emerald-50 font-mono flex items-center gap-1.5">
                      <Wifi size={11} className={isSystemActive ? 'text-emerald-400' : 'text-zinc-600'} />
                      {isSystemActive ? `${net.ping}ms` : '--'}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] text-zinc-600 font-mono tracking-widest">PACKET RATE</span>
                    <span className="text-xs font-bold text-emerald-50 font-mono">{isSystemActive ? `${net.rate} MB/s` : '--'}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] text-zinc-600 font-mono tracking-widest">ROUTING</span>
                    <span className="text-xs font-bold text-emerald-50 font-mono flex items-center gap-1.5">
                      {isSystemActive ? 'GLOBAL' : 'LOCAL'}
                      {isSystemActive ? <Globe size={11} className="text-cyan-400" /> : <Server size={11} className="text-zinc-500" />}
                    </span>
                  </div>
                </div>
                <div className="w-full flex flex-col gap-1 mt-3 relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-[7px] font-mono text-zinc-500 w-3">TX</span>
                    <div className="flex-1 h-1 bg-black/60 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 shadow-[0_0_8px_#10b981] transition-all duration-300 ease-out" style={{ width: `${isSystemActive ? net.tx : 0}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[7px] font-mono text-zinc-500 w-3">RX</span>
                    <div className="flex-1 h-1 bg-black/60 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 shadow-[0_0_8px_#06b6d4] transition-all duration-300 ease-out delay-75" style={{ width: `${isSystemActive ? net.rx : 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Core metrics */}
              <div className={`${glassPanel} flex-1 p-4 flex flex-col gap-3`}>
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-[10px] font-bold tracking-widest text-zinc-400 flex items-center gap-1">
                    <Cpu size={12} /> CORE METRICS
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 h-full pb-1">
                  {systemMetrics.map((m, i) => (
                    <div key={i} className={`relative rounded-xl p-3 flex flex-col justify-between border border-white/5 overflow-hidden group hover:border-white/10 transition-all duration-300 bg-linear-to-br ${m.bgGradient}`}>
                      <div className="relative z-10 flex justify-between items-start text-zinc-500">
                        <span className={`text-base ${m.colorClass} opacity-70 group-hover:opacity-100 transition-opacity`}>{m.icon}</span>
                        <span className="text-[8px] font-mono tracking-widest uppercase opacity-70 text-zinc-300">{m.label}</span>
                      </div>
                      <div className="relative z-10 flex flex-col gap-1.5 mt-2">
                        <span className="text-sm font-bold text-white text-right font-mono tracking-wider drop-shadow-md">{m.val}</span>
                        {!m.hideBar && (
                          <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden border border-white/5">
                            <div className={`h-full ${m.bgClass} ${m.shadowClass} transition-all duration-700 ease-out`} style={{ width: isSystemActive ? `${m.raw}%` : '0%' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ---- CENTER: orb + dock ---- */}
            <div className="col-span-12 lg:col-span-6 relative flex flex-col items-center justify-center">
              <div className={`w-[52vh] h-[52vh] max-w-full transition-all duration-1000 ${isSystemActive ? 'opacity-100 scale-100' : 'opacity-85 scale-90 grayscale'}`}>
                <OrbBoundary>
                  <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-emerald-500/40 font-mono text-[10px] tracking-widest">INITIALISING CORE…</div>}>
                    <IrisSphere active={isSystemActive} service={irisVoice} />
                  </Suspense>
                </OrbBoundary>
              </div>

              <div className="absolute bottom-6 z-50">
                <div className={`${glassPanel} px-6 py-3 rounded-full flex items-center gap-6 border border-emerald-500/20 shadow-[0_0_30px_rgba(0,0,0,0.5)]`}>
                  <button
                    type="button"
                    title="Vision (voice module — coming soon)"
                    className="cursor-pointer p-3 rounded-full transition-all hover:bg-white/10 text-zinc-400"
                  >
                    <Camera size={20} />
                  </button>
                  <button type="button" onClick={handleToggleVoice} className="relative group mx-2" title={isSystemActive ? 'End voice session' : 'Talk to IRIS'}>
                    <div className={`cursor-pointer p-4 rounded-full border-2 transition-all duration-500 ${isSystemActive ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_20px_#10b981]' : 'bg-red-500/10 border-red-500/50 text-red-500'}`}>
                      <Phone size={24} className={isSystemActive ? 'animate-pulse' : ''} />
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleMic}
                    disabled={!isSystemActive}
                    title={isSystemActive ? (isMicMuted ? 'Unmute mic' : 'Mute mic') : 'Start a voice session first'}
                    className={`cursor-pointer p-3 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isMicMuted ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}
                  >
                    {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                </div>
              </div>
            </div>

            {/* ---- RIGHT: transcript ---- */}
            <div className="hidden lg:flex col-span-3 flex-col overflow-hidden h-full z-40">
              <div className={`${glassPanel} h-full p-4 flex flex-col`}>
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-2">
                  <span className="text-[10px] font-bold tracking-widest text-zinc-400 flex items-center gap-1">
                    <Terminal size={12} /> TRANSCRIPT
                  </span>
                  <span className="text-[8px] font-mono text-emerald-500/50">LIVE-LOG</span>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-2 opacity-50">
                      <History size={24} />
                      <span className="text-[9px] tracking-widest uppercase font-mono">No Data Stream</span>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[95%] py-2 px-3 rounded-lg text-[11px] leading-relaxed border font-mono font-semibold whitespace-pre-line ${msg.role === 'user' ? 'bg-emerald-900/20 border-emerald-500/20 text-emerald-100/90 rounded-br-none' : 'bg-zinc-900/50 border-white/5 text-zinc-400 rounded-bl-none'}`}>
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Pending action confirm card */}
                  {pendingAction && (
                    <div className="flex flex-col items-start">
                      <div className="max-w-[95%] w-full bg-zinc-900/70 border border-amber-400/40 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-amber-400 mb-2">
                          {pendingIcon} Confirm Action
                        </div>
                        <p className="text-[11px] font-semibold text-zinc-200 leading-relaxed font-mono whitespace-pre-line">
                          {pendingAction.summary || 'Please confirm this action.'}
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <button type="button" onClick={handleConfirm} disabled={isConfirming} className="flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-md transition-all bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-60">
                            {isConfirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Confirm
                          </button>
                          <button type="button" onClick={handleCancel} disabled={isConfirming} className="flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-md transition-all bg-white/5 border border-white/10 text-zinc-400 hover:text-red-400 hover:border-red-500/30 disabled:opacity-60">
                            <XCircle className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Typing indicator */}
                  {isSending && (
                    <div className="flex items-start">
                      <div className="bg-zinc-900/50 border border-white/5 rounded-lg px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== COMMAND BAR ===== */}
        <form onSubmit={handleSend} className="shrink-0 border-t border-white/5 bg-zinc-950/80 backdrop-blur-md p-3 flex items-center gap-3 z-50">
          <div className="flex items-center gap-2 text-emerald-500/60 pl-2">
            <Terminal size={16} />
            <span className="hidden sm:inline text-[9px] font-mono tracking-widest">COMMAND</span>
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask IRIS to collect a fee or broadcast a notice…"
            disabled={isSending}
            className="flex-1 px-4 py-2.5 bg-black/40 border border-white/10 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all rounded-xl font-mono text-[12px] text-emerald-50 placeholder:text-zinc-600 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="flex items-center justify-center gap-2 text-[11px] font-black px-5 py-2.5 rounded-xl transition-all bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="hidden sm:inline tracking-widest">SEND</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default AiAssistant;
