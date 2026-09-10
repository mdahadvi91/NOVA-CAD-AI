import React, { useState } from 'react';
import {
  Sliders,
  Layers,
  History,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Ruler,
  Calendar,
  Check,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { Project, ProjectVersion, UnitType, ViewState, Layer } from '../../types';

interface PropertiesPanelProps {
  project: Project;
  viewState: ViewState;
  versions: ProjectVersion[];
  onUpdateProjectMeta: (updates: {
    name?: string;
    description?: string;
    units?: UnitType;
    gridSpacing?: number;
  }) => void;
  onUpdateLayers: (layers: Layer[]) => void;
  onRestoreVersion?: (versionId: string) => Promise<void> | void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  project,
  viewState,
  versions,
  onUpdateProjectMeta,
  onUpdateLayers,
  onRestoreVersion,
  isOpen,
  onToggleOpen,
}) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'layers' | 'versions'>('properties');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(project.name);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);

  const layers = project.drawingData?.layers || [];

  const handleToggleLayerVisibility = (layerId: string) => {
    const nextLayers = layers.map((l) =>
      l.id === layerId ? { ...l, visible: !l.visible } : l
    );
    onUpdateLayers(nextLayers);
  };

  const handleToggleLayerLock = (layerId: string) => {
    const nextLayers = layers.map((l) =>
      l.id === layerId ? { ...l, locked: !l.locked } : l
    );
    onUpdateLayers(nextLayers);
  };

  const handleAddLayer = () => {
    const id = `layer_${Date.now()}`;
    const newLayer: Layer = {
      id,
      name: `Layer ${layers.length + 1}`,
      color: ['#00e5ff', '#a855f7', '#22c55e', '#eab308', '#f97316'][layers.length % 5],
      visible: true,
      locked: false,
    };
    onUpdateLayers([...layers, newLayer]);
  };

  return (
    <aside
      id="cad-right-properties-panel"
      className={`bg-slate-900 border-l border-slate-800 flex flex-col z-20 transition-all duration-200 select-none ${
        isOpen ? 'w-72 sm:w-80' : 'w-10'
      }`}
    >
      {/* Collapse / Expand Tab Bar */}
      <div className="h-11 border-b border-slate-800 flex items-center justify-between px-2 bg-slate-900/90">
        <button
          id="toggle-properties-panel-btn"
          onClick={onToggleOpen}
          className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title={isOpen ? 'Collapse Panel' : 'Expand Panel'}
        >
          {isOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {isOpen && (
          <div className="flex items-center gap-1">
            <button
              id="tab-properties"
              onClick={() => setActiveTab('properties')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'properties'
                  ? 'bg-slate-800 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders size={13} />
              <span>Properties</span>
            </button>

            <button
              id="tab-layers"
              onClick={() => setActiveTab('layers')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'layers'
                  ? 'bg-slate-800 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers size={13} />
              <span>Layers</span>
            </button>

            <button
              id="tab-versions"
              onClick={() => setActiveTab('versions')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'versions'
                  ? 'bg-slate-800 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History size={13} />
              <span>Versions</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Panel Content */}
      {isOpen ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-300 font-sans">
          {/* TAB 1: PROPERTIES */}
          {activeTab === 'properties' && (
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Project Title
                </span>
                {isEditingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-cyan-500 rounded text-xs text-white focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        if (tempName.trim()) {
                          onUpdateProjectMeta({ name: tempName.trim() });
                          setIsEditingName(false);
                        }
                      }}
                      className="p-1.5 bg-cyan-500 text-slate-950 rounded hover:bg-cyan-400 cursor-pointer"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setTempName(project.name);
                      setIsEditingName(true);
                    }}
                    className="p-2 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded text-slate-200 font-medium cursor-pointer flex items-center justify-between group"
                    title="Click to rename"
                  >
                    <span className="truncate">{project.name}</span>
                    <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100">
                      Edit
                    </span>
                  </div>
                )}
              </div>

              {/* Units Selection */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Active Units
                </span>
                <div className="grid grid-cols-5 gap-1">
                  {(['mm', 'cm', 'm', 'in', 'ft'] as UnitType[]).map((u) => (
                    <button
                      key={u}
                      onClick={() => onUpdateProjectMeta({ units: u })}
                      className={`py-1 text-center font-mono rounded text-[11px] transition-colors cursor-pointer border ${
                        project.units === u
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {u.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* View & Coordinate Stats */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Canvas View Metrics
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-400">Zoom:</span>{' '}
                    <span className="text-cyan-300 font-medium">
                      {(viewState.zoom * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Grid:</span>{' '}
                    <span className="text-slate-200 font-medium">
                      {viewState.gridVisible ? 'Enabled' : 'Hidden'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Pan X:</span>{' '}
                    <span className="text-slate-200">{viewState.panX.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Pan Y:</span>{' '}
                    <span className="text-slate-200">{viewState.panY.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              {/* Project Meta Info */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Project ID:</span>
                  <span className="font-mono text-slate-400">{project.id.slice(0, 12)}...</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Created:</span>
                  <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last Modified:</span>
                  <span>{new Date(project.updatedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LAYERS */}
          {activeTab === 'layers' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Drawing Layers ({layers.length})
                </span>
                <button
                  id="add-layer-btn"
                  onClick={handleAddLayer}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} /> Add Layer
                </button>
              </div>

              <div className="space-y-1.5">
                {layers.map((layer) => (
                  <div
                    key={layer.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: layer.color }}
                      />
                      <span className="text-xs text-slate-200 font-medium truncate">
                        {layer.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleLayerVisibility(layer.id)}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                        title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                      >
                        {layer.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-slate-600" />}
                      </button>
                      <button
                        onClick={() => handleToggleLayerLock(layer.id)}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                        title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
                      >
                        {layer.locked ? <Lock size={13} className="text-amber-400" /> : <Unlock size={13} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-2.5 bg-slate-950/40 border border-dashed border-slate-800 rounded-lg text-[11px] text-slate-400 leading-relaxed">
                <span className="font-semibold text-slate-300">Phase 1 Foundation:</span> Layer structures are schema-backed and ready for vector entity bindings in Phase 2.
              </div>
            </div>
          )}

          {/* TAB 3: VERSIONS */}
          {activeTab === 'versions' && (
            <div className="space-y-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Saved Version History ({versions.length})
              </span>

              <div className="space-y-2">
                {versions.map((ver) => {
                  const isCurrent = ver.id === project.currentVersionId;
                  const isRestoring = restoringVersionId === ver.id;

                  return (
                    <div
                      key={ver.id}
                      className={`p-2.5 rounded-lg bg-slate-950/80 border space-y-1.5 transition-colors ${
                        isCurrent ? 'border-cyan-500/50 bg-cyan-950/20' : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-cyan-400 text-xs">
                            v{ver.version}.0
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              Current
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(ver.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">{ver.description || 'Snapshot'}</p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Calendar size={10} />
                          {new Date(ver.createdAt).toLocaleDateString()}
                        </div>
                        {!isCurrent && onRestoreVersion && (
                          <button
                            type="button"
                            disabled={isRestoring}
                            onClick={async () => {
                              try {
                                setRestoringVersionId(ver.id);
                                await onRestoreVersion(ver.id);
                              } finally {
                                setRestoringVersionId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                            title={`Restore drawing state to v${ver.version}.0`}
                          >
                            <RotateCcw size={10} className={isRestoring ? 'animate-spin' : ''} />
                            <span>{isRestoring ? 'Restoring...' : 'Restore'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Vertical collapsed icons */
        <div className="py-4 flex flex-col items-center gap-4">
          <button
            onClick={() => {
              onToggleOpen();
              setActiveTab('properties');
            }}
            title="Open Properties"
            className="text-slate-400 hover:text-cyan-400"
          >
            <Sliders size={16} />
          </button>
          <button
            onClick={() => {
              onToggleOpen();
              setActiveTab('layers');
            }}
            title="Open Layers"
            className="text-slate-400 hover:text-cyan-400"
          >
            <Layers size={16} />
          </button>
          <button
            onClick={() => {
              onToggleOpen();
              setActiveTab('versions');
            }}
            title="Open Version History"
            className="text-slate-400 hover:text-cyan-400"
          >
            <History size={16} />
          </button>
        </div>
      )}
    </aside>
  );
};
