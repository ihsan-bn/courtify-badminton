import { query } from "../../config/database.js";

export interface AvailabilityCourtRecord {
  id: string;
  name: string;
  location: string;
  active: boolean;
}

interface OccupiedSlotRecord {
  start_hour: number;
}

export const availabilityRepository = {
  async findActiveCourt(
    courtId: string
  ): Promise<AvailabilityCourtRecord | null> {
    const result = await query<AvailabilityCourtRecord>(
      `
        select id, name, location, active
        from public.courts
        where id = $1
          and active = true
      `,
      [courtId]
    );

    return result.rows[0] ?? null;
  },

  async findOccupiedStartHours(
    courtId: string,
    date: string
  ): Promise<number[]> {
    const result = await query<OccupiedSlotRecord>(
      `
        select distinct booking_slot.start_hour
        from public.booking_slots as booking_slot
        inner join public.bookings as booking
          on booking.id = booking_slot.booking_id
        where booking_slot.court_id = $1
          and booking_slot.slot_date = $2::date
          and (
            booking_slot.status = 'confirmed'
            or (
              booking_slot.status = 'locked'
              and booking.status = 'locked'
              and booking.lock_expires_at > now()
            )
          )
        order by booking_slot.start_hour asc
      `,
      [courtId, date]
    );

    return result.rows.map((row) => row.start_hour);
  }
};
