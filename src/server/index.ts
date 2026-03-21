/**
 * git4docs Server
 * Express entry point.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getDatabase } from './db/schema.js';

// Routes
import authRoutes from './routes/auth.js';
import companyRoutes from './routes/companies.js';
import platformUserRoutes from './routes/platform-users.js';
import documentRoutes from './routes/documents.js';
import versionRoutes from './routes/versions.js';
import draftRoutes from './routes/drafts.js';
import changeRoutes from './routes/changes.js';
import releaseRoutes from './routes/releases.js';
import identityRoutes from './routes/identity.js';
import categoryRoutes from './routes/categories.js';
import templateRoutes from './routes/templates.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

import { subdomainMiddleware } from './middleware/subdomain.js';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(subdomainMiddleware);

// Initialize database
getDatabase();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/companies/:id/platform-users', platformUserRoutes);
app.use('/api/companies/:id/identity', identityRoutes);
app.use('/api/versions', versionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/drafts', draftRoutes);
app.use('/api/change-requests', changeRoutes);
app.use('/api/releases', releaseRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'git4docs', timestamp: new Date().toISOString() });
});

// Serve frontend in production
import nodePath from 'node:path';
import nodeFs from 'node:fs';
const clientDist = nodePath.resolve(process.cwd(), 'client/dist');
if (nodeFs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('{*path}', (_req, res) => {
    res.sendFile(nodePath.join(clientDist, 'index.html'));
  });
  console.log(`Serving frontend from ${clientDist}`);
} else {
  console.log(`No frontend build found at ${clientDist} — API only mode`);
}

// Start server
try {
  app.listen(PORT, () => {
    console.log(`git4docs server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
} catch (err) {
  console.error('Failed to start server:', err);
  process.exit(1);
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

export default app;
