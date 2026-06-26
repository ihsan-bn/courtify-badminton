import { createHash, randomBytes } from "node:crypto";

import { withTransaction } from "../../config/database.js";
import { env } from "../../config/env.js";
import {
  BadRequestError,
  ConflictError,
  TooManyRequestsError,
  UnauthorizedError
} from "../../utils/errors.js";
import { signAccessToken } from "../../utils/jwt.js";
import { generateOtp, hashOtp, verifyOtpHash } from "../../utils/otp.js";
import {
  hashPassword,
  verifyPassword
} from "../../utils/password.js";
import { emailService } from "../email/email.service.js";
import type { UserRecord } from "../users/users.repository.js";
import { authRepository } from "./auth.repository.js";
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

interface RequestOtpResult {
  message: string;
  expires_in_seconds: number;
  otp?: string;
}

interface GenericMessageResult {
  message: string;
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

const DUMMY_PASSWORD_HASH =
  "$2b$12$TEeBRv.4g9ozojqm090JyO0kzKaBQdFh5s/GCNeEhDpCNck.mV.HK";

const PASSWORD_RESET_SUCCESS_MESSAGE =
  "If the email exists, a password reset link has been sent.";

function createLoginResult(user: UserRecord): VerifyOtpResult {
  return {
    access_token: signAccessToken({
      sub: user.id,
      role: user.role
    }),
    token_type: "Bearer",
    user,
    onboarding_required: !user.onboarding_completed
  };
}

async function verifyOtpForPhone(
  phoneNumber: string,
  otp: string,
  user?: UserRecord,
  genericErrors = false
): Promise<VerifyOtpResult> {
  const outcome = await withTransaction<VerificationOutcome>(
    async (client) => {
      const record = await authRepository.findLatestOtpForUpdate(
        client,
        phoneNumber
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
      if (!verifyOtpHash(phoneNumber, otp, record.otp_hash)) {
        await authRepository.incrementAttempts(client, record.id);
        return { status: "invalid" };
      }

      await authRepository.consumeOtp(client, record.id);
      const verifiedUser =
        user ?? (await authRepository.findOrCreateUser(client, phoneNumber));
      return { status: "success", user: verifiedUser };
    }
  );

  switch (outcome.status) {
    case "not_found":
      if (genericErrors) {
        throw new UnauthorizedError("Invalid or expired OTP");
      }
      throw new BadRequestError("No active OTP was found");
    case "expired":
      if (genericErrors) {
        throw new UnauthorizedError("Invalid or expired OTP");
      }
      throw new BadRequestError("OTP has expired");
    case "attempts_exhausted":
      throw new TooManyRequestsError(
        "OTP verification attempts have been exhausted"
      );
    case "invalid":
      throw new UnauthorizedError(
        genericErrors ? "Invalid or expired OTP" : "Invalid OTP"
      );
    case "success":
      return createLoginResult(outcome.user);
  }
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

async function sendOtpChallenge({
  otp,
  channel,
  email,
  phoneNumber,
  name
}: {
  otp: string;
  channel: "email" | "sms";
  email: string | null;
  phoneNumber: string;
  name: string | null;
}): Promise<void> {
  if (channel === "email" && email) {
    await emailService.sendLoginOtp({ to: email, otp, name });
    return;
  }

  if (!env.isProduction) {
    console.info(
      JSON.stringify({
        level: "info",
        message: "Local SMS OTP generated",
        phone_number: phoneNumber,
        otp
      })
    );
  }
}

export const authService = {
  async requestOtp(input: RequestOtpInput): Promise<RequestOtpResult> {
    const existingUser = await authRepository.findUserByPhone(
      input.phone_number
    );
    if (existingUser?.onboarding_completed) {
      throw new BadRequestError("Use email and password to login.");
    }

    const otp = generateOtp();
    await authRepository.createOtp(
      input.phone_number,
      hashOtp(input.phone_number, otp)
    );

    return {
      message: "OTP generated",
      expires_in_seconds: 300,
      ...(env.demoMode ? { otp } : {})
    };
  },

  async verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
    const result = await verifyOtpForPhone(input.phone_number, input.otp);
    if (result.user.onboarding_completed) {
      throw new UnauthorizedError("Use email and password to login.");
    }
    return result;
  },

  async requestRegistrationOtp(
    input: RequestRegistrationOtpInput
  ): Promise<RequestOtpResult> {
    const existingUser = await authRepository.findUserByPhone(
      input.phone_number
    );
    if (existingUser?.role === "admin") {
      throw new BadRequestError("Admins must login with email and password.");
    }
    if (existingUser?.onboarding_completed) {
      throw new ConflictError(
        "This phone number is already registered. Please login with email and password."
      );
    }

    const otp = generateOtp();
    await authRepository.createOtp(
      input.phone_number,
      hashOtp(input.phone_number, otp)
    );

    if (!env.isProduction) {
      console.info(
        JSON.stringify({
          level: "info",
          message: "Local registration OTP generated",
          phone_number: input.phone_number,
          otp
        })
      );
    }

    return {
      message: "OTP generated",
      expires_in_seconds: 300,
      ...(env.demoMode ? { otp } : {})
    };
  },

  async completeRegistration(
    input: CompleteRegistrationInput
  ): Promise<VerifyOtpResult> {
    const existingEmail = await authRepository.findUserCredentialsByEmail(
      input.email
    );
    if (existingEmail) {
      throw new ConflictError("Email is already registered");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await withTransaction<UserRecord>(async (client) => {
      const record = await authRepository.findLatestOtpForUpdate(
        client,
        input.phone_number
      );

      if (!record) {
        throw new BadRequestError("No active OTP was found");
      }
      if (record.expires_at.getTime() <= Date.now()) {
        throw new BadRequestError("OTP has expired");
      }
      if (record.attempts >= 3) {
        throw new TooManyRequestsError(
          "OTP verification attempts have been exhausted"
        );
      }
      if (!verifyOtpHash(input.phone_number, input.otp, record.otp_hash)) {
        await authRepository.incrementAttempts(client, record.id);
        throw new UnauthorizedError("Invalid OTP");
      }

      await authRepository.consumeOtp(client, record.id);
      const pendingUser = await authRepository.findOrCreateUser(
        client,
        input.phone_number
      );
      if (pendingUser.role === "admin") {
        throw new BadRequestError("Admins must login with email and password.");
      }
      if (pendingUser.onboarding_completed) {
        throw new ConflictError(
          "This phone number is already registered. Please login with email and password."
        );
      }

      return authRepository.completeRegistration(
        client,
        input.phone_number,
        input.name,
        input.email,
        passwordHash
      );
    });

    return createLoginResult(user);
  },

  async requestEmailPasswordOtp(
    input: RequestEmailPasswordOtpInput
  ): Promise<RequestOtpResult> {
    const credentials = await authRepository.findUserCredentialsByEmail(
      input.email
    );
    const passwordMatches = await verifyPassword(
      input.password,
      credentials?.password_hash ?? DUMMY_PASSWORD_HASH
    );

    if (!credentials?.password_hash || !passwordMatches) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const otp = generateOtp();
    await authRepository.createOtp(
      credentials.phone_number,
      hashOtp(credentials.phone_number, otp)
    );
    await sendOtpChallenge({
      otp,
      channel: input.otp_channel,
      email: credentials.email,
      phoneNumber: credentials.phone_number,
      name: credentials.name
    });

    return {
      message: "OTP generated",
      expires_in_seconds: 300,
      ...(env.demoMode ? { otp } : {})
    };
  },

  async verifyEmailPasswordOtp(
    input: VerifyEmailPasswordOtpInput
  ): Promise<VerifyOtpResult> {
    const credentials = await authRepository.findUserCredentialsByEmail(
      input.email
    );
    if (!credentials?.password_hash) {
      throw new UnauthorizedError("Invalid or expired OTP");
    }

    const user: UserRecord = {
      id: credentials.id,
      phone_number: credentials.phone_number,
      name: credentials.name,
      email: credentials.email,
      role: credentials.role,
      onboarding_completed: credentials.onboarding_completed,
      created_at: credentials.created_at,
      updated_at: credentials.updated_at
    };
    return verifyOtpForPhone(user.phone_number, input.otp, user, true);
  },

  async forgotPassword(
    input: ForgotPasswordInput
  ): Promise<GenericMessageResult> {
    const credentials = await authRepository.findUserCredentialsByEmail(
      input.email
    );
    if (credentials?.email) {
      const token = generateResetToken();
      await authRepository.createPasswordResetToken(
        credentials.id,
        hashResetToken(token)
      );
      await emailService.sendPasswordResetLink({
        to: credentials.email,
        token,
        name: credentials.name
      });
    }

    return { message: PASSWORD_RESET_SUCCESS_MESSAGE };
  },

  async resetPassword(input: ResetPasswordInput): Promise<GenericMessageResult> {
    const tokenHash = hashResetToken(input.token);
    const passwordHash = await hashPassword(input.password);

    await withTransaction(async (client) => {
      const resetToken = await authRepository.findPasswordResetTokenForUpdate(
        client,
        tokenHash
      );
      if (
        !resetToken ||
        resetToken.used_at ||
        resetToken.expires_at.getTime() <= Date.now()
      ) {
        throw new BadRequestError("Password reset link is invalid or expired");
      }

      await authRepository.updatePasswordByUserId(
        client,
        resetToken.user_id,
        passwordHash
      );
      await authRepository.markPasswordResetTokenUsed(client, resetToken.id);
    });

    return {
      message:
        "Password reset successful. Please login with your new password."
    };
  }
};
