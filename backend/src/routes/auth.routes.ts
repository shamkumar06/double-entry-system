import { Router } from 'express';
import * as auth from '../controllers/auth.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// Public
router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/logout', auth.logout);

// Authenticated
router.get('/me', authenticate, auth.getMe);

// Admin only
router.get('/admin/users', authenticate, requireAdmin, auth.listUsers);
router.post('/admin/create', authenticate, requireAdmin, auth.adminCreateUser);
router.patch('/admin/users/:userId/role', authenticate, requireAdmin, auth.changeUserRole);
router.post('/admin/users/:userId/reset-password', authenticate, requireAdmin, auth.resetPassword);
router.patch('/admin/users/:userId', authenticate, requireAdmin, auth.updateUser);
router.delete('/admin/users/:userId', authenticate, requireAdmin, auth.deleteUser);

export default router;
