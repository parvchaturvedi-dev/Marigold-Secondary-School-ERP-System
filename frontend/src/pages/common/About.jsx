import React from 'react';
import {
  Info,
  Code,
  Calendar,
  User,
  Layers,
  GraduationCap,
  Heart,
} from 'lucide-react';

const details = [
  { label: 'Version', value: '1.0.0', icon: Info },
  { label: 'Release Date', value: '05 July 2026', icon: Calendar },
  { label: 'Developer', value: 'Parv Chaturvedi', icon: User },
  {
    label: 'Platform',
    value: 'React · Node/Express · MongoDB · React Native/Expo',
    icon: Layers,
  },
];

const About = () => {
  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      {/* Header card */}
      <div className="glass-card rounded-3xl border border-white/60 shadow-[0_20px_60px_rgba(79,70,229,0.10)] p-8 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-gradient-to-br from-indigo-400/20 to-violet-400/20 blur-3xl" />

        <div className="relative flex items-start gap-5">
          <div className="w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <GraduationCap className="w-8 h-8 text-white" strokeWidth={2} />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-indigo-500 mb-1.5">
              <Info className="w-3.5 h-3.5" />
              About Us
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">
              MGPS ERP — Marigold Secondary School
            </h1>
            <p className="mt-3 text-slate-500 text-sm leading-relaxed max-w-2xl">
              A unified school management platform that connects admins, clerks,
              teachers, and students. From admissions, attendance, examinations,
              and finance to timetables, notices, and digital documents — MGPS ERP
              brings the entire school onto a single, modern portal.
            </p>
          </div>
        </div>
      </div>

      {/* Developer highlight */}
      <div className="glass-card rounded-3xl border border-white/60 shadow-sm p-6 flex items-center gap-4">
        <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border border-white/70 flex items-center justify-center">
          <Code className="w-6 h-6 text-indigo-500" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
            Developed by
          </p>
          <p className="text-xl font-black text-slate-800">Parv Chaturvedi</p>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {details.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="glass-card rounded-2xl border border-white/60 shadow-sm p-5 flex items-center gap-4"
          >
            <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-white/70 flex items-center justify-center">
              <Icon className="w-5 h-5 text-indigo-500" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {label}
              </p>
              <p className="text-sm font-bold text-slate-800 truncate" title={value}>
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-1.5 text-[13px] text-slate-400 pt-2">
        <span>© 2026 Parv Chaturvedi</span>
        <span className="text-slate-300">·</span>
        <span className="inline-flex items-center gap-1">
          Built with <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" /> for Marigold
        </span>
      </div>
    </div>
  );
};

export default About;
