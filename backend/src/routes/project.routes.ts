import { Router } from 'express';
import * as project from '../controllers/project.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// All authenticated
router.get('/', authenticate, project.listProjects);
router.get('/:id', authenticate, project.getProject);
router.get('/:projectId/phases', authenticate, project.listPhases);
router.get('/:projectId/phase-financials', authenticate, project.getPhaseFinancials);

// Admin only
router.post('/', authenticate, requireAdmin, project.createProject);
router.put('/:id', authenticate, requireAdmin, project.updateProject);
router.delete('/:id', authenticate, requireAdmin, project.deleteProject);

router.post('/:projectId/phases', authenticate, requireAdmin, project.createPhase);
router.put('/:projectId/phases/:phaseId', authenticate, requireAdmin, project.updatePhase);
router.delete('/:projectId/phases/:phaseId', authenticate, requireAdmin, project.deletePhase);

router.post('/:projectId/phases/:phaseId/settle', authenticate, requireAdmin, project.settlePhase);
router.post('/:projectId/phases/:phaseId/reallocate', authenticate, requireAdmin, project.reallocateSurplus);

export default router;
