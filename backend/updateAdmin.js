const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

async function updateAdmin() {
  const prisma = new PrismaClient();
  try {
    const hash = await bcrypt.hash('Admin@12345', 12);
    await prisma.user.update({
      where: { email: 'admin@doublentry.com' },
      data: { passwordHash: hash }
    });
    console.log('✅ Admin password updated in DB to Admin@12345');
  } catch (err) {
    console.error('Error updating admin:', err);
  } finally {
    await prisma.$disconnect();
  }
}
updateAdmin();
