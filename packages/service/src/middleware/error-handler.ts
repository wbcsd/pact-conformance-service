import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors';
import { TestRunError } from 'pact-conformance-test';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) {
    return _next(err);
  }

  // Handle service-side ApiError and tests-package TestRunError uniformly: both carry
  // a numeric status that maps to the HTTP response code; exclude it from the body.
  if (err instanceof ApiError || err instanceof TestRunError) {
    const { status, ...rest } = err;
    return res.status(status).json(rest);
  }

  // Default error
  if (typeof err.status === 'number' && err.status >= 100 && err.status <= 599) {
    return res.status(err.status).json(err)
  }
  return res.status(500).json({ message: err.message ?? 'Internal Server Error' });
}
