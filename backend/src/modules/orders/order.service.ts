import { Prisma, type OrderStatus } from '../../generated/prisma/client';
import { prisma } from '../../shared/prisma/client';
import { badRequest, conflict, notFound } from '../../shared/errors';
import { assertWithinDeliveryRadius, getSettings } from '../settings/settings.service';
import type { OrderNotice } from '../notification/channel';
import { notifyOrderPlaced, notifyOrderStatus, shortOrderId } from '../notification/notification.service';

const recipientSelect = { email: true, name: true, phone: true } as const;
const withNoticeData = { items: true, user: { select: recipientSelect } } as const;

function toNotice(order: Prisma.OrderGetPayload<{ include: { items: true } }>): OrderNotice {
  return {
    id: order.id,
    shortId: shortOrderId(order.id),
    status: order.status,
    totalAmount: order.totalAmount.toFixed(2),
    deliveryAddressText: order.deliveryAddressText,
    items: order.items.map((i) => ({ name: i.itemNameSnapshot, quantity: i.quantity, lineTotal: i.priceSnapshot.times(i.quantity).toFixed(2) })),
  };
}

export const CANCEL_WINDOW_SECONDS = 60;

export const ACTIVE_STATUSES: OrderStatus[] = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'];

/** The only status moves an admin may make. CANCELLED = "reject" and needs a reason. */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export interface PlaceOrderInput {
  addressId: string;
  items: { menuItemId: string; quantity: number }[];
}

export async function placeOrder(userId: string, input: PlaceOrderInput) {
  // Merge duplicate lines so { A x1 }, { A x2 } becomes { A x3 }.
  const quantities = new Map<string, number>();
  for (const line of input.items) {
    quantities.set(line.menuItemId, (quantities.get(line.menuItemId) ?? 0) + line.quantity);
  }
  for (const qty of quantities.values()) {
    if (qty > 50) throw badRequest('Maximum quantity per item is 50');
  }

  const order = await prisma.$transaction(async (tx) => {
    // The restaurant needs a number to call for delivery (Addendum 1: phone is contact-only).
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true, name: true } });
    if (!user.phone || !user.name.trim()) {
      throw badRequest('Please add your name and phone number before ordering', 'PROFILE_INCOMPLETE');
    }

    const settings = await getSettings(tx);
    if (!settings.isAcceptingOrders) {
      throw badRequest('Restaurant is currently not accepting orders', 'SHOP_CLOSED');
    }

    const address = await tx.address.findFirst({ where: { id: input.addressId, userId } });
    if (!address) throw notFound('Address not found');

    // Re-checked here: the radius or shop location may have changed since the address was saved.
    const distanceKm = await assertWithinDeliveryRadius(address.latitude.toNumber(), address.longitude.toNumber(), tx);

    const ids = [...quantities.keys()];
    const menuItems = await tx.menuItem.findMany({
      where: { id: { in: ids }, archivedAt: null, category: { archivedAt: null } },
    });
    const byId = new Map(menuItems.map((m) => [m.id, m]));

    const unavailable = ids.filter((id) => !byId.get(id)?.isAvailable);
    if (unavailable.length) {
      const names = unavailable.map((id) => byId.get(id)?.name ?? 'an item').join(', ');
      throw badRequest(`No longer available: ${names}`, 'ITEM_UNAVAILABLE');
    }

    // Exact decimal arithmetic — never floats for money.
    let total = new Prisma.Decimal(0);
    for (const [id, qty] of quantities) total = total.plus(byId.get(id)!.price.times(qty));

    if (total.lessThan(settings.minOrderValue)) {
      throw badRequest(`Minimum order value is ₹${settings.minOrderValue.toFixed(2)}`, 'BELOW_MINIMUM');
    }

    return tx.order.create({
      data: {
        userId,
        addressId: address.id,
        deliveryAddressText: address.addressText,
        deliveryLatitude: address.latitude,
        deliveryLongitude: address.longitude,
        distanceKm,
        totalAmount: total,
        status: 'PLACED',
        items: {
          create: ids.map((id) => {
            const m = byId.get(id)!;
            return { menuItemId: m.id, itemNameSnapshot: m.name, priceSnapshot: m.price, quantity: quantities.get(id)! };
          }),
        },
        statusHistory: { create: { status: 'PLACED', actor: 'CUSTOMER' } },
      },
      include: withNoticeData,
    });
  });

  notifyOrderPlaced(order.user, toNotice(order));
  return order;
}

export async function cancelOrderByCustomer(userId: string, orderId: string) {
  const windowStart = new Date(Date.now() - CANCEL_WINDOW_SECONDS * 1000);

  // Single conditional UPDATE: no race with an admin confirming at the same moment.
  const result = await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, userId, status: 'PLACED', createdAt: { gte: windowStart } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'Cancelled by customer' },
    });
    if (count === 1) {
      await tx.orderStatusHistory.create({ data: { orderId, status: 'CANCELLED', actor: 'CUSTOMER' } });
    }
    return count;
  });

  if (result === 1) {
    const cancelled = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: withNoticeData });
    notifyOrderStatus(cancelled.user, toNotice(cancelled), 'CANCELLED', { byCustomer: true });
    return { success: true };
  }

  const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
  if (!order) throw notFound('Order not found');
  if (order.status !== 'PLACED') throw badRequest('Order can no longer be cancelled', 'NOT_CANCELLABLE');
  throw badRequest('Cancellation window has passed', 'CANCEL_WINDOW_PASSED');
}

export async function transitionOrderByAdmin(adminId: string, orderId: string, to: OrderStatus, reason?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound('Order not found');

  if (!ALLOWED_TRANSITIONS[order.status].includes(to)) {
    throw badRequest(`Cannot move an order from ${order.status} to ${to}`, 'INVALID_TRANSITION');
  }
  if (to === 'CANCELLED' && !reason?.trim()) {
    throw badRequest('A reason is required to reject an order', 'REASON_REQUIRED');
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Optimistic check: fails if the status changed since we read it (e.g. customer cancelled).
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: {
        status: to,
        ...(to === 'CANCELLED' ? { cancelledAt: new Date(), cancelReason: reason!.trim() } : {}),
      },
    });
    if (count === 0) throw conflict('Order was updated by someone else — refresh and try again', 'STALE_STATUS');
    await tx.orderStatusHistory.create({
      data: { orderId, status: to, actor: 'ADMIN', adminId, note: to === 'CANCELLED' ? reason!.trim() : null },
    });
    return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: withNoticeData });
  });

  notifyOrderStatus(updated.user, toNotice(updated), to, { reason: updated.cancelReason });
  const { items: _items, user: _user, ...orderOnly } = updated;
  return orderOnly;
}
