import type { Order, OrderItem, OrderStatusHistory } from '../../generated/prisma/client';
import { CANCEL_WINDOW_SECONDS } from './order.service';

type OrderWithItems = Order & { items: OrderItem[] };

export function cancellableUntil(order: Order): string | null {
  if (order.status !== 'PLACED') return null;
  const until = order.createdAt.getTime() + CANCEL_WINDOW_SECONDS * 1000;
  return until > Date.now() ? new Date(until).toISOString() : null;
}

export function toOrderSummary(order: OrderWithItems) {
  return {
    id: order.id,
    status: order.status,
    totalAmount: order.totalAmount.toFixed(2),
    itemCount: order.items.reduce((n, i) => n + i.quantity, 0),
    isPaid: order.isPaid,
    createdAt: order.createdAt.toISOString(),
    cancellableUntil: cancellableUntil(order),
  };
}

/** Customer-facing detail: status history without admin identities. */
export function toCustomerOrderDetail(order: OrderWithItems & { statusHistory: OrderStatusHistory[] }) {
  return {
    ...toOrderSummary(order),
    deliveryAddressText: order.deliveryAddressText,
    distanceKm: order.distanceKm.toFixed(2),
    cancelReason: order.cancelReason,
    paymentMethod: 'COD',
    items: order.items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      name: i.itemNameSnapshot,
      price: i.priceSnapshot.toFixed(2),
      quantity: i.quantity,
      lineTotal: i.priceSnapshot.times(i.quantity).toFixed(2),
    })),
    statusHistory: order.statusHistory.map((h) => ({ status: h.status, actor: h.actor, note: h.note, changedAt: h.changedAt.toISOString() })),
  };
}
