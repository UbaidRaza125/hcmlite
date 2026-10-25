import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import apiRouter from './src/server/routes.js';
import { initializeStore } from './src/server/storage.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Load/migrate Firestore before opening the listener so requests never race startup.
  await initializeStore();
  const app = express();
  const PORT = 3000;

  // JSON request parser
  app.use(express.json({ limit: '10mb' }));

  // Request logger for API calls
  app.use('/api', (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  // Mount API router
  app.use('/api', apiRouter);

  // Fallback aliases so endpoints called without /api (e.g. /auth/*, /setup/*) never 404
  app.use('/auth', (req, res, next) => {
    req.url = '/auth' + req.url;
    apiRouter(req, res, next);
  });
  app.use('/setup', (req, res, next) => {
    req.url = '/setup' + req.url;
    apiRouter(req, res, next);
  });

  // Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: 3000,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve built dist files
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HCM Lite server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start HCM Lite server:', err);
  process.exit(1);
});
