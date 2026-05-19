const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getUsers() {
  try {
    const users = await prisma.user.findMany();
    console.log('--- DATABASE USERS ---');
    console.log(users);
  } catch (err) {
    console.error('Error fetching users:', err);
  } finally {
    await prisma.$disconnect();
  }
}

getUsers();
