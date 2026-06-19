import { env } from "../../config/env.js";
import { emailRepository } from "./email.repository.js";
import { emailTemplates } from "./email.templates.js";
import type {
  EmailEventType,
  EmailProvider,
  EmailTemplate
} from "./email.types.js";
import { LocalEmailProvider } from "./providers/localEmail.provider.js";

const providers: Record<typeof env.emailProvider, EmailProvider> = {
  local: new LocalEmailProvider()
};
const provider = providers[env.emailProvider];

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
