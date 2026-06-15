import { withTransaction } from "../../config/database.js";
import { env } from "../../config/env.js";
import {
  BadRequestError,
  TooManyRequestsError,
  UnauthorizedError
} from "../../utils/errors.js";
import { signAccessToken } from "../../utils/jwt.js";
import { generateOtp, hashOtp, verifyOtpHash } from "../../utils/otp.js";
import type { UserRecord } from "../users/users.repository.js";
import { authRepository } from "./auth.repository.js";
import type {
  RequestOtpInput,
  VerifyOtpInput
} from "./auth.schemas.js";

interface RequestOtpResult {
  message: string;
  expires_in_seconds: number;
  otp?: string;
}

interface VerifyOtpResult {
  access_token: string;
  token_type: "Bearer";
  user: UserRecord;
  onboarding_required: boolean;
}

type VerificationOutcome =
  | { status: "success"; user: UserRecord }
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "attempts_exhausted" }
  | { status: "invalid" };

export const authService = {
  async requestOtp(input: RequestOtpInput): Promise<RequestOtpResult> {
    const otp = generateOtp();
    await authRepository.createOtp(
      input.phone_number,
      hashOtp(input.phone_number, otp)
    );

    return {
      message: "OTP generated",
      expires_in_seconds: 300,
      ...(!env.isProduction ? { otp } : {})
    };
  },

  async verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
    // The repository locks the latest code so concurrent attempts serialize.
    const outcome = await withTransaction<VerificationOutcome>(
      async (client) => {
        const record = await authRepository.findLatestOtpForUpdate(
          client,
          input.phone_number
        );

        if (!record) {
          return { status: "not_found" };
        }
        if (record.expires_at.getTime() <= Date.now()) {
          return { status: "expired" };
        }
        if (record.attempts >= 3) {
          return { status: "attempts_exhausted" };
        }
        if (
          !verifyOtpHash(input.phone_number, input.otp, record.otp_hash)
        ) {
          await authRepository.incrementAttempts(client, record.id);
          return { status: "invalid" };
        }

        await authRepository.consumeOtp(client, record.id);
        const user = await authRepository.findOrCreateUser(
          client,
          input.phone_number
        );
        return { status: "success", user };
      }
    );

    switch (outcome.status) {
      case "not_found":
        throw new BadRequestError("No active OTP was found");
      case "expired":
        throw new BadRequestError("OTP has expired");
      case "attempts_exhausted":
        throw new TooManyRequestsError(
          "OTP verification attempts have been exhausted"
        );
      case "invalid":
        throw new UnauthorizedError("Invalid OTP");
      case "success":
        return {
          access_token: signAccessToken({
            sub: outcome.user.id,
            role: outcome.user.role
          }),
          token_type: "Bearer",
          user: outcome.user,
          onboarding_required: !outcome.user.onboarding_completed
        };
    }
  }
};
