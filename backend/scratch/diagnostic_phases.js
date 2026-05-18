const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const projectId = "4d605221-fb53-4bad-ac0d-951435561387";

async function checkPhases() {
  const phases = await prisma.phase.findMany({
    where: { projectId },
    include: {
      transactions: {
        where: { isDeleted: false },
        include: { lines: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log("Phases found:", phases.length);
  phases.forEach(p => {
    console.log(`Phase: ${p.name}`);
    console.log(`- Transactions count: ${p.transactions.length}`);
    let spent_amount = 0;
    p.transactions.forEach(tx => {
      console.log(`  Transaction: ${tx.description}, id: ${tx.id}`);
      console.log(`  Lines:`, tx.lines.map(l => ({ type: l.type, amount: l.amount.toString() })));
      tx.lines.forEach(line => {
        if (line.type === 'DEBIT') {
          spent_amount += Number(line.amount);
        }
      });
    });
    console.log(`  => spent_amount calculated: ${spent_amount}`);
  });
}

checkPhases().catch(console.error).finally(() => prisma.$disconnect());
