import React from 'react';
import { Check, X } from 'lucide-react';
import { PasswordValidationResult } from '../../utils/passwordPolicy';

interface PasswordStrengthMeterProps {
  validation: PasswordValidationResult;
  showChecklist?: boolean;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  validation,
  showChecklist = true,
}) => {
  const { score, strengthLabel, checks } = validation;

  // Segment colors based on score (0 to 4)
  const getSegmentColor = (segmentIndex: number) => {
    if (score <= 0) return 'bg-slate-800';
    if (segmentIndex > score) return 'bg-slate-800';

    switch (score) {
      case 1:
        return 'bg-rose-500';
      case 2:
        return 'bg-amber-500';
      case 3:
        return 'bg-sky-400';
      case 4:
        return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]';
      default:
        return 'bg-slate-800';
    }
  };

  const getLabelBadge = () => {
    switch (strengthLabel) {
      case 'Very Weak':
        return <span className="text-rose-400 text-[11px] font-semibold">Very Weak</span>;
      case 'Weak':
        return <span className="text-rose-400 text-[11px] font-semibold">Weak</span>;
      case 'Fair':
        return <span className="text-amber-400 text-[11px] font-semibold">Fair</span>;
      case 'Good':
        return <span className="text-sky-400 text-[11px] font-semibold">Good</span>;
      case 'Strong':
        return <span className="text-emerald-400 text-[11px] font-semibold">Strong</span>;
    }
  };

  return (
    <div id="password-strength-container" className="space-y-2 mt-2">
      {/* 4-bar Progress meter + Strength Label */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 grid grid-cols-4 gap-1.5 h-1.5">
          <div className={`rounded-full transition-colors duration-200 ${getSegmentColor(1)}`} />
          <div className={`rounded-full transition-colors duration-200 ${getSegmentColor(2)}`} />
          <div className={`rounded-full transition-colors duration-200 ${getSegmentColor(3)}`} />
          <div className={`rounded-full transition-colors duration-200 ${getSegmentColor(4)}`} />
        </div>
        <div className="shrink-0 text-right">{getLabelBadge()}</div>
      </div>

      {/* Interactive Requirement Checklist */}
      {showChecklist && (
        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1 text-[11px]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Enterprise Security Requirements (OWASP)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
            {checks.map((check) => (
              <div
                key={check.id}
                className={`flex items-center gap-1.5 transition-colors ${
                  check.passed ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                {check.passed ? (
                  <Check size={13} className="shrink-0 stroke-[2.5]" />
                ) : (
                  <X size={13} className="shrink-0 stroke-[2]" />
                )}
                <span>{check.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
