const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  console.log("Starting DB query test...");
  try {
    const usersCount = await prisma.user.count();
    console.log("Users count in DB:", usersCount);
    
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true }
    });
    console.log("Users list:", users);

    const categoriesCount = await prisma.accountCategory.count();
    console.log("Account categories count in DB:", categoriesCount);

  } catch (err) {
    console.error("DB Query Failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
