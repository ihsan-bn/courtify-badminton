import type { RequestHandler } from "express";

import type {
  CompleteRegistrationInput,
  ForgotPasswordInput,
  RequestEmailPasswordOtpInput,
  RequestRegistrationOtpInput,
  RequestOtpInput,
  ResetPasswordInput,
  VerifyEmailPasswordOtpInput,
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

export const requestRegistrationOtp: RequestHandler = async (
  request,
  response
) => {
  const result = await authService.requestRegistrationOtp(
    request.body as RequestRegistrationOtpInput
  );
  response.status(200).json(result);
};

export const completeRegistration: RequestHandler = async (
  request,
  response
) => {
  const result = await authService.completeRegistration(
    request.body as CompleteRegistrationInput
  );
  response.status(200).json(result);
};

export const requestEmailPasswordOtp: RequestHandler = async (
  request,
  response
) => {
  const result = await authService.requestEmailPasswordOtp(
    request.body as RequestEmailPasswordOtpInput
  );
  response.status(201).json(result);
};

export const verifyEmailPasswordOtp: RequestHandler = async (
  request,
  response
) => {
  const result = await authService.verifyEmailPasswordOtp(
    request.body as VerifyEmailPasswordOtpInput
  );
  response.status(200).json(result);
};

export const forgotPassword: RequestHandler = async (request, response) => {
  const result = await authService.forgotPassword(
    request.body as ForgotPasswordInput
  );
  response.status(200).json(result);
};

export const resetPassword: RequestHandler = async (request, response) => {
  const result = await authService.resetPassword(
    request.body as ResetPasswordInput
  );
  response.status(200).json(result);
};
