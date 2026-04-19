import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// singleton pattern instance
let prismaInstance: PrismaClient;

// Helper to get or create the prisma instance safely
export const getPrismaClient = (): PrismaClient => {
  if (prismaInstance) return prismaInstance;

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('CRITICAL: DATABASE_URL is missing in environment variables.');
    // In dev, we might want to throw, but in prod we return a dummy to prevent total crash on import
    if (process.env.NODE_ENV === 'production') {
       throw new Error('DATABASE_URL is required for production.');
    }
  }

  const pool = new Pool({ 
    connectionString: url,
    // Optimal serverless settings
    max: 5, // Lowered for Supabase Transaction mode
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Increased to 10s for Vercel cold starts
    ssl: { rejectUnauthorized: false } // Required for some hosted DBs
  });

  // Log connection success (sanitized) to help debug production
  if (process.env.NODE_ENV === 'production') {
    const sanitizedUrl = url.replace(/:.*@/, ':****@');
    console.log(`📡 Connecting to database with pooler URL: ${sanitizedUrl.substring(0, 50)}...`);
  }

  const adapter = new PrismaPg(pool);

  prismaInstance = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: 'pretty',
  });

  return prismaInstance;
};

export const prisma = getPrismaClient();

