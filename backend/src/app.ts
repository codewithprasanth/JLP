import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { adminRouter } from './modules/admin';
import { adminAuthRouter } from './modules/auth/admin-auth.routes';
import { customerAuthRouter } from './modules/auth/customer-auth.routes';
import { customerRouter } from './modules/customer';
import { publicMenuRouter } from './modules/menu/public-menu.routes';
import { publicSettingsRouter } from './modules/settings/public-settings.routes';
import { authenticate } from './shared/middleware/authenticate';
import { errorHandler } from './shared/middleware/errorHandler';
import { requireRole } from './shared/middleware/requireRole';
import { prisma } from './shared/prisma/client';
import { redis } from './shared/redis/client';

export function createApp() {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: [env.CORS_ORIGIN_CUSTOMER, env.CORS_ORIGIN_ADMIN],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({ status: 'ok' });
  });

  // ORDER MATTERS: Express runs middleware in registration order. The login/OTP
  // routers must be mounted BEFORE the guarded '/api/customer' and '/api/admin'
  // prefixes, otherwise `authenticate` rejects the login request itself with 401.
  app.use('/api/customer/auth', customerAuthRouter);
  app.use('/api/admin/auth', adminAuthRouter);

  // Public, no auth — the menu is browsable before login.
  app.use('/api/menu', publicMenuRouter);
  app.use('/api/settings', publicSettingsRouter);

  // Role-guarded. A customer token can never reach admin routes, and vice versa.
  app.use('/api/customer', authenticate, requireRole('customer'), customerRouter);
  app.use('/api/admin', authenticate, requireRole('admin'), adminRouter);

  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use(errorHandler);

  return app;
}
