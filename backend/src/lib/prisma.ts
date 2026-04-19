import { PrismaClient } from '@prisma/client';

// Use a global variable to prevent multiple instances in development (Hot Reloading)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: 'pretty',
    // In production (Vercel), we let Prisma handle the connection 
    // pooling automatically via the DATABASE_URL.
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Basic health check to aid in production debugging
if (process.env.NODE_ENV === 'production') {
  prisma.$connect()
    .then(() => console.log('✅ Prisma connected to database successfully'))
    .catch((err) => console.error('❌ Prisma failed to connect to database:', err.message));
}


