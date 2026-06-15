import { query } from "../../config/database.js";
import type {
  CreateCourtInput,
  UpdateCourtInput
} from "./courts.schemas.js";

export interface CourtRecord {
  id: string;
  name: string;
  location: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export const courtsRepository = {
  async findActive(): Promise<CourtRecord[]> {
    const result = await query<CourtRecord>(
      `
        select id, name, location, active, created_at, updated_at
        from public.courts
        where active = true
        order by name asc
      `
    );
    return result.rows;
  },

  async findAll(): Promise<CourtRecord[]> {
    const result = await query<CourtRecord>(
      `
        select id, name, location, active, created_at, updated_at
        from public.courts
        order by name asc
      `
    );
    return result.rows;
  },

  async create(input: CreateCourtInput): Promise<CourtRecord> {
    const result = await query<CourtRecord>(
      `
        insert into public.courts (name, location, active)
        values ($1, $2, $3)
        returning id, name, location, active, created_at, updated_at
      `,
      [input.name, input.location, input.active]
    );
    const court = result.rows[0];
    if (!court) {
      throw new Error("Court insert did not return a row");
    }
    return court;
  },

  async update(
    courtId: string,
    input: UpdateCourtInput
  ): Promise<CourtRecord | null> {
    const result = await query<CourtRecord>(
      `
        update public.courts
        set
          name = coalesce($2, name),
          location = coalesce($3, location),
          active = coalesce($4, active)
        where id = $1
        returning id, name, location, active, created_at, updated_at
      `,
      [
        courtId,
        input.name ?? null,
        input.location ?? null,
        input.active ?? null
      ]
    );
    return result.rows[0] ?? null;
  }
};
