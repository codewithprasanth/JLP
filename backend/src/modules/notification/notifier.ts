import { env, isProd } from '../../config/env';
import type { Notification, NotificationChannel, Recipient } from './channel';
import { EmailChannel } from './email.channel';
import { SmsChannel } from './sms.channel';

/** Addendum 1: the single switch. Nothing else knows which provider is behind it. */
export const channel: NotificationChannel = env.NOTIFICATION_CHANNEL === 'sms' ? new SmsChannel() : new EmailChannel();

export type Route = 'send' | 'log' | 'none';

/**
 * - send: provider configured → real delivery
 * - log:  development, or NOTIFICATIONS_LOG_ONLY=true → printed to the server log
 * - none: production without a provider → not deliverable (OTP login answers 503,
 *         order notifications are skipped). Production never logs OTPs unless
 *         NOTIFICATIONS_LOG_ONLY is set deliberately — a logged OTP is a credential.
 */
export function route(): Route {
  if (channel.isConfigured()) return 'send';
  if (!isProd || env.NOTIFICATIONS_LOG_ONLY) return 'log';
  return 'none';
}

export async function deliver(to: Recipient, message: Notification): Promise<void> {
  const r = route();
  if (r === 'send') return channel.send(to, message);
  if (r === 'none') return;
  const summary =
    message.kind === 'otp'
      ? { otp: message.otp }
      : { order: message.order.shortId, status: message.kind === 'order_placed' ? 'PLACED' : message.status };
  console.log(`[notify:log] ${JSON.stringify({ channel: channel.name, to: to.email, kind: message.kind, ...summary })}`);
}

export function describeNotifications(): string {
  const via = channel.name === 'email' ? `email (${env.EMAIL_PROVIDER})` : 'SMS (MSG91)';
  switch (route()) {
    case 'send':
      return `Notifications: ${via} — live`;
    case 'log':
      return `Notifications: ${via} — log-only${isProd ? ' (NOTIFICATIONS_LOG_ONLY=true — OTPs appear in logs; testing only!)' : ' (development)'}`;
    case 'none':
      return `Notifications: ${via} — NOT CONFIGURED; customer login is disabled until it is set up`;
  }
}
