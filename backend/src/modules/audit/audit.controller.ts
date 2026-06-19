import type { RequestHandler } from "express";

import { auditService } from "./audit.service.js";
import type { AuditLogsQuery } from "./audit.schemas.js";

export const getAuditLogs: RequestHandler = async (request, response) => {
  const result = await auditService.getLogs(
    request.query as unknown as AuditLogsQuery
  );
  response.status(200).json(result);
};
