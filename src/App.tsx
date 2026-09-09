import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { EmailVerificationBanner } from './components/common/EmailVerificationBanner';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { AlertCircle, ArrowLeft } from 'lucide-react';

// Main Router Component wrapped inside AuthProvider
function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  // Synchronize route with browser history (back/forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to !== window.location.pathname) {
      window.history.pushState(null, '', to);
      setCurrentPath(to);
    }
  }, []);

  // Show clean loading spinner while auth session checks
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-slate-800 border-t-cyan-400 animate-spin mb-4" />
        <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">
          NOVA CAD AI • Verifying Security Session
        </p>
      </div>
    );
  }

  // --- ROUTE MATCHING ---
  // 1. /login
  if (currentPath === '/login') {
    if (isAuthenticated) {
      navigate('/dashboard');
      return null;
    }
    return (
      <LoginPage
        onNavigateRegister={() => navigate('/register')}
        onNavigateHome={() => navigate('/')}
      />
    );
  }

  // 2. /register
  if (currentPath === '/register') {
    if (isAuthenticated) {
      navigate('/dashboard');
      return null;
    }
    return (
      <RegisterPage
        onNavigateLogin={() => navigate('/login')}
        onNavigateHome={() => navigate('/')}
      />
    );
  }

  // 3. /dashboard (Protected)
  if (currentPath === '/dashboard') {
    if (!isAuthenticated) {
      navigate('/login');
      return null;
    }
    return (
      <div className="min-h-screen flex flex-col">
        <EmailVerificationBanner />
        <div className="flex-1">
          <DashboardPage
            onOpenProject={(id) => navigate(`/project/${id}`)}
            onNavigateHome={() => navigate('/')}
          />
        </div>
      </div>
    );
  }

  // 4. /project/:projectId (Protected)
  if (currentPath.startsWith('/project/')) {
    const projectId = currentPath.replace('/project/', '').trim();
    if (!isAuthenticated) {
      navigate('/login');
      return null;
    }
    if (!projectId) {
      navigate('/dashboard');
      return null;
    }
    return (
      <div className="min-h-screen flex flex-col">
        <EmailVerificationBanner />
        <div className="flex-1">
          <WorkspacePage
            projectId={projectId}
            onBackToDashboard={() => navigate('/dashboard')}
            onNavigateHome={() => navigate('/')}
          />
        </div>
      </div>
    );
  }

  // 5. / (Landing Page)
  if (currentPath === '/' || currentPath === '') {
    return (
      <LandingPage
        onNavigateDashboard={() => navigate('/dashboard')}
        onNavigateLogin={() => navigate('/login')}
        onNavigateRegister={() => navigate('/register')}
      />
    );
  }

  // 6. 404 Route Not Found
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-400">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">404 — Route Not Found</h2>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          The path <span className="font-mono text-cyan-400">&quot;{currentPath}&quot;</span> does not exist in the NOVA CAD AI system.
        </p>
        <button
          onClick={() => navigate(isAuthenticated ? '/dashboard' : '/')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} /> Return to {isAuthenticated ? 'Dashboard' : 'Home'}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}
