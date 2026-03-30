/**
 * Custom error classes for the REST API
 * These errors are handled by the error middleware in middleware/context.ts
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = new.target.name;
    // Ensure instanceof works reliably across transpilation targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(404, message);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string) {
    super(400, message);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(400, message);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string) {
    super(401, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string) {
    super(403, message);
  }
}

export class RequestTimeoutError extends ApiError {
  constructor(message: string) {
    super(408, message);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message);
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message: string) {
    super(429, message);
  }
}

export class InternalServerError extends ApiError {
  constructor(message: string) {
    super(500, message);
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message: string) {
    super(503, message);
  }
}

