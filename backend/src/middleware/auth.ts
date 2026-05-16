import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export const authenticate = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  try {
    // Try cookie first, then Authorization header (Bearer token)
    const token =
      req.cookies?.token ||
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) throw new AppError('No authentication token provided.', 401);

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError('Invalid or expired token.', 401));
  }
};

export const requireAdmin = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'ADMIN') {
    return next(new AppError('Admin access required.', 403));
  }
  next();
};
