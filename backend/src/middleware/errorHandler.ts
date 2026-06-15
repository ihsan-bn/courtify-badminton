import type {
  ErrorRequestHandler,
  RequestHandler
} from "express";
import { DatabaseError } from "pg";

import { env } from "../config/env.js";
import { AppError, NotFoundError } from "../utils/errors.js";

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new NotFoundError("Route not found"));
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next
) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details })
      }
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON"
      }
    });
    return;
  }

  if (error instanceof DatabaseError && error.code === "23505") {
    response.status(409).json({
      error: {
        code: "CONFLICT",
        message: "A resource with those details already exists"
      }
    });
    return;
  }

  console.error(
    JSON.stringify({
      level: "error",
      message: "Unhandled request error",
      error: error instanceof Error ? error.message : "Unknown error",
      ...(!env.isProduction && error instanceof Error
        ? { stack: error.stack }
        : {})
    })
  );

  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred"
    }
  });
};
