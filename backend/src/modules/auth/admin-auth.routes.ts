import { Router } from 'express';
import { z } from 'zod';
import { ipRateLimit } from '../../shared/middleware/rateLimiter';
import { revokeRefreshToken, rotateRefreshToken } from '../../shared/utils/tokens';
import { adminLogin } from './auth.service';

export const adminAuthRouter = Router();

const refreshBody = z.object({ refreshToken: z.string().min(1) });

adminAuthRouter.post('/login', ipRateLimit('admin-login', 20, 900), async (req, res) => {
  const { username, password } = z
    .object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(200) })
    .parse(req.body);
  res.json(await adminLogin(username, password));
});

adminAuthRouter.post('/refresh', ipRateLimit('admin-refresh', 60, 600), async (req, res) => {
  const { refreshToken } = refreshBody.parse(req.body);
  res.json(await rotateRefreshToken(refreshToken, 'admin'));
});

adminAuthRouter.post('/logout', async (req, res) => {
  const { refreshToken } = refreshBody.parse(req.body);
  await revokeRefreshToken(refreshToken);
  res.json({ success: true });
});
