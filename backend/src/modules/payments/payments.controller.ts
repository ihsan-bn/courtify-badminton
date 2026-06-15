import type { RequestHandler } from "express";

import {
  ForbiddenError,
  UnauthorizedError
} from "../../utils/errors.js";
import type { CreateCheckoutSessionInput } from "./payments.schemas.js";
import { paymentsService } from "./payments.service.js";

export const createCheckoutSession: RequestHandler = async (
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

  const result = await paymentsService.createCheckoutSession(
    authenticatedUser.id,
    request.body as CreateCheckoutSessionInput
  );
  response.status(201).json(result);
};
