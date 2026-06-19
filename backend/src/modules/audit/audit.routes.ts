import { Router } from "express";

import {
  authenticate,
  requireAdmin
} from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { getAuditLogs } from "./audit.controller.js";
import { auditLogsQuerySchema } from "./audit.schemas.js";

export const adminAuditRouter = Router();

adminAuditRouter.get(
  "/",
  authenticate,
  requireAdmin,
  validate({ query: auditLogsQuerySchema }),
  getAuditLogs
);
