require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing connection to database...');
    console.log('DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 20), '...');
    const userCount = await prisma.user.count();
    console.log('User count:', userCount);
    
    // ...
    process.exit(0);
  } catch (err) {
    console.error('CRITICAL ERROR DETAILS:');
    console.error('Message:', err.message);
    console.error('Code:', err.code);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

main();
