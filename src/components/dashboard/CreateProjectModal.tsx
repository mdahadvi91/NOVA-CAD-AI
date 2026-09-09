import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { UnitType } from '../../types';
import { Ruler, AlertCircle } from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; units: UnitType }) => Promise<void>;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [units, setUnits] = useState<UnitType>('mm');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a project name.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        units,
      });
      setName('');
      setDescription('');
      setUnits('mm');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal id="create-project-modal" isOpen={isOpen} onClose={onClose} title="Create New CAD Project">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg flex items-center gap-2 text-xs text-red-300">
            <AlertCircle size={15} className="shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor="new-project-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
            Project Name <span className="text-cyan-400">*</span>
          </label>
          <input
            id="new-project-name"
            type="text"
            required
            placeholder="e.g. Master Floor Plan Level 1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
          />
        </div>

        <div>
          <label htmlFor="new-project-description" className="block text-xs font-semibold text-slate-300 mb-1.5">
            Description / Notes (Optional)
          </label>
          <textarea
            id="new-project-description"
            rows={3}
            placeholder="e.g. Primary residential layout for architectural coordination."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Ruler size={13} className="text-cyan-400" />
            <span>Measurement Units</span>
          </label>
          <div className="grid grid-cols-5 gap-2">
            {(['mm', 'cm', 'm', 'in', 'ft'] as UnitType[]).map((u) => (
              <button
                key={u}
                type="button"
                id={`unit-select-${u}`}
                onClick={() => setUnits(u)}
                className={`py-2 px-1 text-center rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer border ${
                  units === u
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {u.toUpperCase()}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Metric (mm, cm, m) or Imperial (in, ft) coordinate grid reference.
          </p>
        </div>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            id="cancel-create-project-btn"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            id="submit-create-project-btn"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Initializing Project...' : 'Create Project'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
