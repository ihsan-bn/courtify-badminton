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
        text: message.text
      })
    );

    return Promise.resolve({ providerMessageId });
  }
}
