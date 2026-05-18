const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const projectId = "4d605221-fb53-4bad-ac0d-951435561387";

async function main() {
  console.log("=== Diagnosing Project and Phase Data ===");
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      phases: true,
      transactions: {
        where: { isDeleted: false },
        include: {
          lines: {
            include: { account: true }
          }
        }
      }
    }
  });

  if (!project) {
    console.log("Project not found!");
    return;
  }

  console.log(`\nProject Name: ${project.name}`);
  console.log(`Total Funds (Allocated Budget): ${project.totalFunds}`);
  
  console.log("\n--- Phases ---");
  project.phases.forEach(ph => {
    console.log(`Phase: "${ph.name}" (ID: ${ph.id})`);
    console.log(`  Estimated Budget: ${ph.estimatedBudget}`);
    console.log(`  Received Amount: ${ph.receivedAmount}`);
  });

  console.log("\n--- Transactions in Journal ---");
  project.transactions.forEach(tx => {
    console.log(`\nTransaction: "${tx.description}" on ${tx.date.toISOString().split('T')[0]} (Phase ID: ${tx.phaseId})`);
    tx.lines.forEach(line => {
      console.log(`  [${line.type}] Account: ${line.account.name} (Code: ${line.account.code}, Type: ${line.account.type}) | Amount: ${line.amount}`);
    });
  });
}

main().finally(() => prisma.$disconnect());
