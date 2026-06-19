import { Router } from "express";

import {
  authenticate,
  requireAdmin
} from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  downloadBookingReceipt,
  downloadCancellationCaseSummary,
  downloadCancellationReceipt,
  downloadRefundReceipt
} from "./documents.controller.js";
import {
  bookingDocumentParamsSchema,
  cancellationCaseParamsSchema
} from "./documents.schemas.js";

export const bookingDocumentsRouter = Router();

bookingDocumentsRouter.get(
  "/:id/receipt",
  authenticate,
  validate({ params: bookingDocumentParamsSchema }),
  downloadBookingReceipt
);
bookingDocumentsRouter.get(
  "/:id/cancellation-receipt",
  authenticate,
  validate({ params: bookingDocumentParamsSchema }),
  downloadCancellationReceipt
);
bookingDocumentsRouter.get(
  "/:id/refund-receipt",
  authenticate,
  validate({ params: bookingDocumentParamsSchema }),
  downloadRefundReceipt
);

export const adminDocumentsRouter = Router();

adminDocumentsRouter.get(
  "/:id/case-summary",
  authenticate,
  requireAdmin,
  validate({ params: cancellationCaseParamsSchema }),
  downloadCancellationCaseSummary
);
