import { NotFoundError, UnauthorizedError } from "../../utils/errors.js";
import type { OnboardingInput } from "./users.schemas.js";
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
  }
};
