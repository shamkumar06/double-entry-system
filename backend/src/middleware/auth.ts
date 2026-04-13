import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from './errorHandler';
import { prisma } from '../lib/prisma';

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'VIEWER';
}

// Extend Express Request with authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ── Authenticate: verify JWT from HTTP-only cookie or Authorization header ──
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // Prefer HTTP-only cookie, fallback to Bearer token
    if (req.cookies?.token) {
      token = req.cookies.token as string;
    } else if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new ApiError(401, 'Authentication required. Please log in.');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    let user: any = null;
    try {
      // Verify user still exists and is active
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, isActive: true, role: true },
      });
    } catch (dbError) {
      console.error('⚠️ Database connection failed in auth middleware:', dbError);
      // If we are in "Maintenance Mode" (DB down) but it's the admin, let them in
      if (decoded.email === 'admin@doublentry.com') {
        console.log('🛡️ Admin bypass triggered (Database Offline)');
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          role: 'ADMIN',
        };
        return next();
      }
      throw new ApiError(503, 'Database is currently unvailable. Please try again soon.');
    }

    if (!user || !user.isActive) {
      throw new ApiError(401, 'User account not found or deactivated.');
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: user.role as 'ADMIN' | 'VIEWER',
    };

    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      next(new ApiError(401, 'Invalid or expired token. Please log in again.'));
    } else {
      next(err);
    }
  }
};

// ── Authorize: role-based access control ──
export const authorize = (...roles: Array<'ADMIN' | 'VIEWER'>) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Access denied. Required roles: [${roles.join(', ')}]. Your role: ${req.user.role}`
        )
      );
    }

    next();
  };
};

// ── Convenience helpers ──
export const adminOnly = authorize('ADMIN');
export const anyRole = authorize('ADMIN', 'VIEWER');
