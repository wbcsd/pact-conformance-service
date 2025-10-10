import { Request, Response, NextFunction } from 'express';
import { Services } from '../services';
import logger from '../utils/logger';

/**
 * ContextRequests Express Request interface to include custom properties:
 *
 * @property services - An instance of the Services class, 
 *                      providing access to application services.
 */
type ContextRequest = Request & { services: Services };

/**
 * Represents an asynchronous request handler function for API routes.
 *
 * @param req - The incoming request context.
 * @param res - The response object used to send data back to the client.
 * @returns A promise that resolves with the handler's result.
 */
export type Handler = (req: ContextRequest, res: Response) => Promise<any>;

/**
 * Middleware wrapper that injects application services and user context into the request object,
 * then executes the provided handler function. If the handler returns a result and the response
 * headers have not been sent, the result is sent as a JSON response. Errors are logged and passed
 * to the next middleware.
 */
export const context = (handler: Handler) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    (req as ContextRequest).services = req.app.locals.services;
    const result = await handler(req as ContextRequest, res);
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(200).send();
    }
  } catch (error) {
    logger.error(error);
    next(error);
  }
};
