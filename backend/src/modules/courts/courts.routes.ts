import { Router } from "express";

import {
  authenticate,
  requireAdmin
} from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createCourt,
  listActiveCourts,
  listAllCourts,
  updateCourt
} from "./courts.controller.js";
import {
  courtIdParamsSchema,
  createCourtSchema,
  updateCourtSchema
} from "./courts.schemas.js";

export const publicCourtsRouter = Router();
publicCourtsRouter.get("/", listActiveCourts);

export const adminCourtsRouter = Router();
adminCourtsRouter.use(authenticate, requireAdmin);
adminCourtsRouter.get("/", listAllCourts);
adminCourtsRouter.post(
  "/",
  validate({ body: createCourtSchema }),
  createCourt
);
adminCourtsRouter.patch(
  "/:courtId",
  validate({ params: courtIdParamsSchema, body: updateCourtSchema }),
  updateCourt
);
