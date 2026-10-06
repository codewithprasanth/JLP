import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './shared/prisma/client';
import { connectRedis, redis } from './shared/redis/client';
import { describeNotifications } from './modules/notification/notifier';

async function main() {
  await connectRedis();
  await prisma.$connect();

  const server = createApp().listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    console.log(describeNotifications());
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
