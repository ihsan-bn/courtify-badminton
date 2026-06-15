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

export const authRepository = {
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
  }
};
