import React from 'react';

// Isolates the WebGL orb: if Three.js / react-three-fiber ever fails (no GPU,
// context loss, React mismatch, etc.) we show a calm fallback instead of letting
// the error bubble up and blank the whole portal page.
export default class OrbBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.warn('[IRIS] Orb failed to render:', error?.message || error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-40 h-40 rounded-full border border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_60px_rgba(16,185,129,0.25)] animate-pulse flex items-center justify-center">
            <span className="text-[9px] font-mono tracking-widest text-emerald-500/60 text-center px-4">
              NEURAL CORE<br />STANDBY
            </span>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
