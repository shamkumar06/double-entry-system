import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';

import helmet from 'helmet';

import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import accountingRoutes from './routes/accounting.routes';
import systemRoutes from './routes/system.routes';
import { errorHandler } from './middleware/errorHandler';
import prisma from './lib/prisma';

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// --- Uploads folder ---
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// --- Middleware ---
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow images from backend to be seen on frontend
}));
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadsDir));

// --- Request Logger Middleware ---
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- Routes ---
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, message: 'Server & DB healthy ✅', env: process.env.NODE_ENV });
  } catch {
    res.status(503).json({ success: false, message: 'Database connection failed ❌' });
  }
});

app.get('/api/diagnose', async (_req, res) => {
  const diagnosticResults: any = {
    timestamp: new Date().toISOString(),
    connectionTest: false,
    usersQuery: null,
    categoriesQuery: null,
    error: null
  };
  try {
    await prisma.$queryRaw`SELECT 1`;
    diagnosticResults.connectionTest = true;

    try {
      const users = await prisma.user.findMany({ take: 2, select: { id: true, email: true, role: true } });
      diagnosticResults.usersQuery = { success: true, count: users.length, sample: users };
    } catch (e: any) {
      diagnosticResults.usersQuery = { success: false, error: e.message || String(e), stack: e.stack };
    }

    try {
      const categories = await prisma.accountCategory.findMany({ take: 2 });
      diagnosticResults.categoriesQuery = { success: true, count: categories.length, sample: categories };
    } catch (e: any) {
      diagnosticResults.categoriesQuery = { success: false, error: e.message || String(e), stack: e.stack };
    }

    res.json({ success: true, diagnostics: diagnosticResults });
  } catch (err: any) {
    diagnosticResults.error = err.message || String(err);
    res.status(500).json({ success: false, diagnostics: diagnosticResults });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/system', systemRoutes);

// --- 404 handler ---
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// --- Global error handler ---
app.use(errorHandler);

// --- Start ---
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Frontend allowed: ${FRONTEND_URL}\n`);
});

export default app;
