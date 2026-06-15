import { Router, type RequestHandler } from "express";

import { query } from "../../config/database.js";

export const healthRouter = Router();

type DatabaseCheck = () => Promise<void>;

function logDatabaseHealthError(error: unknown): void {
  console.error("Database health check failed", error);
}

export function createDatabaseHealthHandler(
  databaseCheck: DatabaseCheck
): RequestHandler {
  return async (_request, response) => {
    try {
      await databaseCheck();
      response.status(200).json({
        status: "healthy",
        database: "online"
      });
    } catch (error) {
      // Detailed diagnostics remain server-side and never enter the response.
      logDatabaseHealthError(error);
      response.status(503).json({
        status: "unhealthy",
        database: "offline"
      });
    }
  };
}

healthRouter.get("/", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "courtify-badminton-api"
  });
});

healthRouter.get(
  "/db",
  createDatabaseHealthHandler(async () => {
    await query<{ healthy: number }>("select 1 as healthy");
  })
);
