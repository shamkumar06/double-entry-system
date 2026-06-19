/**
 * backfill_allocations.js
 *
 * One-time script to create SYSTEM AUTOMATED ALLOCATION journal entries
 * for all existing phases that have a receivedAmount > 0 but no allocation
 * transaction yet.
 *
 * Run with:  node scripts/backfill_allocations.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill of phase allocation journal entries...\n');

  // 1. Ensure "Fund Received" system account exists
  let fundReceivedCategory = await prisma.accountCategory.findFirst({
    where: { name: 'Fund Received' },
  });
  if (!fundReceivedCategory) {
    // Find a safe code (above all existing ones)
    const maxCode = await prisma.accountCategory.findFirst({ orderBy: { code: 'desc' } });
    const newCode = maxCode ? maxCode.code + 1 : 4;
    fundReceivedCategory = await prisma.accountCategory.create({
      data: {
        code: newCode,
        name: 'Fund Received',
        type: 'EQUITY',
        description: 'Source of funds allocated to a phase by management',
        isSystem: true,
      },
    });
    console.log(`Created "Fund Received" account (code ${newCode}).`);
  } else {
    console.log(`"Fund Received" account already exists (code ${fundReceivedCategory.code}).`);
  }

  // 2. Find "Bank" account
  const bankCategory = await prisma.accountCategory.findFirst({ where: { name: 'Bank' } });
  if (!bankCategory) {
    console.error('ERROR: "Bank" account category not found. Aborting.');
    process.exit(1);
  }
  console.log(`Using "Bank" account (code ${bankCategory.code}).\n`);

  // 3. Get all phases with receivedAmount > 0
  const phases = await prisma.phase.findMany({
    where: {
      receivedAmount: { gt: 0 },
    },
    include: {
      project: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${phases.length} phase(s) with receivedAmount > 0.\n`);

  let created = 0;
  let skipped = 0;

  for (const phase of phases) {
    // Check if an allocation transaction already exists for this phase
    const existing = await prisma.transaction.findFirst({
      where: {
        phaseId: phase.id,
        isDeleted: false,
        description: { contains: 'SYSTEM AUTOMATED ALLOCATION' },
      },
    });

    if (existing) {
      console.log(`[SKIP] ${phase.project.name} / ${phase.name} — allocation already exists.`);
      skipped++;
      continue;
    }

    const received = Number(phase.receivedAmount);
    await prisma.transaction.create({
      data: {
        projectId: phase.projectId,
        phaseId: phase.id,
        date: phase.createdAt, // use phase creation date for historical accuracy
        description: `SYSTEM AUTOMATED ALLOCATION: Funds received for ${phase.name}`,
        fromEntity: phase.receivedFrom || 'College Management',
        toEntity: phase.receivedTo || phase.name,
        paymentMode: phase.paymentMode || 'AUTO',
        reference: 'ALLOC-' + phase.id.slice(0, 8).toUpperCase(),
        lines: {
          create: [
            {
              accountId: bankCategory.id,
              type: 'DEBIT',
              amount: new Prisma.Decimal(received),
            },
            {
              accountId: fundReceivedCategory.id,
              type: 'CREDIT',
              amount: new Prisma.Decimal(received),
            },
          ],
        },
      },
    });

    console.log(`[OK]   ${phase.project.name} / ${phase.name} — created allocation journal for ₹${received.toLocaleString('en-IN')}`);
    created++;
  }

  console.log(`\n✅ Done! Created: ${created}, Skipped (already existed): ${skipped}`);
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
