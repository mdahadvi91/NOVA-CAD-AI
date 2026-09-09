import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Compass, Lock, Mail, ArrowRight, AlertCircle, KeyRound } from 'lucide-react';

interface LoginPageProps {
  onNavigateRegister: () => void;
  onNavigateHome: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onNavigateRegister,
  onNavigateHome,
}) => {
  const { login, error, clearError, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    if (!email.trim() || !password) {
      setLocalError('Please enter both your email address and password.');
      return;
    }

    try {
      await login(email.trim(), password);
    } catch {
      // Error handled by AuthContext
    }
  };

  const handleFillDemo = () => {
    setEmail('demo@novacad.ai');
    setPassword('password123');
    clearError();
    setLocalError(null);
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Simple Brand Bar */}
      <div className="p-6">
        <div
          onClick={onNavigateHome}
          className="inline-flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-cyan-500 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <Compass size={18} className="stroke-[2.5]" />
          </div>
          <span className="font-extrabold tracking-wider text-sm text-white">NOVA CAD AI</span>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto px-4 py-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle accent border */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-500" />

          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-white tracking-tight">Sign In to NOVA CAD</h1>
            <p className="text-xs text-slate-400 mt-1">
              Access your calibrated workspaces and CAD project files.
            </p>
          </div>

          {displayError && (
            <div
              id="login-error-banner"
              className="mb-5 p-3 rounded-lg bg-rose-950/50 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300"
            >
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="architect@novacad.ai"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="text-xs font-semibold text-slate-300"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                />
              </div>
            </div>

            <button
              id="login-submit-button"
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating Session...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Demo User Fast-Fill Badge */}
          <div className="mt-5 pt-4 border-t border-slate-800">
            <button
              type="button"
              id="fill-demo-credentials-btn"
              onClick={handleFillDemo}
              className="w-full py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-cyan-300 font-mono flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <KeyRound size={14} className="text-cyan-400" />
              <span>Use Demo Account (demo@novacad.ai)</span>
            </button>
          </div>

          <div className="mt-6 text-center text-xs text-slate-400">
            Don&apos;t have an account yet?{' '}
            <button
              id="navigate-register-link"
              onClick={onNavigateRegister}
              className="text-cyan-400 font-semibold hover:text-cyan-300 hover:underline cursor-pointer"
            >
              Create Account
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 text-center text-[11px] text-slate-500">
        NOVA CAD AI • Phase 1 Foundation Architecture
      </div>
    </div>
  );
};
