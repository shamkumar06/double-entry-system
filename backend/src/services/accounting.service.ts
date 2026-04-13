import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/errorHandler';

interface TransactionLineInput {
  accountId: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
}

interface CreateJournalInput {
  projectId: string;
  phaseId?: string;
  date: string;
  description: string;
  fromEntity?: string;
  toEntity?: string;
  paymentMode?: string;
  reference?: string;
  attachmentUrl?: string;
  lines: TransactionLineInput[];
}

// ── Parse embedded description metadata (legacy fallback) ─────────────────
export const parseTransactionDescription = (description: string = '') => {
  if (!description?.includes('| From:')) {
    return { pureDesc: description, fromEntity: null, toEntity: null, paymentMode: null, reference: null };
  }
  const parts = description.split('|');
  const pureDesc = parts[0]?.trim() || '';
  let fromEntity: string | null = null;
  let toEntity: string | null = null;
  let paymentMode: string | null = null;
  let reference: string | null = null;

  if (parts[1]) {
    const m = parts[1].match(/From: (.*?) To: (.*)/);
    if (m) { fromEntity = m[1]?.trim() || null; toEntity = m[2]?.trim() || null; }
  }
  if (parts[2]) {
    const m = parts[2].match(/Mode: (.*?) Ref: (.*)/);
    if (m) { paymentMode = m[1]?.trim() || null; reference = m[2]?.trim() || null; }
  }
  return { pureDesc, fromEntity, toEntity, paymentMode, reference };
};

// ── Core Rule: Sum(Debits) must === Sum(Credits) ───────────────────────────
const validateDoubleEntry = (lines: TransactionLineInput[]): void => {
  let totalDebits = new Decimal(0);
  let totalCredits = new Decimal(0);

  for (const line of lines) {
    const amount = new Decimal(line.amount);
    if (amount.lte(0)) {
      throw new ApiError(400, 'All transaction amounts must be greater than zero.');
    }
    if (line.type === 'DEBIT') {
      totalDebits = totalDebits.plus(amount);
    } else {
      totalCredits = totalCredits.plus(amount);
    }
  }

  if (!totalDebits.equals(totalCredits)) {
    throw new ApiError(
      400,
      `Double-entry validation failed. Debits (${totalDebits.toFixed(2)}) must equal Credits (${totalCredits.toFixed(2)}).`
    );
  }

  if (lines.length < 2) {
    throw new ApiError(400, 'A journal entry requires at least 2 transaction lines.');
  }
};

// ── Create Journal Entry ───────────────────────────────────────────────────
export const createJournalEntry = async (input: CreateJournalInput) => {
  // 1. Validate double-entry before touching DB
  validateDoubleEntry(input.lines);

  // 2. Verify project exists
  const project = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!project) throw new ApiError(404, 'Project not found.');

  // 3. Verify phase if provided
  if (input.phaseId) {
    const phase = await prisma.phase.findFirst({
      where: { id: input.phaseId, projectId: input.projectId },
    });
    if (!phase) throw new ApiError(404, 'Phase not found in this project.');
  }

  // 4. Verify all account categories exist
  const accountIds = [...new Set(input.lines.map((l) => l.accountId))];
  const accounts = await prisma.accountCategory.findMany({
    where: { id: { in: accountIds } },
    select: { id: true },
  });
  if (accounts.length !== accountIds.length) {
    throw new ApiError(400, 'One or more account IDs are invalid.');
  }

  // 5. Wrap in Prisma $transaction for atomicity — plan rule #5.1
  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        projectId: input.projectId,
        phaseId: input.phaseId || null,
        date: new Date(input.date),
        description: input.description,
        fromEntity: input.fromEntity || null,
        toEntity: input.toEntity || null,
        paymentMode: input.paymentMode || null,
        reference: input.reference || null,
        attachmentUrl: input.attachmentUrl || null,
        lines: {
          create: input.lines.map((line) => ({
            accountId: line.accountId,
            type: line.type,
            amount: new Decimal(line.amount),
          })),
        },
      },
      include: {
        lines: {
          include: { account: { select: { id: true, code: true, name: true, type: true } } },
        },
        phase: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return transaction;
  });

  return result;
};

// ── Update Journal Entry ───────────────────────────────────────────────────
export const updateJournalEntry = async (transactionId: string, input: CreateJournalInput) => {
  validateDoubleEntry(input.lines);

  const existingTx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!existingTx) throw new ApiError(404, 'Transaction not found.');
  if (existingTx.isDeleted) throw new ApiError(400, 'Cannot edit a deleted transaction.');

  const result = await prisma.$transaction(async (tx) => {
    // Delete existing lines entirely, then rewrite them dynamically
    await tx.transactionLine.deleteMany({ where: { transactionId } });

    return tx.transaction.update({
      where: { id: transactionId },
      data: {
        projectId: input.projectId,
        phaseId: input.phaseId || null,
        date: new Date(input.date),
        description: input.description,
        fromEntity: input.fromEntity || null,
        toEntity: input.toEntity || null,
        paymentMode: input.paymentMode || null,
        reference: input.reference || null,
        attachmentUrl: input.attachmentUrl || null,
        lines: {
          create: input.lines.map((line) => ({
            accountId: line.accountId,
            type: line.type,
            amount: new Decimal(line.amount),
          })),
        },
      },
      include: { lines: { include: { account: true } }, phase: true, project: true }
    });
  });

  return result;
};

// ── Get Journal (with phase filtering) ────────────────────────────────────
export const getJournal = async (projectId: string, phaseIds?: string[]) => {
  const whereClause: Record<string, unknown> = {
    projectId,
    isDeleted: false,
  };

  if (phaseIds && phaseIds.length > 0) {
    whereClause.phaseId = { in: phaseIds }; // Prisma `in` for multi-phase — plan rule #6.1
  }

  return prisma.transaction.findMany({
    where: whereClause,
    include: {
      lines: {
        include: {
          account: { select: { id: true, code: true, name: true, type: true } },
        },
      },
      phase: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  });
};

// ── Soft Delete a transaction ──────────────────────────────────────────────
export const softDeleteTransaction = async (transactionId: string) => {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new ApiError(404, 'Transaction not found.');
  if (tx.isDeleted) throw new ApiError(400, 'Transaction is already deleted.');

  return prisma.transaction.update({
    where: { id: transactionId },
    data: { isDeleted: true, deletedAt: new Date() },
  });
};

// ── Trial Balance (phase-filtered) ─────────────────────────────────────────
export const getTrialBalance = async (projectId: string, phaseIds?: string[]) => {
  const txWhereClause: Record<string, unknown> = {
    projectId,
    isDeleted: false,
  };

  if (phaseIds && phaseIds.length > 0) {
    txWhereClause.phaseId = { in: phaseIds };
  }

  const groupedLines = await prisma.transactionLine.groupBy({
    by: ['accountId', 'type'],
    _sum: { amount: true },
    where: { transaction: txWhereClause },
  });

  const accountIds = [...new Set(groupedLines.map(g => g.accountId))];
  const accountsData = await prisma.accountCategory.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, code: true, name: true, type: true },
  });

  const accountMap: Record<string, { id: string, name: string; type: string; code: number; debits: Decimal; credits: Decimal }> = {};
  for (const acc of accountsData) {
    accountMap[acc.id] = { id: acc.id, name: acc.name, type: acc.type, code: acc.code, debits: new Decimal(0), credits: new Decimal(0) };
  }

  for (const group of groupedLines) {
    const aid = group.accountId;
    if (accountMap[aid]) {
      if (group.type === 'DEBIT') {
        accountMap[aid].debits = accountMap[aid].debits.plus(new Decimal(group._sum.amount?.toString() || '0'));
      } else {
        accountMap[aid].credits = accountMap[aid].credits.plus(new Decimal(group._sum.amount?.toString() || '0'));
      }
    }
  }

  let totalDebits = new Decimal(0);
  let totalCredits = new Decimal(0);

  const accounts = Object.values(accountMap).map((acc) => {
    totalDebits = totalDebits.plus(acc.debits);
    totalCredits = totalCredits.plus(acc.credits);
    return {
      ...acc,
      debits: acc.debits.toFixed(2),
      credits: acc.credits.toFixed(2),
      balance: acc.debits.minus(acc.credits).toFixed(2),
    };
  });

  return {
    accounts,
    totals: {
      totalDebits: totalDebits.toFixed(2),
      totalCredits: totalCredits.toFixed(2),
      isBalanced: totalDebits.equals(totalCredits),
    },
  };
};

// ── Ledger for a single account (phase-filtered) ───────────────────────────
export const getLedger = async (
  projectId: string,
  accountId: string,
  phaseIds?: string[]
) => {
  const txWhere: Record<string, unknown> = { projectId, isDeleted: false };
  if (phaseIds && phaseIds.length > 0) {
    txWhere.phaseId = { in: phaseIds };
  }

  const lines = await prisma.transactionLine.findMany({
    where: {
      accountId,
      transaction: txWhere,
    },
    include: {
      transaction: {
        include: { phase: { select: { id: true, name: true } } },
      },
      account: { select: { id: true, code: true, name: true, type: true } },
    },
    orderBy: { transaction: { date: 'asc' } },
  });

  let runningBalance = new Decimal(0);
  const isNormalDebit = ['ASSET', 'EXPENSE'].includes(lines[0]?.account.type || '');

  return lines.map((line) => {
    const amt = new Decimal(line.amount.toString());
    if (isNormalDebit) {
      runningBalance = line.type === 'DEBIT'
        ? runningBalance.plus(amt)
        : runningBalance.minus(amt);
    } else {
      runningBalance = line.type === 'CREDIT'
        ? runningBalance.plus(amt)
        : runningBalance.minus(amt);
    }

    return {
      id: line.id,
      date: line.transaction.date,
      description: line.transaction.description,
      phaseName: line.transaction.phase?.name || 'Whole Project',
      type: line.type,
      amount: amt.toFixed(2),
      runningBalance: runningBalance.toFixed(2),
      accountType: line.account.type,
    };
  });
};

// ── Project-level Financial Aggregation (for Dashboard) ────────────────────
export const getProjectFinancials = async (projectId: string, phaseIds?: string[]) => {
  const txWhere: Record<string, unknown> = { projectId, isDeleted: false };
  if (phaseIds && phaseIds.length > 0) {
    txWhere.phaseId = { in: phaseIds };
  }

  const groupedLines = await prisma.transactionLine.groupBy({
    by: ['accountId', 'type'],
    _sum: { amount: true },
    where: { transaction: txWhere },
  });

  const accountIds = [...new Set(groupedLines.map(g => g.accountId))];
  const accountsData = await prisma.accountCategory.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, type: true },
  });

  const accountTypesMap: Record<string, string> = {};
  accountsData.forEach(a => accountTypesMap[a.id] = a.type);

  let received = new Decimal(0);
  let spent = new Decimal(0);

  for (const group of groupedLines) {
    const type = accountTypesMap[group.accountId];
    const amount = new Decimal(group._sum.amount?.toString() || '0');
    
    if (group.type === 'CREDIT' && ['REVENUE', 'EQUITY', 'LIABILITY'].includes(type)) {
      received = received.plus(amount);
    }
    
    if (group.type === 'DEBIT' && type === 'EXPENSE') {
      spent = spent.plus(amount);
    }
  }

  return {
    received: received.toFixed(2),
    spent: spent.toFixed(2),
    balance: received.minus(spent).toFixed(2)
  };
};

// ── Recycle Bin Operations ────────────────────────────────────────────────
export const getDeletedTransactions = async (projectId: string) => {
  const transactions = await prisma.transaction.findMany({
    where: { projectId, isDeleted: true },
    include: {
      lines: {
        include: { account: { select: { name: true } } }
      },
      phase: { select: { name: true } }
    },
    orderBy: { deletedAt: 'desc' },
  });

  return transactions.map(tx => {
    const debitLine = tx.lines.find(l => l.type === 'DEBIT');
    
    // Disassemble description to match UI expectations
    let pureDesc = tx.description;
    let fromName = '-';
    let toName = '-';
    if (tx.description?.includes('| From:')) {
        const parts = tx.description.split('|');
        pureDesc = parts[0]?.trim() || '';
        const fromToMatch = parts[1]?.match(/From: (.*?) To: (.*)/);
        if (fromToMatch) {
            fromName = fromToMatch[1]?.trim() || '-';
            toName = fromToMatch[2]?.trim() || '-';
        }
    }

    return {
      id: tx.id,
      category_name: debitLine?.account?.name || 'Unknown',
      phase_name: tx.phase?.name || '',
      transaction_date: tx.date.toISOString().split('T')[0],
      from_name: fromName,
      to_name: toName,
      description: pureDesc,
      amount: debitLine?.amount.toNumber() || 0,
    };
  });
};

export const restoreTransaction = async (id: string) => {
  return prisma.transaction.update({
    where: { id },
    data: { isDeleted: false, deletedAt: null }
  });
};
