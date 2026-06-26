import { Resend } from "resend";

import type {
  EmailDeliveryResult,
  EmailMessage,
  EmailProvider
} from "../email.types.js";

export class ResendEmailProvider implements EmailProvider {
  private readonly resend: Resend;

  public constructor(apiKey: string) {
    this.resend = new Resend(apiKey);
  }

  public async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    const result = await this.resend.emails.send({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.attachments
        ? {
            attachments: message.attachments.map((attachment) => ({
              filename: attachment.filename,
              content: attachment.content,
              contentType: attachment.contentType
            }))
          }
        : {})
    });

    if (result.error) {
      throw new Error(
        `Resend email delivery failed: ${result.error.name} - ${result.error.message}`
      );
    }

    return { providerMessageId: result.data.id };
  }
}
