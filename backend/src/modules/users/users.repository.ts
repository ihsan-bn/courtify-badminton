import { query } from "../../config/database.js";
import type { UserRole } from "../../utils/jwt.js";

export interface UserRecord {
  id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  onboarding_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

export const usersRepository = {
  async findById(id: string): Promise<UserRecord | null> {
    const result = await query<UserRecord>(
      `
        select
          id,
          phone_number,
          name,
          email,
          role,
          onboarding_completed,
          created_at,
          updated_at
        from public.users
        where id = $1
      `,
      [id]
    );
    return result.rows[0] ?? null;
  },

  async updateOnboarding(
    id: string,
    name: string,
    email: string
  ): Promise<UserRecord | null> {
    const result = await query<UserRecord>(
      `
        update public.users
        set name = $2, email = $3, onboarding_completed = true
        where id = $1
        returning
          id,
          phone_number,
          name,
          email,
          role,
          onboarding_completed,
          created_at,
          updated_at
      `,
      [id, name, email]
    );
    return result.rows[0] ?? null;
  }
};
