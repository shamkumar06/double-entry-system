import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error(`[ERROR] ${err.name}: ${err.message}`);
  
  if (err.name === 'MulterError') {
    console.error('[MULTER DETAIL] code:', (err as any).code, 'field:', (err as any).field, 'error:', err);
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message });
    return;
  }

  // Prisma unique constraint violation
  if ((err as any).code === 'P2002') {
    res.status(409).json({ success: false, message: 'A record with this value already exists.' });
    return;
  }

  // Prisma record not found
  if ((err as any).code === 'P2025') {
    res.status(404).json({ success: false, message: 'Record not found.' });
    return;
  }

  res.status(500).json({ 
    success: false, 
    message: 'Internal server error.',
    detail: err.message,
    stack: err.stack
  });
};
