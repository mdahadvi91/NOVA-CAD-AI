import React, { useState } from 'react';
import { Compass, User, LogOut, ChevronDown, LayoutDashboard, Shield, CreditCard, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  currentProjectName?: string;
  onNavigateHome?: () => void;
  onNavigateDashboard?: () => void;
  onOpenBilling?: () => void;
  statusSlot?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  currentProjectName,
  onNavigateHome,
  onNavigateDashboard,
  onOpenBilling,
  statusSlot,
}) => {
  const { user, logout, isAuthenticated } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <header
      id="nova-header"
      className="h-14 bg-slate-900 border-b border-slate-800 text-slate-200 px-4 flex items-center justify-between select-none z-30 relative"
    >
      {/* Brand & Context */}
      <div className="flex items-center gap-3 md:gap-5">
        <div
          id="nova-brand-logo"
          onClick={onNavigateHome || onNavigateDashboard}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-cyan-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <Compass size={19} className="stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-sm text-white">NOVA CAD</span>
              <span className="text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase">
                AI • P1
              </span>
            </div>
            <span className="text-[10px] text-slate-400 hidden sm:inline leading-none">
              Professional CAD Foundation
            </span>
          </div>
        </div>

        {/* Project Breadcrumb if inside workspace */}
        {currentProjectName && (
          <div className="hidden md:flex items-center gap-2 text-xs border-l border-slate-800 pl-4">
            <button
              id="header-nav-dashboard-crumb"
              onClick={onNavigateDashboard}
              className="text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors"
            >
              <LayoutDashboard size={13} />
              <span>Projects</span>
            </button>
            <span className="text-slate-600">/</span>
            <span className="font-medium text-slate-200 max-w-[200px] truncate" title={currentProjectName}>
              {currentProjectName}
            </span>
          </div>
        )}
      </div>

      {/* Middle Slot for Status/Save indicator */}
      <div className="flex items-center gap-3">{statusSlot}</div>

      {/* Right Controls: User Profile / Auth */}
      <div className="flex items-center gap-3">
        {isAuthenticated && user ? (
          <>
            {onOpenBilling && (
              <button
                id="header-billing-quick-btn"
                onClick={onOpenBilling}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-950/70 border border-cyan-800/40 text-cyan-300 text-xs font-medium transition-colors cursor-pointer"
                title="Manage Subscription & AI Credits"
              >
                <Sparkles size={13} className="text-cyan-400" />
                <span className="font-mono text-[11px] font-bold">{user.aiCreditsRemaining ?? 50} Cr</span>
                <span className="text-[10px] uppercase px-1 py-0.2 rounded bg-cyan-800/50 text-cyan-200">
                  {user.tier || 'Free'}
                </span>
              </button>
            )}

            <div className="relative">
            <button
              id="header-user-menu-button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-cyan-600 text-slate-950 font-bold flex items-center justify-center text-[11px]">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline max-w-[120px] truncate">{user.name}</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>

            {isDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div
                  id="header-user-dropdown"
                  className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl z-50 py-1 overflow-hidden"
                >
                  <div className="px-4 py-2.5 border-b border-slate-800">
                    <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-cyan-400 font-mono">
                      <Shield size={10} /> Authenticated User
                    </div>
                  </div>

                  {onNavigateDashboard && (
                    <button
                      id="dropdown-dashboard-link"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onNavigateDashboard();
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <LayoutDashboard size={14} className="text-slate-400" />
                      Project Dashboard
                    </button>
                  )}

                  {onOpenBilling && (
                    <button
                      id="dropdown-billing-link"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenBilling();
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-cyan-300 hover:bg-cyan-950/30 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard size={14} className="text-cyan-400" />
                        <span>Billing & Plans</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold bg-cyan-900/60 px-1.5 py-0.5 rounded text-cyan-300">
                        {user.tier || 'Free'}
                      </span>
                    </button>
                  )}

                  <button
                    id="dropdown-logout-button"
                    onClick={async () => {
                      setIsDropdownOpen(false);
                      await logout();
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 flex items-center gap-2 border-t border-slate-800"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </>
        ) : (
          <div className="flex items-center gap-2">
            <button
              id="header-signin-btn"
              onClick={onNavigateHome}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors"
            >
              Sign In
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
