import { env } from "../../config/env.js";
import { createBookingCalendarInvite } from "../../utils/ics.js";
import { emailRepository } from "./email.repository.js";
import { emailTemplates } from "./email.templates.js";
import type {
  EmailAttachment,
  EmailEventType,
  EmailProvider,
  EmailTemplate
} from "./email.types.js";
import { LocalEmailProvider } from "./providers/localEmail.provider.js";
import { ResendEmailProvider } from "./providers/resendEmail.provider.js";
import { auditService } from "../audit/audit.service.js";

function createProvider(): EmailProvider {
  if (env.emailProvider === "resend") {
    return new ResendEmailProvider(env.resendApiKey ?? "");
  }

  return new LocalEmailProvider();
}

const provider = createProvider();

function getFrontendOrigin(): string {
  return env.corsAllowedOrigins[0] ?? "http://localhost:3000";
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown email provider error";
}

async function dispatch(
  bookingId: string,
  eventType: EmailEventType,
  templateFactory: (
    context: NonNullable<
      Awaited<ReturnType<typeof emailRepository.findBookingContext>>
    >
  ) => EmailTemplate,
  attachmentFactory?: (
    context: NonNullable<
      Awaited<ReturnType<typeof emailRepository.findBookingContext>>
    >
  ) => EmailAttachment[]
): Promise<void> {
  let notificationEventId: string | null = null;

  try {
    const context = await emailRepository.findBookingContext(bookingId);
    if (!context?.customer_email) {
      console.warn(
        JSON.stringify({
          level: "warn",
          message: "Transactional email skipped because customer email is unavailable",
          booking_id: bookingId,
          email_type: eventType
        })
      );
      return;
    }

    const recipientEmail = context.customer_email.toLowerCase();
    const template = templateFactory(context);
    const attachments = attachmentFactory?.(context);
    notificationEventId = await emailRepository.claimEmailEvent(
      bookingId,
      eventType,
      recipientEmail,
      template,
      `${eventType}:${bookingId}`
    );
    if (!notificationEventId) {
      return;
    }

    const result = await provider.send({
      to: recipientEmail,
      from: env.emailFrom,
      subject: template.subject,
      html: template.html,
      text: template.text,
      ...(attachments ? { attachments } : {})
    });
    await emailRepository.markEmailSent(
      notificationEventId,
      result.providerMessageId
    );
    await auditService.record({
      actor: { userId: null, role: "system", name: "Email service" },
      action: "notification_sent",
      entityType: "booking",
      entityId: bookingId,
      summary: "Transactional email notification was sent.",
      metadata: {
        notification_event_id: notificationEventId,
        email_type: eventType,
        provider_message_id: result.providerMessageId
      }
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Transactional email delivery failed",
        booking_id: bookingId,
        email_type: eventType,
        error: safeErrorMessage(error)
      })
    );

    if (notificationEventId) {
      try {
        await emailRepository.markEmailFailed(
          notificationEventId,
          safeErrorMessage(error)
        );
        await auditService.record({
          actor: { userId: null, role: "system", name: "Email service" },
          action: "notification_failed",
          entityType: "booking",
          entityId: bookingId,
          summary: "Transactional email notification failed.",
          metadata: {
            notification_event_id: notificationEventId,
            email_type: eventType,
            failure: "email_delivery_failed"
          }
        });
      } catch (historyError) {
        console.error(
          JSON.stringify({
            level: "error",
            message: "Email failure history could not be updated",
            booking_id: bookingId,
            email_type: eventType,
            error: safeErrorMessage(historyError)
          })
        );
      }
    }
  }
}

export const emailService = {
  async sendLoginOtp({
    to,
    otp,
    name
  }: {
    to: string;
    otp: string;
    name: string | null;
  }): Promise<void> {
    const template = emailTemplates.loginOtp({ otp, name });
    await provider.send({
      to: to.toLowerCase(),
      from: env.emailFrom,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
  },

  async sendPasswordResetLink({
    to,
    token,
    name
  }: {
    to: string;
    token: string;
    name: string | null;
  }): Promise<void> {
    const resetUrl = `${getFrontendOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
    const template = emailTemplates.passwordReset({ resetUrl, name });
    await provider.send({
      to: to.toLowerCase(),
      from: env.emailFrom,
      subject: template.subject,
      html: template.html,
      text: template.text
    });

    if (!env.isProduction) {
      console.info(
        JSON.stringify({
          level: "info",
          message: "Local password reset link generated",
          to: to.toLowerCase(),
          reset_url: resetUrl
        })
      );
    }
  },

  async sendPasswordChangedNotification({
    to,
    name
  }: {
    to: string;
    name: string | null;
  }): Promise<void> {
    const template = emailTemplates.passwordChanged({ name });
    await provider.send({
      to: to.toLowerCase(),
      from: env.emailFrom,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
  },

  async sendBookingConfirmation(bookingId: string): Promise<void> {
    await dispatch(
      bookingId,
      "booking_confirmation",
      (context) =>
        emailTemplates.bookingConfirmation({
          bookingId: context.booking_id,
          courtName: context.court_name,
          reservationStartAt: context.reservation_start_at,
          reservationEndAt: context.reservation_end_at,
          totalAmountBnd: context.total_amount_bnd,
          bookingStatus: context.booking_status
        }),
      (context) => [
        {
          filename: `courtify-booking-${context.booking_id}.ics`,
          content: createBookingCalendarInvite({
            bookingId: context.booking_id,
            courtName: context.court_name,
            customerEmail: context.customer_email,
            organizerEmail: env.emailFrom,
            reservationStartAt: context.reservation_start_at,
            reservationEndAt: context.reservation_end_at,
            totalAmountBnd: context.total_amount_bnd
          }),
          contentType: "text/calendar; charset=UTF-8; method=REQUEST"
        }
      ]
    );
  },

  async sendCancellationRequestReceived(bookingId: string): Promise<void> {
    await dispatch(bookingId, "cancellation_request_received", (context) =>
      emailTemplates.cancellationRequestReceived({
        bookingId: context.booking_id,
        courtName: context.court_name,
        reservationStartAt: context.reservation_start_at,
        status: context.cancellation_status ?? context.booking_status
      })
    );
  },

  async sendCancellationApproved(bookingId: string): Promise<void> {
    await dispatch(bookingId, "cancellation_approved", (context) =>
      emailTemplates.cancellationApproved({
        bookingId: context.booking_id,
        courtName: context.court_name,
        reservationStartAt: context.reservation_start_at,
        status: context.cancellation_status ?? context.booking_status
      })
    );
  },

  async sendRefundCompleted(bookingId: string): Promise<void> {
    await dispatch(bookingId, "refund_completed", (context) => {
      if (
        !context.refunded_at ||
        !context.refund_method ||
        !context.refund_reference
      ) {
        throw new Error("Completed refund details are unavailable");
      }

      return emailTemplates.refundCompleted({
        bookingId: context.booking_id,
        refundedAt: context.refunded_at,
        refundMethod: context.refund_method,
        refundReference: context.refund_reference
      });
    });
  },

  async sendCaseClosed(bookingId: string): Promise<void> {
    await dispatch(bookingId, "case_closed", (context) =>
      emailTemplates.caseClosed({
        bookingId: context.booking_id,
        finalStatus: context.cancellation_status ?? context.booking_status
      })
    );
  },

  async getBookingEmailHistory(bookingId: string) {
    const history = await emailRepository.findEmailHistory(bookingId);
    return history.map((event) => ({
      email_type: event.email_type,
      delivery_status: event.delivery_status,
      sent_at: event.sent_at?.toISOString() ?? null,
      created_at: event.created_at.toISOString()
    }));
  }
};
