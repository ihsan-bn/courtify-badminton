import type { RequestHandler } from "express";

import {
  ForbiddenError,
  UnauthorizedError
} from "../../utils/errors.js";
import type {
  CancelBookingInput,
  CreateBookingLockInput
} from "./bookings.schemas.js";
import { bookingsService } from "./bookings.service.js";

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
  if (authenticatedUser.role !== "customer") {
    throw new ForbiddenError("Customer access required");
  }

  const result = await bookingsService.cancelBooking(
    authenticatedUser.id,
    request.params.bookingId as string,
    request.body as CancelBookingInput
  );
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
