import type { OrderStatus } from '../../generated/prisma/client';

/** Who a notification is for. Each channel picks the address it needs (email or phone). */
export interface Recipient {
  email: string;
  phone?: string | null;
  name?: string | null;
}

export interface OrderNotice {
  id: string;
  shortId: string;
  status: OrderStatus;
  totalAmount: string;
  deliveryAddressText: string;
  items: { name: string; quantity: number; lineTotal: string }[];
}

/**
 * Typed messages rather than a free-text string: email needs a subject + HTML,
 * SMS needs DLT-registered template variables, so each channel formats its own.
 */
export type Notification =
  | { kind: 'otp'; otp: string; ttlMinutes: number }
  | { kind: 'order_placed'; order: OrderNotice }
  | { kind: 'order_status'; order: OrderNotice; status: OrderStatus; reason?: string | null; byCustomer?: boolean };

/** Addendum 1: one interface, provider chosen by NOTIFICATION_CHANNEL. */
export interface NotificationChannel {
  readonly name: 'email' | 'sms';
  /** Credentials present — can actually deliver. */
  isConfigured(): boolean;
  send(to: Recipient, message: Notification): Promise<void>;
}

export class NotificationNotConfiguredError extends Error {
  constructor(channel: string) {
    super(`${channel} notifications are not configured`);
  }
}
