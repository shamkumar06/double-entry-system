import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, adminOnly, anyRole } from '../middleware/auth';
import {
  createJournalEntry,
  getJournal,
  updateJournalEntry,
  softDeleteTransaction,
  getTrialBalance,
  getLedger,
  getDeletedTransactions,
  restoreTransaction
} from '../services/accounting.service';
import multer from 'multer';
import { uploadFile } from '../services/upload.service';
import { generateReport } from '../services/report.service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() }); // Use memory storage — uploaded to Supabase

// ── Helper: parse phase IDs from query param ─────────────────────────────
const parsePhaseIds = (phases?: string): string[] | undefined => {
  if (!phases) return undefined;
  return phases
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
};

// ── Validation Schemas ─────────────────────────────────────────────────────
const journalSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  phaseId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Date must be YYYY-MM-DD'),
  description: z.string().min(3, 'Description must be at least 3 characters'),
  attachmentUrl: z.string().url().optional(),
  lines: z
    .array(
      z.object({
        accountId: z.string().uuid('Invalid account ID'),
        type: z.enum(['DEBIT', 'CREDIT']),
        amount: z.number().positive('Amount must be positive'),
      })
    )
    .min(2, 'Minimum 2 transaction lines required'),
});

// ── Journal Endpoints ──────────────────────────────────────────────────────

// POST /api/accounting/journal — Create new transaction (ADMIN only)
router.post('/journal', authenticate, adminOnly, async (req: Request, res: Response) => {
  const parsed = journalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const entry = await createJournalEntry(parsed.data);
  res.status(201).json({ success: true, data: entry });
});

// GET /api/accounting/journal?projectId=&phases=1,2 — Phase-filtered journal
router.get('/journal', authenticate, anyRole, async (req: Request, res: Response) => {
  const { projectId, phases } = req.query as { projectId?: string; phases?: string };

  if (!projectId) {
    res.status(400).json({ success: false, error: 'projectId is required' });
    return;
  }

  const entries = await getJournal(projectId, parsePhaseIds(phases));
  res.status(200).json({ success: true, data: entries });
});

// GET /api/accounting/trial-balance?projectId=&phases=1,2
router.get('/trial-balance', authenticate, anyRole, async (req: Request, res: Response) => {
  const { projectId, phases } = req.query as { projectId?: string; phases?: string };

  if (!projectId) {
    res.status(400).json({ success: false, error: 'projectId is required' });
    return;
  }

  const tb = await getTrialBalance(projectId, parsePhaseIds(phases));
  res.status(200).json({ success: true, data: tb });
});

// GET /api/accounting/ledger?projectId=&accountId=&phases=1,2
router.get('/ledger', authenticate, anyRole, async (req: Request, res: Response) => {
  const { projectId, accountId, phases } = req.query as {
    projectId?: string;
    accountId?: string;
    phases?: string;
  };

  if (!projectId || !accountId) {
    res.status(400).json({ success: false, error: 'projectId and accountId are required' });
    return;
  }

  const ledger = await getLedger(projectId, accountId, parsePhaseIds(phases));
  res.status(200).json({ success: true, data: ledger });
});

// DELETE /api/accounting/journal/:id — Soft delete (ADMIN only)
router.delete('/journal/:id', authenticate, adminOnly, async (req: Request, res: Response) => {
  await softDeleteTransaction(req.params.id as string);
  res.status(200).json({ success: true, message: 'Transaction moved to recycle bin.' });
});

// PUT /api/accounting/journal/:id — Update existing transaction (ADMIN only)
router.put('/journal/:id', authenticate, adminOnly, async (req: Request, res: Response) => {
  const parsed = journalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const updatedEntry = await updateJournalEntry(req.params.id as string, parsed.data);
  res.status(200).json({ success: true, data: updatedEntry });
});

// GET /api/accounting/journal/deleted — Fetch ALL soft-deleted transactions
router.get('/journal/deleted', authenticate, anyRole, async (req: Request, res: Response) => {
  const { projectId } = req.query as { projectId?: string };
  if (!projectId) {
    res.status(400).json({ success: false, error: 'projectId is required' });
    return;
  }
  const entries = await getDeletedTransactions(projectId);
  res.status(200).json({ success: true, data: entries });
});

// POST /api/accounting/journal/:id/restore — Restore a deleted transaction (ADMIN only)
router.post('/journal/:id/restore', authenticate, adminOnly, async (req: Request, res: Response) => {
  const result = await restoreTransaction(req.params.id as string);
  res.status(200).json({ success: true, data: result });
});

// ── File Upload ────────────────────────────────────────────────────────────
router.post(
  '/upload',
  authenticate,
  adminOnly,
  upload.single('file'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file provided.' });
      return;
    }

    const folder = (req.query.folder as 'receipts' | 'materials' | 'logos') || 'receipts';
    const bucketName = folder === 'logos' ? 'logos' : undefined;
    const url = await uploadFile(req.file, folder, bucketName);
    res.status(200).json({ success: true, data: { url } });
  }
);

// ── Report Generation ──────────────────────────────────────────────────────
router.post('/reports/generate', authenticate, anyRole, async (req: Request, res: Response) => {
  const { projectId, reportType, phaseIds, params } = req.body as {
    projectId?: string;
    reportType?: string;
    phaseIds?: string[];
    params?: any;
  };

  if (!projectId || !reportType) {
    res.status(400).json({ success: false, error: 'projectId and reportType are required' });
    return;
  }

  const validTypes = ['journal', 'trial-balance', 'ledger', 'Full'];
  if (!validTypes.includes(reportType)) {
    res.status(400).json({ success: false, error: `reportType must be one of: ${validTypes.join(', ')}` });
    return;
  }

  const buffer = await generateReport(
    projectId,
    reportType as 'journal' | 'trial-balance' | 'ledger' | 'Full',
    phaseIds,
    params
  );

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${reportType}-report.docx"`);
  res.status(200).send(buffer);
});

export default router;
