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

export type RequestEmailPasswordOtpResponse = RequestOtpResponse;

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
  email_history: Array<{
    email_type: string;
    delivery_status: "pending" | "sent" | "failed";
    sent_at: string | null;
    created_at: string;
  }>;
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

export interface AdminDashboardSummary {
  total_bookings: number;
  bookings_today: number;
  bookings_this_month: number;
  revenue_today: string;
  revenue_this_month: string;
  upcoming_bookings_count: number;
  pending_cancellation_requests: number;
  refunds_in_progress: number;
  active_courts: number;
}

export interface DashboardOccupancyBooking {
  booking_id: string;
  customer_name: string | null;
  reservation_start_at: string;
  reservation_end_at: string;
}

export interface DashboardCourtOccupancy {
  court_id: string;
  court_name: string;
  current_status: "available" | "occupied" | "upcoming_today";
  current_booking: DashboardOccupancyBooking | null;
  next_booking_today: DashboardOccupancyBooking | null;
}

export interface DashboardOperationsBooking {
  booking_id: string;
  customer_name: string | null;
  court_name: string;
  reservation_start_at: string;
  reservation_end_at: string;
  status: "confirmed" | "cancellation_requested";
  total_amount_bnd: string;
}

export interface DashboardPendingCancellation {
  request_id: string;
  booking_id: string;
  customer_name: string | null;
  court_name: string;
  reservation_start_at: string;
  cancellation_status:
    | "pending_admin_review"
    | "admin_verifying"
    | "customer_contacted";
  requested_at: string;
}

export interface DashboardRefundInProgress {
  request_id: string;
  booking_id: string;
  customer_name: string | null;
  refund_method: string | null;
  refund_reference: string | null;
  requested_at: string;
}

export interface AdminDashboardOperations {
  today_date: string;
  live_court_occupancy: DashboardCourtOccupancy[];
  todays_bookings: DashboardOperationsBooking[];
  upcoming_bookings: DashboardOperationsBooking[];
  pending_cancellations: DashboardPendingCancellation[];
  refunds_in_progress: DashboardRefundInProgress[];
}

export interface AnalyticsRevenuePoint {
  date: string;
  revenue_bnd: string;
}

export interface AnalyticsBookingPoint {
  date: string;
  booking_count: number;
}

export interface AnalyticsDayOfWeek {
  day: string;
  booking_count: number;
  revenue_bnd: string;
}

export interface AnalyticsPopularCourt {
  court_id: string;
  court_name: string;
  booking_count: number;
  revenue_bnd: string;
  total_hours: number;
}

export interface AnalyticsPeakHour {
  start_hour: number;
  label: string;
  booking_count: number;
}

export interface AnalyticsTopCustomer {
  user_id: string;
  customer_name: string | null;
  booking_count: number;
  revenue_bnd: string;
}

export interface AdminDashboardAnalytics {
  revenue_last_30_days: AnalyticsRevenuePoint[];
  bookings_last_30_days: AnalyticsBookingPoint[];
  bookings_by_day_of_week: AnalyticsDayOfWeek[];
  revenue_by_day_of_week: AnalyticsDayOfWeek[];
  popular_courts: AnalyticsPopularCourt[];
  peak_booking_hours: AnalyticsPeakHour[];
  top_customers: AnalyticsTopCustomer[];
  cancellation_summary: {
    pending_admin_review: number;
    admin_verifying: number;
    customer_contacted: number;
    approved: number;
    refund_in_progress: number;
    refund_completed: number;
    closed: number;
    rejected: number;
  };
  refund_summary: {
    refund_in_progress_count: number;
    refund_completed_count: number;
    closed_count: number;
  };
}

export interface AuditLog {
  id: string;
  actor_user_id: string | null;
  actor_role: "customer" | "admin" | "system";
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  page: number;
  page_size: number;
  total: number;
}

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

function getDownloadFilename(
  response: Response,
  fallbackFilename: string
): string {
  const disposition = response.headers.get("content-disposition");
  const match = disposition?.match(/filename="([^"]+)"/i);
  return match?.[1] ?? fallbackFilename;
}

export async function downloadApiFile(
  path: string,
  fallbackFilename: string,
  accept = "application/pdf"
): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new ApiError("Please login to continue.", 401, "UNAUTHORIZED");
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "GET",
      headers: {
        Accept: accept,
        Authorization: `Bearer ${token}`
      }
    });
  } catch (error) {
    logDevError("Courtify document download failed", error);
    throw new ApiError("Courtify-Badminton API is unavailable.");
  }

  if (!response.ok) {
    const data = await parseJsonResponse(response);
    const body = data as ApiErrorBody;
    throw new ApiError(
      body.error?.message ?? "Unable to download this document.",
      response.status,
      body.error?.code
    );
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = getDownloadFilename(response, fallbackFilename);
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
