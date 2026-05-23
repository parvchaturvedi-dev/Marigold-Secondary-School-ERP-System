import React from 'react';
import { Contact2, Sparkles } from 'lucide-react';

const IdCard = () => {
  return (
    <div className="w-full min-h-screen bg-[#D9D9D9] flex items-center justify-center p-4 overflow-hidden relative">
      {/* Inline Scannable Grid Keyframe Animations */}
      <style>{`
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.03); opacity: 1; filter: drop-shadow(0 0 25px rgba(59, 130, 246, 0.4)); }
        }
        @keyframes scanBar {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        .animate-glow { animation: pulseGlow 4s infinite ease-in-out; }
        .animate-scan { animation: scanBar 3s infinite linear; }
      `}</style>

      {/* Decorative Blur Vectors */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-300/30 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-indigo-300/30 rounded-full blur-3xl" />

      {/* Main Glassmorphic Module Shell */}
      <div className="animate-glow bg-white/80 backdrop-blur-md border border-neutral-300 p-8 md:p-12 rounded-3xl shadow-xl max-w-md w-full text-center relative overflow-hidden flex flex-col items-center gap-5">
        
        {/* Animated Scanner Effect Line */}
        <div className="absolute left-0 w-full h-0.5 bg-blue-600/40 shadow-[0_0_10px_#2563eb] animate-scan pointer-events-none" />

        {/* Center Graphic Badge */}
        <div className="w-20 h-20 bg-blue-50 border-2 border-blue-200 text-blue-900 rounded-2xl flex items-center justify-center shadow-inner relative">
          <Contact2 className="w-10 h-10" />
          <Sparkles className="w-5 h-5 absolute -top-1 -right-1 text-blue-600 animate-bounce" />
        </div>

        {/* Text Engine */}
        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase tracking-widest text-neutral-900">ID Card Generation</h2>
          <p className="text-xs font-mono font-bold text-blue-800 tracking-wider bg-blue-100/60 px-3 py-1 rounded-full inline-block">
            MODULE PIPELINE: INITIALIZING
          </p>
        </div>

        <p className="text-sm font-medium text-neutral-500 max-w-xs leading-relaxed">
          Dynamic automated layout editor, sibling physical print links, and QR-code identifier engines are arriving shortly.
        </p>

        {/* Loading Bar Simulator */}
        <div className="w-full bg-neutral-200 h-1.5 rounded-full mt-2 overflow-hidden p-0.5 border border-neutral-300">
          <div className="bg-gradient-to-r from-blue-700 to-cyan-500 h-full rounded-full w-2/3 animate-pulse" />
        </div>
      </div>
    </div>
  );
};

export default IdCard;