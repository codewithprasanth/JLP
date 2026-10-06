import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/prisma/client';
import { conflict, notFound } from '../../shared/errors';
import { redis } from '../../shared/redis/client';
import { idParam } from '../../shared/validate';
import { ACTIVE_STATUSES, cancelOrderByCustomer, placeOrder } from '../orders/order.service';
import { toCustomerOrderDetail, toOrderSummary } from '../orders/order.dto';

export const customerOrdersRouter = Router();

const placeOrderBody = z.object({
  addressId: z.uuid(),
  items: z
    .array(z.object({ menuItemId: z.uuid(), quantity: z.number().int().min(1).max(50) }))
    .min(1, 'Cart is empty')
    .max(50),
});

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

/**
 * Optional `Idempotency-Key` header: a retried "Place Order" (flaky network,
 * double tap) returns the original order instead of creating a duplicate.
 */
customerOrdersRouter.post('/', async (req, res) => {
  const userId = req.user!.id;
  const body = placeOrderBody.parse(req.body);
  const idemHeader = req.get('Idempotency-Key');
  const idemKey = idemHeader && /^[\w-]{8,64}$/.test(idemHeader) ? `idem:order:${userId}:${idemHeader}` : null;

  if (idemKey) {
    const claimed = await redis.set(idemKey, 'pending', {
      expiration: { type: 'EX', value: IDEMPOTENCY_TTL_SECONDS },
      condition: 'NX',
    });
    if (claimed !== 'OK') {
      const existing = await redis.get(idemKey);
      if (existing && existing !== 'pending') {
        const order = await prisma.order.findFirst({
          where: { id: existing, userId },
          include: { items: true, statusHistory: { orderBy: { changedAt: 'asc' } } },
        });
        if (order) return res.status(200).json(toCustomerOrderDetail(order));
      }
      throw conflict('This order is already being placed', 'DUPLICATE_REQUEST');
    }
  }

  try {
    const order = await placeOrder(userId, body);
    if (idemKey) await redis.set(idemKey, order.id, { expiration: { type: 'EX', value: IDEMPOTENCY_TTL_SECONDS } });
    res.status(201).json(toCustomerOrderDetail({ ...order, statusHistory: [] }));
  } catch (err) {
    // A rejected order (e.g. below minimum) may be fixed and retried with the same key.
    if (idemKey) await redis.del(idemKey);
    throw err;
  }
});

customerOrdersRouter.get('/', async (req, res) => {
  const { status } = z.object({ status: z.enum(['ongoing', 'history']).default('ongoing') }).parse(req.query);
  const orders = await prisma.order.findMany({
    where: {
      userId: req.user!.id,
      status: status === 'ongoing' ? { in: ACTIVE_STATUSES } : { notIn: ACTIVE_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { items: true },
  });
  res.json(orders.map(toOrderSummary));
});

customerOrdersRouter.get('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const order = await prisma.order.findFirst({
    where: { id, userId: req.user!.id },
    include: { items: true, statusHistory: { orderBy: { changedAt: 'asc' } } },
  });
  if (!order) throw notFound('Order not found');
  res.json(toCustomerOrderDetail(order));
});

customerOrdersRouter.post('/:id/cancel', async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await cancelOrderByCustomer(req.user!.id, id));
});
