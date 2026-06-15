import { NotFoundError } from "../../utils/errors.js";
import { courtsRepository, type CourtRecord } from "./courts.repository.js";
import type {
  CreateCourtInput,
  UpdateCourtInput
} from "./courts.schemas.js";

export const courtsService = {
  listActive(): Promise<CourtRecord[]> {
    return courtsRepository.findActive();
  },

  listAll(): Promise<CourtRecord[]> {
    return courtsRepository.findAll();
  },

  create(input: CreateCourtInput): Promise<CourtRecord> {
    return courtsRepository.create(input);
  },

  async update(
    courtId: string,
    input: UpdateCourtInput
  ): Promise<CourtRecord> {
    const court = await courtsRepository.update(courtId, input);
    if (!court) {
      throw new NotFoundError("Court not found");
    }
    return court;
  }
};
