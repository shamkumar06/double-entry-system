import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import * as accounting from '../controllers/accounting.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// Journal - read
router.get('/journal', authenticate, accounting.getJournal);
router.get('/journal/deleted', authenticate, accounting.getDeletedTransactions);

// Journal - write (admin only)
router.post('/journal', authenticate, requireAdmin, accounting.createTransaction);
router.put('/journal/:id', authenticate, requireAdmin, accounting.updateTransaction);
router.delete('/journal/:id', authenticate, requireAdmin, accounting.deleteTransaction);
router.post('/journal/:id/restore', authenticate, requireAdmin, accounting.restoreTransaction);

// Reports & Ledger - read
router.get('/trial-balance', authenticate, accounting.getTrialBalance);
router.get('/ledger', authenticate, accounting.getLedger);
router.post('/reports/generate', authenticate, accounting.generateReport);

// File Upload
router.post('/upload', authenticate, requireAdmin, upload.single('file'), accounting.uploadFile);

export default router;
