import { Router } from 'express';
import { z } from 'zod';
import { loginEmail } from '../../shared/validate';
import { ipRateLimit } from '../../shared/middleware/rateLimiter';
import { revokeRefreshToken, rotateRefreshToken } from '../../shared/utils/tokens';
import { sendOtp, verifyOtp } from './auth.service';

export const customerAuthRouter = Router();

const refreshBody = z.object({ refreshToken: z.string().min(1) });

// Per-IP caps stop the endpoint being used to mail-bomb many different addresses.
customerAuthRouter.post('/send-otp', ipRateLimit('send-otp', 10, 3600), async (req, res) => {
  const { email } = z.object({ email: loginEmail }).parse(req.body);
  res.json(await sendOtp(email));
});

customerAuthRouter.post('/verify-otp', ipRateLimit('verify-otp', 30, 600), async (req, res) => {
  const { email, otp } = z.object({ email: loginEmail, otp: z.string().regex(/^\d{6}$/) }).parse(req.body);
  res.json(await verifyOtp(email, otp));
});

customerAuthRouter.post('/refresh', ipRateLimit('refresh', 60, 600), async (req, res) => {
  const { refreshToken } = refreshBody.parse(req.body);
  res.json(await rotateRefreshToken(refreshToken, 'customer'));
});

// No access token required: logging out with an expired session must still work.
customerAuthRouter.post('/logout', async (req, res) => {
  const { refreshToken } = refreshBody.parse(req.body);
  await revokeRefreshToken(refreshToken);
  res.json({ success: true });
});
