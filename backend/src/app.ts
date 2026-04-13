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

// Robust CORS with Dynamic Origin Handling
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000'
];

// Add FRONTEND_URL from env if it exists (removing any trailing slashes)
if (process.env.FRONTEND_URL) {
  const cleanUrl = process.env.FRONTEND_URL.replace(/\/$/, "");
  allowedOrigins.push(cleanUrl);
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      const cleanOrigin = origin.replace(/\/$/, "");
      
      if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log(`⚠️ CORS Blocked for origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['set-cookie']
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
