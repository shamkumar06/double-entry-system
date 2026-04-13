import { Router } from 'express';
import { authenticate, adminOnly, anyRole } from '../middleware/auth';
import {
  register,
  login,
  logout,
  getMe,
  adminCreate,
  changeRole,
  getAllUsers,
  adminResetPassword,
  adminUpdateUser,
  adminDeleteUser,
} from '../controllers/auth.controller';

const router = Router();

// Public
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Authenticated
router.get('/me', authenticate, anyRole, getMe);

// Admin only
router.post('/admin/create', authenticate, adminOnly, adminCreate);
router.patch('/admin/users/:userId/role', authenticate, adminOnly, changeRole);
router.get('/admin/users', authenticate, adminOnly, getAllUsers);
router.post('/admin/users/:userId/reset-password', authenticate, adminOnly, adminResetPassword);
router.patch('/admin/users/:userId', authenticate, adminOnly, adminUpdateUser);
router.delete('/admin/users/:userId', authenticate, adminOnly, adminDeleteUser);

export default router;
