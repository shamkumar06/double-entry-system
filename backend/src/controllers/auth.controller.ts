import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { AuthRequest } from '../middleware/auth';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = req.body;
    const user = await authService.register(email, password, name);
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const { token, user } = await authService.login(email, password);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ success: true, data: { ...user, token } });
  } catch (err) { next(err); }
};

export const logout = (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out.' });
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getMe(req.user!.id);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

export const listUsers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await authService.listUsers();
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
};

export const adminCreateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, role, name } = req.body;
    const user = await authService.adminCreateUser(email, password, role, name);
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
};

export const changeUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.changeUserRole(req.params.userId as string, req.body.role);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.resetPassword(req.params.userId as string, req.body.password);
    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err) { next(err); }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.updateUser(req.params.userId as string, req.body);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.deleteUser(req.params.userId as string);
    res.json({ success: true, message: 'User deleted.' });
  } catch (err) { next(err); }
};
