export interface EmailAttachment {
  filename: string;
  content: string;
  contentType: string;
}

export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

export interface EmailDeliveryResult {
  providerMessageId: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailDeliveryResult>;
}

export type EmailEventType =
  | "booking_confirmation"
  | "cancellation_request_received"
  | "cancellation_approved"
  | "refund_completed"
  | "case_closed";

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}
