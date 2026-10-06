import { Router } from 'express';
import { z } from 'zod';
import { OrderStatus } from '../../generated/prisma/client';
import { prisma } from '../../shared/prisma/client';
import { badRequest, notFound } from '../../shared/errors';
import { idParam } from '../../shared/validate';
import { ACTIVE_STATUSES, ALLOWED_TRANSITIONS, transitionOrderByAdmin } from '../orders/order.service';
import { toCustomerOrderDetail, toOrderSummary } from '../orders/order.dto';

export const adminOrdersRouter = Router();

const statusEnum = z.enum(OrderStatus);

adminOrdersRouter.get('/', async (req, res) => {
  const q = z
    .object({
      status: z.union([statusEnum, z.literal('active')]).optional(),
      // Polling: only orders created or changed after this instant.
      since: z.iso.datetime().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(100),
    })
    .parse(req.query);

  const orders = await prisma.order.findMany({
    where: {
      ...(q.status === 'active' ? { status: { in: ACTIVE_STATUSES } } : q.status ? { status: q.status } : {}),
      ...(q.since ? { updatedAt: { gt: new Date(q.since) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: q.limit,
    include: { items: true, user: { select: { name: true, phone: true, email: true } } },
  });

  res.json({
    serverTime: new Date().toISOString(), // client sends this back as `since`
    orders: orders.map((o) => ({
      ...toOrderSummary(o),
      customerName: o.user.name,
      customerPhone: o.user.phone,
      customerEmail: o.user.email,
      isNew: o.adminViewedAt === null && o.status === 'PLACED',
      updatedAt: o.updatedAt.toISOString(),
    })),
  });
});

adminOrdersRouter.get('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      user: { select: { name: true, phone: true, email: true } },
      statusHistory: { orderBy: { changedAt: 'asc' }, include: { admin: { select: { username: true } } } },
    },
  });
  if (!order) throw notFound('Order not found');
  // First open clears the "new" highlight. Plain SQL update avoids bumping updatedAt.
  if (!order.adminViewedAt) {
    await prisma.$executeRaw`UPDATE orders SET admin_viewed_at = now() WHERE id = ${id} AND admin_viewed_at IS NULL`;
  }

  res.json({
    ...toCustomerOrderDetail(order),
    customerName: order.user.name,
    customerPhone: order.user.phone,
    customerEmail: order.user.email,
    deliveryLatitude: order.deliveryLatitude.toNumber(),
    deliveryLongitude: order.deliveryLongitude.toNumber(),
    allowedTransitions: ALLOWED_TRANSITIONS[order.status],
    statusHistory: order.statusHistory.map((h) => ({
      status: h.status,
      actor: h.actor,
      by: h.admin?.username ?? null,
      note: h.note,
      changedAt: h.changedAt.toISOString(),
    })),
  });
});

adminOrdersRouter.patch('/:id/status', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { status, reason } = z.object({ status: statusEnum, reason: z.string().max(300).optional() }).parse(req.body);
  res.json(await transitionOrderByAdmin(req.user!.id, id, status, reason));
});

adminOrdersRouter.patch('/:id/payment', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { isPaid } = z.object({ isPaid: z.boolean() }).parse(req.body);
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw notFound('Order not found');
  if (order.status === 'CANCELLED') throw badRequest('Cannot mark a cancelled order as paid');
  const updated = await prisma.order.update({ where: { id }, data: { isPaid } });
  res.json({ id: updated.id, isPaid: updated.isPaid });
});
