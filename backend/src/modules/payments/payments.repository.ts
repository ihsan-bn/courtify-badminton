import type { PoolClient } from "pg";

import { queryWithClient } from "../../config/database.js";
import type { BookingStatus } from "../bookings/bookings.repository.js";

export interface CheckoutBookingRecord {
  id: string;
  user_id: string;
  court_id: string;
  status: BookingStatus;
  total_amount_bnd: string;
  lock_expires_at: Date | null;
  reservation_start_at: Date;
  reservation_end_at: Date;
  court_name: string;
  stripe_checkout_session_id: string | null;
  court_active: boolean;
}

export interface WebhookBookingRecord {
  id: string;
  status: BookingStatus;
  lock_expires_at: Date | null;
  total_amount_bnd: string;
  reservation_start_at: Date;
  reservation_end_at: Date;
}

export interface WebhookRefundRecord {
  id: string;
  booking_id: string;
  amount_bnd: string;
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
          booking.court_id,
          booking.status,
          booking.total_amount_bnd,
          booking.lock_expires_at,
          booking.reservation_start_at,
          booking.reservation_end_at,
          court.name as court_name,
          booking.stripe_checkout_session_id,
          court.active as court_active
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

  async replaceCheckoutSession(
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
        select
          id,
          status,
          lock_expires_at,
          total_amount_bnd,
          reservation_start_at,
          reservation_end_at
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

  async findBookingForPaymentFailure(
    client: PoolClient,
    paymentIntentId: string,
    metadataBookingId: string | null
  ): Promise<WebhookBookingRecord | null> {
    const result = await queryWithClient<WebhookBookingRecord>(
      client,
      `
        select
          id,
          status,
          lock_expires_at,
          total_amount_bnd,
          reservation_start_at,
          reservation_end_at
        from public.bookings
        where stripe_payment_intent_id = $1
          or ($2::uuid is not null and id = $2)
        order by (stripe_payment_intent_id = $1) desc
        limit 1
        for update
      `,
      [paymentIntentId, metadataBookingId]
    );

    return result.rows[0] ?? null;
  },

  async findRefundForWebhook(
    client: PoolClient,
    stripeRefundId: string,
    metadataBookingId: string | null
  ): Promise<WebhookRefundRecord | null> {
    const result = await queryWithClient<WebhookRefundRecord>(
      client,
      `
        select id, booking_id, amount_bnd
        from public.refund_records
        where stripe_refund_id = $1
          or ($2::uuid is not null and booking_id = $2)
        order by (stripe_refund_id = $1) desc
        limit 1
        for update
      `,
      [stripeRefundId, metadataBookingId]
    );

    return result.rows[0] ?? null;
  },

  async findRefundByPaymentIntentForUpdate(
    client: PoolClient,
    paymentIntentId: string
  ): Promise<WebhookRefundRecord | null> {
    const result = await queryWithClient<WebhookRefundRecord>(
      client,
      `
        select id, booking_id, amount_bnd
        from public.refund_records
        where stripe_payment_intent_id = $1
        for update
      `,
      [paymentIntentId]
    );

    return result.rows[0] ?? null;
  },

  async updateRefundWebhookStatus(
    client: PoolClient,
    refundRecordId: string,
    stripeRefundId: string,
    status: string,
    failureReason: string | null
  ): Promise<void> {
    await queryWithClient(
      client,
      `
        update public.refund_records
        set stripe_refund_id = $2,
            status = $3,
            failure_reason = $4
        where id = $1
      `,
      [refundRecordId, stripeRefundId, status, failureReason]
    );
  },

  async markRefundSucceededFromCharge(
    client: PoolClient,
    refundRecordId: string,
    amountRefundedCents: number
  ): Promise<void> {
    await queryWithClient(
      client,
      `
        update public.refund_records
        set status = 'succeeded',
            failure_reason = null
        where id = $1
          and round(amount_bnd * 100)::integer <= $2
      `,
      [refundRecordId, amountRefundedCents]
    );
  },

  async deleteLockedBookingSlots(
    client: PoolClient,
    bookingId: string
  ): Promise<void> {
    await queryWithClient(
      client,
      `
        delete from public.booking_slots
        where booking_id = $1
          and status = 'locked'
      `,
      [bookingId]
    );
  },

  async markLockedBookingExpired(
    client: PoolClient,
    bookingId: string
  ): Promise<boolean> {
    const result = await queryWithClient<{ id: string }>(
      client,
      `
        update public.bookings
        set status = 'expired',
            lock_expires_at = null
        where id = $1
          and status = 'locked'
        returning id
      `,
      [bookingId]
    );

    return result.rowCount === 1;
  },

  async relockExpiredBooking(
    client: PoolClient,
    bookingId: string
  ): Promise<boolean> {
    const result = await queryWithClient<{ id: string }>(
      client,
      `
        update public.bookings
        set status = 'locked',
            lock_expires_at = now() + interval '10 minutes',
            stripe_checkout_session_id = null,
            stripe_payment_intent_id = null
        where id = $1
          and status = 'expired'
          and reservation_start_at > clock_timestamp()
        returning id
      `,
      [bookingId]
    );

    return result.rowCount === 1;
  },

  async findExpiredOverlappingBookingIds(
    client: PoolClient,
    bookingId: string
  ): Promise<string[]> {
    const result = await queryWithClient<{ id: string }>(
      client,
      `
        select conflicting_booking.id
        from public.bookings as conflicting_booking
        where conflicting_booking.status = 'locked'
          and conflicting_booking.lock_expires_at < now()
          and conflicting_booking.id <> $1
          and exists (
            select 1
            from public.bookings as target_booking
            inner join public.booking_slots as conflicting_slot
              on conflicting_slot.court_id = target_booking.court_id
             and conflicting_slot.slot_date = (
               target_booking.reservation_start_at
                 at time zone 'Asia/Brunei'
             )::date
             and conflicting_slot.start_hour >= extract(
               hour from target_booking.reservation_start_at
                 at time zone 'Asia/Brunei'
             )::integer
             and conflicting_slot.start_hour < extract(
               hour from target_booking.reservation_end_at
                 at time zone 'Asia/Brunei'
             )::integer
             and conflicting_slot.booking_id = conflicting_booking.id
             and conflicting_slot.status = 'locked'
            where target_booking.id = $1
          )
        for update
      `,
      [bookingId]
    );

    return result.rows.map((booking) => booking.id);
  },

  async recreateLockedBookingSlots(
    client: PoolClient,
    bookingId: string
  ): Promise<void> {
    await queryWithClient(
      client,
      `
        insert into public.booking_slots (
          booking_id,
          court_id,
          slot_date,
          start_hour,
          status
        )
        select
          booking.id,
          booking.court_id,
          (booking.reservation_start_at at time zone 'Asia/Brunei')::date,
          requested_hour,
          'locked'
        from public.bookings as booking
        cross join lateral generate_series(
          extract(
            hour from booking.reservation_start_at at time zone 'Asia/Brunei'
          )::integer,
          extract(
            hour from booking.reservation_end_at at time zone 'Asia/Brunei'
          )::integer - 1
        ) as requested_hour
        where booking.id = $1
          and booking.status = 'locked'
      `,
      [bookingId]
    );
  },

  async confirmBooking(
    client: PoolClient,
    bookingId: string,
    paymentIntentId: string,
    paymentCompletedAt: Date
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
          and lock_expires_at >= $3
        returning id
      `,
      [bookingId, paymentIntentId, paymentCompletedAt]
    );

    return result.rowCount === 1;
  },

  async confirmBookingSlots(
    client: PoolClient,
    bookingId: string
  ): Promise<number> {
    const result = await queryWithClient(
      client,
      `
        update public.booking_slots
        set status = 'confirmed'
        where booking_id = $1
          and status = 'locked'
      `,
      [bookingId]
    );

    return result.rowCount ?? 0;
  }
};
