import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { errorHandler, notFound } from './middleware/errorHandler';

// Routes
import authRoutes from './routes/auth.routes';
import accountingRoutes from './routes/accounting.routes';
import projectRoutes from './routes/project.routes';
import systemRoutes from './routes/system.routes';

const app = express();

// ── Security Middleware ────────────────────────────────────────────────────
app.use(helmet());

app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:4173'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);



// ── Body Parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Root Entry ─────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Double Entry Accounting Server is online.',
    docs: '/api',
    health: '/health'
  });
});

// ── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    status: 'online',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// ── API Routes ─────────────────────────────────────────────────────────────
app.get('/api', (_req, res) => res.json({ success: true, message: 'Double Entry Accounting API V1 is running.' }));
app.use('/api/auth', authRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/system', systemRoutes);

// ── Error Handling ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
