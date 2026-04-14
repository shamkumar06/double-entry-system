import { Request, Response } from 'express';
import { z } from 'zod';
import {
  registerUser,
  loginUser,
  adminCreateUser,
  updateUserRole,
  listUsers,
  resetUserPassword,
  updateUser,
  deleteUser,
} from '../services/auth.service';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true, // Always true for cross-site 'none' cookies
  sameSite: 'none' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ── Validation Schemas ─────────────────────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const adminCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'VIEWER']),
  name: z.string().optional(),
});

const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'VIEWER']),
});

// ── Controllers ────────────────────────────────────────────────────────────
export const register = async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const { email, password, name } = parsed.data;
  const { user, token } = await registerUser(email, password, name);

  res.cookie('token', token, COOKIE_OPTIONS);
  res.status(201).json({ success: true, data: { user, token } });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const { email, password } = parsed.data;
  const { user, token } = await loginUser(email, password);

  res.cookie('token', token, COOKIE_OPTIONS);
  res.status(200).json({ success: true, data: { user, token } });
};

export const logout = (_req: Request, res: Response): void => {
  res.clearCookie('token', COOKIE_OPTIONS);
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

export const getMe = (req: Request, res: Response): void => {
  res.status(200).json({ success: true, data: req.user });
};

// ── Admin Controllers ──────────────────────────────────────────────────────
export const adminCreate = async (req: Request, res: Response): Promise<void> => {
  const parsed = adminCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }
  const { email, password, role, name } = parsed.data;
  const user = await adminCreateUser(email, password, role, name);
  res.status(201).json({ success: true, data: user });
};

export const changeRole = async (req: Request, res: Response): Promise<void> => {
  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }
  const user = await updateUserRole(req.params.userId as string, parsed.data.role);
  res.status(200).json({ success: true, data: user });
};

export const getAllUsers = async (_req: Request, res: Response): Promise<void> => {
  const users = await listUsers();
  res.status(200).json({ success: true, data: users });
};

export const adminResetPassword = async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({ password: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }
  const user = await resetUserPassword(req.params.userId as string, parsed.data.password);
  res.status(200).json({ success: true, data: user });
};

export const adminUpdateUser = async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    isActive: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }
  const user = await updateUser(req.params.userId as string, parsed.data);
  res.status(200).json({ success: true, data: user });
};

export const adminDeleteUser = async (req: Request, res: Response): Promise<void> => {
  await deleteUser(req.params.userId as string);
  res.status(200).json({ success: true, message: 'User deleted.' });
};
