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
      let manualReallocation = 0;

      phase.transactions.forEach((tx) => {
        tx.lines.forEach((line) => {
          if (line.account?.name === 'Settlement Amount') {
            if (line.type === 'DEBIT') {
              manualSettlement += Number(line.amount);
            }
          } else if (line.account?.name === 'Reallocated Fund') {
            if (line.type === 'CREDIT') {
              manualReallocation += Number(line.amount);
            }
          } else if (line.type === 'DEBIT') {
            spent_amount += Number(line.amount);
          }
        });
      });

      const effectiveReturned = manualSettlement;
      const effectiveReallocated = manualReallocation;
      const effectiveIsSettled = phase.isSettled;

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
        reallocatedAmount: effectiveReallocated,
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
    let manualReallocation = 0;

    phase.transactions.forEach((tx) => {
      tx.lines.forEach((line) => {
        if (line.account?.name === 'Settlement Amount') {
          if (line.type === 'DEBIT') {
            manualSettlement += Number(line.amount);
          }
        } else if (line.account?.name === 'Reallocated Fund') {
          if (line.type === 'CREDIT') {
            manualReallocation += Number(line.amount);
          }
        } else if (line.type === 'DEBIT') {
          spent_amount += Number(line.amount);
        }
      });
    });

    const effectiveReturned = manualSettlement;
    const effectiveReallocated = manualReallocation;
    const effectiveIsSettled = phase.isSettled;

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
      reallocatedAmount: effectiveReallocated,
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
    let manualReallocation = 0;

    phase.transactions.forEach((tx) => {
      tx.lines.forEach((line) => {
        if (line.account?.name === 'Settlement Amount') {
          if (line.type === 'DEBIT') {
            manualSettlement += Number(line.amount);
          }
        } else if (line.account?.name === 'Reallocated Fund') {
          if (line.type === 'CREDIT') {
            manualReallocation += Number(line.amount);
          }
        } else if (line.type === 'DEBIT') {
          spent_amount += Number(line.amount);
        }
      });
    });

    const effectiveReturned = manualSettlement;
    const effectiveReallocated = manualReallocation;
    const effectiveIsSettled = phase.isSettled;

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
      reallocatedAmount: effectiveReallocated,
      isSettled: effectiveIsSettled,
      createdAt: phase.createdAt,
      updatedAt: phase.updatedAt,
      spent_amount,
    };
  });
};

const detectCashAccount = async (
  projectId: string,
  phaseId?: string,
  txClient: any = prisma
) => {
  if (phaseId) {
    const creditLines = await txClient.transactionLine.findMany({
      where: {
        type: 'CREDIT',
        transaction: {
          phaseId,
          projectId,
          isDeleted: false,
          description: { not: { contains: 'SYSTEM AUTOMATED' } },
        },
      },
      include: { account: { select: { id: true, name: true, type: true } } },
    });

    const freq: Record<string, { id: string; name: string; count: number }> = {};
    for (const line of creditLines) {
      if (line.account.type === 'ASSET') {
        const key = line.accountId;
        if (!freq[key]) freq[key] = { id: line.account.id, name: line.account.name, count: 0 };
        freq[key].count++;
      }
    }

    const sorted = Object.values(freq).sort((a, b) => b.count - a.count);
    if (sorted.length > 0) {
      return sorted[0].id;
    }
  }

  const projectCreditLines = await txClient.transactionLine.findMany({
    where: {
      type: 'CREDIT',
      transaction: {
        projectId,
        isDeleted: false,
        description: { not: { contains: 'SYSTEM AUTOMATED' } },
      },
    },
    include: { account: { select: { id: true, name: true, type: true } } },
  });

  const freq: Record<string, { id: string; name: string; count: number }> = {};
  for (const line of projectCreditLines) {
    if (line.account.type === 'ASSET') {
      const key = line.accountId;
      if (!freq[key]) freq[key] = { id: line.account.id, name: line.account.name, count: 0 };
      freq[key].count++;
    }
  }

  const sorted = Object.values(freq).sort((a, b) => b.count - a.count);
  if (sorted.length > 0) {
    return sorted[0].id;
  }

  const fallback =
    await txClient.accountCategory.findFirst({ where: { name: 'Cash', type: 'ASSET' } }) ||
    await txClient.accountCategory.findFirst({ where: { name: 'Bank', type: 'ASSET' } }) ||
    await txClient.accountCategory.findFirst({ where: { type: 'ASSET' } });

  return fallback?.id || null;
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
  // 1. Find system accounts needed for the allocation journal entry
  const fundReceivedCategory = await prisma.accountCategory.findFirst({ where: { name: 'Fund Received' } });

  return prisma.$transaction(async (tx) => {
    // 2. Create the phase record
    const phase = await tx.phase.create({
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
      },
    });

    // 3. If a received amount is set, auto-create the double-entry allocation journal
    const received = Number(data.receivedAmount || 0);
    if (received > 0 && fundReceivedCategory) {
      const cashAccountId = await detectCashAccount(projectId, phase.id, tx);
      if (cashAccountId) {
        await tx.transaction.create({
          data: {
            projectId,
            phaseId: phase.id,
            date: new Date(),
            description: `SYSTEM AUTOMATED ALLOCATION: Funds received for ${data.name}`,
            fromEntity: data.receivedFrom || 'College Management',
            toEntity: data.receivedTo || phase.name,
            paymentMode: data.paymentMode || 'AUTO',
            reference: 'ALLOC-' + phase.id.slice(0, 8).toUpperCase(),
            lines: {
              create: [
                {
                  // DEBIT Bank — cash flows in
                  accountId: cashAccountId,
                  type: 'DEBIT',
                  amount: new Prisma.Decimal(received),
                },
                {
                  // CREDIT Fund Received — equity / source of funds
                  accountId: fundReceivedCategory.id,
                  type: 'CREDIT',
                  amount: new Prisma.Decimal(received),
                },
              ],
            },
          },
        });
      }
    }

    return phase;
  });
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

  const isUnsettling = data.isSettled === false;
  const receivedAmountChanged =
    data.receivedAmount !== undefined &&
    Number(data.receivedAmount) !== Number(phase.receivedAmount);

  // Build updateData — only include fields that were explicitly provided (not undefined)
  // This is critical when called from Settings with only { isSettled: false }
  const rawUpdate: any = {
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
  };
  // Strip out undefined so Prisma does not try to nullify required fields
  const updateData: any = Object.fromEntries(
    Object.entries(rawUpdate).filter(([, v]) => v !== undefined)
  );

  if (isUnsettling) {
    updateData.returnedAmount = new Prisma.Decimal(0);
    // REMOVED: Destructive soft-delete of all settlement transactions.
    // Ledger records of partial returns should be preserved even when reopening a phase.
  }

  return prisma.$transaction(async (tx) => {
    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: updateData,
    });

    // If receivedAmount changed, re-journal the allocation
    if (receivedAmountChanged) {
      const fundReceivedCategory = await tx.accountCategory.findFirst({ where: { name: 'Fund Received' } });
      const cashAccountId = await detectCashAccount(projectId, phaseId, tx);

      if (fundReceivedCategory && cashAccountId) {
        // Soft-delete any prior allocation journal entries for this phase
        const existingAllocTx = await tx.transaction.findMany({
          where: {
            phaseId,
            projectId,
            isDeleted: false,
            description: { contains: 'SYSTEM AUTOMATED ALLOCATION' },
          },
        });
        if (existingAllocTx.length > 0) {
          await tx.transaction.updateMany({
            where: { id: { in: existingAllocTx.map((t) => t.id) } },
            data: { isDeleted: true, deletedAt: new Date() },
          });
        }

        // Create new allocation journal if new amount > 0
        const newReceived = Number(data.receivedAmount);
        if (newReceived > 0) {
          await tx.transaction.create({
            data: {
              projectId,
              phaseId,
              date: new Date(),
              description: `SYSTEM AUTOMATED ALLOCATION: Funds received for ${updatedPhase.name}`,
              fromEntity: data.receivedFrom || String(phase.receivedFrom || 'College Management'),
              toEntity: data.receivedTo || String(phase.receivedTo || updatedPhase.name),
              paymentMode: data.paymentMode || String(phase.paymentMode || 'AUTO'),
              reference: 'ALLOC-' + phaseId.slice(0, 8).toUpperCase(),
              lines: {
                create: [
                  {
                    accountId: cashAccountId,
                    type: 'DEBIT',
                    amount: new Prisma.Decimal(newReceived),
                  },
                  {
                    accountId: fundReceivedCategory.id,
                    type: 'CREDIT',
                    amount: new Prisma.Decimal(newReceived),
                  },
                ],
              },
            },
          });
        }
      }
    }

    return updatedPhase;
  });
};

export const unsettlePhase = async (projectId: string, phaseId: string) => {
  const phase = await prisma.phase.findFirst({ where: { id: phaseId, projectId } });
  if (!phase) throw new AppError('Phase not found.', 404);

  // REMOVED: Soft-delete ALL settlement transactions for this phase.
  // We keep historical returns in the ledger, just toggle the phase state to OPEN.

  // Reset phase settlement state
  const updatedPhase = await prisma.phase.update({
    where: { id: phaseId },
    data: {
      isSettled: false,
      returnedAmount: new Prisma.Decimal(0),
    },
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
    let manualReallocation = 0;

    phase.transactions.forEach((tx) => {
      tx.lines.forEach((line) => {
        if (line.account?.name === 'Settlement Amount') {
          if (line.type === 'DEBIT') {
            manualSettlement += Number(line.amount);
          }
        } else if (line.account?.name === 'Reallocated Fund') {
          if (line.type === 'CREDIT') {
            manualReallocation += Number(line.amount);
          }
        } else if (line.type === 'DEBIT') {
          totalExpense += Number(line.amount);
        }
      });
    });

    const effectiveReturned = manualSettlement;
    const effectiveReallocated = manualReallocation;
    const effectiveIsSettled = phase.isSettled;

    return {
      id: phase.id,
      name: phase.name,
      estimatedBudget: Number(phase.estimatedBudget),
      receivedAmount: Number(phase.receivedAmount),
      returnedAmount: effectiveReturned,
      reallocatedAmount: effectiveReallocated,
      totalExpense,
      balance: (Number(phase.receivedAmount) + effectiveReallocated) - (totalExpense + effectiveReturned),
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
  
  if (!settlementCategory) {
    throw new AppError('System categories for settlement (Settlement Amount) not seeded.', 500);
  }

  return prisma.$transaction(async (tx) => {
    const cashAccountId = await detectCashAccount(projectId, phaseId, tx);
    if (!cashAccountId) {
      throw new AppError('No ASSET account found for settlement.', 500);
    }

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
                accountId: cashAccountId,
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

  if (!reallocatedCategory) {
    throw new AppError('System categories for reallocation (Reallocated Fund) not seeded.', 500);
  }

  return prisma.$transaction(async (tx) => {
    const cashAccountId = await detectCashAccount(projectId, targetPhaseId, tx);
    if (!cashAccountId) {
      throw new AppError('No ASSET account found for reallocation.', 500);
    }

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
              accountId: cashAccountId,
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
