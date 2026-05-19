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
router.get('/:projectId/notepad', authenticate, project.getNotepad);
router.post('/:projectId/notepad', authenticate, project.saveNotepad);

// Admin only
router.post('/', authenticate, requireAdmin, project.createProject);
router.put('/:id', authenticate, requireAdmin, project.updateProject);
router.delete('/:id', authenticate, requireAdmin, project.deleteProject);

router.post('/:projectId/phases', authenticate, requireAdmin, project.createPhase);
router.put('/:projectId/phases/:phaseId', authenticate, requireAdmin, project.updatePhase);
router.delete('/:projectId/phases/:phaseId', authenticate, requireAdmin, project.deletePhase);

router.post('/:projectId/phases/:phaseId/settle', authenticate, requireAdmin, project.settlePhase);
router.post('/:projectId/phases/:phaseId/unsettle', authenticate, requireAdmin, project.unsettlePhase);
router.post('/:projectId/phases/:phaseId/reallocate', authenticate, requireAdmin, project.reallocateSurplus);

// Procurement Routes
router.get('/:projectId/procurement', authenticate, procurement.listProcurements);
router.post('/:projectId/procurement', authenticate, requireAdmin, upload.any(), procurement.createProcurement);
router.put('/:projectId/procurement/items/:itemId', authenticate, requireAdmin, upload.any(), procurement.updateProcurement);
router.delete('/:projectId/procurement/items/:itemId', authenticate, requireAdmin, procurement.deleteProcurement);

// Photo Gallery & Management Routes
router.get('/:projectId/procurement/items/:itemId/photos', authenticate, procurement.listPhotos);
router.post('/:projectId/procurement/items/:itemId/photos', authenticate, requireAdmin, upload.any(), procurement.uploadPhotos);
router.delete('/:projectId/procurement/items/:itemId/photos', authenticate, requireAdmin, procurement.deletePhoto);
router.get('/:projectId/procurement/photos/view', authenticate, procurement.streamPhotoProxy);


export default router;

