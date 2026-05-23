import React from 'react';
import { CalendarCheck2, Fingerprint } from 'lucide-react';

const Attendance = () => {
  return (
    <div className="w-full min-h-screen bg-[#D9D9D9] flex items-center justify-center p-4 overflow-hidden relative">
      <style>{`
        @keyframes ripplePulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.2), 0 0 0 10px rgba(16, 185, 129, 0.1); }
          100% { box-shadow: 0 0 0 15px rgba(16, 185, 129, 0), 0 0 0 30px rgba(16, 185, 129, 0); }
        }
        .animate-ripple { animation: ripplePulse 2s infinite ease-out; }
      `}</style>

      {/* Background Ambience Overlays */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl pointer-events-none" />

      {/* Structural Card Container */}
      <div className="bg-white/80 backdrop-blur-md border border-neutral-300 p-8 md:p-12 rounded-3xl shadow-xl max-w-md w-full text-center relative flex flex-col items-center gap-5">
        
        {/* Interactive Biometric Checkpoint Visualizer */}
        <div className="w-20 h-20 bg-emerald-50 border-2 border-emerald-200 text-emerald-800 rounded-full flex items-center justify-center relative animate-ripple">
          <CalendarCheck2 className="w-9 h-9" />
          <div className="absolute top-0 right-0 bg-emerald-600 text-white p-1 rounded-full border-2 border-white">
            <Fingerprint className="w-3.5 h-3.5 animate-pulse" />
          </div>
        </div>

        {/* Text Systems */}
        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase tracking-widest text-neutral-900">Attendance Tracker</h2>
          <p className="text-xs font-mono font-bold text-emerald-800 tracking-wider bg-emerald-100 px-3 py-1 rounded-full inline-block">
            BIOMETRIC INTEGRATION PENDING
          </p>
        </div>

        <p className="text-sm font-medium text-neutral-500 max-w-xs leading-relaxed">
          Daily registers, dynamic monthly aggregators, leave management consoles, and real-time sibling alerts coming soon.
        </p>

        {/* Loading Track Bar */}
        <div className="w-full bg-neutral-200 h-1 rounded-full mt-3 overflow-hidden">
          <div className="h-full bg-emerald-600 rounded-full w-1/2 animate-infinite-scroll translate-x-full transition-transform duration-1000 ease-in-out" 
               style={{ animation: 'rebound 2.5s infinite linear' }} />
        </div>
        <style>{`
          @keyframes rebound {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default Attendance;