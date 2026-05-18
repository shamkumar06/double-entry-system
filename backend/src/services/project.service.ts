import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { Prisma } from '@prisma/client';

export const listProjects = async () => {
  const projects = await prisma.project.findMany({
    where: { isActive: true },
    include: {
      phases: {
        orderBy: { createdAt: 'asc' },
        include: {
          transactions: {
            where: { isDeleted: false },
            include: { lines: { include: { account: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return projects.map((project) => {
    const mappedPhases = project.phases.map((phase) => {
      let spent_amount = 0;
      let manualSettlement = 0;

      phase.transactions.forEach((tx) => {
        tx.lines.forEach((line) => {
          if (line.account?.name === 'Settlement Amount') {
            if (line.type === 'DEBIT') {
              manualSettlement += Number(line.amount);
            }
          } else if (line.type === 'DEBIT') {
            spent_amount += Number(line.amount);
          }
        });
      });

      const effectiveReturned = Math.max(Number(phase.returnedAmount || 0), manualSettlement);
      const effectiveIsSettled = phase.isSettled || manualSettlement > 0;

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
        returnedAmount: effectiveReturned,
        reallocatedAmount: Number(phase.reallocatedAmount || 0),
        isSettled: effectiveIsSettled,
        createdAt: phase.createdAt,
        updatedAt: phase.updatedAt,
        spent_amount,
      };
    });

    return {
      ...project,
      phases: mappedPhases,
    };
  });
};

export const getProject = async (id: string) => {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      phases: {
        orderBy: { createdAt: 'asc' },
        include: {
          transactions: {
            where: { isDeleted: false },
            include: { lines: { include: { account: true } } },
          },
        },
      },
    },
  });
  if (!project) throw new AppError('Project not found.', 404);

  const mappedPhases = project.phases.map((phase) => {
    let spent_amount = 0;
    let manualSettlement = 0;

    phase.transactions.forEach((tx) => {
      tx.lines.forEach((line) => {
        if (line.account?.name === 'Settlement Amount') {
          if (line.type === 'DEBIT') {
            manualSettlement += Number(line.amount);
          }
        } else if (line.type === 'DEBIT') {
          spent_amount += Number(line.amount);
        }
      });
    });

    const effectiveReturned = Math.max(Number(phase.returnedAmount || 0), manualSettlement);
    const effectiveIsSettled = phase.isSettled || manualSettlement > 0;

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
      returnedAmount: effectiveReturned,
      reallocatedAmount: Number(phase.reallocatedAmount || 0),
      isSettled: effectiveIsSettled,
      createdAt: phase.createdAt,
      updatedAt: phase.updatedAt,
      spent_amount,
    };
  });

  return {
    ...project,
    phases: mappedPhases,
  };
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
        include: { lines: { include: { account: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return phases.map((phase) => {
    let spent_amount = 0;
    let manualSettlement = 0;

    phase.transactions.forEach((tx) => {
      tx.lines.forEach((line) => {
        if (line.account?.name === 'Settlement Amount') {
          if (line.type === 'DEBIT') {
            manualSettlement += Number(line.amount);
          }
        } else if (line.type === 'DEBIT') {
          spent_amount += Number(line.amount);
        }
      });
    });

    const effectiveReturned = Math.max(Number(phase.returnedAmount || 0), manualSettlement);
    const effectiveIsSettled = phase.isSettled || manualSettlement > 0;

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
      returnedAmount: effectiveReturned,
      reallocatedAmount: Number(phase.reallocatedAmount || 0),
      isSettled: effectiveIsSettled,
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
        include: { lines: { include: { account: true } } },
      },
    },
  });

  return phases.map((phase) => {
    let totalExpense = 0;
    let manualSettlement = 0;

    phase.transactions.forEach((tx) => {
      tx.lines.forEach((line) => {
        if (line.account?.name === 'Settlement Amount') {
          if (line.type === 'DEBIT') {
            manualSettlement += Number(line.amount);
          }
        } else if (line.type === 'DEBIT') {
          totalExpense += Number(line.amount);
        }
      });
    });

    const effectiveReturned = Math.max(Number(phase.returnedAmount || 0), manualSettlement);
    const effectiveIsSettled = phase.isSettled || manualSettlement > 0;

    return {
      id: phase.id,
      name: phase.name,
      estimatedBudget: Number(phase.estimatedBudget),
      receivedAmount: Number(phase.receivedAmount),
      returnedAmount: effectiveReturned,
      reallocatedAmount: Number(phase.reallocatedAmount || 0),
      totalExpense,
      balance: (Number(phase.receivedAmount) + Number(phase.reallocatedAmount || 0)) - (totalExpense + effectiveReturned),
      isSettled: effectiveIsSettled,
    };
  });
};

export const settlePhase = async (projectId: string, phaseId: string) => {
  const phase = await prisma.phase.findFirst({
    where: { id: phaseId, projectId },
    include: {
      transactions: {
        where: { isDeleted: false },
        include: { lines: true }
      }
    }
  });
  if (!phase) throw new AppError('Phase not found.', 404);
  if (phase.isSettled) throw new AppError('Phase is already settled.', 400);

  // 1. Calculate spent_amount
  let spentAmount = 0;
  phase.transactions.forEach((tx) => {
    tx.lines.forEach((line) => {
      if (line.type === 'DEBIT') {
        spentAmount += Number(line.amount);
      }
    });
  });

  // 2. Compute current balance: (receivedAmount + reallocatedAmount) - spentAmount
  const currentBalance = (Number(phase.receivedAmount) + Number(phase.reallocatedAmount || 0)) - spentAmount;
  if (currentBalance < 0) {
    throw new AppError('Cannot settle a phase with a negative balance.', 400);
  }

  // 3. Find categories
  const settlementCategory = await prisma.accountCategory.findFirst({
    where: { name: 'Settlement Amount' }
  });
  const bankCategory = await prisma.accountCategory.findFirst({
    where: { name: 'Bank' }
  });
  
  if (!settlementCategory || !bankCategory) {
    throw new AppError('System categories for settlement (Settlement Amount or Bank) not seeded.', 500);
  }

  return prisma.$transaction(async (tx) => {
    // 4. Update phase
    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: {
        isSettled: true,
        returnedAmount: currentBalance,
      }
    });

    // 5. If balance > 0, automate system transaction
    if (currentBalance > 0) {
      await tx.transaction.create({
        data: {
          projectId,
          phaseId,
          date: new Date(),
          description: `SYSTEM AUTOMATED SETTLEMENT: Returned surplus of ₹${currentBalance.toLocaleString('en-IN')} to College Management`,
          fromEntity: phase.name,
          toEntity: 'College Management',
          paymentMode: 'AUTO',
          reference: 'SETTLE-' + phaseId.slice(0, 8).toUpperCase(),
          lines: {
            create: [
              {
                accountId: settlementCategory.id,
                type: 'DEBIT',
                amount: new Prisma.Decimal(currentBalance),
              },
              {
                accountId: bankCategory.id,
                type: 'CREDIT',
                amount: new Prisma.Decimal(currentBalance),
              }
            ]
          }
        }
      });
    }

    return updatedPhase;
  });
};

export const reallocateSurplus = async (
  projectId: string,
  targetPhaseId: string,
  sourcePhaseId: string
) => {
  const targetPhase = await prisma.phase.findFirst({ where: { id: targetPhaseId, projectId } });
  const sourcePhase = await prisma.phase.findFirst({
    where: { id: sourcePhaseId, projectId },
    include: {
      transactions: {
        where: { isDeleted: false },
        include: { lines: { include: { account: true } } }
      }
    }
  });

  if (!targetPhase) throw new AppError('Target phase not found.', 404);
  if (!sourcePhase) throw new AppError('Source phase not found.', 404);

  // Calculate manual settlement
  let manualSettlement = 0;
  sourcePhase.transactions.forEach((tx) => {
    tx.lines.forEach((line) => {
      if (line.account?.name === 'Settlement Amount' && line.type === 'DEBIT') {
        manualSettlement += Number(line.amount);
      }
    });
  });

  const effectiveIsSettled = sourcePhase.isSettled || manualSettlement > 0;
  if (!effectiveIsSettled) throw new AppError('Source phase is not settled yet.', 400);

  const surplus = Math.max(Number(sourcePhase.returnedAmount || 0), manualSettlement);
  if (surplus <= 0) {
    throw new AppError('Source phase has no returned surplus to reallocate.', 400);
  }

  // Check if already reallocated
  const existingReallocation = await prisma.phase.findFirst({
    where: {
      projectId,
      reallocatedAmount: surplus,
      transactions: {
        some: {
          description: {
            contains: `Rolled-over surplus from ${sourcePhase.name}`
          }
        }
      }
    }
  });
  if (existingReallocation) {
    throw new AppError(`The surplus of ${sourcePhase.name} has already been reallocated to ${existingReallocation.name}.`, 400);
  }

  // Find system categories
  const reallocatedCategory = await prisma.accountCategory.findFirst({
    where: { name: 'Reallocated Fund' }
  });
  const bankCategory = await prisma.accountCategory.findFirst({
    where: { name: 'Bank' }
  });

  if (!reallocatedCategory || !bankCategory) {
    throw new AppError('System categories for reallocation (Reallocated Fund or Bank) not seeded.', 500);
  }

  return prisma.$transaction(async (tx) => {
    // 1. Update target phase
    const updatedTargetPhase = await tx.phase.update({
      where: { id: targetPhaseId },
      data: {
        reallocatedAmount: surplus
      }
    });

    // 2. Automate double-entry transaction
    await tx.transaction.create({
      data: {
        projectId,
        phaseId: targetPhaseId,
        date: new Date(),
        description: `SYSTEM AUTOMATED REALLOCATION: Rolled-over surplus from ${sourcePhase.name} to ${targetPhase.name}`,
        fromEntity: sourcePhase.name,
        toEntity: targetPhase.name,
        paymentMode: 'AUTO',
        reference: 'REALLOC-' + sourcePhaseId.slice(0, 8).toUpperCase(),
        lines: {
          create: [
            {
              accountId: bankCategory.id,
              type: 'DEBIT',
              amount: new Prisma.Decimal(surplus),
            },
            {
              accountId: reallocatedCategory.id,
              type: 'CREDIT',
              amount: new Prisma.Decimal(surplus),
            }
          ]
        }
      }
    });

    return updatedTargetPhase;
  });
};
