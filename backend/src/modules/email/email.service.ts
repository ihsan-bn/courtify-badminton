import { env } from "../../config/env.js";
import { emailRepository } from "./email.repository.js";
import { emailTemplates } from "./email.templates.js";
import type {
  EmailEventType,
  EmailProvider,
  EmailTemplate
} from "./email.types.js";
import { LocalEmailProvider } from "./providers/localEmail.provider.js";
import { auditService } from "../audit/audit.service.js";

const providers: Record<typeof env.emailProvider, EmailProvider> = {
  local: new LocalEmailProvider()
};
const provider = providers[env.emailProvider];

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
  ) => EmailTemplate
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
      text: template.text
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
    const greeting = name ? `Hi ${name},` : "Hi,";
    await provider.send({
      to: to.toLowerCase(),
      from: env.emailFrom,
      subject: "Your Courtify-Badminton login OTP",
      html: `<p>${greeting}</p><p>Your Courtify-Badminton OTP is <strong>${otp}</strong>. It expires in 5 minutes.</p>`,
      text: `${greeting}\n\nYour Courtify-Badminton OTP is ${otp}. It expires in 5 minutes.`
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
    const greeting = name ? `Hi ${name},` : "Hi,";
    await provider.send({
      to: to.toLowerCase(),
      from: env.emailFrom,
      subject: "Reset your Courtify-Badminton password",
      html: `<p>${greeting}</p><p>Use this secure link to reset your password. It expires in 30 minutes:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
      text: `${greeting}\n\nUse this secure link to reset your password. It expires in 30 minutes:\n${resetUrl}`
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
    const greeting = name ? `Hi ${name},` : "Hi,";
    await provider.send({
      to: to.toLowerCase(),
      from: env.emailFrom,
      subject: "Your Courtify-Badminton password was changed",
      html: `<p>${greeting}</p><p>Your Courtify-Badminton password was changed. If this was not you, contact the court administrator immediately.</p>`,
      text: `${greeting}\n\nYour Courtify-Badminton password was changed. If this was not you, contact the court administrator immediately.`
    });
  },

  async sendBookingConfirmation(bookingId: string): Promise<void> {
    await dispatch(bookingId, "booking_confirmation", (context) =>
      emailTemplates.bookingConfirmation({
        bookingId: context.booking_id,
        courtName: context.court_name,
        reservationStartAt: context.reservation_start_at,
        reservationEndAt: context.reservation_end_at,
        totalAmountBnd: context.total_amount_bnd,
        bookingStatus: context.booking_status
      })
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
