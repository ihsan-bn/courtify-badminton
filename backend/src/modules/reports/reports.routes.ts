import { Router } from "express";

import {
  authenticate,
  requireAdmin
} from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  downloadBookingsReport,
  downloadCancellationsReport,
  downloadCourtUtilizationReport,
  downloadRefundsReport,
  downloadRevenueReport
} from "./reports.controller.js";
import { reportQuerySchema } from "./reports.schemas.js";

export const adminReportsRouter = Router();

adminReportsRouter.use(authenticate, requireAdmin);
adminReportsRouter.get(
  "/revenue.csv",
  validate({ query: reportQuerySchema }),
  downloadRevenueReport
);
adminReportsRouter.get(
  "/bookings.csv",
  validate({ query: reportQuerySchema }),
  downloadBookingsReport
);
adminReportsRouter.get(
  "/cancellations.csv",
  validate({ query: reportQuerySchema }),
  downloadCancellationsReport
);
adminReportsRouter.get(
  "/refunds.csv",
  validate({ query: reportQuerySchema }),
  downloadRefundsReport
);
adminReportsRouter.get(
  "/court-utilization.csv",
  validate({ query: reportQuerySchema }),
  downloadCourtUtilizationReport
);
