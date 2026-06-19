import { query } from "../../config/database.js";

export interface BookingDocumentRecord {
  booking_id: string;
  booking_status: string;
  total_amount_bnd: string;
  reservation_start_at: Date;
  reservation_end_at: Date;
  booking_created_at: Date;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone_number: string;
  court_name: string;
  court_location: string;
  cancellation_request_id: string | null;
  cancellation_status: string | null;
  cancellation_created_at: Date | null;
  cancellation_reviewed_at: Date | null;
  refund_method: string | null;
  refund_reference: string | null;
  refund_notes: string | null;
  refunded_at: Date | null;
}

export interface CancellationDocumentEventRecord {
  event_id: string;
  event_type: string;
  message: string;
  actor_type: "customer" | "admin" | "system";
  created_at: Date;
}

const bookingDocumentSelect = `
  select
    booking.id as booking_id,
    booking.status as booking_status,
    booking.total_amount_bnd,
    booking.reservation_start_at,
    booking.reservation_end_at,
    booking.created_at as booking_created_at,
    customer.name as customer_name,
    customer.email as customer_email,
    customer.phone_number as customer_phone_number,
    court.name as court_name,
    court.location as court_location,
    cancellation_request.id as cancellation_request_id,
    cancellation_request.status as cancellation_status,
    cancellation_request.created_at as cancellation_created_at,
    cancellation_request.reviewed_at as cancellation_reviewed_at,
    cancellation_request.refund_method,
    cancellation_request.refund_reference,
    cancellation_request.refund_notes,
    cancellation_request.refunded_at
  from public.bookings as booking
  inner join public.users as customer
    on customer.id = booking.user_id
  inner join public.courts as court
    on court.id = booking.court_id
  left join lateral (
    select
      request.id,
      request.status,
      request.created_at,
      request.reviewed_at,
      request.refund_method,
      request.refund_reference,
      request.refund_notes,
      request.refunded_at
    from public.cancellation_requests as request
    where request.booking_id = booking.id
    order by request.created_at desc
    limit 1
  ) as cancellation_request on true
`;

export const documentsRepository = {
  async findCustomerBooking(
    bookingId: string,
    userId: string
  ): Promise<BookingDocumentRecord | null> {
    const result = await query<BookingDocumentRecord>(
      `
        ${bookingDocumentSelect}
        where booking.id = $1
          and booking.user_id = $2
      `,
      [bookingId, userId]
    );

    return result.rows[0] ?? null;
  },

  async findCancellationCase(
    requestId: string
  ): Promise<BookingDocumentRecord | null> {
    const result = await query<BookingDocumentRecord>(
      `
        ${bookingDocumentSelect}
        where cancellation_request.id = $1
      `,
      [requestId]
    );

    return result.rows[0] ?? null;
  },

  async findCancellationEvents(
    requestId: string
  ): Promise<CancellationDocumentEventRecord[]> {
    const result = await query<CancellationDocumentEventRecord>(
      `
        select
          id as event_id,
          event_type,
          message,
          actor_type,
          created_at
        from public.cancellation_request_events
        where cancellation_request_id = $1
        order by created_at asc, id asc
      `,
      [requestId]
    );

    return result.rows;
  }
};
