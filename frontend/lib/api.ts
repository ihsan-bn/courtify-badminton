import { getAccessToken } from "./auth";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

interface ApiRequestOptions {
  method?: HttpMethod;
  body?: unknown;
  auth?: boolean;
}

export interface UserProfile {
  id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  role: "customer" | "admin";
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface RequestOtpResponse {
  message: string;
  expires_in_seconds: number;
  otp?: string;
}

export interface VerifyOtpResponse {
  access_token: string;
  token_type: "Bearer";
  user: UserProfile;
  onboarding_required: boolean;
}

export interface Court {
  id: string;
  name: string;
  location: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvailabilitySlot {
  start_hour: number;
  end_hour: number;
  available: boolean;
  price_bnd: string;
  unavailable_reason: "booked" | null;
}

export interface AvailabilityResponse {
  court: Court;
  date: string;
  slots: AvailabilitySlot[];
}

export interface BookingLockResponse {
  booking_id: string;
  status: "locked";
  court_id: string;
  slot_date: string;
  start_hour: number;
  duration_hours: number;
  reservation_start_at: string;
  reservation_end_at: string;
  total_amount_bnd: string;
  lock_expires_at: string;
}

export interface CheckoutSessionResponse {
  booking_id?: string;
  checkout_session_id?: string;
  checkout_url?: string;
  url?: string;
}

export type BookingStatus =
  | "locked"
  | "confirmed"
  | "cancellation_requested"
  | "cancelled"
  | "expired";

export interface BookingHistorySlot {
  slot_date: string;
  start_hour: number;
  end_hour: number;
  status: "locked" | "confirmed" | "cancellation_requested" | "cancelled";
  price_bnd: string;
}

export interface CancellationTimelineEvent {
  event_id: string;
  event_type: string;
  message: string;
  actor_type: "customer" | "admin" | "system";
  created_at: string;
}

export type CancellationRequestStatus =
  | "pending_admin_review"
  | "admin_verifying"
  | "customer_contacted"
  | "approved"
  | "refund_in_progress"
  | "refund_completed"
  | "closed"
  | "rejected";

export interface CustomerCancellationRequest {
  cancellation_request_id: string;
  status: CancellationRequestStatus;
  reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by?: string | null;
  refund_method: RefundMethod | null;
  refund_reference: string | null;
  refunded_at: string | null;
  timeline: CancellationTimelineEvent[];
}

export interface CustomerBooking {
  booking_id: string;
  status: BookingStatus;
  court_id: string;
  court_name: string;
  court_location: string;
  total_amount_bnd: string;
  reservation_start_at: string;
  reservation_end_at: string;
  lock_expires_at: string | null;
  stripe_checkout_session_id?: string | null;
  created_at: string;
  slots: BookingHistorySlot[];
  cancellation_request?: CustomerCancellationRequest | null;
}

export interface AdminCancellationQueueItem {
  request_id: string;
  cancellation_request_id: string;
  booking_id: string;
  user_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone_number: string;
  customer_phone: string;
  court_id: string;
  court_name: string;
  court_location: string;
  reservation_start_at: string;
  reservation_end_at: string;
  total_amount_bnd: string;
  reason: string | null;
  status: CancellationRequestStatus;
  current_cancellation_status: CancellationRequestStatus;
  booking_date: string;
  requested_at: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface AdminCancellationSlot {
  slot_date: string;
  start_hour: number;
  end_hour: number;
  status: BookingHistorySlot["status"];
  price_bnd: string;
}

export interface AdminCancellationDetail extends AdminCancellationQueueItem {
  booking_status: BookingStatus;
  refund_method: RefundMethod | null;
  refund_reference: string | null;
  refund_notes: string | null;
  refunded_at: string | null;
  refunded_by: string | null;
  slots: AdminCancellationSlot[];
  timeline: Array<
    CancellationTimelineEvent & {
      actor_user_id: string | null;
    }
  >;
}

export type AdminCancellationAction =
  | "admin_verifying_cancellation"
  | "customer_contacted"
  | "cancellation_approved"
  | "cancellation_rejected"
  | "refund_in_progress"
  | "refund_completed"
  | "close_case";

export type RefundMethod =
  | "BIBD Transfer"
  | "Baiduri Transfer"
  | "Cash"
  | "Bank Transfer"
  | "Other";

export class ApiError extends Error {
  public constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost:4000"
  );
}

function logDevError(message: string, error: unknown): void {
  if (process.env.NODE_ENV !== "production") {
    console.error(message, error);
  }
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    logDevError("Courtify API returned invalid JSON", error);
    throw new ApiError("The server returned an unreadable response.");
  }
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const headers = new Headers({
    Accept: "application/json"
  });

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth) {
    const token = getAccessToken();
    if (!token) {
      throw new ApiError("Please login to continue.", 401, "UNAUTHORIZED");
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch (error) {
    logDevError("Courtify API request failed", error);
    throw new ApiError("Courtify-Badminton API is unavailable.");
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const body = data as ApiErrorBody;
    throw new ApiError(
      body.error?.message ?? "Something went wrong. Please try again.",
      response.status,
      body.error?.code
    );
  }

  return data as T;
}
