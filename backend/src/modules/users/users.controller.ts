import type { RequestHandler } from "express";

import { UnauthorizedError } from "../../utils/errors.js";
import type { OnboardingInput } from "./users.schemas.js";
import { usersService } from "./users.service.js";

export const getMe: RequestHandler = async (request, response) => {
  const userId = request.authenticatedUser?.id;
  if (!userId) {
    throw new UnauthorizedError();
  }

  const user = await usersService.getCurrentUser(userId);
  response.status(200).json({ user });
};

export const completeOnboarding: RequestHandler = async (
  request,
  response
) => {
  const userId = request.authenticatedUser?.id;
  if (!userId) {
    throw new UnauthorizedError();
  }

  const user = await usersService.completeOnboarding(
    userId,
    request.body as OnboardingInput
  );
  response.status(200).json({ user });
};
