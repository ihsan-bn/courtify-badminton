import { query } from "../../config/database.js";
import type { EmailEventType, EmailTemplate } from "./email.types.js";

export interface EmailBookingContext {
  booking_id: string;
  customer_email: string | null;
  court_name: string;
  reservation_start_at: Date;
  reservation_end_at: Date;
  total_amount_bnd: string;
  booking_status: string;
  cancellation_status: string | null;
  refund_method: string | null;
  refund_reference: string | null;
  refunded_at: Date | null;
}

export interface EmailHistoryRecord {
  email_type: string;
  delivery_status: "pending" | "sent" | "failed";
  sent_at: Date | null;
  created_at: Date;
}

interface NotificationEventRecord {
  id: string;
}

export const emailRepository = {
  async findBookingContext(
    bookingId: string
  ): Promise<EmailBookingContext | null> {
    const result = await query<EmailBookingContext>(
      `
        select
          booking.id as booking_id,
          customer.email as customer_email,
          court.name as court_name,
          booking.reservation_start_at,
          booking.reservation_end_at,
          booking.total_amount_bnd,
          booking.status as booking_status,
          cancellation_request.status as cancellation_status,
          cancellation_request.refund_method,
          cancellation_request.refund_reference,
          cancellation_request.refunded_at
        from public.bookings as booking
        inner join public.users as customer
          on customer.id = booking.user_id
        inner join public.courts as court
          on court.id = booking.court_id
        left join lateral (
          select
            status,
            refund_method,
            refund_reference,
            refunded_at
          from public.cancellation_requests
          where booking_id = booking.id
          order by created_at desc
          limit 1
        ) as cancellation_request on true
        where booking.id = $1
      `,
      [bookingId]
    );

    return result.rows[0] ?? null;
  },

  async claimEmailEvent(
    bookingId: string,
    eventType: EmailEventType,
    recipientEmail: string,
    template: EmailTemplate,
    idempotencyKey: string
  ): Promise<string | null> {
    const result = await query<NotificationEventRecord>(
      `
        insert into public.notification_events (
          booking_id,
          event_type,
          channel,
          status,
          payload,
          recipient_email,
          subject,
          idempotency_key
        )
        values (
          $1,
          $2,
          'email',
          'pending',
          $3::jsonb,
          $4,
          $5,
          $6
        )
        on conflict (idempotency_key) where idempotency_key is not null
          do nothing
        returning id
      `,
      [
        bookingId,
        eventType,
        JSON.stringify({
          html: template.html,
          text: template.text
        }),
        recipientEmail,
        template.subject,
        idempotencyKey
      ]
    );

    return result.rows[0]?.id ?? null;
  },

  async markEmailSent(
    eventId: string,
    providerMessageId: string
  ): Promise<void> {
    await query(
      `
        update public.notification_events
        set status = 'sent',
            provider_message_id = $2,
            processed_at = now(),
            error_message = null
        where id = $1
          and status = 'pending'
      `,
      [eventId, providerMessageId]
    );
  },

  async markEmailFailed(eventId: string, errorMessage: string): Promise<void> {
    await query(
      `
        update public.notification_events
        set status = 'failed',
            processed_at = now(),
            error_message = $2
        where id = $1
          and status = 'pending'
      `,
      [eventId, errorMessage.slice(0, 2000)]
    );
  },

  async findEmailHistory(bookingId: string): Promise<EmailHistoryRecord[]> {
    const result = await query<EmailHistoryRecord>(
      `
        select
          event_type as email_type,
          status as delivery_status,
          processed_at as sent_at,
          created_at
        from public.notification_events
        where booking_id = $1
          and channel = 'email'
        order by created_at desc
      `,
      [bookingId]
    );

    return result.rows;
  }
};
