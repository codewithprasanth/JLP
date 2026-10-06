import { prisma } from '../../shared/prisma/client';
import { HttpError, badRequest } from '../../shared/errors';
import { haversineDistanceKm } from '../../shared/utils/haversine';

type Db = Pick<typeof prisma, 'settings'>;

export async function getSettings(db: Db = prisma) {
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (!settings) throw new HttpError(503, 'Restaurant settings not initialised — run the seed script');
  return settings;
}

export async function getPublicSettings() {
  const s = await getSettings();
  return {
    isAcceptingOrders: s.isAcceptingOrders,
    minOrderValue: s.minOrderValue.toFixed(2),
    deliveryRadiusKm: s.deliveryRadiusKm.toFixed(2),
    shopLatitude: s.shopLatitude.toNumber(),
    shopLongitude: s.shopLongitude.toNumber(),
  };
}

/** Used when saving an address AND again at order placement (defence in depth). */
export async function assertWithinDeliveryRadius(lat: number, lng: number, db: Db = prisma): Promise<number> {
  const s = await getSettings(db);
  const distanceKm = haversineDistanceKm(s.shopLatitude.toNumber(), s.shopLongitude.toNumber(), lat, lng);
  const radius = s.deliveryRadiusKm.toNumber();
  if (distanceKm > radius) {
    throw badRequest(
      `Sorry, this address is outside our delivery area. We deliver within ${radius} km; this location is ${distanceKm.toFixed(1)} km away.`,
      'OUTSIDE_DELIVERY_RADIUS',
    );
  }
  return Math.round(distanceKm * 100) / 100;
}
