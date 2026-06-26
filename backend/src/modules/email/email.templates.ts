import type { EmailTemplate } from "./email.types.js";

interface OtpEmailData {
  otp: string;
  name?: string | null;
}

interface PasswordResetEmailData {
  resetUrl: string;
  name: string | null;
}

interface PasswordChangedEmailData {
  name: string | null;
}

interface BookingEmailData {
  bookingId: string;
  courtName: string;
  reservationStartAt: Date;
  reservationEndAt: Date;
  totalAmountBnd: string;
  bookingStatus: string;
}

interface CancellationEmailData {
  bookingId: string;
  courtName: string;
  reservationStartAt: Date;
  status: string;
}

interface RefundEmailData {
  bookingId: string;
  refundedAt: Date;
  refundMethod: string;
  refundReference: string;
}

interface CaseClosedEmailData {
  bookingId: string;
  finalStatus: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-BN", {
    timeZone: "Asia/Brunei",
    dateStyle: "full"
  }).format(value);
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("en-BN", {
    timeZone: "Asia/Brunei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(value);
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-BN", {
    timeZone: "Asia/Brunei",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function formatStatus(value: string): string {
  return value.replaceAll("_", " ");
}

function durationHours(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (60 * 60 * 1000));
}

function greeting(name?: string | null): string {
  return name ? `Hi ${name},` : "Hi,";
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f4faf6;color:#102116;font-family:Arial,Helvetica,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4faf6;padding:24px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #cfe2d5;border-radius:18px;overflow:hidden">
            <tr>
              <td style="background:#087f5b;color:#ffffff;padding:24px">
                <strong style="display:block;font-size:22px;line-height:1.25">Courtify-Badminton</strong>
                <span style="display:block;margin-top:6px;font-size:14px;line-height:1.4">Badminton booking in Brunei</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px">
                <h1 style="margin:0 0 18px;font-size:26px;line-height:1.2;color:#102116">${escapeHtml(title)}</h1>
                ${body}
                <p style="margin:28px 0 0;color:#526158;font-size:13px;line-height:1.5">This is a transactional Courtify-Badminton email. Please do not share OTPs, reset links, or booking references with anyone you do not trust.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function paragraph(value: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6">${escapeHtml(value)}</p>`;
}

function otpBlock(otp: string): string {
  return `<div style="margin:20px 0;padding:18px;border:1px solid #b7dfc6;border-radius:14px;background:#f0fdf4;text-align:center">
    <div style="color:#526158;font-size:13px;font-weight:bold;text-transform:uppercase">Your OTP</div>
    <div style="margin-top:8px;color:#102116;font-size:32px;font-weight:bold;line-height:1">${escapeHtml(otp)}</div>
  </div>`;
}

function actionLink(label: string, href: string): string {
  const safeHref = escapeHtml(href);

  return `<p style="margin:22px 0"><a href="${safeHref}" style="display:inline-block;border-radius:10px;background:#087f5b;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a></p>
  <p style="margin:0 0 16px;color:#526158;font-size:13px;line-height:1.5;word-break:break-all">${safeHref}</p>`;
}

function details(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px">
    ${rows
      .map(
        ([label, value]) => `<tr>
      <td style="padding:10px 0;border-top:1px solid #cfe2d5;color:#526158">${escapeHtml(label)}</td>
      <td align="right" style="padding:10px 0;border-top:1px solid #cfe2d5;font-weight:bold;color:#102116">${escapeHtml(value)}</td>
    </tr>`
      )
      .join("")}
  </table>`;
}

function textDetails(rows: [string, string][]): string {
  return rows.map(([label, value]) => `${label}: ${value}`).join("\n");
}

export const emailTemplates = {
  registrationOtp(data: OtpEmailData): EmailTemplate {
    return {
      subject: "Your Courtify-Badminton registration OTP",
      html: layout(
        "Registration OTP",
        `${paragraph(greeting(data.name))}
        ${paragraph("Use this one-time password to complete your Courtify-Badminton registration. It expires in 5 minutes.")}
        ${otpBlock(data.otp)}
        ${paragraph("If you did not request this code, you can ignore this email.")}`
      ),
      text: `${greeting(data.name)}\n\nUse this one-time password to complete your Courtify-Badminton registration. It expires in 5 minutes.\n\nGenerated OTP: ${data.otp}\n\nIf you did not request this code, you can ignore this email.`
    };
  },

  loginOtp(data: OtpEmailData): EmailTemplate {
    return {
      subject: "Your Courtify-Badminton login OTP",
      html: layout(
        "Login OTP",
        `${paragraph(greeting(data.name))}
        ${paragraph("Use this one-time password to continue signing in to Courtify-Badminton. It expires in 5 minutes.")}
        ${otpBlock(data.otp)}
        ${paragraph("If you did not request this code, please contact the court administrator.")}`
      ),
      text: `${greeting(data.name)}\n\nUse this one-time password to continue signing in to Courtify-Badminton. It expires in 5 minutes.\n\nGenerated OTP: ${data.otp}\n\nIf you did not request this code, please contact the court administrator.`
    };
  },

  passwordReset(data: PasswordResetEmailData): EmailTemplate {
    return {
      subject: "Reset your Courtify-Badminton password",
      html: layout(
        "Password Reset",
        `${paragraph(greeting(data.name))}
        ${paragraph("Use this secure link to reset your password. It expires in 30 minutes.")}
        ${actionLink("Reset password", data.resetUrl)}
        ${paragraph("If you did not request a password reset, you can ignore this email.")}`
      ),
      text: `${greeting(data.name)}\n\nUse this secure link to reset your password. It expires in 30 minutes.\n\n${data.resetUrl}\n\nIf you did not request a password reset, you can ignore this email.`
    };
  },

  passwordChanged(data: PasswordChangedEmailData): EmailTemplate {
    return {
      subject: "Your Courtify-Badminton password was changed",
      html: layout(
        "Password Changed",
        `${paragraph(greeting(data.name))}
        ${paragraph("Your Courtify-Badminton password was changed. If this was not you, contact the court administrator immediately.")}`
      ),
      text: `${greeting(data.name)}\n\nYour Courtify-Badminton password was changed. If this was not you, contact the court administrator immediately.`
    };
  },

  bookingConfirmation(data: BookingEmailData): EmailTemplate {
    const rows: [string, string][] = [
      ["Booking ID", data.bookingId],
      ["Court", data.courtName],
      ["Date", formatDate(data.reservationStartAt)],
      ["Start time", formatTime(data.reservationStartAt)],
      ["End time", formatTime(data.reservationEndAt)],
      [
        "Duration",
        `${durationHours(
          data.reservationStartAt,
          data.reservationEndAt
        ).toString()} hour(s)`
      ],
      ["Total amount", `BND ${data.totalAmountBnd}`],
      ["Status", formatStatus(data.bookingStatus)]
    ];

    return {
      subject: "Courtify-Badminton booking confirmed",
      html: layout(
        "Booking Confirmed",
        `${paragraph("Your payment is confirmed and your court is reserved.")}
        ${details(rows)}`
      ),
      text: `Courtify-Badminton Booking Confirmed\n\nYour payment is confirmed and your court is reserved.\n\n${textDetails(rows)}`
    };
  },

  cancellationRequestReceived(data: CancellationEmailData): EmailTemplate {
    const rows: [string, string][] = [
      ["Booking ID", data.bookingId],
      ["Court", data.courtName],
      ["Reservation date", formatDate(data.reservationStartAt)],
      ["Current status", formatStatus(data.status)]
    ];

    return {
      subject: "Courtify-Badminton cancellation request received",
      html: layout(
        "Cancellation Request Received",
        `${paragraph("Your cancellation request has been submitted and is pending admin review.")}
        ${details(rows)}`
      ),
      text: `Courtify-Badminton Cancellation Request Received\n\nYour cancellation request has been submitted and is pending admin review.\n\n${textDetails(rows)}`
    };
  },

  cancellationApproved(data: CancellationEmailData): EmailTemplate {
    const rows: [string, string][] = [
      ["Booking ID", data.bookingId],
      ["Court", data.courtName],
      ["Reservation date", formatDate(data.reservationStartAt)],
      ["Status", formatStatus(data.status)]
    ];

    return {
      subject: "Courtify-Badminton cancellation approved",
      html: layout(
        "Cancellation Approved",
        `${paragraph("Your cancellation has been approved and the booking slots have been released. The business will process any eligible refund manually.")}
        ${details(rows)}`
      ),
      text: `Courtify-Badminton Cancellation Approved\n\nYour cancellation has been approved and the booking slots have been released. The business will process any eligible refund manually.\n\n${textDetails(rows)}`
    };
  },

  refundCompleted(data: RefundEmailData): EmailTemplate {
    const rows: [string, string][] = [
      ["Booking ID", data.bookingId],
      ["Refund date", formatDateTime(data.refundedAt)],
      ["Refund method", data.refundMethod],
      ["Refund reference", data.refundReference]
    ];

    return {
      subject: "Courtify-Badminton refund completed",
      html: layout(
        "Refund Completed",
        `${paragraph("Your manual refund has been completed.")}
        ${details(rows)}`
      ),
      text: `Courtify-Badminton Refund Completed\n\nYour manual refund has been completed.\n\n${textDetails(rows)}`
    };
  },

  caseClosed(data: CaseClosedEmailData): EmailTemplate {
    const rows: [string, string][] = [
      ["Booking ID", data.bookingId],
      ["Final status", formatStatus(data.finalStatus)]
    ];

    return {
      subject: "Courtify-Badminton case closed",
      html: layout(
        "Case Closed",
        `${paragraph("Your cancellation and refund case is now closed.")}
        ${details(rows)}`
      ),
      text: `Courtify-Badminton Case Closed\n\nYour cancellation and refund case is now closed.\n\n${textDetails(rows)}`
    };
  }
};
