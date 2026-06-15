import { Router } from "express";

import { validate } from "../../middleware/validate.js";
import { getAvailability } from "./availability.controller.js";
import { availabilityQuerySchema } from "./availability.schemas.js";

export const availabilityRouter = Router();

availabilityRouter.get(
  "/",
  validate({ query: availabilityQuerySchema }),
  getAvailability
);
