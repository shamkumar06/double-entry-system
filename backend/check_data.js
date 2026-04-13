const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  const tlines = await prisma.transactionLine.findMany({
    include: {
      account: true,
      transaction: true
    }
  });

  const summary = tlines.map(tl => ({
    txId: tl.transactionId,
    desc: tl.transaction.description,
    amount: tl.amount.toString(),
    type: tl.type,
    accountId: tl.accountId,
    accountName: tl.account.name,
    accountType: tl.account.type
  }));

  console.log(JSON.stringify(summary, null, 2));
}

checkData()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
