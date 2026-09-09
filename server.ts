import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { validateAndGetConfig } from './server/config.js';
import authRoutes from './server/routes/auth.js';
import projectRoutes from './server/routes/projects.js';
import { db } from './server/db.js';

async function startServer() {
  // Validate environment and fail fast in production if APP_SECRET is missing or insecure
  validateAndGetConfig();

  await db.init();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));
  app.use(cookieParser());

  // API health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'NOVA CAD AI - Phase 1 Foundation',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);

  // Global 404 handler for unknown API routes
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NOVA CAD AI] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
