/**
 * Idempotent seed: creates the singleton settings row, the admin account and a
 * starter menu (only if the menu is empty). Safe to re-run.
 *   npm run db:seed
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  // Defaults: Jinisha Lovely Products, Victorian View Layout, Borewell Road, Nallurhalli, Whitefield.
  // Only used when the settings row is first created — afterwards the admin Settings page owns these.
  const lat = Number(process.env.SEED_SHOP_LATITUDE ?? 12.967145);
  const lng = Number(process.env.SEED_SHOP_LONGITUDE ?? 77.736177);
  const radiusKm = Number(process.env.SEED_DELIVERY_RADIUS_KM ?? 1);
  const minOrder = Number(process.env.SEED_MIN_ORDER_VALUE ?? 100);
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, shopLatitude: lat, shopLongitude: lng, deliveryRadiusKm: radiusKm, minOrderValue: minOrder },
  });
  console.log('✔ settings');

  const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD;
  const existing = await prisma.admin.findUnique({ where: { username } });
  if (existing) {
    console.log(`✔ admin "${username}" already exists (password unchanged)`);
  } else {
    const minLength = process.env.NODE_ENV === 'production' ? 16 : 12;
    if (!password || password.length < minLength || /change-me/i.test(password)) {
      throw new Error(`Set SEED_ADMIN_PASSWORD (random, min ${minLength} chars) to create the admin account`);
    }
    await prisma.admin.create({ data: { username, passwordHash: await bcrypt.hash(password, 12) } });
    console.log(`✔ admin "${username}" created`);
  }

  // Demo dishes are for local development only — production starts with an empty menu.
  if (process.env.NODE_ENV !== 'production' && (await prisma.category.count()) === 0) {
    const menu: Record<string, [string, string, number][]> = {
      Breakfast: [
        ['Masala Dosa', 'Crispy rice crepe with spiced potato filling', 80],
        ['Idli Vada', 'Two idlis and one medu vada with chutney and sambar', 60],
      ],
      Lunch: [
        ['Veg Thali', 'Rice, two curries, dal, roti, curd and pickle', 150],
        ['Paneer Butter Masala', 'Cottage cheese in a rich tomato gravy', 180],
      ],
      Beverages: [
        ['Filter Coffee', 'Traditional South Indian coffee', 30],
        ['Masala Chai', 'Spiced milk tea', 25],
      ],
    };
    let sortOrder = 0;
    for (const [name, items] of Object.entries(menu)) {
      await prisma.category.create({
        data: {
          name,
          sortOrder: sortOrder++,
          items: { create: items.map(([n, description, price]) => ({ name: n, description, price })) },
        },
      });
    }
    console.log('✔ starter menu');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
