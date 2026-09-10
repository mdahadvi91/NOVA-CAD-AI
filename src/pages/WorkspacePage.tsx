import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Project,
  ProjectVersion,
  ViewState,
  WorkspaceTool,
  SaveStatus,
  CommandLog,
  UnitType,
  Layer,
} from '../types';
import { api } from '../services/api';
import { Header } from '../components/common/Header';
import { StatusPill } from '../components/common/StatusPill';
import { CadCanvas } from '../components/workspace/CadCanvas';
import { ToolPanel } from '../components/workspace/ToolPanel';
import { PropertiesPanel } from '../components/workspace/PropertiesPanel';
import { CommandLine } from '../components/workspace/CommandLine';
import { Modal } from '../components/common/Modal';
import { BillingModal } from '../components/BillingModal';
import {
  Save,
  RotateCcw,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Compass,
  Menu,
  Sliders,
  Shield,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

interface WorkspacePageProps {
  projectId: string;
  onBackToDashboard: () => void;
  onNavigateHome: () => void;
}

export const WorkspacePage: React.FC<WorkspacePageProps> = ({
  projectId,
  onBackToDashboard,
  onNavigateHome,
}) => {
  const [project, setProject] = useState<Project | null>(null);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBillingOpen, setIsBillingOpen] = useState(false);

  // Workspace View & Tool State
  const [viewState, setViewState] = useState<ViewState>({
    panX: 0,
    panY: 0,
    zoom: 1.0,
    gridVisible: true,
    gridSnap: true,
    gridSize: 20,
  });
  const [activeTool, setActiveTool] = useState<WorkspaceTool>('select');
  const [cursorCoords, setCursorCoords] = useState<{ worldX: number; worldY: number }>({
    worldX: 0,
    worldY: 0,
  });

  // Save & Autosave State
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>(undefined);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Panels & Modals
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  // Command Line Logs
  const [commandLogs, setCommandLogs] = useState<CommandLog[]>([
    {
      id: 'log_welcome',
      text: 'NOVA CAD AI Phase 1 Workspace initialized. Coordinate grid calibrated.',
      type: 'system',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const addLog = useCallback((text: string, type: CommandLog['type'] = 'output') => {
    setCommandLogs((prev) => [
      ...prev,
      {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text,
        type,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  }, []);

  // Fetch Project on Mount
  const fetchProjectData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getProject(projectId);
      setProject(res.project);
      if (res.project.drawingData?.viewState) {
        setViewState(res.project.drawingData.viewState);
      }
      setLastSavedAt(res.project.updatedAt);
      setSaveStatus('saved');
      setHasUnsavedChanges(false);

      // Fetch versions
      const versRes = await api.getProjectVersions(projectId).catch(() => ({ versions: [] }));
      setVersions(versRes.versions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Project could not be found.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  // Unsaved changes warning on window unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved CAD changes. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Explicit Save Implementation
  const handleSave = useCallback(
    async (description = 'Manual save') => {
      if (!project) return;
      try {
        setSaveStatus('saving');
        const drawingData = {
          ...project.drawingData,
          viewState,
        };

        const res = await api.saveProjectVersion(project.id, drawingData, description);
        setProject(res.project);
        setVersions((prev) => [res.version, ...prev.filter((v) => v.id !== res.version.id)]);
        setSaveStatus('saved');
        setLastSavedAt(res.project.updatedAt);
        setHasUnsavedChanges(false);
        addLog(`Project saved successfully (Version ${res.version.version}.0)`, 'success');
      } catch (err: unknown) {
        setSaveStatus('error');
        const msg = err instanceof Error ? err.message : 'Save failed';
        addLog(`Save error: ${msg}`, 'error');
      }
    },
    [project, viewState, addLog]
  );

  // Restore Project Version Implementation
  const handleRestoreVersion = useCallback(
    async (versionId: string) => {
      if (!project) return;
      try {
        const res = await api.restoreProjectVersion(project.id, versionId);
        setProject(res.project);
        setVersions((prev) => [res.version, ...prev]);
        if (res.project.drawingData?.viewState) {
          setViewState(res.project.drawingData.viewState);
        }
        setSaveStatus('saved');
        setLastSavedAt(res.project.updatedAt);
        setHasUnsavedChanges(false);
        addLog(
          `Restored workspace state to Version ${res.version.version}.0 (from historical snapshot).`,
          'success'
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Restore failed';
        alert(`Failed to restore version: ${msg}`);
        addLog(`Restore error: ${msg}`, 'error');
      }
    },
    [project, addLog]
  );

  // Autosave trigger: if unsaved changes exist, debounce save after 25 seconds
  useEffect(() => {
    if (hasUnsavedChanges) {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(() => {
        handleSave('Autosave');
      }, 25000);
    }
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [hasUnsavedChanges, handleSave]);

  // Keyboard Shortcuts (Ctrl+S, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave('Shortcut save (Ctrl+S)');
      }
      // V for Pointer
      if (e.key.toLowerCase() === 'v' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        setActiveTool('select');
      }
      // H for Hand/Pan
      if (e.key.toLowerCase() === 'h' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        setActiveTool('pan');
      }
      // G for Grid toggle
      if (e.key.toLowerCase() === 'g' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        setViewState((prev) => ({ ...prev, gridVisible: !prev.gridVisible }));
        setHasUnsavedChanges(true);
        setSaveStatus('unsaved');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Update View State handler
  const handleViewStateChange = (next: ViewState | ((prev: ViewState) => ViewState)) => {
    setViewState(next);
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
  };

  // Zoom helpers
  const handleZoomIn = () => {
    setViewState((prev) => ({ ...prev, zoom: Math.min(prev.zoom * 1.2, 50) }));
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
  };

  const handleZoomOut = () => {
    setViewState((prev) => ({ ...prev, zoom: Math.max(prev.zoom / 1.2, 0.05) }));
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
  };

  const handleResetView = () => {
    setViewState((prev) => ({
      ...prev,
      panX: 0,
      panY: 0,
      zoom: 1.0,
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
    addLog('View coordinates reset to Origin (0, 0) at 100% scale.', 'system');
  };

  const handleFitView = () => {
    // Center calibration geometry (0 to 200 mm)
    setViewState((prev) => ({
      ...prev,
      panX: -100 * prev.zoom,
      panY: 50 * prev.zoom,
      zoom: 1.2,
    }));
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
    addLog('Viewport fitted to calibration boundary.', 'system');
  };

  // Update Project Metadata
  const handleUpdateProjectMeta = async (updates: {
    name?: string;
    description?: string;
    units?: UnitType;
    gridSpacing?: number;
  }) => {
    if (!project) return;
    try {
      const res = await api.updateProject(project.id, updates);
      setProject(res.project);
      addLog(`Updated project properties (${Object.keys(updates).join(', ')})`, 'system');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Update failed');
    }
  };

  // Update Layers
  const handleUpdateLayers = (nextLayers: Layer[]) => {
    if (!project) return;
    const updatedDrawing = {
      ...project.drawingData,
      layers: nextLayers,
    };
    setProject({ ...project, drawingData: updatedDrawing });
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
  };

  // Command Line Interpreter
  const handleExecuteCommand = (cmdStr: string): { success: boolean; message: string } => {
    const trimmed = cmdStr.trim();
    addLog(`> ${trimmed}`, 'input');

    const parts = trimmed.toUpperCase().split(/\s+/);
    const verb = parts[0];
    const arg = parts[1];

    switch (verb) {
      case 'HELP': {
        const helpText =
          'Commands: ZOOM [in|out|factor|reset|fit], PAN [x y], GRID [on|off], SNAP [on|off], UNITS [mm|cm|m|in|ft], RESET, FIT, SAVE, CLEAR, INFO';
        addLog(helpText, 'system');
        return { success: true, message: helpText };
      }
      case 'SAVE': {
        handleSave('CLI Save Command');
        return { success: true, message: 'Initiating project save...' };
      }
      case 'RESET': {
        handleResetView();
        return { success: true, message: 'View reset to origin (0, 0).' };
      }
      case 'FIT': {
        handleFitView();
        return { success: true, message: 'View fitted to bounds.' };
      }
      case 'CLEAR': {
        setCommandLogs([]);
        return { success: true, message: 'Command logs cleared.' };
      }
      case 'GRID': {
        const show = arg === 'ON' ? true : arg === 'OFF' ? false : !viewState.gridVisible;
        setViewState((prev) => ({ ...prev, gridVisible: show }));
        setHasUnsavedChanges(true);
        setSaveStatus('unsaved');
        addLog(`Grid display ${show ? 'ENABLED' : 'DISABLED'}`, 'system');
        return { success: true, message: `Grid ${show ? 'ON' : 'OFF'}` };
      }
      case 'SNAP': {
        const snap = arg === 'ON' ? true : arg === 'OFF' ? false : !viewState.gridSnap;
        setViewState((prev) => ({ ...prev, gridSnap: snap }));
        setHasUnsavedChanges(true);
        setSaveStatus('unsaved');
        addLog(`Grid snapping ${snap ? 'ENABLED' : 'DISABLED'}`, 'system');
        return { success: true, message: `Snap ${snap ? 'ON' : 'OFF'}` };
      }
      case 'ZOOM': {
        if (arg === 'IN') {
          handleZoomIn();
        } else if (arg === 'OUT') {
          handleZoomOut();
        } else if (arg === 'RESET') {
          handleResetView();
        } else if (arg === 'FIT') {
          handleFitView();
        } else if (arg && !isNaN(Number(arg))) {
          const factor = Number(arg);
          setViewState((prev) => ({ ...prev, zoom: Math.min(Math.max(factor, 0.05), 50) }));
          setHasUnsavedChanges(true);
          setSaveStatus('unsaved');
          addLog(`Zoom set to ${(factor * 100).toFixed(0)}%`, 'system');
        } else {
          addLog('Usage: ZOOM [in|out|reset|fit|<factor>]', 'error');
        }
        return { success: true, message: 'Zoom adjusted' };
      }
      case 'PAN': {
        if (parts[1] && parts[2] && !isNaN(Number(parts[1])) && !isNaN(Number(parts[2]))) {
          const px = Number(parts[1]);
          const py = Number(parts[2]);
          setViewState((prev) => ({ ...prev, panX: px, panY: py }));
          setHasUnsavedChanges(true);
          setSaveStatus('unsaved');
          addLog(`Pan coordinates updated: (${px}, ${py})`, 'system');
        } else {
          setActiveTool('pan');
          addLog('Pan tool activated. Drag canvas with mouse or touch.', 'system');
        }
        return { success: true, message: 'Pan command completed' };
      }
      case 'UNITS': {
        const u = arg?.toLowerCase() as UnitType;
        if (['mm', 'cm', 'm', 'in', 'ft'].includes(u)) {
          handleUpdateProjectMeta({ units: u });
          return { success: true, message: `Units updated to ${u.toUpperCase()}` };
        } else {
          addLog('Usage: UNITS [mm|cm|m|in|ft]', 'error');
          return { success: false, message: 'Invalid units' };
        }
      }
      case 'INFO': {
        setIsInfoModalOpen(true);
        return { success: true, message: 'Displaying Phase 1 Scope & Architecture.' };
      }
      default: {
        const errMsg = `Unknown command: '${verb}'. Type 'HELP' for available CAD commands.`;
        addLog(errMsg, 'error');
        return { success: false, message: errMsg };
      }
    }
  };

  // Guard: Loading State
  if (isLoading) {
    return (
      <div
        id="workspace-loading-screen"
        className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6"
      >
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 mb-6 shadow-2xl animate-pulse">
          <Compass size={32} className="stroke-[2]" />
        </div>
        <h2 className="text-lg font-bold text-white tracking-wide mb-1">
          Loading CAD Workspace
        </h2>
        <p className="text-xs text-slate-400 font-mono">
          Mounting WebGL / Canvas coordinate engine...
        </p>
      </div>
    );
  }

  // Guard: Error State (Invalid Project ID or 403 Forbidden)
  if (error || !project) {
    return (
      <div
        id="workspace-error-screen"
        className="min-h-screen bg-slate-950 text-slate-100 flex flex-col"
      >
        <Header onNavigateHome={onNavigateHome} onNavigateDashboard={onBackToDashboard} />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
              <AlertCircle size={28} />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Project Access Failed</h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              {error || 'The requested project could not be found or access was restricted.'}
            </p>
            <button
              id="back-to-dashboard-error-btn"
              onClick={onBackToDashboard}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} /> Return to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none font-sans">
      {/* 1. TOP HEADER & APP MENU */}
      <Header
        currentProjectName={project.name}
        onNavigateHome={onNavigateHome}
        onNavigateDashboard={onBackToDashboard}
        onOpenBilling={() => setIsBillingOpen(true)}
        statusSlot={
          <div className="flex items-center gap-2 sm:gap-3">
            <StatusPill
              status={saveStatus}
              lastSavedAt={lastSavedAt}
              onClick={() => handleSave('Status pill clicked')}
            />

            <button
              id="header-save-button"
              onClick={() => handleSave('Header save button')}
              disabled={saveStatus === 'saving'}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              title="Save Project (Ctrl+S)"
            >
              <Save size={14} className="text-cyan-400" />
              <span>Save</span>
            </button>

            {/* Mobile properties drawer toggle */}
            <button
              id="mobile-props-toggle"
              onClick={() => setIsPropertiesOpen(!isPropertiesOpen)}
              className="sm:hidden p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              title="Toggle Properties"
            >
              <Sliders size={16} />
            </button>
          </div>
        }
      />

      {/* 2. MAIN CAD WORKSPACE (LEFT TOOLS, CENTER CANVAS, RIGHT PROPERTIES) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT: Tool Panel */}
        <ToolPanel
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          viewState={viewState}
          onToggleGrid={() => {
            setViewState((prev) => ({ ...prev, gridVisible: !prev.gridVisible }));
            setHasUnsavedChanges(true);
            setSaveStatus('unsaved');
          }}
          onToggleSnap={() => {
            setViewState((prev) => ({ ...prev, gridSnap: !prev.gridSnap }));
            setHasUnsavedChanges(true);
            setSaveStatus('unsaved');
          }}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onFitView={handleFitView}
          onOpenInfo={() => setIsInfoModalOpen(true)}
        />

        {/* CENTER: Interactive HTML5 CAD Canvas */}
        <main className="flex-1 h-full relative overflow-hidden bg-slate-950 flex flex-col">
          <CadCanvas
            viewState={viewState}
            onViewStateChange={handleViewStateChange}
            units={project.units}
            activeTool={activeTool}
            onCursorMove={(coords) => {
              setCursorCoords({ worldX: coords.worldX, worldY: coords.worldY });
            }}
          />

          {/* Quick HUD overlay in top-left of canvas */}
          <div className="absolute top-3 left-3 pointer-events-none flex items-center gap-2">
            <div className="bg-slate-900/85 backdrop-blur-xs px-2.5 py-1 rounded-md border border-slate-800 text-[11px] font-mono text-slate-300 shadow-lg">
              <span className="text-cyan-400 font-bold">TOOL:</span>{' '}
              <span className="uppercase">{activeTool}</span>
            </div>
          </div>
        </main>

        {/* RIGHT: Properties, Layers, and Versions Panel */}
        <PropertiesPanel
          project={project}
          viewState={viewState}
          versions={versions}
          onUpdateProjectMeta={handleUpdateProjectMeta}
          onUpdateLayers={handleUpdateLayers}
          onRestoreVersion={handleRestoreVersion}
          isOpen={isPropertiesOpen}
          onToggleOpen={() => setIsPropertiesOpen(!isPropertiesOpen)}
        />
      </div>

      {/* 3. BOTTOM: Command Line & Live Status Bar */}
      <CommandLine
        cursorCoords={cursorCoords}
        zoom={viewState.zoom}
        gridVisible={viewState.gridVisible}
        gridSnap={viewState.gridSnap}
        units={project.units}
        onExecuteCommand={handleExecuteCommand}
        commandLogs={commandLogs}
      />

      {/* Scope & Architecture Information Modal */}
      <Modal
        id="workspace-info-modal"
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        title="NOVA CAD AI — Phase 1 Architectural Foundation"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs text-slate-300">
          <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-lg flex items-start gap-2.5">
            <Compass size={18} className="text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-cyan-200">Phase 1 Foundation Scope</p>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                This release establishes the core architectural foundation: server-authenticated sessions, database persistence, project ownership isolation, real HTML5 CAD coordinate projection, pan/zoom view transformations, and responsive workspace layout.
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
              <Shield size={14} className="text-cyan-400" /> Key Features Active:
            </h4>
            <ul className="space-y-1 text-[11px] text-slate-400 list-disc list-inside">
              <li>High-DPI 2D CAD Canvas with dynamic metric/imperial coordinate grid</li>
              <li>Real World-to-Screen coordinate transformation matrix</li>
              <li>Interactive Pan (Middle click / Hand tool / Spacebar) & Zoom (wheel / pinch)</li>
              <li>Project Version snapshot engine with autosave foundation</li>
              <li>Encrypted PBKDF2 user authentication and project ownership enforcement</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
              <Layers size={14} className="text-cyan-400" /> Upcoming Phase 2 Pipeline:
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Vector drawing objects (Lines, Polylines, Circles, Arcs), precision Object Snapping (Endpoint, Midpoint, Perpendicular), dimensioning tools, and full vector layer rendering will be introduced in Phase 2.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => setIsInfoModalOpen(false)}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
            >
              Acknowledge & Continue
            </button>
          </div>
        </div>
      </Modal>

      {/* Subscription & Payments Modal */}
      <BillingModal isOpen={isBillingOpen} onClose={() => setIsBillingOpen(false)} />
    </div>
  );
};
