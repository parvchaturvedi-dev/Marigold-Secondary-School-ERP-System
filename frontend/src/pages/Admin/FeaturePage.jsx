import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  Download,
  FileText,
  Mail,
  Mic,
  MicOff,
  PauseCircle,
  PhoneCall,
  PhoneOff,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Undo2,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch } from '../../services/api';

const SCHOOL_NAME = 'Marigold Secondary School, Behror';
const AI_ENDPOINT = '/api/ai';
const CHART_COLORS = ['#111827', '#E1FA6C', '#2563EB', '#DC2626', '#16A34A'];

const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const createConversationId = () => `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const formatCurrency = (value) =>
  `Rs. ${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;

const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

const getBestSpeechVoice = (text = '') => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices?.() || [];
  const needsHindi = /[\u0900-\u097F]/.test(text);
  const preferred = needsHindi
    ? [
        (voice) => voice.lang?.toLowerCase() === 'hi-in',
        (voice) => /hindi|हिन्दी|हिंदी/i.test(voice.name || ''),
        (voice) => voice.lang?.toLowerCase().startsWith('hi'),
      ]
    : [
        (voice) => voice.lang?.toLowerCase() === 'en-in',
        (voice) => /india|indian/i.test(voice.name || ''),
        (voice) => voice.lang?.toLowerCase().startsWith('en'),
      ];

  for (const matcher of preferred) {
    const voice = voices.find(matcher);
    if (voice) return voice;
  }
  return null;
};

const createMessage = (sender, payload) => ({
  id: `${sender}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  sender,
  timestamp: nowTime(),
  ...payload,
});

const ProviderBadge = ({ enabled, children }) => (
  <span
    className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${
      enabled
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-amber-200 bg-amber-50 text-amber-700'
    }`}
  >
    {children}: {enabled ? 'Ready' : 'Mock'}
  </span>
);

const providerOptions = [
  { value: 'groq', label: 'Groq Fast', description: 'Fast replies' },
  { value: 'gemini', label: 'Gemini Brain', description: 'Reasoning' },
];

const initialAiMessage = () =>
  createMessage('ai', {
    text: `Namaste. Main ${SCHOOL_NAME} ki AI assistant hoon. Main sirf live ERP context se short, point-to-point answers dungi.`,
    elements: [],
    actions: [],
    isGreeting: true,
  });

const buildHistoryPayload = (items = []) =>
  items
    .filter((message) => !message.isGreeting)
    .slice(-4)
    .map((message) => ({
      sender: message.sender,
      text: message.text,
    }));

const shouldEndCall = (text = '') =>
  /(\bend call\b|\bstop call\b|\bhang up\b|call\s*(band|bund|बंद)|बात\s*बंद|कॉल\s*बंद)/i.test(String(text || ''));

const DataTable = ({ element }) => {
  const rows = Array.isArray(element.rows) ? element.rows : [];
  const columns = rows.length ? Object.keys(rows[0]).slice(0, 7) : [];

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4 text-xs font-semibold text-neutral-500">
        No table rows available.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-500">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 font-black">
                {column.replace(/([A-Z])/g, ' $1')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row, rowIndex) => (
            <tr key={`${element.title}-${rowIndex}`} className="hover:bg-neutral-50">
              {columns.map((column) => (
                <td key={column} className="px-3 py-2 font-semibold text-neutral-700">
                  {typeof row[column] === 'number' && column.toLowerCase().includes('fee')
                    ? formatCurrency(row[column])
                    : String(row[column] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ChartElement = ({ element }) => {
  const data = Array.isArray(element.data) ? element.data : [];
  if (!data.length) return null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-black text-neutral-800">
        <BarChart3 className="h-4 w-4" />
        {element.title}
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {element.chartType === 'pie' ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={76} paddingAngle={2}>
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => (Number(value) > 100 ? formatCurrency(value) : value)} />
              <Legend />
            </PieChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value) => (Number(value) > 100 ? formatCurrency(value) : value)} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#111827" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const StudentCard = ({ student = {} }) => (
  <div className="rounded-xl border border-neutral-200 bg-white p-4 text-xs">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wide text-neutral-500">Student Profile</p>
        <h4 className="mt-1 text-sm font-black text-neutral-950">{student.name || student.displayName}</h4>
        <p className="mt-1 font-semibold text-neutral-600">
          {student.className || student.class} | Admission: {student.admissionNumber}
        </p>
      </div>
      <span className="rounded-full bg-[#E1FA6C] px-3 py-1 text-[10px] font-black text-neutral-950">
        {student.status || 'Active'}
      </span>
    </div>
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <p className="rounded-lg bg-neutral-50 p-2 font-semibold">Father: {student.fatherName || '-'}</p>
      <p className="rounded-lg bg-neutral-50 p-2 font-semibold">Mother: {student.motherName || '-'}</p>
      <p className="rounded-lg bg-neutral-50 p-2 font-semibold">Mobile: {student.guardianPhone || '-'}</p>
      <p className="rounded-lg bg-neutral-50 p-2 font-semibold">Email: {student.guardianEmail || '-'}</p>
    </div>
  </div>
);

const AssistantElements = ({ elements = [] }) => (
  <div className="mt-3 space-y-3">
    {elements.map((element, index) => {
      if (element.type === 'chart') return <ChartElement key={`${element.title}-${index}`} element={element} />;
      if (element.type === 'table') return <DataTable key={`${element.title}-${index}`} element={element} />;
      if (element.type === 'student-card') {
        return <StudentCard key={`${element.student?.admissionNumber || index}`} student={element.student} />;
      }
      return null;
    })}
  </div>
);

const ReceiptCard = ({ receipt, onDownload, onSend }) => {
  if (!receipt) return null;

  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Receipt Generated</p>
          <h4 className="mt-1 text-sm font-black text-neutral-950">{receipt.receiptNo}</h4>
          <p className="mt-1 font-semibold text-neutral-700">Amount: {formatCurrency(receipt.amountPaid)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onDownload(receipt)}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[10px] font-black"
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </button>
          <button
            type="button"
            onClick={() => onSend(receipt)}
            className="inline-flex items-center gap-1 rounded-lg bg-neutral-950 px-3 py-2 text-[10px] font-black text-white"
          >
            <Mail className="h-3.5 w-3.5" />
            Gmail / WhatsApp
          </button>
        </div>
      </div>
      <div className="mt-3 rounded-lg bg-white p-3">
        {(receipt.breakdown || []).map((item) => (
          <div key={item.admissionNumber || item.name} className="flex justify-between gap-3 font-semibold">
            <span>{item.name}</span>
            <span>{formatCurrency(item.allocated)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ConfirmationModal = ({ pendingAction, onCancel, onConfirm, isWorking }) => {
  if (!pendingAction) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-50 p-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-neutral-950">Are you sure you want to perform this action?</h3>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-neutral-600">
              {pendingAction.label || pendingAction.type} will be recorded in the ERP audit log.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isWorking}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-xs font-black text-neutral-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isWorking}
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2 text-xs font-black text-white disabled:opacity-60"
          >
            {isWorking && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

const FeaturePage = () => {
  const chatEndRef = useRef(null);
  const conversationIdRef = useRef(createConversationId());
  const messagesRef = useRef([]);
  const recognitionRef = useRef(null);
  const startRecognitionRef = useRef(null);
  const speechAudioRef = useRef(null);
  const callActiveRef = useRef(false);
  const [config, setConfig] = useState({
    defaultProvider: 'development-fallback',
    providers: { gemini: false, groq: false },
    role: '',
  });
  const [provider, setProvider] = useState('gemini');
  const [mode, setMode] = useState('chat');
  const [input, setInput] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [messages, setMessages] = useState(() => {
    const initialMessages = [initialAiMessage()];
    messagesRef.current = initialMessages;
    return initialMessages;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [isActionWorking, setIsActionWorking] = useState(false);

  const speechSupported = useMemo(() => Boolean(getSpeechRecognition()), []);

  useEffect(() => {
    let active = true;
    apiFetch(`${AI_ENDPOINT}/config`)
      .then((payload) => {
        if (!active) return;
        setConfig(payload);
        setProvider(payload.defaultProvider === 'gemini' ? 'gemini' : 'groq');
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    callActiveRef.current = isCallActive;
  }, [isCallActive]);

  useEffect(() => {
    window.speechSynthesis?.getVoices?.();
    return () => {
      window.speechSynthesis?.cancel();
      speechAudioRef.current?.pause?.();
      recognitionRef.current?.stop?.();
      callActiveRef.current = false;
    };
  }, []);

  const speak = async (text) => {
    if (isMuted || !text || typeof window === 'undefined') return Promise.resolve();
    const speechText = /[\u0900-\u097F]/.test(text) ? text : text.replace(/\bAI\b/g, 'ए आई');
    window.speechSynthesis?.cancel();
    speechAudioRef.current?.pause?.();
    speechAudioRef.current = null;
    setIsSpeaking(true);

    try {
      const payload = await apiFetch(`${AI_ENDPOINT}/voice/speak`, {
        method: 'POST',
        body: { text: speechText },
      });
      if (payload.audioBase64 && payload.mimeType) {
        const audio = new Audio(`data:${payload.mimeType};base64,${payload.audioBase64}`);
        speechAudioRef.current = audio;
        audio.onplay = () => setIsSpeaking(true);
        audio.onended = () => {
          setIsSpeaking(false);
          speechAudioRef.current = null;
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          speechAudioRef.current = null;
        };
        await audio.play();
        return new Promise((resolve) => {
          audio.onended = () => {
            setIsSpeaking(false);
            speechAudioRef.current = null;
            resolve();
          };
          audio.onerror = () => {
            setIsSpeaking(false);
            speechAudioRef.current = null;
            resolve();
          };
        });
      }
    } catch {
      // Browser speech still works when the server voice endpoint is unavailable.
    }

    if (!window.speechSynthesis) {
      setIsSpeaking(false);
      return Promise.resolve();
    }
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = /[\u0900-\u097F]/.test(speechText) ? 'hi-IN' : 'en-IN';
    const voice = getBestSpeechVoice(speechText);
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    const done = new Promise((resolve) => {
      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        resolve();
      };
    });
    window.speechSynthesis.speak(utterance);
    return done;
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    speechAudioRef.current?.pause?.();
    speechAudioRef.current = null;
    setIsSpeaking(false);
  };

  const appendAiMessage = (payload, options = {}) => {
    const nextMessage = createMessage('ai', payload);
    setMessages((current) => {
      const nextMessages = [...current, nextMessage];
      messagesRef.current = nextMessages;
      return nextMessages;
    });
    if (options.speak ?? mode === 'voice') {
      speak(payload.text);
    }
  };

  const submitPrompt = async (prompt = input) => {
    const trimmed = String(prompt || '').trim();
    if (!trimmed || isLoading) return;

    setInput('');
    setError('');
    setLastPrompt(trimmed);
    const requestHistory = buildHistoryPayload(messagesRef.current);
    setMessages((current) => {
      const nextMessages = [
        ...current,
        createMessage('user', { text: trimmed, elements: [], actions: [] }),
      ];
      messagesRef.current = nextMessages;
      return nextMessages;
    });
    setIsLoading(true);

    try {
      const payload = await apiFetch(`${AI_ENDPOINT}/chat`, {
        method: 'POST',
        body: {
          message: trimmed,
          provider,
          conversationId: conversationIdRef.current,
          history: requestHistory,
        },
      });

      appendAiMessage({
        text: payload.text,
        provider: payload.provider,
        elements: payload.elements || [],
        actions: payload.actions || [],
        fallbackAttempts: payload.fallbackAttempts || [],
      });
    } catch (submitError) {
      setError(submitError.message);
      setMessages((current) => {
        const nextMessages = [
          ...current,
          createMessage('ai', {
            text: `I could not complete that request: ${submitError.message}`,
            error: true,
            elements: [],
            actions: [],
          }),
        ];
        messagesRef.current = nextMessages;
        return nextMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const retryLastPrompt = () => {
    if (lastPrompt) submitPrompt(lastPrompt);
  };

  const endVoiceCall = (message = 'Voice call ended.') => {
    callActiveRef.current = false;
    setIsCallActive(false);
    recognitionRef.current?.stop?.();
    setIsListening(false);
    stopSpeaking();
    setMessages((current) => {
      const nextMessages = [...current, createMessage('ai', { text: message, elements: [], actions: [] })];
      messagesRef.current = nextMessages;
      return nextMessages;
    });
  };

  const startRecognition = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setError('Speech-to-text is not supported in this browser.');
      return false;
    }

    if (isListening || isLoading || isSpeaking) return false;

    const recognition = new Recognition();
    recognition.lang = 'hi-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event) => {
      setError(event.error || 'Microphone input failed.');
      setIsListening(false);
    };
    recognition.onresult = async (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (shouldEndCall(transcript)) {
        endVoiceCall('Voice call ended by instruction.');
        return;
      }
      setInput(transcript);
      try {
        await apiFetch(`${AI_ENDPOINT}/voice/transcribe`, {
          method: 'POST',
          body: { text: transcript },
        });
      } catch {
        // The browser transcript is already usable.
      }
      submitPrompt(transcript);
    };
    recognitionRef.current = recognition;
    recognition.start();
    return true;
  };
  startRecognitionRef.current = startRecognition;

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    startRecognition();
  };

  const startVoiceCall = () => {
    setMode('voice');
    callActiveRef.current = true;
    setIsCallActive(true);
    startRecognition();
  };

  useEffect(() => {
    if (!isCallActive || mode !== 'voice' || isListening || isLoading || isSpeaking || pendingAction) return;
    const timer = window.setTimeout(() => {
      if (callActiveRef.current) startRecognitionRef.current?.();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [isCallActive, mode, isListening, isLoading, isSpeaking, pendingAction]);

  const searchStudent = async (event) => {
    event.preventDefault();
    const query = studentQuery.trim();
    if (!query) return;

    setError('');
    setIsLoading(true);
    try {
      const payload = await apiFetch(`${AI_ENDPOINT}/student-details`, {
        method: 'POST',
        body: { query },
      });
      appendAiMessage({
        text: `Student profile loaded for ${payload.student.profile.name}.`,
        elements: [
          { type: 'student-card', student: payload.student.profile },
          {
            type: 'chart',
            chartType: 'bar',
            title: 'Fee Summary',
            data: [
              { name: 'Assigned', value: payload.student.finance.assignedFees },
              { name: 'Paid', value: payload.student.finance.paidFees },
              { name: 'Pending', value: payload.student.finance.pendingFees },
            ],
          },
          {
            type: 'chart',
            chartType: 'pie',
            title: 'Attendance',
            data: [
              { name: 'Present', value: payload.student.attendance.attendancePercentage },
              {
                name: 'Absent/Unmarked',
                value: Math.max(0, 100 - payload.student.attendance.attendancePercentage),
              },
            ],
          },
        ],
        actions: [],
      });
      setStudentQuery('');
    } catch (searchError) {
      setError(searchError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadReceiptPdf = (receipt) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(SCHOOL_NAME, 16, 18);
    doc.setFontSize(12);
    doc.text('Fee Receipt', 16, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Receipt No: ${receipt.receiptNo}`, 16, 42);
    doc.text(`Date: ${new Date(receipt.timestamp || Date.now()).toLocaleString()}`, 16, 50);
    doc.text(`Amount Paid: ${formatCurrency(receipt.amountPaid)}`, 16, 58);
    doc.text(`Father/Guardian: ${receipt.familyDetails?.fatherName || '-'}`, 16, 66);
    doc.text(`Contact: ${receipt.familyDetails?.contact || '-'}`, 16, 74);
    doc.text('Breakdown', 16, 90);
    let y = 100;
    (receipt.breakdown || []).forEach((item) => {
      doc.text(`${item.name || item.admissionNumber}: ${formatCurrency(item.allocated)}`, 20, y);
      y += 8;
    });
    doc.text('Authorized by AI action workflow with admin confirmation.', 16, Math.max(y + 12, 122));
    doc.save(`${receipt.receiptNo}.pdf`);
  };

  const resetChat = () => {
    const freshMessages = [initialAiMessage()];
    conversationIdRef.current = createConversationId();
    messagesRef.current = freshMessages;
    setMessages(freshMessages);
    setError('');
    setInput('');
    setLastPrompt('');
    setPendingAction(null);
  };

  const exportChatPdf = () => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`${SCHOOL_NAME} - AI Assistant Transcript`, 14, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    let y = 28;
    messages.forEach((message) => {
      const label = `${message.sender === 'ai' ? 'AI' : 'User'} (${message.timestamp || ''})`;
      const lines = doc.splitTextToSize(`${label}: ${message.text || ''}`, 182);
      lines.forEach((line) => {
        if (y > 282) {
          doc.addPage();
          y = 18;
        }
        doc.text(line, 14, y);
        y += 6;
      });
      y += 2;
    });

    doc.save(`ai-chat-transcript-${Date.now()}.pdf`);
  };

  const openConfirmation = (action) => {
    setPendingAction(action);
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    setIsActionWorking(true);
    setError('');

    try {
      const payload = await apiFetch(`${AI_ENDPOINT}/actions/execute`, {
        method: 'POST',
        body: {
          action: pendingAction.type,
          payload: pendingAction.payload,
          confirmed: true,
        },
      });
      const result = payload.result || {};
      const undoAction = payload.undoAction
        ? [{ id: `undo-${Date.now()}`, sensitive: true, ...payload.undoAction }]
        : [];
      appendAiMessage({
        text: (() => {
          if (pendingAction.type === 'finance_payment') {
            return `Payment recorded successfully. Receipt ${result.receipt?.receiptNo} is ready.`;
          }
          if (pendingAction.type === 'finance_ledger_charge') {
            return `Ledger updated successfully. Pending fees are now ${formatCurrency(result.student?.pendingFees)}.`;
          }
          if (pendingAction.type === 'undo_last_ai_action') {
            return `Undo completed. Reverted ${result.undoneAction || 'the selected AI action'}.`;
          }
          return 'Action completed successfully.';
        })(),
        elements: [],
        actions: undoAction,
        result,
      });
      setPendingAction(null);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setIsActionWorking(false);
    }
  };

  const confirmReceiptSend = (receipt) => {
    openConfirmation({
      type: 'receipt_send',
      label: `Send receipt ${receipt.receiptNo} through Gmail and WhatsApp`,
      payload: {
        receiptNo: receipt.receiptNo,
        channels: ['gmail', 'whatsapp'],
      },
    });
  };

  return (
    <div className="h-[calc(100vh-73px)] overflow-hidden bg-[#F4F4F2] p-3 text-neutral-950 md:p-6">
      <div className="mx-auto flex h-full max-w-7xl min-h-0 flex-col gap-4">
        <section className="shrink-0 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-neutral-950 p-3 text-[#E1FA6C]">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight md:text-xl">
                  AI Assistant for {SCHOOL_NAME}
                </h1>
                <p className="mt-1 max-w-3xl text-xs font-semibold leading-relaxed text-neutral-600">
                  School-specific assistant for concise answers from live ERP context only.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ProviderBadge enabled={config.providers?.gemini}>Gemini</ProviderBadge>
                  <ProviderBadge enabled={config.providers?.groq}>Groq</ProviderBadge>
                  <ProviderBadge enabled={config.tts?.ready}>AI4Bharat TTS</ProviderBadge>
                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-black uppercase text-neutral-600">
                    Role: {config.role || 'Authenticated'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={resetChat}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-black text-neutral-700"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
              <button
                type="button"
                onClick={exportChatPdf}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-black text-neutral-700"
              >
                <FileText className="h-4 w-4" />
                Export PDF
              </button>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-1">
                {['chat', 'voice'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMode(item)}
                    className={`rounded-lg px-3 py-2 text-xs font-black capitalize ${
                      mode === item ? 'bg-neutral-950 text-white' : 'text-neutral-600'
                    }`}
                  >
                    {item === 'voice' ? 'Speaking Assistant' : 'Chatting Assistant'}
                  </button>
                ))}
              </div>
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-black outline-none"
              >
                {providerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="min-h-0 space-y-4 overflow-y-auto pr-1">
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-black">Student Search</h2>
              <p className="mt-1 text-xs font-semibold text-neutral-500">
                Search by admission number, name, father name, class, or mobile.
              </p>
              <form onSubmit={searchStudent} className="mt-3 flex gap-2">
                <input
                  value={studentQuery}
                  onChange={(event) => setStudentQuery(event.target.value)}
                  placeholder="ADM / name / mobile..."
                  className="min-w-0 flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold outline-none focus:border-neutral-950"
                />
                <button
                  type="submit"
                  disabled={!studentQuery.trim() || isLoading}
                  className="rounded-xl bg-neutral-950 p-2.5 text-white disabled:opacity-40"
                  title="Search student"
                >
                  <Search className="h-4 w-4" />
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-black">Voice Controls</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={isCallActive ? () => endVoiceCall('Voice call ended.') : startVoiceCall}
                  disabled={mode !== 'voice' || !speechSupported}
                  className={`col-span-2 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${
                    isCallActive ? 'bg-red-600 text-white' : 'bg-neutral-950 text-white'
                  } disabled:opacity-40`}
                >
                  {isCallActive ? <PhoneOff className="h-4 w-4" /> : <PhoneCall className="h-4 w-4" />}
                  {isCallActive ? 'End Call' : 'Start Call'}
                </button>
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={mode !== 'voice' || !speechSupported || isCallActive}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${
                    isListening
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-800'
                  } disabled:opacity-40`}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {isListening ? 'Stop' : 'Speak'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsMuted((value) => !value)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-black"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  {isMuted ? 'Muted' : 'Voice'}
                </button>
                <button
                  type="button"
                  onClick={stopSpeaking}
                  disabled={!isSpeaking}
                  className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-black disabled:opacity-40"
                >
                  <PauseCircle className="h-4 w-4" />
                  Stop Speaking
                </button>
              </div>
              {isCallActive && (
                <p className="mt-2 text-[11px] font-semibold text-emerald-700">
                  Continuous call is active. Say "end call" to stop.
                </p>
              )}
              {!speechSupported && (
                <p className="mt-2 text-[11px] font-semibold text-amber-700">
                  Browser microphone speech recognition is not available here.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-black">
                <ShieldCheck className="h-4 w-4" />
                Security Rules
              </h2>
              <div className="mt-3 space-y-2 text-xs font-semibold text-neutral-600">
                <p>Only Admin can run full AI action mode.</p>
                <p>Sensitive actions always require confirmation.</p>
                <p>API keys and secrets never leave the backend.</p>
                <p>The assistant is limited to {SCHOOL_NAME}.</p>
              </div>
            </section>
          </aside>

          <main className="flex min-h-0 flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="shrink-0 border-b border-neutral-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-black">
                    <Sparkles className="h-4 w-4 text-lime-600" />
                    Conversation
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-neutral-500">
                    {providerOptions.find((option) => option.value === provider)?.description || 'AI'} mode.
                    {' '}Use chat for typed messages or speaking assistant for microphone input and spoken replies.
                  </p>
                </div>
                {error && (
                  <button
                    type="button"
                    onClick={retryLastPrompt}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </button>
                )}
              </div>
              {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-neutral-50 p-4">
              {messages.map((message) => {
                const isAi = message.sender === 'ai';
                return (
                  <div key={message.id} className={`flex gap-3 ${isAi ? 'justify-start' : 'justify-end'}`}>
                    {isAi && (
                      <div className="h-9 w-9 shrink-0 rounded-xl bg-neutral-950 p-2 text-[#E1FA6C]">
                        <Bot className="h-5 w-5" />
                      </div>
                    )}
                    <div className={`max-w-[900px] ${isAi ? 'w-full' : 'w-auto'}`}>
                      <div
                        className={`rounded-2xl border p-3 text-sm font-semibold leading-relaxed ${
                          isAi
                            ? 'border-neutral-200 bg-white text-neutral-800'
                            : 'border-neutral-950 bg-neutral-950 text-white'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.text}</p>
                        {message.provider && (
                          <p className="mt-2 text-[10px] font-black uppercase text-neutral-400">
                            Provider: {message.provider}
                          </p>
                        )}
                      </div>
                      <AssistantElements elements={message.elements} />
                      <ReceiptCard
                        receipt={message.result?.receipt || message.result?.result?.receipt}
                        onDownload={downloadReceiptPdf}
                        onSend={confirmReceiptSend}
                      />
                      {Array.isArray(message.actions) && message.actions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.actions.map((action) => (
                            <button
                              key={action.id || action.label}
                              type="button"
                              onClick={() => openConfirmation(action)}
                              className="inline-flex items-center gap-2 rounded-xl bg-[#E1FA6C] px-3 py-2 text-xs font-black text-neutral-950"
                            >
                              {action.type === 'undo_last_ai_action' ? (
                                <Undo2 className="h-4 w-4" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <span className="mt-1 block px-1 text-[10px] font-bold text-neutral-400">
                        {message.timestamp}
                      </span>
                    </div>
                    {!isAi && (
                      <div className="h-9 w-9 shrink-0 rounded-xl bg-[#E1FA6C] p-2 text-neutral-950">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-wide text-neutral-500">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  AI is reading ERP data...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={(event) => { event.preventDefault(); submitPrompt(); }} className="shrink-0 border-t border-neutral-200 p-3">
              <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-2">
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={mode !== 'voice' || !speechSupported || isCallActive}
                  className={`rounded-xl p-2.5 ${
                    isListening ? 'bg-red-100 text-red-700' : 'bg-white text-neutral-800'
                  } disabled:opacity-40`}
                  title="Use microphone"
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={isLoading}
                  placeholder="Ask: Show pending fees of Class 8, or Pay Rs. 5000 for ADM-001..."
                  className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm font-semibold outline-none placeholder:text-neutral-400"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="rounded-xl bg-neutral-950 p-3 text-white disabled:opacity-40"
                  title="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </main>
        </div>
      </div>

      <ConfirmationModal
        pendingAction={pendingAction}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmAction}
        isWorking={isActionWorking}
      />
    </div>
  );
};

export default FeaturePage;
