import { Router } from 'express';
import multer from 'multer';
import * as project from '../controllers/project.controller';
import * as procurement from '../controllers/procurement.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

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

// Procurement Routes
router.get('/:projectId/procurement', authenticate, procurement.listProcurements);
router.post('/:projectId/procurement', authenticate, requireAdmin, upload.array('files', 10), procurement.createProcurement);
router.put('/:projectId/procurement/items/:itemId', authenticate, requireAdmin, upload.array('files', 10), procurement.updateProcurement);
router.delete('/:projectId/procurement/items/:itemId', authenticate, requireAdmin, procurement.deleteProcurement);


export default router;

