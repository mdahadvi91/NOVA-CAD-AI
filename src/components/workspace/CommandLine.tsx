import React, { useState, useRef, useEffect } from 'react';
import { Terminal, ChevronUp, ChevronDown, CheckCircle2, CornerDownLeft } from 'lucide-react';
import { CommandLog, UnitType } from '../../types';

interface CommandLineProps {
  cursorCoords: { worldX: number; worldY: number };
  zoom: number;
  gridVisible: boolean;
  gridSnap: boolean;
  units: UnitType;
  onExecuteCommand: (cmd: string) => { success: boolean; message: string };
  commandLogs: CommandLog[];
}

export const CommandLine: React.FC<CommandLineProps> = ({
  cursorCoords,
  zoom,
  gridVisible,
  gridSnap,
  units,
  onExecuteCommand,
  commandLogs,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [commandLogs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    onExecuteCommand(trimmed);
    setInputVal('');
  };

  return (
    <footer
      id="cad-bottom-command-area"
      className="bg-slate-900/95 border-t border-slate-800 text-slate-300 select-none z-20 flex flex-col"
    >
      {/* Expanded Terminal Output Log */}
      {isExpanded && (
        <div
          ref={scrollRef}
          className="h-28 overflow-y-auto p-2.5 bg-slate-950 font-mono text-[11px] space-y-1 border-b border-slate-800 select-text"
        >
          {commandLogs.length === 0 ? (
            <p className="text-slate-400">
              NOVA CAD Command Line Engine. Type &apos;HELP&apos; to view foundation commands.
            </p>
          ) : (
            commandLogs.map((log) => (
              <div
                key={log.id}
                className={`leading-relaxed ${
                  log.type === 'input'
                    ? 'text-cyan-400'
                    : log.type === 'error'
                    ? 'text-rose-400'
                    : log.type === 'success'
                    ? 'text-emerald-400'
                    : 'text-slate-300'
                }`}
              >
                <span className="text-slate-400 mr-1.5 font-sans text-[10px]">
                  {log.timestamp}
                </span>
                {log.text}
              </div>
            ))
          )}
        </div>
      )}

      {/* Interactive Command Bar & Status Row */}
      <div className="h-9 px-3 flex items-center justify-between gap-3 text-xs">
        {/* Left: Terminal Input Prompt */}
        <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2 max-w-xl">
          <button
            type="button"
            id="toggle-cli-history-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-cyan-400 p-0.5 rounded transition-colors"
            title={isExpanded ? 'Minimize Command History' : 'Expand Command History'}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <div className="flex items-center gap-1 font-mono text-cyan-400 font-bold text-[11px]">
            <Terminal size={13} />
            <span>COMMAND:</span>
          </div>
          <input
            ref={inputRef}
            id="cad-cli-input"
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Enter command (e.g. ZOOM, PAN, GRID, RESET, HELP)..."
            className="flex-1 bg-transparent border-none text-slate-100 font-mono text-[11px] focus:outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            className="text-slate-400 hover:text-cyan-400 p-1 rounded"
            title="Execute"
          >
            <CornerDownLeft size={13} />
          </button>
        </form>

        {/* Right: Live CAD Coordinates & Status Badges */}
        <div className="flex items-center gap-2 sm:gap-4 font-mono text-[11px] shrink-0">
          {/* Coordinates Readout */}
          <div
            id="status-coords"
            className="hidden sm:flex items-center gap-3 bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-slate-200"
          >
            <div>
              <span className="text-rose-400 font-semibold">X:</span>{' '}
              <span>{cursorCoords.worldX.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-emerald-400 font-semibold">Y:</span>{' '}
              <span>{cursorCoords.worldY.toFixed(2)}</span>
            </div>
            <span className="text-slate-400 font-bold uppercase">{units}</span>
          </div>

          {/* Quick status pills */}
          <div className="flex items-center gap-1.5">
            <span
              id="status-zoom-pill"
              className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]"
              title="Current Zoom factor"
            >
              {(zoom * 100).toFixed(0)}%
            </span>

            <span
              id="status-grid-pill"
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                gridVisible
                  ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/40'
                  : 'bg-slate-950 text-slate-400'
              }`}
            >
              GRID
            </span>

            <span
              id="status-snap-pill"
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                gridSnap
                  ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/40'
                  : 'bg-slate-950 text-slate-400'
              }`}
            >
              SNAP
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
