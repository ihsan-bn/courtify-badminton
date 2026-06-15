import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

export const requestLogger: RequestHandler = (request, response, next) => {
  const requestId = request.header("x-request-id") ?? randomUUID();
  const startedAt = performance.now();

  response.setHeader("x-request-id", requestId);

  response.on("finish", () => {
    console.info(
      JSON.stringify({
        level: "info",
        message: "HTTP request completed",
        requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100
      })
    );
  });

  next();
};
