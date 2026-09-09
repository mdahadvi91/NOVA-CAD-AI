import React from 'react';
import { CheckCircle2, RefreshCw, AlertTriangle, AlertCircle } from 'lucide-react';
import { SaveStatus } from '../../types';

interface StatusPillProps {
  status: SaveStatus;
  lastSavedAt?: string;
  onClick?: () => void;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, lastSavedAt, onClick }) => {
  const config = {
    saved: {
      bg: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400',
      icon: <CheckCircle2 size={13} className="text-emerald-400" />,
      label: 'Saved',
    },
    saving: {
      bg: 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300',
      icon: <RefreshCw size={13} className="text-cyan-400 animate-spin" />,
      label: 'Saving...',
    },
    unsaved: {
      bg: 'bg-amber-950/60 border-amber-500/40 text-amber-300',
      icon: <AlertTriangle size={13} className="text-amber-400" />,
      label: 'Unsaved Changes',
    },
    error: {
      bg: 'bg-rose-950/60 border-rose-500/40 text-rose-300',
      icon: <AlertCircle size={13} className="text-rose-400" />,
      label: 'Save Failed',
    },
  }[status];

  return (
    <button
      id="save-status-pill"
      type="button"
      onClick={onClick}
      title={lastSavedAt ? `Last saved: ${new Date(lastSavedAt).toLocaleTimeString()}` : 'Save status'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${config.bg} ${
        onClick ? 'cursor-pointer hover:opacity-85' : 'cursor-default'
      }`}
    >
      {config.icon}
      <span>{config.label}</span>
    </button>
  );
};
