import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export const listProjects = async () => {
  const projects = await prisma.project.findMany({
    where: { isActive: true },
    include: {
      phases: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return projects;
};

export const getProject = async (id: string) => {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { phases: { orderBy: { createdAt: 'asc' } } },
  });
  if (!project) throw new AppError('Project not found.', 404);
  return project;
};

export const createProject = async (data: {
  name: string;
  description?: string;
  totalFunds?: number;
  logoUrl?: string;
}) => {
  return prisma.project.create({ data, include: { phases: true } });
};

export const updateProject = async (
  id: string,
  data: { name?: string; description?: string; totalFunds?: number; logoUrl?: string }
) => {
  return prisma.project.update({
    where: { id },
    data,
    include: { phases: true },
  });
};

export const deleteProject = async (id: string) => {
  await prisma.project.update({ where: { id }, data: { isActive: false } });
};

// --- Phases ---

export const listPhases = async (projectId: string) => {
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

  return phases.map((phase) => {
    let spent_amount = 0;
    phase.transactions.forEach((tx) => {
      tx.lines.forEach((line) => {
        if (line.type === 'DEBIT') {
          spent_amount += Number(line.amount);
        }
      });
    });

    return {
      id: phase.id,
      projectId: phase.projectId,
      name: phase.name,
      description: phase.description,
      estimatedBudget: Number(phase.estimatedBudget),
      receivedAmount: Number(phase.receivedAmount),
      receivedFrom: phase.receivedFrom,
      receivedTo: phase.receivedTo,
      paymentMode: phase.paymentMode,
      reference: phase.reference,
      requestLetterUrl: phase.requestLetterUrl,
      isSettled: phase.isSettled,
      createdAt: phase.createdAt,
      updatedAt: phase.updatedAt,
      spent_amount,
    };
  });
};

export const createPhase = async (
  projectId: string,
  data: {
    name: string;
    description?: string;
    estimatedBudget?: number;
    receivedAmount?: number;
    receivedFrom?: string;
    receivedTo?: string;
    paymentMode?: string;
    reference?: string;
    requestLetterUrl?: string;
  }
) => {
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

  const amt = Number(data.receivedAmount || 0);
  if (amt > 0) {
    const cashAcc = await prisma.accountCategory.findFirst({ where: { code: 1001 } });
    const bankAcc = await prisma.accountCategory.findFirst({ where: { code: 1002 } });
    const fundingAcc = await prisma.accountCategory.findFirst({ where: { code: 3001 } });

    if (fundingAcc && (cashAcc || bankAcc)) {
      const isCash = data.paymentMode?.toLowerCase() === 'cash';
      const debitAcc = isCash ? cashAcc : (bankAcc || cashAcc);

      if (debitAcc) {
        await prisma.transaction.create({
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
      }
    }
  }

  return phase;
};

export const updatePhase = async (
  projectId: string,
  phaseId: string,
  data: {
    name?: string;
    description?: string;
    estimatedBudget?: number;
    receivedAmount?: number;
    receivedFrom?: string;
    receivedTo?: string;
    paymentMode?: string;
    reference?: string;
    requestLetterUrl?: string;
    isSettled?: boolean;
  }
) => {
  const phase = await prisma.phase.findFirst({ where: { id: phaseId, projectId } });
  if (!phase) throw new AppError('Phase not found.', 404);

  const updatedPhase = await prisma.phase.update({
    where: { id: phaseId },
    data: {
      name: data.name,
      description: data.description,
      estimatedBudget: data.estimatedBudget,
      receivedAmount: data.receivedAmount,
      receivedFrom: data.receivedFrom,
      receivedTo: data.receivedTo,
      paymentMode: data.paymentMode,
      reference: data.reference,
      requestLetterUrl: data.requestLetterUrl,
      isSettled: data.isSettled,
    }
  });

  const amt = data.receivedAmount !== undefined ? Number(data.receivedAmount) : Number(phase.receivedAmount);

  // Sync journal entry
  const existingFundingTx = await prisma.transaction.findFirst({
    where: {
      phaseId,
      isDeleted: false,
      description: { startsWith: 'Initial funding received' }
    }
  });

  if (existingFundingTx) {
    if (amt === 0) {
      await prisma.transaction.update({
        where: { id: existingFundingTx.id },
        data: { isDeleted: true, deletedAt: new Date() }
      });
    } else {
      const cashAcc = await prisma.accountCategory.findFirst({ where: { code: 1001 } });
      const bankAcc = await prisma.accountCategory.findFirst({ where: { code: 1002 } });
      const fundingAcc = await prisma.accountCategory.findFirst({ where: { code: 3001 } });

      if (fundingAcc && (cashAcc || bankAcc)) {
        const isCash = (data.paymentMode !== undefined ? data.paymentMode : (phase.paymentMode || '')).toLowerCase() === 'cash';
        const debitAcc = isCash ? cashAcc : (bankAcc || cashAcc);

        if (debitAcc) {
          await prisma.transactionLine.deleteMany({ where: { transactionId: existingFundingTx.id } });

          await prisma.transaction.update({
            where: { id: existingFundingTx.id },
            data: {
              description: `Initial funding received for Phase: "${data.name || phase.name}"`,
              fromEntity: data.receivedFrom !== undefined ? data.receivedFrom : phase.receivedFrom,
              toEntity: data.receivedTo !== undefined ? data.receivedTo : phase.receivedTo,
              paymentMode: data.paymentMode !== undefined ? data.paymentMode : phase.paymentMode,
              reference: data.reference !== undefined ? data.reference : phase.reference,
              attachmentUrl: data.requestLetterUrl !== undefined ? data.requestLetterUrl : phase.requestLetterUrl,
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
        }
      }
    }
  } else if (amt > 0) {
    const cashAcc = await prisma.accountCategory.findFirst({ where: { code: 1001 } });
    const bankAcc = await prisma.accountCategory.findFirst({ where: { code: 1002 } });
    const fundingAcc = await prisma.accountCategory.findFirst({ where: { code: 3001 } });

    if (fundingAcc && (cashAcc || bankAcc)) {
      const isCash = (data.paymentMode !== undefined ? data.paymentMode : (phase.paymentMode || '')).toLowerCase() === 'cash';
      const debitAcc = isCash ? cashAcc : (bankAcc || cashAcc);

      if (debitAcc) {
        await prisma.transaction.create({
          data: {
            projectId,
            phaseId: updatedPhase.id,
            date: new Date(),
            description: `Initial funding received for Phase: "${updatedPhase.name}"`,
            fromEntity: updatedPhase.receivedFrom || 'External Funder',
            toEntity: updatedPhase.receivedTo || 'Project Entity',
            paymentMode: updatedPhase.paymentMode || 'Bank Transfer',
            reference: updatedPhase.reference || null,
            attachmentUrl: updatedPhase.requestLetterUrl || null,
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
      }
    }
  }

  return updatedPhase;
};

export const deletePhase = async (projectId: string, phaseId: string) => {
  const phase = await prisma.phase.findFirst({ where: { id: phaseId, projectId } });
  if (!phase) throw new AppError('Phase not found.', 404);
  await prisma.phase.delete({ where: { id: phaseId } });
};

// --- Phase Financials (aggregated) ---

export const getPhaseFinancials = async (projectId: string) => {
  const phases = await prisma.phase.findMany({
    where: { projectId },
    include: {
      transactions: {
        where: { isDeleted: false },
        include: { lines: true },
      },
    },
  });

  return phases.map((phase) => {
    let totalExpense = 0;
    phase.transactions.forEach((tx) => {
      tx.lines.forEach((line) => {
        if (line.type === 'DEBIT') {
          totalExpense += Number(line.amount);
        }
      });
    });
    return {
      id: phase.id,
      name: phase.name,
      estimatedBudget: Number(phase.estimatedBudget),
      receivedAmount: Number(phase.receivedAmount),
      totalExpense,
      balance: Number(phase.receivedAmount) - totalExpense,
      isSettled: phase.isSettled,
    };
  });
};
