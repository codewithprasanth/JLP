import { env } from '../../config/env';
import type { OrderStatus } from '../../generated/prisma/client';
import type { OrderNotice, Recipient } from './channel';
import { deliver, route } from './notifier';

export const shortOrderId = (orderId: string) => orderId.slice(0, 8).toUpperCase();

/** Customer login can only work when a code can actually reach them. */
export function canDeliverOtp(): boolean {
  return route() !== 'none';
}

/** Awaited: the caller must know whether the code went out. */
export async function sendLoginOtp(email: string, otp: string, ttlSeconds: number): Promise<void> {
  await deliver({ email }, { kind: 'otp', otp, ttlMinutes: Math.round(ttlSeconds / 60) });
}

/**
 * Fire-and-forget: a provider outage must never fail (or duplicate) the order
 * request that triggered it. Errors are logged only.
 */
function dispatch(to: Recipient, run: () => Promise<void>) {
  void run().catch((err) => console.error(`Notification to ${to.email} failed:`, err));
}

export function notifyOrderPlaced(to: Recipient, order: OrderNotice) {
  dispatch(to, () => deliver(to, { kind: 'order_placed', order }));
}

export function notifyOrderStatus(
  to: Recipient,
  order: OrderNotice,
  status: OrderStatus,
  options: { reason?: string | null; byCustomer?: boolean } = {},
) {
  // ORDER_EMAIL_STATUSES trims email volume (provider quotas) — CANCELLED is always sent.
  if (status !== 'CANCELLED' && !(env.ORDER_EMAIL_STATUSES as OrderStatus[]).includes(status)) return;
  dispatch(to, () => deliver(to, { kind: 'order_status', order, status, ...options }));
}
