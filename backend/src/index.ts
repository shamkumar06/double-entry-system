import 'dotenv/config';
import app from './app';
process.on('exit', (code) => console.log('DEBUG: Process exiting with code:', code));
process.on('uncaughtException', (err) => console.error('DEBUG: Uncaught:', err));
process.on('unhandledRejection', (err) => console.error('DEBUG: Unhandled Rejection:', err));
import { prisma } from './lib/prisma';

const PORT = parseInt(process.env.PORT || '5000', 10);

const startServer = async () => {
  let retries = 3;
  let connected = false;

  while (retries > 0 && !connected) {
    try {
      console.log(`🔌 Attempting to connect to database... (${4 - retries}/3)`);
      await prisma.$connect();
      connected = true;
      console.log('✅ Connected to PostgreSQL (Supabase)');
    } catch (error) {
      retries--;
      console.error(`❌ Connection failed. Retries remaining: ${retries}`);
      if (retries === 0) {
        console.error('🛑 Could not connect to database. starting in maintenance mode.');
        // We still start the server so the developer can see the error in the UI
      } else {
        await new Promise(res => setTimeout(res, 2000)); // wait 2 seconds before retry
      }
    }
  }

  try {
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔒 Auth: JWT + HTTP-only cookies`);
    });

    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log('✅ Database connection closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Heartbeat to ensure persistence in production environments
    setInterval(() => {}, 60000);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
