import type { PoolClient } from "pg";

import { queryWithClient } from "../../config/database.js";
import type { BookingStatus } from "../bookings/bookings.repository.js";

export interface CheckoutBookingRecord {
  id: string;
  user_id: string;
  status: BookingStatus;
  total_amount_bnd: string;
  lock_expires_at: Date | null;
  reservation_start_at: Date;
  reservation_end_at: Date;
  court_name: string;
  stripe_checkout_session_id: string | null;
}

export interface WebhookBookingRecord {
  id: string;
  status: BookingStatus;
  lock_expires_at: Date | null;
}

export const paymentsRepository = {
  async findBookingForCheckout(
    client: PoolClient,
    bookingId: string
  ): Promise<CheckoutBookingRecord | null> {
    const result = await queryWithClient<CheckoutBookingRecord>(
      client,
      `
        select
          booking.id,
          booking.user_id,
          booking.status,
          booking.total_amount_bnd,
          booking.lock_expires_at,
          booking.reservation_start_at,
          booking.reservation_end_at,
          court.name as court_name,
          booking.stripe_checkout_session_id
        from public.bookings as booking
        inner join public.courts as court
          on court.id = booking.court_id
        where booking.id = $1
        for update
      `,
      [bookingId]
    );

    return result.rows[0] ?? null;
  },

  async storeCheckoutSession(
    client: PoolClient,
    bookingId: string,
    userId: string,
    checkoutSessionId: string
  ): Promise<boolean> {
    const result = await queryWithClient<{ id: string }>(
      client,
      `
        update public.bookings
        set stripe_checkout_session_id = $3
        where id = $1
          and user_id = $2
          and status = 'locked'
          and lock_expires_at > clock_timestamp()
          and stripe_checkout_session_id is null
        returning id
      `,
      [bookingId, userId, checkoutSessionId]
    );

    return result.rowCount === 1;
  },

  async claimPaymentEvent(
    client: PoolClient,
    stripeEventId: string,
    eventType: string,
    payload: object
  ): Promise<boolean> {
    const result = await queryWithClient<{ id: string }>(
      client,
      `
        insert into public.payment_events (
          stripe_event_id,
          event_type,
          payload,
          verified_signature
        )
        values ($1, $2, $3::jsonb, true)
        on conflict (stripe_event_id) do nothing
        returning id
      `,
      [stripeEventId, eventType, JSON.stringify(payload)]
    );

    return result.rowCount === 1;
  },

  async attachPaymentEventToBooking(
    client: PoolClient,
    stripeEventId: string,
    bookingId: string
  ): Promise<void> {
    await queryWithClient(
      client,
      `
        update public.payment_events
        set booking_id = $2
        where stripe_event_id = $1
      `,
      [stripeEventId, bookingId]
    );
  },

  async findBookingByCheckoutSessionForUpdate(
    client: PoolClient,
    checkoutSessionId: string
  ): Promise<WebhookBookingRecord | null> {
    const result = await queryWithClient<WebhookBookingRecord>(
      client,
      `
        select id, status, lock_expires_at
        from public.bookings
        where stripe_checkout_session_id = $1
        for update
      `,
      [checkoutSessionId]
    );

    return result.rows[0] ?? null;
  },

  async findBookingByPaymentIntent(
    client: PoolClient,
    paymentIntentId: string
  ): Promise<{ id: string } | null> {
    const result = await queryWithClient<{ id: string }>(
      client,
      `
        select id
        from public.bookings
        where stripe_payment_intent_id = $1
      `,
      [paymentIntentId]
    );

    return result.rows[0] ?? null;
  },

  async confirmBooking(
    client: PoolClient,
    bookingId: string,
    paymentIntentId: string
  ): Promise<boolean> {
    const result = await queryWithClient<{ id: string }>(
      client,
      `
        update public.bookings
        set status = 'confirmed',
            stripe_payment_intent_id = $2,
            lock_expires_at = null,
            updated_at = now()
        where id = $1
          and status = 'locked'
          and lock_expires_at > clock_timestamp()
        returning id
      `,
      [bookingId, paymentIntentId]
    );

    return result.rowCount === 1;
  },

  async confirmBookingSlots(
    client: PoolClient,
    bookingId: string
  ): Promise<void> {
    await queryWithClient(
      client,
      `
        update public.booking_slots
        set status = 'confirmed'
        where booking_id = $1
          and status = 'locked'
      `,
      [bookingId]
    );
  }
};
