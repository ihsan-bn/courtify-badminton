import type { RequestHandler } from "express";

import type { AvailabilityQuery } from "./availability.schemas.js";
import { availabilityService } from "./availability.service.js";

export const getAvailability: RequestHandler = async (request, response) => {
  const result = await availabilityService.getAvailability(
    request.query as AvailabilityQuery
  );
  response.status(200).json(result);
};
