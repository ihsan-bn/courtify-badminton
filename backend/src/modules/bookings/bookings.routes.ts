import { Router } from "express";

import {
  authenticate,
  requireAdmin
} from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  cancelBooking,
  createBookingLock,
  getAdminBookings,
  getCancellationRequests,
  getMyBookings
} from "./bookings.controller.js";
import {
  adminBookingsQuerySchema,
  cancelBookingBodySchema,
  cancelBookingParamsSchema,
  createBookingLockSchema
} from "./bookings.schemas.js";

export const bookingsRouter = Router();

bookingsRouter.post(
  "/lock",
  authenticate,
  validate({ body: createBookingLockSchema }),
  createBookingLock
);

bookingsRouter.get("/me", authenticate, getMyBookings);
bookingsRouter.post(
  "/:bookingId/cancel",
  authenticate,
  validate({
    params: cancelBookingParamsSchema,
    body: cancelBookingBodySchema
  }),
  cancelBooking
);

export const adminBookingsRouter = Router();

adminBookingsRouter.get(
  "/",
  authenticate,
  requireAdmin,
  validate({ query: adminBookingsQuerySchema }),
  getAdminBookings
);

export const adminCancellationRequestsRouter = Router();

adminCancellationRequestsRouter.get(
  "/",
  authenticate,
  requireAdmin,
  getCancellationRequests
);
