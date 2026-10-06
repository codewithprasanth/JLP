import { Router } from 'express';
import { z } from 'zod';
import type { Address } from '../../generated/prisma/client';
import { prisma } from '../../shared/prisma/client';
import { badRequest, notFound } from '../../shared/errors';
import { idParam, latitude, longitude } from '../../shared/validate';
import { assertWithinDeliveryRadius } from '../settings/settings.service';

export const addressesRouter = Router();

const MAX_ADDRESSES = 20;

const addressBody = z.object({
  addressText: z.string().trim().min(5).max(500),
  latitude,
  longitude,
  label: z.string().trim().min(1).max(30).default('Home'),
  isDefault: z.boolean().optional(),
});

const toDto = (a: Address) => ({
  id: a.id,
  addressText: a.addressText,
  latitude: a.latitude.toNumber(),
  longitude: a.longitude.toNumber(),
  label: a.label,
  isDefault: a.isDefault,
});

addressesRouter.get('/', async (req, res) => {
  const list = await prisma.address.findMany({
    where: { userId: req.user!.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  res.json(list.map(toDto));
});

addressesRouter.post('/', async (req, res) => {
  const userId = req.user!.id;
  const body = addressBody.parse(req.body);
  await assertWithinDeliveryRadius(body.latitude, body.longitude);

  const created = await prisma.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) throw badRequest(`You can save up to ${MAX_ADDRESSES} addresses`);
    const makeDefault = body.isDefault === true || count === 0;
    // Clear the old default first — the partial unique index allows only one per user.
    if (makeDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return tx.address.create({ data: { ...body, userId, isDefault: makeDefault } });
  });
  res.status(201).json(toDto(created));
});

addressesRouter.patch('/:id', async (req, res) => {
  const userId = req.user!.id;
  const { id } = idParam.parse(req.params);
  const body = addressBody.partial().parse(req.body);

  const existing = await prisma.address.findFirst({ where: { id, userId } });
  if (!existing) throw notFound('Address not found');

  const lat = body.latitude ?? existing.latitude.toNumber();
  const lng = body.longitude ?? existing.longitude.toNumber();
  if (body.latitude !== undefined || body.longitude !== undefined) await assertWithinDeliveryRadius(lat, lng);

  const updated = await prisma.$transaction(async (tx) => {
    if (body.isDefault === true) {
      await tx.address.updateMany({ where: { userId, isDefault: true, NOT: { id } }, data: { isDefault: false } });
    }
    // Un-defaulting is done by making another address default, never by leaving none.
    const { isDefault, ...rest } = body;
    return tx.address.update({ where: { id }, data: { ...rest, ...(isDefault === true ? { isDefault } : {}) } });
  });
  res.json(toDto(updated));
});

addressesRouter.delete('/:id', async (req, res) => {
  const userId = req.user!.id;
  const { id } = idParam.parse(req.params);
  await prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id, userId } });
    if (!existing) throw notFound('Address not found');
    // Past orders keep their snapshotted address; address_id becomes NULL.
    await tx.address.delete({ where: { id } });
    if (existing.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  res.json({ success: true });
});
