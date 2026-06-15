import { NotFoundError } from "../../utils/errors.js";
import { calculateSlotPriceBnd } from "../../utils/pricing.js";
import {
  availabilityRepository,
  type AvailabilityCourtRecord
} from "./availability.repository.js";
import type { AvailabilityQuery } from "./availability.schemas.js";

interface AvailabilitySlot {
  start_hour: number;
  end_hour: number;
  available: boolean;
  price_bnd: string;
  unavailable_reason: "booked" | null;
}

interface AvailabilityResult {
  court: AvailabilityCourtRecord;
  date: string;
  slots: AvailabilitySlot[];
}

export const availabilityService = {
  async getAvailability(
    input: AvailabilityQuery
  ): Promise<AvailabilityResult> {
    const court = await availabilityRepository.findActiveCourt(input.court_id);
    if (!court) {
      throw new NotFoundError("Active court not found");
    }

    const occupiedHours = new Set(
      await availabilityRepository.findOccupiedStartHours(
        input.court_id,
        input.date
      )
    );

    const slots = Array.from({ length: 14 }, (_, index) => {
      const startHour = index + 8;
      const available = !occupiedHours.has(startHour);

      return {
        start_hour: startHour,
        end_hour: startHour + 1,
        available,
        price_bnd: calculateSlotPriceBnd(
          input.date,
          startHour
        ).toFixed(2),
        unavailable_reason: available ? null : ("booked" as const)
      };
    });

    return {
      court,
      date: input.date,
      slots
    };
  }
};
