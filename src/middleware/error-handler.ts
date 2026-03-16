import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import logger from '../utils/logger';

export const errorHandler: ErrorRequestHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  // Log full error with all context
  logger.error({
    err,
    method: req.method,
    url: req.url,
    body: req.body,
    query: req.query,
    params: req.params,
    headers: req.headers,
    stack: err.stack
  }, 'Error handler caught error');
  
  if (res.headersSent) {
    _next(err);
    return;
  }
  // Handle custom errors
  if (err.name && err.code) {
    // check if code is a valid HTTP status code
    if (typeof err.code !== 'number' || err.code < 100 || err.code > 599) {
      err.code = 500; // default to 500 if invalid
    }
    res.status(err.code).json({ name: err.name, message: err.message });
    return;
  }
  // Default error
  res.status(err.code ?? 500).json({ message: err.message ?? 'Internal Server Error' });
};
