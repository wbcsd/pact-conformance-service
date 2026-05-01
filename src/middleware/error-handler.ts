import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) {
    return _next(err);
  }

  // Handle API custom errors defined in common/errors.ts.
  if (err instanceof ApiError) {  
    // Exclude the status property from the error response body to avoid redundancy, 
    // as it's already set in the HTTP status code.
    const { status, ...rest } = err;
    return res.status(status).json(rest);
  }

  // Default error
  if (typeof err.status === 'number' && err.status >= 100 && err.status <= 599) {
    return res.status(err.status).json(err)
  }
  return res.status(500).json({ message: err.message ?? 'Internal Server Error' });
}
