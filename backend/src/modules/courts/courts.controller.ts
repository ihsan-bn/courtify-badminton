import type { RequestHandler } from "express";

import type {
  CreateCourtInput,
  UpdateCourtInput
} from "./courts.schemas.js";
import { courtsService } from "./courts.service.js";

export const listActiveCourts: RequestHandler = async (
  _request,
  response
) => {
  const courts = await courtsService.listActive();
  response.status(200).json({ courts });
};

export const listAllCourts: RequestHandler = async (_request, response) => {
  const courts = await courtsService.listAll();
  response.status(200).json({ courts });
};

export const createCourt: RequestHandler = async (request, response) => {
  const court = await courtsService.create(
    request.body as CreateCourtInput
  );
  response.status(201).json({ court });
};

export const updateCourt: RequestHandler = async (request, response) => {
  const court = await courtsService.update(
    request.params.courtId as string,
    request.body as UpdateCourtInput
  );
  response.status(200).json({ court });
};
