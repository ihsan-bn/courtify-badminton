import { Router } from "express";

import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  completeOnboarding,
  getMe
} from "./users.controller.js";
import { onboardingSchema } from "./users.schemas.js";

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.get("/", getMe);
usersRouter.post(
  "/onboarding",
  validate({ body: onboardingSchema }),
  completeOnboarding
);
