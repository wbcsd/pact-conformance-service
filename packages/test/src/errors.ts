export class TestRunError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends TestRunError {
  constructor(message: string) {
    super(404, message);
  }
}

export class BadRequestError extends TestRunError {
  constructor(message: string) {
    super(400, message);
  }
}
