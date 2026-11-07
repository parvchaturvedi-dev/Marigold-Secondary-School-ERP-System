import React from 'react';

/**
 * Fixed decorative gradient backdrop for the whole app.
 * Pure visual layer — sits behind everything, never captures pointer events.
 */
const AuroraBackground = () => (
  <div className="fixed inset-0 -z-10 pointer-events-none bg-[#fdfdfd]" aria-hidden="true" />
);

export default AuroraBackground;
