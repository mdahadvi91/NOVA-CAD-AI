import React, { useState } from 'react';
import { Project } from '../../types';
import { Folder, MoreVertical, Edit2, Copy, Trash2, ExternalLink, Clock, Layers } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onOpen: (id: string) => void;
  onRename: (project: Project) => void;
  onDuplicate: (id: string) => void;
  onDelete: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const formattedDate = new Date(project.updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const layerCount = project.drawingData?.layers?.length || 1;

  return (
    <div
      id={`project-card-${project.id}`}
      className="group relative bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-5 shadow-lg hover:shadow-cyan-500/5 transition-all flex flex-col justify-between"
    >
      <div>
        {/* Card Header: Icon, Units pill, and Menu */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center text-cyan-400 group-hover:border-cyan-500/40 group-hover:bg-cyan-950/20 transition-colors">
              <Folder size={20} />
            </div>
            <div>
              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
                {project.units.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="relative">
            <button
              id={`project-menu-btn-${project.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Project actions"
            >
              <MoreVertical size={16} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                <div
                  id={`project-menu-dropdown-${project.id}`}
                  className="absolute right-0 mt-1 w-44 bg-slate-900 border border-slate-700/90 rounded-xl shadow-xl z-30 py-1 overflow-hidden"
                >
                  <button
                    id={`action-open-${project.id}`}
                    onClick={() => {
                      setMenuOpen(false);
                      onOpen(project.id);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                  >
                    <ExternalLink size={14} className="text-cyan-400" />
                    Open Workspace
                  </button>
                  <button
                    id={`action-rename-${project.id}`}
                    onClick={() => {
                      setMenuOpen(false);
                      onRename(project);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Edit2 size={14} className="text-slate-400" />
                    Rename Project
                  </button>
                  <button
                    id={`action-duplicate-${project.id}`}
                    onClick={() => {
                      setMenuOpen(false);
                      onDuplicate(project.id);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Copy size={14} className="text-slate-400" />
                    Duplicate
                  </button>
                  <button
                    id={`action-delete-${project.id}`}
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(project);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 border-t border-slate-800"
                  >
                    <Trash2 size={14} />
                    Delete Project
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Project Name & Description */}
        <h4
          id={`project-title-${project.id}`}
          onClick={() => onOpen(project.id)}
          className="text-base font-bold text-white hover:text-cyan-400 cursor-pointer transition-colors line-clamp-1 mb-1"
          title={project.name}
        >
          {project.name}
        </h4>
        <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px] mb-4">
          {project.description || 'No description provided.'}
        </p>
      </div>

      {/* Meta Footer */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5" title={`Last updated: ${project.updatedAt}`}>
          <Clock size={12} className="text-slate-500" />
          <span>{formattedDate}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-slate-400" title={`${layerCount} layers configured`}>
            <Layers size={12} className="text-slate-500" />
            <span>{layerCount}L</span>
          </span>
          <button
            id={`open-btn-${project.id}`}
            onClick={() => onOpen(project.id)}
            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
          >
            Launch <ExternalLink size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
