import type { Request, RequestHandler } from "express";
import { type ZodType, z } from "zod";

import { BadRequestError } from "../utils/errors.js";

interface ValidationSchemas {
  body?: ZodType<unknown>;
  params?: ZodType<unknown>;
  query?: ZodType<unknown>;
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (request, _response, next) => {
    try {
      if (schemas.body) {
        request.body = schemas.body.parse(request.body);
      }
      if (schemas.params) {
        request.params = schemas.params.parse(
          request.params
        ) as Request["params"];
      }
      if (schemas.query) {
        const parsedQuery = schemas.query.parse(
          request.query
        ) as Request["query"];

        // Express 5 exposes query as a getter, so assignment throws at runtime.
        Object.defineProperty(request, "query", {
          value: parsedQuery,
          writable: true,
          configurable: true,
          enumerable: true
        });
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(
          new BadRequestError(
            "Request validation failed",
            error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message
            }))
          )
        );
        return;
      }
      next(error);
    }
  };
}
