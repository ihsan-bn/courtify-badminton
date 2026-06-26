import { randomUUID } from "node:crypto";

import type {
  EmailDeliveryResult,
  EmailMessage,
  EmailProvider
} from "../email.types.js";

export class LocalEmailProvider implements EmailProvider {
  send(message: EmailMessage): Promise<EmailDeliveryResult> {
    const providerMessageId = `local-${randomUUID()}`;

    console.info(
      JSON.stringify({
        level: "info",
        message: "Local transactional email delivered",
        provider_message_id: providerMessageId,
        to: message.to,
        from: message.from,
        subject: message.subject,
        text: message.text,
        attachments:
          message.attachments?.map((attachment) => ({
            filename: attachment.filename,
            content_type: attachment.contentType,
            message: "Attachment would be sent by a real email provider"
          })) ?? []
      })
    );

    return Promise.resolve({ providerMessageId });
  }
}
