import { Router } from 'express';
import { z } from 'zod';
import type { Settings } from '../../generated/prisma/client';
import { prisma } from '../../shared/prisma/client';
import { latitude, longitude, money } from '../../shared/validate';
import { getSettings } from '../settings/settings.service';

export const adminSettingsRouter = Router();

const toDto = (s: Settings) => ({
  shopLatitude: s.shopLatitude.toNumber(),
  shopLongitude: s.shopLongitude.toNumber(),
  deliveryRadiusKm: s.deliveryRadiusKm.toNumber(),
  minOrderValue: s.minOrderValue.toFixed(2),
  isAcceptingOrders: s.isAcceptingOrders,
  updatedAt: s.updatedAt.toISOString(),
});

adminSettingsRouter.get('/', async (_req, res) => {
  res.json(toDto(await getSettings()));
});

adminSettingsRouter.patch('/', async (req, res) => {
  const body = z
    .object({
      shopLatitude: latitude.optional(),
      shopLongitude: longitude.optional(),
      deliveryRadiusKm: z.coerce.number().min(0.1).max(50).optional(),
      minOrderValue: money.optional(),
      isAcceptingOrders: z.boolean().optional(),
    })
    .parse(req.body);
  await getSettings(); // 503 if not seeded
  // Past orders keep their snapshotted distance_km — nothing is recalculated here.
  res.json(toDto(await prisma.settings.update({ where: { id: 1 }, data: body })));
});
