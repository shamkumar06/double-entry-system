import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

interface TransactionLineInput {
  accountId: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
}

interface CreateTransactionInput {
  projectId: string;
  phaseId?: string;
  date: string;
  description: string;
  fromEntity?: string;
  toEntity?: string;
  paymentMode?: string;
  reference?: string;
  attachmentUrl?: string;
  cgst?: number;
  sgst?: number;
  igst?: number;
  discount?: number;
  actualAmount?: number;
  lines: TransactionLineInput[];
}

const validateDoubleEntry = (lines: TransactionLineInput[]) => {
  const totalDebit = lines
    .filter((l) => l.type === 'DEBIT')
    .reduce((sum, l) => sum + l.amount, 0);
  const totalCredit = lines
    .filter((l) => l.type === 'CREDIT')
    .reduce((sum, l) => sum + l.amount, 0);

  // Use toFixed to handle floating point precision
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new AppError(
      `Unbalanced entry: Debits (${totalDebit}) ≠ Credits (${totalCredit})`,
      400
    );
  }
};

export const createTransaction = async (input: CreateTransactionInput) => {
  validateDoubleEntry(input.lines);

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        projectId: input.projectId,
        phaseId: input.phaseId || null,
        date: new Date(input.date),
        description: input.description,
        fromEntity: input.fromEntity,
        toEntity: input.toEntity,
        paymentMode: input.paymentMode,
        reference: input.reference,
        attachmentUrl: input.attachmentUrl,
        cgst: input.cgst !== undefined ? new Prisma.Decimal(input.cgst) : null,
        sgst: input.sgst !== undefined ? new Prisma.Decimal(input.sgst) : null,
        igst: input.igst !== undefined ? new Prisma.Decimal(input.igst) : null,
        discount: input.discount !== undefined ? new Prisma.Decimal(input.discount) : null,
        actualAmount: input.actualAmount !== undefined ? new Prisma.Decimal(input.actualAmount) : null,
        lines: {
          create: input.lines.map((l) => ({
            accountId: l.accountId,
            type: l.type,
            amount: new Prisma.Decimal(l.amount),
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });
    return transaction;
  });
};

export const updateTransaction = async (id: string, input: Partial<CreateTransactionInput>) => {
  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing || existing.isDeleted) throw new AppError('Transaction not found.', 404);

  if (input.lines) validateDoubleEntry(input.lines);

  return prisma.$transaction(async (tx) => {
    if (input.lines) {
      await tx.transactionLine.deleteMany({ where: { transactionId: id } });
    }

    return tx.transaction.update({
      where: { id },
      data: {
        ...(input.date && { date: new Date(input.date) }),
        ...(input.description && { description: input.description }),
        ...(input.fromEntity !== undefined && { fromEntity: input.fromEntity }),
        ...(input.toEntity !== undefined && { toEntity: input.toEntity }),
        ...(input.paymentMode !== undefined && { paymentMode: input.paymentMode }),
        ...(input.reference !== undefined && { reference: input.reference }),
        ...(input.attachmentUrl !== undefined && { attachmentUrl: input.attachmentUrl }),
        ...(input.cgst !== undefined && { cgst: input.cgst !== null ? new Prisma.Decimal(input.cgst) : null }),
        ...(input.sgst !== undefined && { sgst: input.sgst !== null ? new Prisma.Decimal(input.sgst) : null }),
        ...(input.igst !== undefined && { igst: input.igst !== null ? new Prisma.Decimal(input.igst) : null }),
        ...(input.discount !== undefined && { discount: input.discount !== null ? new Prisma.Decimal(input.discount) : null }),
        ...(input.actualAmount !== undefined && { actualAmount: input.actualAmount !== null ? new Prisma.Decimal(input.actualAmount) : null }),
        ...(input.phaseId !== undefined && { phaseId: input.phaseId }),
        ...(input.lines && {
          lines: {
            create: input.lines.map((l) => ({
              accountId: l.accountId,
              type: l.type,
              amount: new Prisma.Decimal(l.amount),
            })),
          },
        }),
      },
      include: { lines: { include: { account: true } } },
    });
  });
};

export const softDeleteTransaction = async (id: string) => {
  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing) throw new AppError('Transaction not found.', 404);
  await prisma.transaction.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });
};

export const restoreTransaction = async (id: string) => {
  await prisma.transaction.update({
    where: { id },
    data: { isDeleted: false, deletedAt: null },
  });
};

export const getJournal = async (projectId: string, phaseIds?: string[]) => {
  return prisma.transaction.findMany({
    where: {
      projectId,
      isDeleted: false,
      ...(phaseIds?.length ? { phaseId: { in: phaseIds } } : {}),
    },
    include: {
      lines: { include: { account: { select: { id: true, name: true, type: true, code: true } } } },
      phase: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  });
};

export const getDeletedTransactions = async (projectId: string) => {
  return prisma.transaction.findMany({
    where: { projectId, isDeleted: true },
    include: {
      lines: { include: { account: { select: { id: true, name: true, type: true } } } },
      phase: { select: { id: true, name: true } },
    },
    orderBy: { deletedAt: 'desc' },
  });
};

export const getTrialBalance = async (projectId: string, phaseIds?: string[]) => {
  const lines = await prisma.transactionLine.findMany({
    where: {
      transaction: {
        projectId,
        isDeleted: false,
        ...(phaseIds?.length ? { phaseId: { in: phaseIds } } : {}),
      },
    },
    include: {
      account: { select: { id: true, name: true, type: true, code: true } },
    },
  });

  const accounts: Record<
    string,
    { id: string; name: string; type: string; code: number; debit: number; credit: number }
  > = {};

  lines.forEach((line) => {
    const key = line.accountId;
    if (!accounts[key]) {
      accounts[key] = {
        id: line.account.id,
        name: line.account.name,
        type: line.account.type,
        code: line.account.code,
        debit: 0,
        credit: 0,
      };
    }
    if (line.type === 'DEBIT') {
      accounts[key].debit += Number(line.amount);
    } else {
      accounts[key].credit += Number(line.amount);
    }
  });

  let totalDebits = 0;
  let totalCredits = 0;

  const accountsArray = Object.values(accounts).map(acc => {
    const netBalance = acc.debit - acc.credit;
    totalDebits += acc.debit;
    totalCredits += acc.credit;
    
    return {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      code: acc.code,
      balance: netBalance
    };
  }).sort((a, b) => a.code - b.code);

  return {
    accounts: accountsArray,
    totals: {
      totalDebits,
      totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01
    }
  };
};

export const getLedger = async (projectId: string, accountId: string, phaseIds?: string[]) => {
  const account = await prisma.accountCategory.findUnique({ where: { id: accountId } });
  if (!account) return [];

  const lines = await prisma.transactionLine.findMany({
    where: {
      accountId,
      transaction: {
        projectId,
        isDeleted: false,
        ...(phaseIds?.length ? { phaseId: { in: phaseIds } } : {}),
      },
    },
    include: {
      transaction: {
        select: {
          id: true,
          date: true,
          description: true,
          reference: true,
          phase: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { transaction: { date: 'asc' } },
  });

  let runningBalance = 0;
  const isNormalDebit = ['ASSET', 'EXPENSE'].includes(account.type);

  return lines.map(line => {
    const amount = Number(line.amount);
    
    if (isNormalDebit) {
       if (line.type === 'DEBIT') runningBalance += amount;
       else runningBalance -= amount;
    } else {
       if (line.type === 'CREDIT') runningBalance += amount;
       else runningBalance -= amount;
    }

    return {
      id: line.id,
      date: line.transaction.date,
      description: line.transaction.description,
      reference: line.transaction.reference,
      phaseName: line.transaction.phase?.name || null,
      type: line.type,
      amount: amount,
      accountType: account.type,
      runningBalance
    };
  });
};
