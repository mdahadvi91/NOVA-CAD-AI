import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { validatePassword, validateEmail } from '../../utils/passwordPolicy';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { X, Mail, KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  onSuccess: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
  onSuccess,
}) => {
  const { forgotPassword, resetPassword, isLoading } = useAuth();
  const [step, setStep] = useState<'request' | 'reset' | 'success'>('request');
  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const passwordValidation = validatePassword(newPassword, { email });
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      await forgotPassword(email.trim());
      setStep('reset');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request password reset.';
      setError(msg);
    }
  };

  const handleApplyReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token.trim()) {
      setError('Reset token is required.');
      return;
    }

    if (!passwordValidation.isValid) {
      setError(passwordValidation.feedback[0] || 'Password does not meet enterprise security requirements.');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await resetPassword(token.trim(), newPassword);
      setStep('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset failed.';
      setError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
        >
          <X size={18} />
        </button>

        {step === 'request' && (
          <div>
            <div className="flex items-center gap-2.5 mb-3 text-cyan-400">
              <KeyRound size={20} />
              <h2 className="text-base font-bold text-white">Reset CAD Account Password</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Enter your registered email address. We will generate a secure, one-hour reset link to restore your workspace credentials.
            </p>

            {error && (
              <div className="mb-4 p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-300">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="architect@novacad.ai"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="request-reset-btn"
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 'reset' && (
          <div>
            <div className="flex items-center gap-2.5 mb-2 text-cyan-400">
              <Lock size={20} />
              <h2 className="text-base font-bold text-white">Set New Password</h2>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Configure a hardened OWASP-compliant password for <span className="text-slate-200 font-semibold">{email}</span>.
            </p>

            {error && (
              <div className="mb-3 p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-300">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleApplyReset} className="space-y-3">
              <div>
                <label htmlFor="reset-token" className="block text-xs font-semibold text-slate-300 mb-1">
                  Reset Token
                </label>
                <input
                  id="reset-token"
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste 64-character token"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label htmlFor="new-password" className="block text-xs font-semibold text-slate-300 mb-1">
                  New Password (min 12 characters)
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {newPassword.length > 0 && (
                  <PasswordStrengthMeter validation={passwordValidation} showChecklist={true} />
                )}
              </div>

              <div>
                <label htmlFor="confirm-new-password" className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirm-new-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <div className="mt-1 text-[11px] flex items-center gap-1.5">
                    {passwordsMatch ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={13} /> Passwords match
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertCircle size={13} /> Passwords do not match
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Back
                </button>
                <button
                  id="submit-new-password-btn"
                  type="submit"
                  disabled={isLoading || !passwordValidation.isValid || !passwordsMatch}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? 'Updating...' : 'Save & Protect Account'}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
              <CheckCircle2 size={26} />
            </div>
            <h2 className="text-base font-bold text-white mb-1">Password Successfully Updated</h2>
            <p className="text-xs text-slate-400 mb-5">
              Your credentials have been securely hashed with Argon2id and all prior sessions have been invalidated for security.
            </p>
            <button
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="w-full py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              <span>Sign In with New Password</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
