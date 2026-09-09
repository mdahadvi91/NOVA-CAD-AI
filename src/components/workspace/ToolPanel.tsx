import React from 'react';
import {
  MousePointer,
  Hand,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Grid,
  Magnet,
  Info,
} from 'lucide-react';
import { WorkspaceTool, ViewState } from '../../types';

interface ToolPanelProps {
  activeTool: WorkspaceTool;
  onSelectTool: (tool: WorkspaceTool) => void;
  viewState: ViewState;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFitView: () => void;
  onOpenInfo: () => void;
}

export const ToolPanel: React.FC<ToolPanelProps> = ({
  activeTool,
  onSelectTool,
  viewState,
  onToggleGrid,
  onToggleSnap,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitView,
  onOpenInfo,
}) => {
  return (
    <aside
      id="cad-left-toolpanel"
      className="bg-slate-900 border-r border-slate-800 flex flex-col justify-between py-3 px-2 z-20 select-none"
    >
      {/* Primary Foundation Tools */}
      <div className="flex flex-col items-center gap-1.5">
        <button
          id="tool-select"
          onClick={() => onSelectTool('select')}
          title="Pointer / Selection (V)"
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            activeTool === 'select'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-sm shadow-cyan-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <MousePointer size={17} />
        </button>

        <button
          id="tool-pan"
          onClick={() => onSelectTool('pan')}
          title="Pan View (H / Middle Mouse Drag)"
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            activeTool === 'pan'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-sm shadow-cyan-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Hand size={17} />
        </button>

        <div className="w-6 h-[1px] bg-slate-800 my-1" />

        {/* View Zoom & Navigation Controls */}
        <button
          id="tool-zoom-in"
          onClick={onZoomIn}
          title="Zoom In (+)"
          className="w-9 h-9 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
        >
          <ZoomIn size={17} />
        </button>

        <button
          id="tool-zoom-out"
          onClick={onZoomOut}
          title="Zoom Out (-)"
          className="w-9 h-9 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
        >
          <ZoomOut size={17} />
        </button>

        <button
          id="tool-fit-view"
          onClick={onFitView}
          title="Zoom Extents / Fit Calibration"
          className="w-9 h-9 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
        >
          <Maximize2 size={17} />
        </button>

        <button
          id="tool-reset-origin"
          onClick={onResetView}
          title="Reset View to Origin (0,0)"
          className="w-9 h-9 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
        >
          <RotateCcw size={17} />
        </button>

        <div className="w-6 h-[1px] bg-slate-800 my-1" />

        {/* Grid & Snap Helpers */}
        <button
          id="tool-toggle-grid"
          onClick={onToggleGrid}
          title={`Toggle Grid (${viewState.gridVisible ? 'ON' : 'OFF'}) [G]`}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            viewState.gridVisible
              ? 'bg-cyan-950/40 text-cyan-300 border border-cyan-600/40'
              : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Grid size={17} />
        </button>

        <button
          id="tool-toggle-snap"
          onClick={onToggleSnap}
          title={`Toggle Grid Snap (${viewState.gridSnap ? 'ON' : 'OFF'}) [F9]`}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            viewState.gridSnap
              ? 'bg-cyan-950/40 text-cyan-300 border border-cyan-600/40'
              : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Magnet size={17} />
        </button>
      </div>

      {/* Bottom Tool info */}
      <div className="flex flex-col items-center gap-2">
        <button
          id="tool-phase-info"
          onClick={onOpenInfo}
          title="Phase 1 Architectural Scope & Controls"
          className="w-9 h-9 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
        >
          <Info size={17} />
        </button>
      </div>
    </aside>
  );
};
