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

export interface UserCredentialsRecord extends UserRecord {
  password_hash: string | null;
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

  async findCredentialsById(id: string): Promise<UserCredentialsRecord | null> {
    const result = await query<UserCredentialsRecord>(
      `
        select
          id,
          phone_number,
          name,
          email,
          role,
          onboarding_completed,
          created_at,
          updated_at,
          password_hash
        from public.users
        where id = $1
      `,
      [id]
    );
    return result.rows[0] ?? null;
  },

  async emailExistsForOtherUser(
    userId: string,
    email: string
  ): Promise<boolean> {
    const result = await query<{ exists: boolean }>(
      `
        select exists(
          select 1
          from public.users
          where lower(email) = $2
            and id <> $1
        )
      `,
      [userId, email]
    );
    return result.rows[0]?.exists ?? false;
  },

  async phoneExistsForOtherUser(
    userId: string,
    phoneNumber: string
  ): Promise<boolean> {
    const result = await query<{ exists: boolean }>(
      `
        select exists(
          select 1
          from public.users
          where phone_number = $2
            and id <> $1
        )
      `,
      [userId, phoneNumber]
    );
    return result.rows[0]?.exists ?? false;
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
  },

  async updateProfile(
    id: string,
    name: string,
    email: string,
    phoneNumber: string
  ): Promise<UserRecord | null> {
    const result = await query<UserRecord>(
      `
        update public.users
        set
          name = $2,
          email = $3,
          phone_number = $4
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
      [id, name, email, phoneNumber]
    );
    return result.rows[0] ?? null;
  },

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await query(
      `
        update public.users
        set
          password_hash = $2,
          password_set_at = coalesce(password_set_at, now()),
          password_updated_at = now()
        where id = $1
      `,
      [id, passwordHash]
    );
  }
};
