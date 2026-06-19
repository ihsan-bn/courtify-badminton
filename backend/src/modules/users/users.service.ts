import {
  ConflictError,
  NotFoundError,
  UnauthorizedError
} from "../../utils/errors.js";
import {
  hashPassword,
  verifyPassword
} from "../../utils/password.js";
import { emailService } from "../email/email.service.js";
import type {
  ChangePasswordInput,
  OnboardingInput,
  UpdateProfileInput
} from "./users.schemas.js";
import { usersRepository, type UserRecord } from "./users.repository.js";

export const usersService = {
  async getCurrentUser(userId: string): Promise<UserRecord> {
    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError("User account is unavailable");
    }
    return user;
  },

  async completeOnboarding(
    userId: string,
    input: OnboardingInput
  ): Promise<UserRecord> {
    const user = await usersRepository.updateOnboarding(
      userId,
      input.name,
      input.email
    );
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return user;
  },

  async updateProfile(
    userId: string,
    input: UpdateProfileInput
  ): Promise<UserRecord> {
    const [emailExists, phoneExists] = await Promise.all([
      usersRepository.emailExistsForOtherUser(userId, input.email),
      usersRepository.phoneExistsForOtherUser(userId, input.phone_number)
    ]);

    if (emailExists) {
      throw new ConflictError("Email is already registered");
    }
    if (phoneExists) {
      throw new ConflictError("Phone number is already registered");
    }

    const user = await usersRepository.updateProfile(
      userId,
      input.name,
      input.email,
      input.phone_number
    );
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return user;
  },

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await usersRepository.findCredentialsById(userId);
    if (!user?.password_hash) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    const passwordMatches = await verifyPassword(
      input.current_password,
      user.password_hash
    );
    if (!passwordMatches) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    const nextPasswordHash = await hashPassword(input.new_password);
    await usersRepository.updatePassword(userId, nextPasswordHash);

    if (user.email) {
      await emailService.sendPasswordChangedNotification({
        to: user.email,
        name: user.name
      });
    }

    return {
      message:
        "Password changed. Your current session remains active; please logout manually on shared devices."
    };
  }
};
