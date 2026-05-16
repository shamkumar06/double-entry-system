import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';

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
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadsDir));

// --- Routes ---
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, message: 'Server & DB healthy ✅', env: process.env.NODE_ENV });
  } catch {
    res.status(503).json({ success: false, message: 'Database connection failed ❌' });
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
