/**
 * Custom error classes for the REST API
 * These errors are handled by the error middleware in middleware/context.ts
 */

export class NotFoundError extends Error {
  code = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
    this.message = message;
  }
}

export class BadRequestError extends Error {
  code = 400;
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
    this.message = message;
  }
}

export class ValidationError extends Error {
  code = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    this.message = message;
  }
}

export class UnauthorizedError extends Error {
  code = 401;
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
    this.message = message;
  }
}

export class ForbiddenError extends Error {
  code = 403;
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
    this.message = message;
  }
}

export class RequestTimeoutError extends Error {
  code = 408;
  constructor(message: string) {
    super(message);
    this.name = 'RequestTimeoutError';
    this.message = message;
  }
}

export class ConflictError extends Error {
  code = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictRequestError';
    this.message = message;
  }
} 

export class TooManyRequestsError extends Error {
  code = 429;
  constructor(message: string) {
    super(message);
    this.name = 'TooManyRequestsError';
    this.message = message;
  }
}

export class InternalServerError extends Error {
  code = 500;
  constructor(message: string) {
    super(message);
    this.name = 'InternalServerError';
    this.message = message;
  }
}

export class ServiceUnavailableError extends Error {
  code = 503
  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
    this.message = message;
  }
}

