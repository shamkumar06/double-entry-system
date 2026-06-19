import { Request, Response, NextFunction } from 'express';
import * as systemService from '../services/system.service';
import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';

export const listCategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await systemService.listCategories();
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await systemService.createCategory(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
};

export const renameCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await systemService.renameCategory(req.params.id as string, req.body.name);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await systemService.deleteCategory(req.params.id as string);
    res.json({ success: true, message: 'Category deleted.' });
  } catch (err) { next(err); }
};

export const getSettings = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await systemService.getSettings();
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await systemService.updateSettings(req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const backfillAllocations = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure "Fund Received" system equity account exists
    let fundReceivedCategory = await prisma.accountCategory.findFirst({ where: { name: 'Fund Received' } });
    if (!fundReceivedCategory) {
      const maxCode = await prisma.accountCategory.findFirst({ orderBy: { code: 'desc' } });
      fundReceivedCategory = await prisma.accountCategory.create({
        data: {
          code: maxCode ? maxCode.code + 1 : 4,
          name: 'Fund Received',
          type: 'EQUITY',
          description: 'Source of funds allocated to a phase by management',
          isSystem: true,
        },
      });
    }

    const bankCategory = await prisma.accountCategory.findFirst({ where: { name: 'Bank' } });
    if (!bankCategory) {
      res.status(500).json({ success: false, message: '"Bank" account category not found. Seed it first.' });
      return;
    }

    const phases = await prisma.phase.findMany({
      where: { receivedAmount: { gt: 0 } },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const results: { phase: string; status: string; amount?: number }[] = [];

    for (const phase of phases) {
      const existing = await prisma.transaction.findFirst({
        where: {
          phaseId: phase.id,
          isDeleted: false,
          description: { contains: 'SYSTEM AUTOMATED ALLOCATION' },
        },
      });

      if (existing) {
        results.push({ phase: `${phase.project.name} / ${phase.name}`, status: 'skipped (already exists)' });
        continue;
      }

      const received = Number(phase.receivedAmount);
      await prisma.transaction.create({
        data: {
          projectId: phase.projectId,
          phaseId: phase.id,
          date: phase.createdAt,
          description: `SYSTEM AUTOMATED ALLOCATION: Funds received for ${phase.name}`,
          fromEntity: phase.receivedFrom || 'College Management',
          toEntity: phase.receivedTo || phase.name,
          paymentMode: phase.paymentMode || 'AUTO',
          reference: 'ALLOC-' + phase.id.slice(0, 8).toUpperCase(),
          lines: {
            create: [
              { accountId: bankCategory.id, type: 'DEBIT', amount: new Prisma.Decimal(received) },
              { accountId: fundReceivedCategory.id, type: 'CREDIT', amount: new Prisma.Decimal(received) },
            ],
          },
        },
      });
      results.push({ phase: `${phase.project.name} / ${phase.name}`, status: 'created', amount: received });
    }

    res.json({ success: true, data: { processed: phases.length, results } });
  } catch (err) { next(err); }
};
