import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  logger.error(err);
  if (res.headersSent) {
    _next(err);
  }
  // Handle custom errors
  if (err.name && err.code) {
    res.status(err.code).json({ name: err.name, message: err.message });
  }
  // Default error
  res.status(err.code ?? 500).json({ message: err.message ?? 'Internal Server Error' });
}
