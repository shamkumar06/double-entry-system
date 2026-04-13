import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, adminOnly, anyRole } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/errorHandler';
import * as accountingService from '../services/accounting.service';

const router = Router();

// ── Project Schemas ────────────────────────────────────────────────────────
const projectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters'),
  description: z.string().optional(),
  totalFunds: z.number().nonnegative().optional(),
  logoUrl: z.string().url().or(z.literal('')).optional(),
});

const phaseSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  estimatedBudget: z.number().nonnegative().optional(),
  received_amount: z.number().nonnegative().optional(),
  received_from: z.string().optional(),
  received_to: z.string().optional(),
  payment_mode: z.string().optional(),
  reference: z.string().optional(),
  is_received: z.boolean().optional(),
  isSettled: z.boolean().optional(),  // ← allows settlement toggle
});

// ── Projects ───────────────────────────────────────────────────────────────
router.get('/', authenticate, anyRole, async (_req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: { isActive: true },
      include: { _count: { select: { phases: true, transactions: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: projects });
  } catch (error: any) {
    console.error('Database error in project listing:', error.message);
    res.status(503).json({ 
      success: false, 
      error: 'Database Connection Failed. Running in Maintenance Mode.',
      data: [] 
    });
  }
});

router.get('/:id', authenticate, anyRole, async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id as string },
    include: {
      phases: { orderBy: { createdAt: 'asc' } },
      _count: { select: { transactions: true } },
    },
  });
  if (!project) throw new ApiError(404, 'Project not found.');

  // Aggregate project-level financials
  const financials = await accountingService.getProjectFinancials(project.id);
  
  res.json({ 
    success: true, 
    data: {
      ...project,
      received_amount: parseFloat(financials.received),
      spent_amount: parseFloat(financials.spent),
      remaining_balance: parseFloat(financials.balance)
    } 
  });
});

router.post('/', authenticate, adminOnly, async (req: Request, res: Response) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }
  const project = await prisma.project.create({ data: parsed.data });
  res.status(201).json({ success: true, data: project });
});

router.put('/:id', authenticate, adminOnly, async (req: Request, res: Response) => {
  const parsed = projectSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }
  const project = await prisma.project.update({
    where: { id: req.params.id as string },
    data: parsed.data,
  });
  res.json({ success: true, data: project });
});

router.delete('/:id', authenticate, adminOnly, async (req: Request, res: Response) => {
  await prisma.project.update({
    where: { id: req.params.id as string },
    data: { isActive: false },
  });
  res.json({ success: true, message: 'Project archived successfully.' });
});

// ── Phases ─────────────────────────────────────────────────────────────────
router.get('/:projectId/phases', authenticate, anyRole, async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const phases = await prisma.phase.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });

  // Calculate detailed financials for each phase
  const enrichedPhases = await Promise.all(phases.map(async (phase) => {
    // 1. Get all non-deleted transactions for this phase
    const transactions = await prisma.transaction.findMany({
      where: { phaseId: phase.id, isDeleted: false },
      include: { lines: { include: { account: true } } }
    });

    let received = 0;
    let spent = 0;

    // 2. Tally up received funds and expenses
    transactions.forEach(tx => {
      tx.lines.forEach(line => {
        const amount = Number(line.amount);
        
        // RECEIVED: Credits to Income, Equity, or Liability accounts linked to this phase
        if (line.type === 'CREDIT' && ['REVENUE', 'EQUITY', 'LIABILITY'].includes(line.account.type)) {
          received += amount;
        }
        
        // SPENT: Debits to Expense accounts linked to this phase
        if (line.type === 'DEBIT' && line.account.type === 'EXPENSE') {
          spent += amount;
        }
      });

      // Extract specifically the Initial Funding amount to prevent UI edit double-counting
      let initialFunding = 0;
      if (tx.description.startsWith('Initial Funding for Phase:')) {
         const debitLine = tx.lines.find(l => l.type === 'DEBIT');
         if (debitLine) initialFunding = Number(debitLine.amount);
      }
    });

    // We only need one initialFunding per phase, but since we iterate all transactions we should find it correctly.
    // Wait, the loop above was inside transactions.forEach. Let me restructure so initialFunding is correctly found.
    const initialTx = transactions.find(tx => tx.description.startsWith('Initial Funding for Phase:'));
    const initialFundingAmount = initialTx?.lines.find(l => l.type === 'DEBIT')?.amount || 0;

    return {
      ...phase,
      received_amount: received,
      spent_amount: spent,
      initial_funding_amount: Number(initialFundingAmount),
      remaining_balance: Number(phase.estimatedBudget) - spent
    };
  }));

  res.json({ success: true, data: enrichedPhases });
});

// ── Phase Financial Aggregates ─────────────────────────────────────────────
// Single-call endpoint returning per-phase spending for Dashboard breakdowns.
// Avoids the N+1 pattern in the frontend that looped per-phase journal fetches.
router.get('/:id/phase-financials', authenticate, anyRole, async (req: Request, res: Response) => {
  const projectId = req.params.id as string;

  const [phases, phaseLines] = await Promise.all([
    prisma.phase.findMany({
      where: { projectId },
      select: { id: true, name: true, estimatedBudget: true },
    }),
    prisma.transactionLine.findMany({
      where: { transaction: { projectId, isDeleted: false, phaseId: { not: null } } },
      select: {
        type: true,
        amount: true,
        account: { select: { type: true } },
        transaction: { select: { phaseId: true } },
      },
    }),
  ]);

  // Aggregate per phase in-memory
  const phaseMap: Record<string, { received: number; spent: number }> = {};
  phases.forEach(ph => { phaseMap[ph.id] = { received: 0, spent: 0 }; });

  phaseLines.forEach(line => {
    const phId = line.transaction.phaseId!;
    if (!phaseMap[phId]) return;
    const accountType = line.account?.type || '';
    const amount = Number(line.amount);
    if (line.type === 'CREDIT' && ['REVENUE', 'EQUITY', 'LIABILITY'].includes(accountType)) {
      phaseMap[phId].received += amount;
    }
    if (line.type === 'DEBIT' && accountType === 'EXPENSE') {
      phaseMap[phId].spent += amount;
    }
  });

  const result = phases.map(ph => ({
    phaseId: ph.id,
    phaseName: ph.name,
    budget: Number(ph.estimatedBudget),
    received: phaseMap[ph.id]?.received || 0,
    spent: phaseMap[ph.id]?.spent || 0,
    balance: (phaseMap[ph.id]?.received || 0) - (phaseMap[ph.id]?.spent || 0),
  }));

  res.json({ success: true, data: result });
});

router.post('/:projectId/phases', authenticate, adminOnly, async (req: Request, res: Response) => {
  const parsed = phaseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const projectId = req.params.projectId as string;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new ApiError(404, 'Project not found.');

  // Extract non-model financial fields
  const { received_amount, received_from, received_to, payment_mode, reference, ...phaseData } = parsed.data;

  // Execute in a transaction to ensure data integrity
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the phase
    const phase = await tx.phase.create({
      data: {
        name: phaseData.name,
        description: phaseData.description,
        estimatedBudget: phaseData.estimatedBudget || 0,
        projectId: projectId
      }
    });

    // 2. If initial funding is provided, create a transaction record
    const amount = Number(received_amount) || 0;
    if (amount > 0) {
      // Find suitable accounts (Cash/Bank for Asset, and a generic 'Fund' for Inflow)
      const categories = await tx.accountCategory.findMany();
      const assetAcc = categories.find(c => 
        c.type === 'ASSET' && (c.name.toLowerCase().includes('cash') || c.name.toLowerCase().includes('bank'))
      ) || categories.find(c => c.type === 'ASSET') || categories[0];

      const creditAcc = categories.find(c => 
        (c.type === 'EQUITY' || c.type === 'REVENUE') && (c.name.toLowerCase().includes('fund') || c.name.toLowerCase().includes('grant'))
      ) || categories.find(c => c.type === 'EQUITY' || c.type === 'REVENUE') || categories[0];

      if (assetAcc && creditAcc) {
          const finalMode = payment_mode === 'Cash' ? 'Cash' : (payment_mode || 'Bank Transfer');
          const description = `Initial Funding for Phase: ${phase.name} | From: ${received_from || '-'} To: ${received_to || '-'} | Mode: ${finalMode} Ref: ${reference || '-'}`;
          
          await tx.transaction.create({
            data: {
              projectId,
              phaseId: phase.id,
              date: new Date(),
              description,
              lines: {
                create: [
                  { accountId: assetAcc.id, type: 'DEBIT', amount: amount },
                  { accountId: creditAcc.id, type: 'CREDIT', amount: amount }
                ]
              }
            }
          });
      }
    }

    return phase;
  });

  res.status(201).json({ success: true, data: result });
});

router.put('/:projectId/phases/:phaseId', authenticate, adminOnly, async (req: Request, res: Response) => {
  const parsed = phaseSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }
  
  // Extract non-model financial fields
  const { received_amount, received_from, received_to, payment_mode, reference, is_received, ...phaseData } = parsed.data;
  const projectId = req.params.projectId as string;
  const phaseId = req.params.phaseId as string;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update the phase itself
      const updatedPhase = await tx.phase.update({
        where: { id: phaseId },
        data: phaseData,
      });

      // 2. Handle initial funding transaction if received_amount is provided
      if (received_amount !== undefined) {
        const amount = Number(received_amount) || 0;
        
        // Find existing initial funding transaction
        const existingTx = await tx.transaction.findFirst({
          where: {
            phaseId: phaseId,
            description: { startsWith: 'Initial Funding for Phase:' },
            isDeleted: false
          },
          include: { lines: true }
        });

        if (amount > 0) {
          const finalMode = payment_mode === 'Cash' ? 'Cash' : (payment_mode || 'Bank Transfer');
          const description = `Initial Funding for Phase: ${updatedPhase.name} | From: ${received_from || '-'} To: ${received_to || '-'} | Mode: ${finalMode} Ref: ${reference || '-'}`;

          if (existingTx) {
            // Update existing transaction and lines
            await tx.transaction.update({
              where: { id: existingTx.id },
              data: { description }
            });
            
            const debitAccount = existingTx.lines.find(l => l.type === 'DEBIT')?.accountId;
            const creditAccount = existingTx.lines.find(l => l.type === 'CREDIT')?.accountId;
            
            if (debitAccount && creditAccount) {
              await tx.transactionLine.deleteMany({
                where: { transactionId: existingTx.id }
              });
              
              await tx.transactionLine.createMany({
                data: [
                  { transactionId: existingTx.id, accountId: debitAccount, type: 'DEBIT', amount },
                  { transactionId: existingTx.id, accountId: creditAccount, type: 'CREDIT', amount }
                ]
              });
            }
          } else {
            // Create new transaction (same logic as in POST)
            const categories = await tx.accountCategory.findMany();
            const assetAcc = categories.find(c => 
              c.type === 'ASSET' && (c.name.toLowerCase().includes('cash') || c.name.toLowerCase().includes('bank'))
            ) || categories.find(c => c.type === 'ASSET') || categories[0];

            const creditAcc = categories.find(c => 
              (c.type === 'EQUITY' || c.type === 'REVENUE') && (c.name.toLowerCase().includes('fund') || c.name.toLowerCase().includes('grant'))
            ) || categories.find(c => c.type === 'EQUITY' || c.type === 'REVENUE') || categories[0];

            if (assetAcc && creditAcc) {
              await tx.transaction.create({
                data: {
                  projectId,
                  phaseId: phaseId,
                  date: new Date(),
                  description,
                  lines: {
                    create: [
                      { accountId: assetAcc.id, type: 'DEBIT', amount: amount },
                      { accountId: creditAcc.id, type: 'CREDIT', amount: amount }
                    ]
                  }
                }
              });
            }
          }
        } else if (existingTx) {
          // If amount is 0, delete the initial funding transaction
          await tx.transaction.update({
            where: { id: existingTx.id },
            data: { isDeleted: true, deletedAt: new Date() }
          });
        }
      }

      return updatedPhase;
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Phase update transaction error:", error);
    res.status(500).json({ success: false, error: 'Failed to complete update' });
  }
});

router.delete('/:projectId/phases/:phaseId', authenticate, adminOnly, async (req: Request, res: Response) => {
  const phaseId = req.params.phaseId as string;
  
  await prisma.$transaction(async (tx) => {
    // 1. Soft delete all transactions associated with this phase
    await tx.transaction.updateMany({
      where: { phaseId },
      data: { isDeleted: true, deletedAt: new Date() }
    });

    // 2. Delete the phase record
    await tx.phase.delete({ where: { id: phaseId } });
  });

  res.json({ success: true, message: 'Phase and its transactions moved to recycle bin.' });
});

export default router;
