import React from 'react';

/**
 * Fixed decorative gradient backdrop for the whole app.
 * Pure visual layer — sits behind everything, never captures pointer events.
 */
const AuroraBackground = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-sky-50 to-fuchsia-50" />
    <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-indigo-300/30 blur-[120px] animate-float" />
    <div className="absolute top-1/3 -right-44 w-[560px] h-[560px] rounded-full bg-sky-300/30 blur-[130px] animate-floatSlow" />
    <div
      className="absolute -bottom-44 left-1/4 w-[520px] h-[520px] rounded-full bg-fuchsia-300/25 blur-[140px] animate-float"
      style={{ animationDelay: '6s' }}
    />
    <div
      className="absolute top-10 left-1/2 w-[380px] h-[380px] rounded-full bg-violet-200/30 blur-[110px] animate-floatSlow"
      style={{ animationDelay: '3s' }}
    />
  </div>
);

export default AuroraBackground;
