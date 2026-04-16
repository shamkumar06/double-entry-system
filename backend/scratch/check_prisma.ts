import { prisma } from './src/lib/prisma';
async function test() {
  try {
    console.log('Checking prisma:', typeof prisma);
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database check: OK');
  } catch (err) {
    console.error('Database check: FAILED', err);
  }
}
test();
