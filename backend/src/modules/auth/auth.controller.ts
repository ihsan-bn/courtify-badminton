import type { RequestHandler } from "express";

import type {
  RequestOtpInput,
  VerifyOtpInput
} from "./auth.schemas.js";
import { authService } from "./auth.service.js";

export const requestOtp: RequestHandler = async (request, response) => {
  const result = await authService.requestOtp(
    request.body as RequestOtpInput
  );
  response.status(201).json(result);
};

export const verifyOtp: RequestHandler = async (request, response) => {
  const result = await authService.verifyOtp(request.body as VerifyOtpInput);
  response.status(200).json(result);
};
