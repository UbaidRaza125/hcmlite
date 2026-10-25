import express from 'express';
import apiRouter from '../src/server/routes.js';
import { initializeStore } from '../src/server/storage.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

// Strip duplicate /api prefix when rewritten by Vercel
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    req.url = req.url.slice(4);
  } else if (req.url === '/api') {
    req.url = '/';
  }
  next();
});

// Lazy store initializer for Vercel serverless cold starts
let storePromise = null;
app.use(async (req, res, next) => {
  if (!storePromise) {
    storePromise = initializeStore().catch((err) => {
      console.warn('Store init notice:', err?.message || err);
    });
  }
  await storePromise;
  next();
});

// Mount the API router
app.use(apiRouter);

export default app;
