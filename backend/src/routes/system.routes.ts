import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, adminOnly, anyRole } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/errorHandler';
import {
  getExchangeRates,
  getSystemSettings,
  updateSystemSettings,
} from '../services/currency.service';

const router = Router();

// ── Account Categories ─────────────────────────────────────────────────────
const categorySchema = z.object({
  code: z.number().int().positive(),
  name: z.string().min(2),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  description: z.string().optional(),
});

router.get('/categories', authenticate, anyRole, async (_req: Request, res: Response) => {
  const categories = await prisma.accountCategory.findMany({
    orderBy: [{ type: 'asc' }, { code: 'asc' }],
  });
  res.json({ success: true, data: categories });
});

router.post('/categories', authenticate, adminOnly, async (req: Request, res: Response) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }
  const category = await prisma.accountCategory.create({ data: parsed.data });
  res.status(201).json({ success: true, data: category });
});

router.put('/categories/:id', authenticate, adminOnly, async (req: Request, res: Response) => {
  const category = await prisma.accountCategory.findUnique({ where: { id: req.params.id as string } });
  if (!category) throw new ApiError(404, 'Category not found.');
  if (category.isSystem) throw new ApiError(403, 'System categories cannot be modified.');

  const parsed = categorySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }
  const updated = await prisma.accountCategory.update({
    where: { id: req.params.id as string },
    data: parsed.data,
  });
  res.json({ success: true, data: updated });
});

router.delete('/categories/:id', authenticate, adminOnly, async (req: Request, res: Response) => {
  const category = await prisma.accountCategory.findUnique({ where: { id: req.params.id as string } });
  if (!category) throw new ApiError(404, 'Category not found.');
  if (category.isSystem) throw new ApiError(403, 'System categories cannot be deleted.');

  await prisma.accountCategory.delete({ where: { id: req.params.id as string } });
  res.json({ success: true, message: 'Category deleted.' });
});

// ── System Settings ────────────────────────────────────────────────────────
router.get('/settings', authenticate, anyRole, async (_req: Request, res: Response) => {
  const settings = await getSystemSettings();
  res.json({ success: true, data: settings });
});

router.put('/settings', authenticate, adminOnly, async (req: Request, res: Response) => {
  const schema = z.object({
    baseCurrency: z.string().length(3).toUpperCase().optional(),
    exchangeRateApiKey: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }
  const settings = await updateSystemSettings(parsed.data);
  res.json({ success: true, data: settings });
});

// ── Exchange Rates ─────────────────────────────────────────────────────────
router.get('/exchange-rates', authenticate, anyRole, async (req: Request, res: Response) => {
  const base = (req.query.base as string) || 'INR';
  const rates = await getExchangeRates(base);
  res.json({ success: true, data: { base, rates } });
});

export default router;
