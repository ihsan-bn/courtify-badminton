import type { PoolClient } from "pg";

import {
  query,
  queryWithClient
} from "../../config/database.js";
import type { UserRecord } from "../users/users.repository.js";

export interface OtpRecord {
  id: string;
  phone_number: string;
  otp_hash: string;
  attempts: number;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
}

export interface UserPasswordCredentials extends UserRecord {
  password_hash: string | null;
}

export interface PasswordResetTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

export const authRepository = {
  async findUserByPhone(phoneNumber: string): Promise<UserRecord | null> {
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
        where phone_number = $1
        limit 1
      `,
      [phoneNumber]
    );
    return result.rows[0] ?? null;
  },

  async findUserCredentialsByEmail(
    email: string
  ): Promise<UserPasswordCredentials | null> {
    const result = await query<UserPasswordCredentials>(
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
        where lower(email) = $1
        limit 1
      `,
      [email]
    );
    return result.rows[0] ?? null;
  },

  async completeRegistration(
    client: PoolClient,
    phoneNumber: string,
    name: string,
    email: string,
    passwordHash: string
  ): Promise<UserRecord> {
    const result = await queryWithClient<UserRecord>(
      client,
      `
        update public.users
        set
          name = $2,
          email = $3,
          password_hash = $4,
          password_set_at = coalesce(password_set_at, now()),
          password_updated_at = now(),
          onboarding_completed = true
        where phone_number = $1
          and role = 'customer'
          and password_hash is null
          and onboarding_completed = false
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
      [phoneNumber, name, email, passwordHash]
    );

    const user = result.rows[0];
    if (!user) {
      throw new Error("Registration did not update a customer account");
    }
    return user;
  },

  async createOtp(phoneNumber: string, otpHash: string): Promise<void> {
    await query(
      `
        insert into public.otp_codes (
          phone_number,
          otp_hash,
          attempts,
          expires_at
        )
        values ($1, $2, 0, now() + interval '5 minutes')
      `,
      [phoneNumber, otpHash]
    );
  },

  async findLatestOtpForUpdate(
    client: PoolClient,
    phoneNumber: string
  ): Promise<OtpRecord | null> {
    const result = await queryWithClient<OtpRecord>(
      client,
      `
        select
          id,
          phone_number,
          otp_hash,
          attempts,
          expires_at,
          consumed_at,
          created_at
        from public.otp_codes
        where phone_number = $1
          and consumed_at is null
        order by created_at desc
        limit 1
        for update
      `,
      [phoneNumber]
    );
    return result.rows[0] ?? null;
  },

  async incrementAttempts(client: PoolClient, otpId: string): Promise<void> {
    await queryWithClient(
      client,
      `
        update public.otp_codes
        set attempts = least(attempts + 1, 3)
        where id = $1
      `,
      [otpId]
    );
  },

  async consumeOtp(client: PoolClient, otpId: string): Promise<void> {
    await queryWithClient(
      client,
      `
        update public.otp_codes
        set consumed_at = now()
        where id = $1 and consumed_at is null
      `,
      [otpId]
    );
  },

  async findOrCreateUser(
    client: PoolClient,
    phoneNumber: string
  ): Promise<UserRecord> {
    const result = await queryWithClient<UserRecord>(
      client,
      `
        with inserted_user as (
          insert into public.users (phone_number)
          values ($1)
          on conflict (phone_number) do nothing
          returning
            id,
            phone_number,
            name,
            email,
            role,
            onboarding_completed,
            created_at,
            updated_at
        )
        select
          id,
          phone_number,
          name,
          email,
          role,
          onboarding_completed,
          created_at,
          updated_at
        from inserted_user
        union all
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
        where phone_number = $1
        limit 1
      `,
      [phoneNumber]
    );

    const user = result.rows[0];
    if (!user) {
      throw new Error("User upsert did not return a row");
    }
    return user;
  },

  async createPasswordResetToken(
    userId: string,
    tokenHash: string
  ): Promise<void> {
    await query(
      `
        insert into public.password_reset_tokens (
          user_id,
          token_hash,
          expires_at
        )
        values ($1, $2, now() + interval '30 minutes')
      `,
      [userId, tokenHash]
    );
  },

  async findPasswordResetTokenForUpdate(
    client: PoolClient,
    tokenHash: string
  ): Promise<PasswordResetTokenRecord | null> {
    const result = await queryWithClient<PasswordResetTokenRecord>(
      client,
      `
        select
          id,
          user_id,
          token_hash,
          expires_at,
          used_at,
          created_at
        from public.password_reset_tokens
        where token_hash = $1
        limit 1
        for update
      `,
      [tokenHash]
    );
    return result.rows[0] ?? null;
  },

  async markPasswordResetTokenUsed(
    client: PoolClient,
    resetTokenId: string
  ): Promise<void> {
    await queryWithClient(
      client,
      `
        update public.password_reset_tokens
        set used_at = now()
        where id = $1 and used_at is null
      `,
      [resetTokenId]
    );
  },

  async updatePasswordByUserId(
    client: PoolClient,
    userId: string,
    passwordHash: string
  ): Promise<void> {
    await queryWithClient(
      client,
      `
        update public.users
        set
          password_hash = $2,
          password_set_at = coalesce(password_set_at, now()),
          password_updated_at = now()
        where id = $1
      `,
      [userId, passwordHash]
    );
  }
};
