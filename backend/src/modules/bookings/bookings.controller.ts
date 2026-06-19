import type { RequestHandler } from "express";

import {
  ForbiddenError,
  UnauthorizedError
} from "../../utils/errors.js";
import type {
  AdminCancellationActionInput,
  CancelBookingInput,
  CreateBookingLockInput
} from "./bookings.schemas.js";
import { bookingsService } from "./bookings.service.js";
import { auditService } from "../audit/audit.service.js";

export const createBookingLock: RequestHandler = async (
  request,
  response
) => {
  const authenticatedUser = request.authenticatedUser;
  if (!authenticatedUser) {
    throw new UnauthorizedError();
  }
  if (authenticatedUser.role !== "customer") {
    throw new ForbiddenError("Customer access required");
  }

  const result = await bookingsService.createLock(
    authenticatedUser.id,
    request.body as CreateBookingLockInput
  );
  await auditService.record({
    actor: { userId: authenticatedUser.id, role: authenticatedUser.role },
    action: "booking_lock_created",
    entityType: "booking",
    entityId: result.booking_id,
    summary: "Customer created a temporary booking lock.",
    metadata: {
      court_id: result.court_id,
      reservation_start_at: result.reservation_start_at,
      reservation_end_at: result.reservation_end_at,
      total_amount_bnd: result.total_amount_bnd
    },
    request
  });
  response.status(201).json(result);
};

export const getMyBookings: RequestHandler = async (request, response) => {
  const authenticatedUser = request.authenticatedUser;
  if (!authenticatedUser) {
    throw new UnauthorizedError();
  }
  if (authenticatedUser.role !== "customer") {
    throw new ForbiddenError("Customer access required");
  }

  const bookings = await bookingsService.getCustomerHistory(
    authenticatedUser.id
  );
  response.status(200).json({ bookings });
};

export const getAdminBookings: RequestHandler = async (request, response) => {
  const bookings = await bookingsService.getAdminBookings(
    request.query
  );
  response.status(200).json({ bookings });
};

export const cancelBooking: RequestHandler = async (request, response) => {
  const authenticatedUser = request.authenticatedUser;
  if (!authenticatedUser) {
    throw new UnauthorizedError();
  }

  const result = await bookingsService.cancelBooking(
    authenticatedUser.id,
    authenticatedUser.role === "admin",
    request.params.bookingId as string,
    request.body as CancelBookingInput
  );
  await auditService.record({
    actor: { userId: authenticatedUser.id, role: authenticatedUser.role },
    action: "cancellation_requested",
    entityType: "booking",
    entityId: result.booking_id,
    summary:
      authenticatedUser.role === "admin"
        ? "Administrator submitted a cancellation request."
        : "Customer submitted a cancellation request.",
    metadata: {
      cancellation_request_id: result.cancellation_request_id,
      status: result.status
    },
    request
  });
  response.status(200).json(result);
};

export const getCancellationRequests: RequestHandler = async (
  _request,
  response
) => {
  const cancellationRequests =
    await bookingsService.getCancellationRequests();
  response.status(200).json({ cancellation_requests: cancellationRequests });
};

export const getCancellationRequestDetail: RequestHandler = async (
  request,
  response
) => {
  const cancellationRequest =
    await bookingsService.getCancellationRequestDetail(
      request.params.id as string
    );
  await auditService.record({
    actor: {
      userId: request.authenticatedUser?.id ?? null,
      role: "admin"
    },
    action: "admin_cancellation_viewed",
    entityType: "cancellation_request",
    entityId: cancellationRequest.cancellation_request_id,
    summary: "Administrator viewed a cancellation case.",
    metadata: { booking_id: cancellationRequest.booking_id },
    request
  });
  response.status(200).json({ cancellation_request: cancellationRequest });
};

export const addCancellationRequestAction: RequestHandler = async (
  request,
  response
) => {
  const authenticatedUser = request.authenticatedUser;
  if (!authenticatedUser) {
    throw new UnauthorizedError();
  }

  const result = await bookingsService.addCancellationAction(
    authenticatedUser.id,
    request.params.id as string,
    request.body as AdminCancellationActionInput
  );
  await auditService.record({
    actor: { userId: authenticatedUser.id, role: "admin" },
    action: "admin_cancellation_status_updated",
    entityType: "cancellation_request",
    entityId: result.cancellation_request_id,
    summary: "Administrator updated a cancellation case status.",
    metadata: {
      booking_id: result.booking_id,
      action: result.action,
      cancellation_status: result.cancellation_status,
      booking_status: result.booking_status
    },
    request
  });

  const specializedActions: Partial<
    Record<AdminCancellationActionInput["action"], string>
  > = {
    cancellation_approved: "cancellation_approved",
    cancellation_rejected: "cancellation_rejected",
    refund_in_progress: "refund_in_progress",
    refund_completed: "refund_completed",
    close_case: "case_closed"
  };
  const specializedAction = specializedActions[result.action];
  if (specializedAction) {
    await auditService.record({
      actor: { userId: authenticatedUser.id, role: "admin" },
      action: specializedAction,
      entityType: "cancellation_request",
      entityId: result.cancellation_request_id,
      summary: `Administrator completed action ${specializedAction.replaceAll(
        "_",
        " "
      )}.`,
      metadata: {
        booking_id: result.booking_id,
        cancellation_status: result.cancellation_status
      },
      request
    });
  }
  response.status(200).json(result);
};
