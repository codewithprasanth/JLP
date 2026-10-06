import { env } from '../../config/env';
import type { OrderStatus } from '../../generated/prisma/client';
import { NotificationNotConfiguredError, type Notification, type NotificationChannel, type Recipient } from './channel';

const STATUS_TEXT: Record<OrderStatus, string> = {
  PLACED: 'placed',
  CONFIRMED: 'confirmed',
  PREPARING: 'being prepared',
  OUT_FOR_DELIVERY: 'out for delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

/**
 * Phase 2 — MSG91 via DLT-registered Flow templates. Scaffolded and wired to the
 * same interface, but NOT enabled in v1: env.ts refuses NOTIFICATION_CHANNEL=sms
 * until login moves back to phone numbers (an SMS can't verify an email login).
 * MSG91 template variables: OTP → ##otp##; order → ##order_id##, ##status##.
 */
export class SmsChannel implements NotificationChannel {
  readonly name = 'sms' as const;

  isConfigured(): boolean {
    return Boolean(env.MSG91_AUTH_KEY && env.MSG91_OTP_TEMPLATE_ID && env.MSG91_ORDER_TEMPLATE_ID);
  }

  async send(to: Recipient, message: Notification): Promise<void> {
    if (!this.isConfigured()) throw new NotificationNotConfiguredError(this.name);
    if (!to.phone) return; // no contact number on file

    const [templateId, variables] =
      message.kind === 'otp'
        ? [env.MSG91_OTP_TEMPLATE_ID, { otp: message.otp }]
        : [
            env.MSG91_ORDER_TEMPLATE_ID,
            { order_id: message.order.shortId, status: STATUS_TEXT[message.kind === 'order_placed' ? 'PLACED' : message.status] },
          ];

    const res = await fetch('https://control.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: { authkey: env.MSG91_AUTH_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ template_id: templateId, short_url: '0', recipients: [{ mobiles: `91${to.phone}`, ...variables }] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`MSG91 responded ${res.status}: ${await res.text()}`);
  }
}
