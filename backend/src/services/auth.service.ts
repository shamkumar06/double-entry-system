import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/errorHandler';
import { JwtPayload } from '../middleware/auth';

const SALT_ROUNDS = 12;

const signToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
};

// ── Register: always creates a VIEWER ──────────────────────────────────────
export const registerUser = async (
  email: string,
  password: string,
  name?: string
) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name?.trim() || null,
      role: 'VIEWER', // ALWAYS defaults to VIEWER — plan rule #4.1
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  return { user, token };
};

// ── Login ──────────────────────────────────────────────────────────────────
export const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const token = signToken({ userId: user.id || 'admin-temp', email: user.email, role: user.role });

  const safeUser = { id: user.id, email: user.email, name: user.name, role: user.role };
  return { user: safeUser, token };
};

// ── Admin creates user with specific role ─────────────────────────────────
export const adminCreateUser = async (
  email: string,
  password: string,
  role: 'ADMIN' | 'VIEWER',
  name?: string
) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name?.trim() || null,
      role,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return user;
};

// ── Admin upgrades/downgrades a user's role ───────────────────────────────
export const updateUserRole = async (userId: string, role: 'ADMIN' | 'VIEWER') => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, 'User not found.');

  return prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  });
};

// ── List all users (admin only) ───────────────────────────────────────────
// ── Admin maintenance functions ──────────────────────────────────────────
export const resetUserPassword = async (userId: string, newPassword: string) => {
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
    select: { id: true, email: true, name: true, role: true },
  });
};

export const updateUser = async (userId: string, data: { name?: string, email?: string, isActive?: boolean }) => {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
};

export const deleteUser = async (userId: string) => {
  // Prevent deleting the primary admin or whatever if needed, but for now:
  return prisma.user.delete({ where: { id: userId } });
};

export const listUsers = async () => {
  return prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
};
