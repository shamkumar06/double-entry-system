const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting backfill of Cashier Accounts...");

  // 1. Get all project members
  const members = await prisma.projectMember.findMany();
  console.log(`Found ${members.length} members.`);

  // 2. Find max code for ASSET accounts
  const maxAcc = await prisma.accountCategory.findFirst({
    where: { type: 'ASSET' },
    orderBy: { code: 'desc' }
  });
  let currentCode = maxAcc && maxAcc.code >= 1000 ? maxAcc.code : 1000;

  let createdCount = 0;

  for (const member of members) {
    // Check if account already exists
    const exists = await prisma.accountCategory.findFirst({
      where: { name: member.name, type: 'ASSET' }
    });

    if (!exists) {
      currentCode++;
      await prisma.accountCategory.create({
        data: {
          name: member.name,
          type: 'ASSET',
          code: currentCode
        }
      });
      console.log(`Created ASSET account for ${member.name} (Code: ${currentCode})`);
      createdCount++;
    } else {
      console.log(`Account already exists for ${member.name}`);
    }
  }

  console.log(`Backfill complete. Created ${createdCount} new accounts.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
