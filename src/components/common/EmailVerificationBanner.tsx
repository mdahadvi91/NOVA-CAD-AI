import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react';

export const EmailVerificationBanner: React.FC = () => {
  const { user, verifyEmail, resendVerification, isLoading } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.emailVerified || isDismissed) {
    return null;
  }

  const handleResend = async () => {
    setError(null);
    setFeedback(null);
    try {
      const res = await resendVerification();
      setFeedback(res.message || 'Verification token dispatched.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification.');
    }
  };

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setError(null);
    setFeedback(null);
    try {
      const msg = await verifyEmail(tokenInput.trim());
      setFeedback(msg);
      setTimeout(() => setIsModalOpen(false), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    }
  };

  return (
    <>
      {/* Top Warning Banner */}
      <div
        id="email-verification-banner"
        className="bg-amber-950/70 border-b border-amber-600/30 px-4 py-2 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2 shadow-inner"
      >
        <div className="flex items-center gap-2">
          <Mail size={15} className="text-amber-400 shrink-0" />
          <span>
            <strong className="font-semibold text-amber-300">Action Required:</strong> Please verify your email (
            <span className="font-mono text-amber-200">{user.email}</span>) to enable cloud DXF export and project sharing.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Verify Now
          </button>
          <button
            onClick={handleResend}
            disabled={isLoading}
            className="px-2 py-1 rounded hover:bg-amber-900/40 text-amber-300 text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            <span>Resend</span>
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="text-amber-400/70 hover:text-amber-300 p-0.5 rounded cursor-pointer"
            title="Dismiss temporarily"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Verification Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-2 text-amber-400">
              <Mail size={20} />
              <h2 className="text-base font-bold text-white">Verify Your Email Address</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              We sent a verification link and security token to <span className="text-slate-200 font-semibold">{user.email}</span>.
            </p>

            {feedback && (
              <div className="mb-4 p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                <span>{feedback}</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
                <AlertCircle size={16} className="shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleManualVerify} className="space-y-4">
              <div>
                <label htmlFor="token-input" className="block text-xs font-semibold text-slate-300 mb-1">
                  Verification Token
                </label>
                <input
                  id="token-input"
                  type="text"
                  required
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Paste 64-character verification token"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isLoading}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Resend token
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    id="submit-verify-token-btn"
                    type="submit"
                    disabled={isLoading || !tokenInput.trim()}
                    className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? 'Verifying...' : 'Verify Email'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
