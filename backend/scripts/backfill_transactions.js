const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting backfill of historical Cashier transactions...");

  // 1. Get all transactions that have a cashierName set
  const transactions = await prisma.transaction.findMany({
    where: {
      cashierName: { not: null },
      isDeleted: false
    },
    include: {
      lines: {
        include: { account: true }
      }
    }
  });

  console.log(`Found ${transactions.length} historical transactions with a cashierName.`);

  let updatedCount = 0;

  for (const tx of transactions) {
    if (!tx.cashierName) continue;

    // Find the cashier's ASSET account
    const cashierAccount = await prisma.accountCategory.findFirst({
      where: { name: tx.cashierName, type: 'ASSET' }
    });

    if (!cashierAccount) {
      console.log(`Could not find ASSET account for cashier ${tx.cashierName}`);
      continue;
    }

    // Find the line that is currently hitting Cash/Bank or an incorrect asset instead of the cashier
    // Usually, this is the offsetting line. If it's an expense transaction, the expense is DEBIT,
    // and the offset is CREDIT (which should be the Cashier).
    // If we find a line where account is NOT the cashier, and is an ASSET, we might need to change it.
    
    let lineToUpdate = null;
    
    for (const line of tx.lines) {
      // If it already points to the cashier, we're good
      if (line.accountId === cashierAccount.id) {
        lineToUpdate = null;
        break; // Already correct
      }
      
      // If it's an ASSET account (like Cash, Bank, Main Cash Account), this is the offset line
      if (line.account.type === 'ASSET' && line.account.id !== cashierAccount.id) {
        lineToUpdate = line;
      }
    }

    if (lineToUpdate) {
      console.log(`Updating tx ${tx.id} - moving ${lineToUpdate.amount} from ${lineToUpdate.account.name} to ${cashierAccount.name}`);
      await prisma.transactionLine.update({
        where: { id: lineToUpdate.id },
        data: { accountId: cashierAccount.id }
      });
      updatedCount++;
    }
  }

  console.log(`Completed. Updated ${updatedCount} transaction lines to use correct Cashier accounts.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
