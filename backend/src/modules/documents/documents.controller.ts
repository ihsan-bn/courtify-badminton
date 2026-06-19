import type { RequestHandler, Response } from "express";

import { UnauthorizedError } from "../../utils/errors.js";
import { documentsService } from "./documents.service.js";
import { auditService } from "../audit/audit.service.js";

function sendPdf(
  response: Response,
  document: { filename: string; content: Buffer }
): void {
  response
    .status(200)
    .set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${document.filename}"`,
      "Content-Length": document.content.length.toString(),
      "Cache-Control": "private, no-store"
    })
    .send(document.content);
}

export const downloadBookingReceipt: RequestHandler = async (
  request,
  response
) => {
  if (!request.authenticatedUser) {
    throw new UnauthorizedError();
  }

  sendPdf(
    response,
    await documentsService.generateBookingReceipt(
      request.params.id as string,
      request.authenticatedUser.id
    )
  );
  await auditService.record({
    actor: {
      userId: request.authenticatedUser.id,
      role: request.authenticatedUser.role
    },
    action: "receipt_downloaded",
    entityType: "booking",
    entityId: request.params.id as string,
    summary: "Customer downloaded a booking receipt.",
    metadata: { document_type: "booking_receipt" },
    request
  });
};

export const downloadCancellationReceipt: RequestHandler = async (
  request,
  response
) => {
  if (!request.authenticatedUser) {
    throw new UnauthorizedError();
  }

  sendPdf(
    response,
    await documentsService.generateCancellationReceipt(
      request.params.id as string,
      request.authenticatedUser.id
    )
  );
  await auditService.record({
    actor: {
      userId: request.authenticatedUser.id,
      role: request.authenticatedUser.role
    },
    action: "receipt_downloaded",
    entityType: "booking",
    entityId: request.params.id as string,
    summary: "Customer downloaded a cancellation receipt.",
    metadata: { document_type: "cancellation_receipt" },
    request
  });
};

export const downloadRefundReceipt: RequestHandler = async (
  request,
  response
) => {
  if (!request.authenticatedUser) {
    throw new UnauthorizedError();
  }

  sendPdf(
    response,
    await documentsService.generateRefundReceipt(
      request.params.id as string,
      request.authenticatedUser.id
    )
  );
  await auditService.record({
    actor: {
      userId: request.authenticatedUser.id,
      role: request.authenticatedUser.role
    },
    action: "receipt_downloaded",
    entityType: "booking",
    entityId: request.params.id as string,
    summary: "Customer downloaded a refund receipt.",
    metadata: { document_type: "refund_receipt" },
    request
  });
};

export const downloadCancellationCaseSummary: RequestHandler = async (
  request,
  response
) => {
  sendPdf(
    response,
    await documentsService.generateCancellationCaseSummary(
      request.params.id as string
    )
  );
  await auditService.record({
    actor: {
      userId: request.authenticatedUser?.id ?? null,
      role: "admin"
    },
    action: "receipt_downloaded",
    entityType: "cancellation_request",
    entityId: request.params.id as string,
    summary: "Administrator downloaded a cancellation case summary.",
    metadata: { document_type: "cancellation_case_summary" },
    request
  });
};
