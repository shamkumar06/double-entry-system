const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { getTrialBalance } = require('./src/services/accounting.service');

async function checkDb() {
  const data = await getTrialBalance("797b088d-42dd-46e0-9143-a79e4bbe5503");
  console.log("Trial Balance Data:", JSON.stringify(data, null, 2));
}

checkDb().finally(() => prisma.$disconnect());
