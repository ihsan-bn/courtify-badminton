import type { EmailTemplate } from "./email.types.js";

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

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f7fbf8;color:#102116;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7fbf8;padding:24px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #cfe2d5;border-radius:20px;overflow:hidden">
            <tr>
              <td style="background:#087f5b;color:#ffffff;padding:24px">
                <strong style="font-size:22px">Courtify-Badminton</strong>
                <div style="margin-top:6px;font-size:14px">Badminton booking in Brunei</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px">
                <h1 style="margin:0 0 20px;font-size:26px">${escapeHtml(title)}</h1>
                ${body}
                <p style="margin:28px 0 0;color:#526158;font-size:13px">This is a transactional email about your Courtify-Badminton booking.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function details(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    ${rows
      .map(
        ([label, value]) => `<tr>
      <td style="padding:10px 0;border-top:1px solid #cfe2d5;color:#526158">${escapeHtml(label)}</td>
      <td align="right" style="padding:10px 0;border-top:1px solid #cfe2d5;font-weight:bold">${escapeHtml(value)}</td>
    </tr>`
      )
      .join("")}
  </table>`;
}

function textDetails(rows: [string, string][]): string {
  return rows.map(([label, value]) => `${label}: ${value}`).join("\n");
}

export const emailTemplates = {
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
      subject: "Courtify Booking Confirmed",
      html: layout(
        "Booking Confirmed",
        `<p>Your payment is confirmed and your court is reserved.</p>${details(rows)}`
      ),
      text: `Courtify Booking Confirmed\n\nYour payment is confirmed and your court is reserved.\n\n${textDetails(rows)}`
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
      subject: "Courtify Cancellation Request Received",
      html: layout(
        "Cancellation Request Received",
        `<p>Your cancellation request is pending admin review.</p>${details(rows)}`
      ),
      text: `Courtify Cancellation Request Received\n\nYour cancellation request is pending admin review.\n\n${textDetails(rows)}`
    };
  },

  cancellationApproved(data: CancellationEmailData): EmailTemplate {
    const rows: [string, string][] = [
      ["Booking ID", data.bookingId],
      ["Status", formatStatus(data.status)]
    ];

    return {
      subject: "Courtify Cancellation Approved",
      html: layout(
        "Cancellation Approved",
        `<p>Your cancellation has been approved. The booking slots have been released. The business will process any eligible refund manually.</p>${details(rows)}`
      ),
      text: `Courtify Cancellation Approved\n\nYour cancellation has been approved. The booking slots have been released. The business will process any eligible refund manually.\n\n${textDetails(rows)}`
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
      subject: "Courtify Refund Completed",
      html: layout(
        "Refund Completed",
        `<p>Your manual refund has been completed.</p>${details(rows)}`
      ),
      text: `Courtify Refund Completed\n\nYour manual refund has been completed.\n\n${textDetails(rows)}`
    };
  },

  caseClosed(data: CaseClosedEmailData): EmailTemplate {
    const rows: [string, string][] = [
      ["Booking ID", data.bookingId],
      ["Final status", formatStatus(data.finalStatus)]
    ];

    return {
      subject: "Courtify Case Closed",
      html: layout(
        "Case Closed",
        `<p>Your cancellation and refund case is now closed.</p>${details(rows)}`
      ),
      text: `Courtify Case Closed\n\nYour cancellation and refund case is now closed.\n\n${textDetails(rows)}`
    };
  }
};
