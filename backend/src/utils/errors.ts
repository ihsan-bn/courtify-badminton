export class AppError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class BadRequestError extends AppError {
  public constructor(message: string, details?: unknown) {
    super(400, "BAD_REQUEST", message, details);
  }
}

export class UnauthorizedError extends AppError {
  public constructor(message = "Authentication required") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  public constructor(message = "Insufficient permissions") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  public constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  public constructor(message: string) {
    super(409, "CONFLICT", message);
  }
}

export class TooManyRequestsError extends AppError {
  public constructor(message: string) {
    super(429, "TOO_MANY_REQUESTS", message);
  }
}
