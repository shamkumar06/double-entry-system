import { Router } from 'express';
import * as system from '../controllers/system.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// Categories
router.get('/categories', authenticate, system.listCategories);
router.post('/categories', authenticate, requireAdmin, system.createCategory);
router.put('/categories/:id', authenticate, requireAdmin, system.renameCategory);
router.delete('/categories/:id', authenticate, requireAdmin, system.deleteCategory);

// Settings
router.get('/settings', authenticate, system.getSettings);
router.put('/settings', authenticate, requireAdmin, system.updateSettings);

// One-time backfill: creates allocation journal entries for all existing phases
router.post('/backfill-allocations', authenticate, requireAdmin, system.backfillAllocations);

export default router;
