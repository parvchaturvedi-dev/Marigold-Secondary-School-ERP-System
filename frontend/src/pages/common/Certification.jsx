import React from 'react';
import { Award, Sparkles, BadgeCheck } from 'lucide-react';

const Certification = () => {
  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center p-6">
      <div className="glass-card rounded-3xl w-full max-w-2xl text-center px-8 py-14 border border-white/60 shadow-[0_20px_60px_rgba(79,70,229,0.12)] relative overflow-hidden">
        {/* Soft accent glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-gradient-to-br from-indigo-400/20 to-violet-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-gradient-to-br from-violet-400/20 to-indigo-400/20 blur-3xl" />

        <div className="relative flex flex-col items-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-6">
            <Award className="w-10 h-10 text-white" strokeWidth={2} />
          </div>

          <h1 className="text-3xl font-black tracking-tight text-slate-800">
            Certifications
          </h1>

          <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-300 px-3 py-1.5 rounded-full">
            <Sparkles className="w-3.5 h-3.5" />
            Coming Soon
          </span>

          <p className="mt-6 text-slate-500 text-sm leading-relaxed max-w-md">
            Digital certificates &amp; achievement records for students and staff are on
            the way. Soon you&apos;ll be able to generate, verify, and share
            beautifully designed credentials right from here.
          </p>

          <div className="mt-8 flex items-center gap-2 text-[13px] font-semibold text-indigo-500">
            <BadgeCheck className="w-4 h-4" />
            Verified, shareable &amp; tamper-proof
          </div>
        </div>
      </div>
    </div>
  );
};

export default Certification;
