import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { validatePassword, validateEmail } from '../utils/passwordPolicy';
import { PasswordStrengthMeter } from '../components/common/PasswordStrengthMeter';
import {
  Compass,
  Lock,
  Mail,
  User,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

interface RegisterPageProps {
  onNavigateLogin: () => void;
  onNavigateHome: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onNavigateLogin,
  onNavigateHome,
}) => {
  const { register, error, clearError, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});

  // Live password validation
  const passwordValidation = validatePassword(password, { email, name });
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  // Live email validation
  const isEmailValid = email.length === 0 || validateEmail(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const errors: { name?: string; email?: string } = {};
    if (!name.trim() || name.trim().length < 2) {
      errors.name = 'Please provide your full name (at least 2 characters).';
    }
    if (!email.trim() || !validateEmail(email)) {
      errors.email = 'Please provide a valid email address.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    if (!passwordValidation.isValid) {
      return;
    }

    if (!passwordsMatch) {
      return;
    }

    if (!termsAccepted) {
      return;
    }

    try {
      await register(email.trim(), name.trim(), password, confirmPassword);
    } catch {
      // Error is caught and surfaced in AuthContext
    }
  };

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

      {/* Main Register Card */}
      <div className="max-w-lg w-full mx-auto px-4 py-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-500" />

          {/* Header */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-[11px] font-semibold mb-2">
              <ShieldCheck size={13} />
              <span>OWASP Enterprise Authentication</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Create CAD Account</h1>
            <p className="text-xs text-slate-400 mt-1">
              Initialize your calibrated repository with Argon2id cryptographic encryption.
            </p>
          </div>

          {error && (
            <div
              id="register-error-banner"
              className="mb-5 p-3 rounded-lg bg-rose-950/50 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300"
            >
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label
                    htmlFor="register-name"
                    className="block text-xs font-semibold text-slate-300 mb-1"
                  >
                    Full Name
                  </label>
                  <div className="relative">
                    <User
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      id="register-name"
                      type="text"
                      required
                      placeholder="Elena Rostova"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                      }}
                      className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                    />
                  </div>
                  {fieldErrors.name && (
                    <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.name}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="register-email"
                    className="block text-xs font-semibold text-slate-300 mb-1"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      id="register-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="elena@studio-design.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      className={`w-full pl-9 pr-3.5 py-2 bg-slate-950 border rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none transition-colors ${
                        !isEmailValid
                          ? 'border-rose-500 focus:border-rose-500'
                          : 'border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                      }`}
                    />
                  </div>
                  {!isEmailValid && (
                    <p className="mt-1 text-[11px] text-rose-400">Please enter a valid email address.</p>
                  )}
                  {fieldErrors.email && (
                    <p className="mt-1 text-[11px] text-rose-400">{fieldErrors.email}</p>
                  )}
                </div>

                {/* Password with Show/Hide */}
                <div>
                  <label
                    htmlFor="register-password"
                    className="block text-xs font-semibold text-slate-300 mb-1"
                  >
                    Master Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      id="register-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="At least 12 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                    />
                    <button
                      type="button"
                      id="toggle-register-password-visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Password Strength Indicator & Requirements */}
                  {password.length > 0 && (
                    <PasswordStrengthMeter validation={passwordValidation} showChecklist={true} />
                  )}
                </div>

                {/* Confirm Password with Show/Hide & Live Match */}
                <div>
                  <label
                    htmlFor="register-confirm-password"
                    className="block text-xs font-semibold text-slate-300 mb-1"
                  >
                    Confirm Master Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      id="register-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Re-enter your master password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                    />
                    <button
                      type="button"
                      id="toggle-confirm-password-visibility"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Match Indicator */}
                  {confirmPassword.length > 0 && (
                    <div className="mt-1 text-[11px]">
                      {passwordsMatch ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-medium">
                          <CheckCircle2 size={13} /> Passwords match
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1 font-medium">
                          <AlertCircle size={13} /> Passwords do not match
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Terms Agreement Checkbox */}
                <div className="flex items-start gap-2 pt-1">
                  <input
                    id="accept-terms"
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  <label htmlFor="accept-terms" className="text-[11px] text-slate-400 leading-tight">
                    I accept the NOVA CAD AI enterprise terms of service, strict data ownership, and automated project versioning policies.
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  id="register-submit-button"
                  type="submit"
                  disabled={isLoading || !passwordValidation.isValid || !passwordsMatch || !termsAccepted}
                  className="w-full py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Hashing with Argon2id & Provisioning...</span>
                    </>
                  ) : (
                    <>
                      <span>Create CAD Account</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <button
              id="navigate-login-link"
              onClick={onNavigateLogin}
              className="text-cyan-400 font-semibold hover:text-cyan-300 hover:underline cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 text-center text-[11px] text-slate-500">
        NOVA CAD AI • Hardened Authentication Architecture
      </div>
    </div>
  );
};
