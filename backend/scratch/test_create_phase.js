const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const projectId = "4d605221-fb53-4bad-ac0d-951435561387";

const data = {
  name: "Test Phase 999",
  description: "Diagnostic phase creation",
  estimatedBudget: 10000,
  receivedAmount: 5000,
  receivedFrom: "Funder X",
  receivedTo: "Entity Y",
  paymentMode: "Bank Transfer",
  reference: "TXN12345",
  requestLetterUrl: "https://example.com/letter.pdf"
};

async function runTest() {
  console.log("Running local test of raw createPhase on production DB...");
  try {
    const phase = await prisma.phase.create({
      data: {
        projectId,
        name: data.name,
        description: data.description,
        estimatedBudget: data.estimatedBudget,
        receivedAmount: data.receivedAmount,
        receivedFrom: data.receivedFrom,
        receivedTo: data.receivedTo,
        paymentMode: data.paymentMode,
        reference: data.reference,
        requestLetterUrl: data.requestLetterUrl,
      }
    });

    console.log("Phase created successfully:", phase.id);

    const amt = Number(data.receivedAmount || 0);
    if (amt > 0) {
      console.log("Creating initial funding transaction...");
      const cashAcc = await prisma.accountCategory.findFirst({ where: { code: 1001 } });
      const bankAcc = await prisma.accountCategory.findFirst({ where: { code: 1002 } });
      const fundingAcc = await prisma.accountCategory.findFirst({ where: { code: 3001 } });

      console.log("Accounts found:", {
        cashAcc: !!cashAcc,
        bankAcc: !!bankAcc,
        fundingAcc: !!fundingAcc
      });

      if (fundingAcc && (cashAcc || bankAcc)) {
        const isCash = data.paymentMode?.toLowerCase() === 'cash';
        const debitAcc = isCash ? cashAcc : (bankAcc || cashAcc);

        if (debitAcc) {
          const tx = await prisma.transaction.create({
            data: {
              projectId,
              phaseId: phase.id,
              date: new Date(),
              description: `Initial funding received for Phase: "${data.name}"`,
              fromEntity: data.receivedFrom || 'External Funder',
              toEntity: data.receivedTo || 'Project Entity',
              paymentMode: data.paymentMode || 'Bank Transfer',
              reference: data.reference || null,
              attachmentUrl: data.requestLetterUrl || null,
              lines: {
                create: [
                  {
                    accountId: debitAcc.id,
                    type: 'DEBIT',
                    amount: amt
                  },
                  {
                    accountId: fundingAcc.id,
                    type: 'CREDIT',
                    amount: amt
                  }
                ]
              }
            }
          });
          console.log("Transaction created successfully:", tx.id);
        } else {
          console.log("No debit account found!");
        }
      } else {
        console.log("Required accounts missing!");
      }
    }

    // Clean up created test data so we don't mess up user's database
    console.log("Cleaning up test phase...");
    await prisma.phase.delete({ where: { id: phase.id } });
    console.log("Cleaned up successfully!");

  } catch (err) {
    console.error("FAILED! Error details:");
    console.error(err);
  }
}

runTest().finally(() => prisma.$disconnect());
