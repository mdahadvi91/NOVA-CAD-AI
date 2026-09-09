import React, { useState, useEffect, useCallback } from 'react';
import { Project, UnitType } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/common/Header';
import { ProjectCard } from '../components/dashboard/ProjectCard';
import { CreateProjectModal } from '../components/dashboard/CreateProjectModal';
import { BillingModal } from '../components/BillingModal';
import { Modal } from '../components/common/Modal';
import {
  FolderPlus,
  Search,
  RefreshCw,
  AlertTriangle,
  FolderOpen,
  SlidersHorizontal,
  Compass,
} from 'lucide-react';

interface DashboardPageProps {
  onOpenProject: (id: string) => void;
  onNavigateHome: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenProject,
  onNavigateHome,
}) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);

  // Rename Modal state
  const [projectToRename, setProjectToRename] = useState<Project | null>(null);
  const [renameName, setRenameName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Delete Confirmation Modal state
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getProjects();
      setProjects(res.projects);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load projects.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async (data: {
    name: string;
    description: string;
    units: UnitType;
  }) => {
    const res = await api.createProject(data);
    setProjects((prev) => [res.project, ...prev]);
    onOpenProject(res.project.id);
  };

  const handleDuplicateProject = async (projectId: string) => {
    try {
      setIsLoading(true);
      const res = await api.duplicateProject(projectId);
      setProjects((prev) => [res.project, ...prev]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to duplicate project.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectToRename || !renameName.trim()) return;

    try {
      setIsRenaming(true);
      const res = await api.updateProject(projectToRename.id, {
        name: renameName.trim(),
      });
      setProjects((prev) =>
        prev.map((p) => (p.id === res.project.id ? res.project : p))
      );
      setProjectToRename(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to rename project.');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    try {
      setIsDeleting(true);
      await api.deleteProject(projectToDelete.id);
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
      setProjectToDelete(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete project.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchName = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchDesc = p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchName || matchDesc;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header onNavigateHome={onNavigateHome} onOpenBilling={() => setIsBillingOpen(true)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Control Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold tracking-tight text-white">Project Dashboard</h1>
              <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-800 text-cyan-300 border border-slate-700">
                {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Manage your engineering drafts, CAD workspaces, and calibrated drawings.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="refresh-projects-btn"
              onClick={fetchProjects}
              disabled={isLoading}
              className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Refresh project list"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin text-cyan-400' : ''} />
            </button>

            <button
              id="dashboard-create-project-btn"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <FolderPlus size={16} className="stroke-[2.5]" />
              New CAD Project
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mt-6 mb-8 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="dashboard-search-input"
              type="text"
              placeholder="Search drawings by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              Clear filter
            </button>
          )}
        </div>

        {/* Content Area: Loading, Error, Empty, or Cards Grid */}
        {isLoading && projects.length === 0 ? (
          <div id="dashboard-loading-state" className="py-24 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-slate-800 border-t-cyan-400 animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-300">Synchronizing CAD Workspace Repository...</p>
            <p className="text-xs text-slate-500 mt-1">Verifying encrypted project ownership</p>
          </div>
        ) : error ? (
          <div id="dashboard-error-state" className="py-16 max-w-md mx-auto text-center bg-slate-900 border border-red-500/30 rounded-2xl p-8">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Unable to load projects</h3>
            <p className="text-xs text-slate-400 mb-6">{error}</p>
            <button
              id="dashboard-retry-btn"
              onClick={fetchProjects}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs cursor-pointer"
            >
              <RefreshCw size={14} /> Retry Request
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div id="dashboard-empty-state" className="py-20 text-center max-w-lg mx-auto bg-slate-900/50 border border-slate-800 rounded-2xl p-8">
            <div className="w-14 h-14 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-cyan-400 shadow-inner">
              <FolderOpen size={28} />
            </div>
            {searchQuery ? (
              <>
                <h3 className="text-base font-bold text-white mb-1">No matching projects found</h3>
                <p className="text-xs text-slate-400 mb-4">
                  No projects match your current search &quot;{searchQuery}&quot;.
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                >
                  Reset Search
                </button>
              </>
            ) : (
              <>
                <h3 className="text-base font-bold text-white mb-1">No CAD projects yet</h3>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Start your first drafting canvas. Choose metric or imperial units, customize your grid, and begin Phase 1 workspace exploration.
                </p>
                <button
                  id="empty-state-create-btn"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 cursor-pointer transition-all"
                >
                  <FolderPlus size={16} /> Create Your First Project
                </button>
              </>
            )}
          </div>
        ) : (
          <div
            id="projects-grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={onOpenProject}
                onRename={(p) => {
                  setProjectToRename(p);
                  setRenameName(p.name);
                }}
                onDuplicate={handleDuplicateProject}
                onDelete={(p) => setProjectToDelete(p)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateProject}
      />

      {/* Rename Project Modal */}
      <Modal
        id="rename-project-modal"
        isOpen={!!projectToRename}
        onClose={() => setProjectToRename(null)}
        title="Rename CAD Project"
      >
        <form onSubmit={handleRenameSubmit} className="space-y-4">
          <div>
            <label htmlFor="rename-input" className="block text-xs font-semibold text-slate-300 mb-1.5">
              New Project Name
            </label>
            <input
              id="rename-input"
              type="text"
              required
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              id="cancel-rename-btn"
              onClick={() => setProjectToRename(null)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="confirm-rename-btn"
              disabled={isRenaming}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg disabled:opacity-50"
            >
              {isRenaming ? 'Saving...' : 'Rename'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        id="delete-project-modal"
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        title="Confirm Project Deletion"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-start gap-2.5">
            <AlertTriangle size={18} className="shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200">Destructive Action</p>
              <p className="mt-0.5 leading-relaxed">
                This will permanently delete <span className="font-bold text-white">&quot;{projectToDelete?.name}&quot;</span> and all its saved CAD versions. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              id="cancel-delete-btn"
              onClick={() => setProjectToDelete(null)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
            >
              Keep Project
            </button>
            <button
              type="button"
              id="confirm-delete-btn"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Permanently Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Billing & Subscription Modal */}
      <BillingModal isOpen={isBillingOpen} onClose={() => setIsBillingOpen(false)} />
    </div>
  );
};
