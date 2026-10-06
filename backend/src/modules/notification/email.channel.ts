import { env } from '../../config/env';
import { NotificationNotConfiguredError, type Notification, type NotificationChannel, type Recipient } from './channel';
import { renderEmail } from './email-templates';

/** Active channel for v1 — Brevo transactional email (no DLT registration needed). */
export class EmailChannel implements NotificationChannel {
  readonly name = 'email' as const;

  isConfigured(): boolean {
    return Boolean(env.BREVO_API_KEY && env.EMAIL_FROM_ADDRESS);
  }

  async send(to: Recipient, message: Notification): Promise<void> {
    if (!this.isConfigured()) throw new NotificationNotConfiguredError(this.name);
    const email = renderEmail(message, { name: env.EMAIL_FROM_NAME, appUrl: env.CORS_ORIGIN_CUSTOMER });

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: env.EMAIL_FROM_NAME, email: env.EMAIL_FROM_ADDRESS },
        to: [{ email: to.email, ...(to.name ? { name: to.name } : {}) }],
        subject: email.subject,
        htmlContent: email.html,
        textContent: email.text,
        tags: [message.kind],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`Brevo responded ${res.status}: ${await res.text()}`);
    }
  }
}
