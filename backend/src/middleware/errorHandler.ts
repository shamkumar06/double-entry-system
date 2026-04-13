import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class ApiError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// Central error handler middleware
export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.isOperational ? err.message : 'Internal Server Error';

  // Handle Prisma initialization errors specifically
  if (err.name === 'PrismaClientInitializationError' || err.code === 'P1001' || err.message?.includes('connect')) {
    statusCode = 503;
    message = 'Database Connection Failed. Running in Maintenance Mode.';
  }

  if (process.env.NODE_ENV === 'development') {
    console.error(`[ERROR] ${statusCode}: ${err.message}`);
    if (err.stack) console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      name: err.name,
      code: err.code 
    }),
  });
};

// Catch-all for unhandled routes
export const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  next(new ApiError(404, `Route not found — ${req.originalUrl}`));
};
