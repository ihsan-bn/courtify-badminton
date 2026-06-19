import { Router } from "express";

import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  changePassword,
  completeOnboarding,
  getMe,
  updateProfile
} from "./users.controller.js";
import {
  changePasswordSchema,
  onboardingSchema,
  updateProfileSchema
} from "./users.schemas.js";

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.get("/", getMe);
usersRouter.post(
  "/onboarding",
  validate({ body: onboardingSchema }),
  completeOnboarding
);
usersRouter.patch(
  "/profile",
  validate({ body: updateProfileSchema }),
  updateProfile
);
usersRouter.post(
  "/change-password",
  validate({ body: changePasswordSchema }),
  changePassword
);
