import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Compass,
  ArrowRight,
  Shield,
  Layers,
  Cpu,
  Ruler,
  Terminal,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

interface LandingPageProps {
  onNavigateDashboard: () => void;
  onNavigateLogin: () => void;
  onNavigateRegister: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigateDashboard,
  onNavigateLogin,
  onNavigateRegister,
}) => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800/80 px-6 max-w-7xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-cyan-500/20">
            <Compass size={19} className="stroke-[2.5]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-extrabold tracking-wider text-base text-white">NOVA CAD AI</span>
            <span className="text-[10px] font-mono uppercase text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
              Phase 1
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <button
              id="landing-enter-dashboard-btn"
              onClick={onNavigateDashboard}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer flex items-center gap-2"
            >
              <span>Go to Dashboard ({user?.name.split(' ')[0]})</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <>
              <button
                id="landing-signin-btn"
                onClick={onNavigateLogin}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                id="landing-get-started-btn"
                onClick={onNavigateRegister}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/10 transition-all cursor-pointer"
              >
                Get Started
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-16 lg:py-24 flex flex-col items-center text-center">
        {/* Foundation Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-cyan-500/30 text-cyan-300 text-xs font-mono mb-8">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>PHASE 1 FOUNDATION • ACTIVE ARCHITECTURE</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight max-w-4xl leading-[1.1]">
          NOVA CAD AI
        </h1>
        <p className="text-xl sm:text-2xl font-light text-slate-300 mt-4 max-w-2xl">
          Professional CAD. Reimagined with AI.
        </p>

        <p className="text-sm text-slate-400 max-w-2xl mt-4 leading-relaxed">
          The precision engineering workspace foundation. Experience pixel-accurate HTML5 Canvas coordinate projection, cryptographic project ownership isolation, dynamic metric & imperial unit grids, and reliable snapshot persistence.
        </p>

        {/* CTA Group */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <button
            id="hero-launch-btn"
            onClick={isAuthenticated ? onNavigateDashboard : onNavigateLogin}
            className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-cyan-500/25 transition-all cursor-pointer flex items-center gap-2"
          >
            <span>{isAuthenticated ? 'Open Project Dashboard' : 'Launch CAD Workspace'}</span>
            <ArrowRight size={16} />
          </button>

          {!isAuthenticated && (
            <button
              id="hero-demo-btn"
              onClick={onNavigateLogin}
              className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-sm font-semibold transition-colors cursor-pointer"
            >
              Sign in with Demo Account
            </button>
          )}
        </div>

        {/* Phase 1 Highlights Bento */}
        <div className="mt-16 sm:mt-24 grid grid-cols-1 md:grid-cols-3 gap-5 w-full text-left">
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800/40 text-cyan-400 flex items-center justify-center mb-4">
              <Ruler size={20} />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">True Mathematical Coordinate Grid</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Standard Cartesian coordinates with positive-Y elevation, adaptive grid steps, scale bar calibration, and millimeter-to-feet metric/imperial switching.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 flex items-center justify-center mb-4">
              <Shield size={20} />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Secure Ownership & Isolation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Server-enforced authorization with PBKDF2 hashing, HMAC token authentication, and strict tenant isolation—User A never accesses User B’s drawings.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/40 text-purple-400 flex items-center justify-center mb-4">
              <Terminal size={20} />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Engineering Foundation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Interactive Pan & Zoom, CLI command interpreter, project version snapshots, and responsive layouts across Desktop, Tablet, and Mobile devices.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 px-6 text-center text-xs text-slate-500">
        <p>NOVA CAD AI • Phase 1 Foundation • All core services verified</p>
      </footer>
    </div>
  );
};
