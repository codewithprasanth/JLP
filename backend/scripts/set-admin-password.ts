/**
 * Sets (or resets) the admin password — the v1 "forgot password" procedure — and
 * signs the admin out everywhere by revoking all of their refresh tokens.
 *
 * The password comes from an environment variable, never a CLI argument, so it
 * doesn't end up in shell history or the process list:
 *
 *   NEW_ADMIN_PASSWORD='…' npm run admin:set-password            (bash)
 *   $env:NEW_ADMIN_PASSWORD='…'; npm run admin:set-password      (PowerShell)
 *
 * Optional: ADMIN_USERNAME (default "admin"). Creates the admin if missing.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { createClient } from 'redis';
import { PrismaClient } from '../src/generated/prisma/client';

async function main() {
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.NEW_ADMIN_PASSWORD ?? '';
  const minLength = process.env.NODE_ENV === 'production' ? 16 : 12;
  if (password.length < minLength || /change-me/i.test(password)) {
    throw new Error(`NEW_ADMIN_PASSWORD must be a random password of at least ${minLength} characters`);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const redis = createClient({ url: process.env.REDIS_URL });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.admin.upsert({
      where: { username },
      update: { passwordHash },
      create: { username, passwordHash },
    });

    // Revoke every existing admin session (same key layout as shared/utils/tokens.ts).
    await redis.connect();
    const setKey = `admin:${admin.id}:sessions`;
    const hashes = await redis.sMembers(setKey);
    if (hashes.length) await redis.del(hashes.map((h) => `refresh:${h}`));
    await redis.del(setKey);

    console.log(`✔ password set for "${username}"; ${hashes.length} existing session(s) revoked`);
  } finally {
    await prisma.$disconnect();
    if (redis.isOpen) await redis.quit();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
