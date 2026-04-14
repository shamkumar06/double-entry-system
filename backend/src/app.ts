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

// Flexible CORS for Vercel Monorepo Deployment
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000'
];

// Dynamically add frontend URL from environment
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ""));
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps)
      if (!origin) return callback(null, true);
      
      const cleanOrigin = origin.replace(/\/$/, "");
      
      // Allow specific origins or any vercel.app subdomain for this project
      const isVercel = cleanOrigin.endsWith('.vercel.app') && cleanOrigin.includes('double-entry-system');
      
      if (allowedOrigins.includes(cleanOrigin) || isVercel) {
        callback(null, true);
      } else {
        console.warn(`CORS attempt from unauthorized origin: ${origin}`);
        callback(null, false); // Return false instead of Error to avoid crashing the response headers
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    preflightContinue: false,
    optionsSuccessStatus: 204
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
app.get('/health', async (_req, res) => {
  let dbStatus = 'connecting';
  let dbError = null;

  try {
    // Simple ping to check DB connectivity
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'online';
  } catch (err: any) {
    dbStatus = 'offline';
    dbError = err.message;
  }

  res.json({
    success: true,
    status: 'online',
    database: dbStatus,
    error: dbError,
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
