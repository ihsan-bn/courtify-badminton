import { Router } from "express";

import {
  authenticate,
  requireAdmin
} from "../../middleware/auth.js";
import {
  getDashboardAnalytics,
  getDashboardOperations,
  getDashboardSummary
} from "./dashboard.controller.js";

export const adminDashboardRouter = Router();

adminDashboardRouter.get(
  "/summary",
  authenticate,
  requireAdmin,
  getDashboardSummary
);

adminDashboardRouter.get(
  "/operations",
  authenticate,
  requireAdmin,
  getDashboardOperations
);

adminDashboardRouter.get(
  "/analytics",
  authenticate,
  requireAdmin,
  getDashboardAnalytics
);
