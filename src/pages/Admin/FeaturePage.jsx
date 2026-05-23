import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, Send, Sparkles, RefreshCw, Trash2, Download, X, Power } from 'lucide-react';

const FeaturePage = () => {
  const chatEndRef = useRef(null);
  const [userInput, setUserInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isResetDone, setIsResetDone] = useState(false);

  // New Cinematic States
  const [isActivating, setIsActivating] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  const [chatLog, setChatLog] = useState([
    {
      id: 'init-core',
      sender: 'ai',
      text: "System Core Initialized. I am linked via your enterprise AI API configuration. Issue direct operational inputs to manipulate database infrastructure.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  useEffect(() => {
    if (isTerminalOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatLog, isAiProcessing, isTerminalOpen]);

  // CINEMATIC SOUND HANDLERS
  // Place your audio files in standard public folder (e.g., public/sounds/activation.mp3)
 // CINEMATIC SOUND HANDLERS (With Origin Resolution & Audio Context Resume)
const playSound = (type) => {
  try {
    // Window location origin automatically resolves to the active deployment domain
    const audioUrl = `${window.location.origin}/sounds/${type === 'activate' ? 'activation.mp3' : 'deactivation.mp3'}`;
    const audio = new Audio(audioUrl);
    
    audio.volume = 0.5;

    // Browser ke Autoplay lock ko bypass karne ke liye explicitly user interaction thread par play karna
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log(`🔊 Core Audio [${type}] dispatched successfully.`);
        })
        .catch(err => {
          console.warn("⚠️ Browser Autoplay blocked the audio. Trying to force audio context...", err);
          // Fallback: Agar pehli baar me block ho, toh window touch/click context par queue kar do
          const forcePlay = () => {
            audio.play();
            window.removeEventListener('click', forcePlay);
          };
          window.addEventListener('click', forcePlay);
        });
    }
  } catch (e) {
    console.error("🚨 Audio Engine Execution Fault:", e);
  }
};

  // TRIGGER 5-SECOND ABSORPTION PIPELINE
  const handleActivationSequence = () => {
    if (isActivating || isTerminalOpen) return;
    setIsActivating(true);
    playSound('activate');

    // 5 Seconds Power Accumulation Animation Loop
    setTimeout(() => {
      setIsActivating(false);
      setIsTerminalOpen(true);
    }, 5000);
  };

  // TERMINAL CLOSE PIPELINE WITH SOUND
  const handleCloseTerminal = () => {
    playSound('deactivate');
    setIsTerminalOpen(false);
  };

  const handleResetChatRegistry = () => {
    if (window.confirm("⚠️ Action Matrix Warning: Expunge current conversation history? Once reset, PDF export for this session will be locked.")) {
      setChatLog([
        {
          id: 'init-core',
          sender: 'ai',
          text: "Memory state cleared. System listener re-anchored to production node. Ready for next instruction set.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setIsResetDone(true);
    }
  };

  const handleExportToPdf = () => {
    if (isResetDone) {
      alert("🔒 Security Lock: Cannot export log file. This chat session history has already been flushed.");
      return;
    }

    const printWindow = window.open('', '_blank');
    const chatHtmlContent = chatLog.map(log => `
      <div style="margin-bottom: 20px; padding: 15px; border-radius: 12px; background: ${log.sender === 'ai' ? '#f4f4f5' : '#e1fa6c'}; color: #1a1a1a; font-family: monospace;">
        <strong>[${log.sender.toUpperCase()}] - ${log.timestamp}</strong>
        <p style="margin-top: 8px; white-space: pre-wrap; line-height: 1.5;">${log.text}</p>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head><title>ERP_AI_Core_Log</title></head>
        <body style="font-family:sans-serif; padding:40px;">
          <h2>ERP Cognitive Core - Transcript</h2>
          <div>${chatHtmlContent}</div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCommandSubmission = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isAiProcessing) return;

    const captureUserText = userInput.trim();
    setChatLog(prev => [...prev, {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: captureUserText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    setUserInput('');
    setIsAiProcessing(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1200));
      setChatLog(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: `[API Echo Resolution Framework]: Stream payload parsed successfully for input: "${captureUserText}"`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch {
      setIsAiProcessing(false);
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <div className="w-full h-[calc(100vh-73px)] bg-[#050505] relative flex items-center justify-center overflow-hidden">
      
      {/* ADD NEON GLOWING CUSTOM STYLES DIRECTLY IN THE DOM FOR POWER RAYS */}
      <style>{`
        @keyframes rayAbsorb {
          0% { transform: rotate(0deg) scale(2); opacity: 0.1; }
          50% { opacity: 0.6; }
          100% { transform: rotate(360deg) scale(0.2); opacity: 0; }
        }
        .power-ray {
          position: absolute;
          top: 50%; left: 50%;
          width: 200%; height: 4px;
          background: linear-gradient(90deg, transparent, #E1FA6C, transparent);
          transform-origin: left center;
          animation: rayAbsorb 2s infinite linear;
        }
      `}</style>

      {/* PHASE 1: CENTRAL BIG ROUND AI ACTIVATION NODE */}
      {!isTerminalOpen && (
        <div className="relative flex flex-col items-center justify-center z-10">
          
          {/* 5-Second Rays Emission Ring */}
          {isActivating && (
            <div className="absolute inset-0 pointer-events-none w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2">
              {[...Array(12)].map((_, i) => (
                <div 
                  key={i} 
                  className="power-ray" 
                  style={{ transform: `translate(-50%, -50%) rotate(${i * 30}deg)`, animationDelay: `${i * 0.15}s` }} 
                />
              ))}
            </div>
          )}

          {/* Core Master Trigger Sphere */}
          <button
            type="button"
            onClick={handleActivationSequence}
            className={`w-40 h-40 rounded-full bg-black border flex flex-col items-center justify-center gap-3 transition-all duration-500 shadow-2xl group ${isActivating ? 'border-[#E1FA6C] scale-95 shadow-[0_0_60px_rgba(225,250,108,0.4)]' : 'border-neutral-800 hover:border-[#E1FA6C] hover:shadow-[0_0_40px_rgba(225,250,108,0.2)]'}`}
          >
            {isActivating ? (
              <RefreshCw className="w-12 h-12 text-[#E1FA6C] animate-spin" />
            ) : (
              <Power className="w-12 h-12 text-neutral-500 group-hover:text-[#E1FA6C] transition-colors duration-300" />
            )}
            <span className={`text-[10px] font-black uppercase tracking-widest ${isActivating ? 'text-[#E1FA6C]' : 'text-neutral-400 group-hover:text-white'}`}>
              {isActivating ? "Initializing..." : "Activate AI Agent"}
            </span>
          </button>
          
          <p className="text-[10px] font-mono text-neutral-600 mt-4 uppercase tracking-widest">
            {isActivating ? "Absorbing core environment metrics..." : "Click sphere node to open secured prompt environment"}
          </p>
        </div>
      )}

      {/* PHASE 2: OVERLAPPING COGNITIVE TERMINAL WINDOW (90vw / 90vh Strict Lock) */}
      {isTerminalOpen && (
        <div className="fixed inset-0 w-screen h-screen bg-black/80 backdrop-blur-md z-[999] flex items-center justify-center p-4 animate-fadeIn">
          
          <div className="w-[90vw] h-[90vh] bg-[#0A0A0A] border border-neutral-800 rounded-3xl p-5 flex flex-col justify-between relative shadow-[0_0_50px_rgba(0,0,0,0.8)] box-border overflow-hidden">
            
            {/* Ambient Background Glow Inside Popup */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[#E1FA6C]/5 rounded-full blur-[120px] pointer-events-none" />

            {/* HEADER INTERACTION CONSOLE */}
            <div className="bg-[#121212]/90 p-3.5 rounded-2xl border border-neutral-800 flex items-center justify-between z-10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center text-[#E1FA6C] border border-[#E1FA6C]/30 relative">
                  <Bot className="w-4 h-4" />
                  <span className="absolute w-1.5 h-1.5 bg-[#E1FA6C] rounded-full top-0 right-0 animate-ping" />
                </div>
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-neutral-100 flex items-center gap-1">
                    AUTOMATED COGNITIVE MODULE <Sparkles className="w-3 h-3 text-[#E1FA6C]" />
                  </h4>
                  <p className="text-[8px] text-[#E1FA6C] font-black font-mono tracking-tight mt-0.5">STATUS: SECURE TERMINAL REDIRECT</p>
                </div>
              </div>

              {/* ACTION MATRIX RIG */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExportToPdf}
                  disabled={isResetDone}
                  className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border transition-all duration-300 ${isResetDone ? 'bg-neutral-900 border-neutral-950 text-neutral-600 cursor-not-allowed' : 'bg-[#E1FA6C] text-black border-[#E1FA6C] hover:bg-[#d5ee5f]'}`}
                >
                  <Download className="w-3 h-3" /> Export PDF
                </button>

                <button
                  type="button"
                  onClick={handleResetChatRegistry}
                  className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-transparent text-neutral-400 hover:text-red-500 border border-neutral-800 hover:border-red-900/40 px-3 py-1.5 rounded-xl transition-all duration-300"
                >
                  <Trash2 className="w-3 h-3" /> Reset Chat
                </button>

                {/* VISUAL CLOSER TRAP */}
                <button
                  type="button"
                  onClick={handleCloseTerminal}
                  className="ml-2 p-1.5 bg-neutral-900 hover:bg-red-600/20 text-neutral-400 hover:text-red-500 border border-neutral-800 hover:border-red-600/40 rounded-xl transition-all duration-300"
                  title="Deactivate Core Terminal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* MESSAGE HUB FEED */}
            <div className="flex-1 overflow-y-auto my-3 p-4 space-y-4 rounded-2xl border border-neutral-900 bg-black/40 z-10 text-left scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
              {chatLog.map((log) => {
                const isAi = log.sender === 'ai';
                return (
                  <div key={log.id} className={`flex gap-3 max-w-[85%] ${isAi ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}>
                    <div className={`w-8 h-8 rounded-xl flex-shrink-0 border flex items-center justify-center ${isAi ? 'bg-black text-[#E1FA6C] border-neutral-800' : 'bg-[#E1FA6C] text-black border-[#E1FA6C]'}`}>
                      {isAi ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4 stroke-[2.5]" />}
                    </div>
                    <div className="space-y-1 max-w-[calc(100%-40px)]">
                      <div className={`p-3.5 rounded-2xl text-xs font-medium border leading-relaxed tracking-wide break-words ${isAi ? 'bg-[#121212] border-neutral-800 text-neutral-200 rounded-tl-none' : 'bg-neutral-900 border-neutral-800 text-neutral-100 rounded-tr-none'}`}>
                        <p className="whitespace-pre-wrap">{log.text}</p>
                      </div>
                      <span className="text-[8px] font-mono font-bold block opacity-40 px-1 text-neutral-400">{log.timestamp}</span>
                    </div>
                  </div>
                );
              })}

              {isAiProcessing && (
                <div className="flex gap-3 max-w-[85%] mr-auto items-center text-[10px] font-black text-[#E1FA6C] animate-pulse font-mono tracking-widest uppercase">
                  <div className="w-8 h-8 bg-black border border-neutral-800 text-[#E1FA6C] rounded-xl flex items-center justify-center shadow-lg">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  </div>
                  <span>Parsing database nodes...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* INPUT TRANSITION COMMAND BAR */}
            <div className="p-1.5 bg-[#121212]/90 backdrop-blur-md rounded-2xl border border-neutral-800 z-10 shadow-2xl flex-shrink-0">
              <form onSubmit={handleCommandSubmission} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  disabled={isAiProcessing}
                  placeholder="Ask me to mark attendance or run deep performance analytics..."
                  className="flex-1 p-3 bg-black/80 border border-neutral-900 focus:border-[#E1FA6C]/50 rounded-xl text-xs font-medium text-white placeholder-neutral-600 outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={!userInput.trim() || isAiProcessing}
                  className="p-3 bg-[#E1FA6C] text-black hover:bg-[#d5ee5f] transition-all rounded-xl disabled:opacity-20 flex-shrink-0 shadow-[0_0_15px_rgba(225,250,108,0.2)]"
                >
                  <Send className="w-4 h-4 stroke-[2.5]" />
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default FeaturePage;
