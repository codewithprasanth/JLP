import bcrypt from 'bcryptjs';
import { env } from '../../config/env';
import { prisma } from '../../shared/prisma/client';
import { redis } from '../../shared/redis/client';
import { HttpError, badRequest, tooManyRequests, unauthorized } from '../../shared/errors';
import { hit } from '../../shared/middleware/rateLimiter';
import { generateOtp, hashOtp, safeEqualHex } from '../../shared/utils/otp';
import { issueTokenPair } from '../../shared/utils/tokens';
import { canDeliverOtp, sendLoginOtp } from '../notification/notification.service';

export const OTP_TTL_SECONDS = 300;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;
const OTP_MAX_SENDS = 3;
const OTP_SEND_WINDOW_SECONDS = 600;
const OTP_MAX_ATTEMPTS = 5;

// Addendum 1: keyed by the (lower-cased) email — the login identifier.
const otpKey = (email: string) => `otp:${email}`;
const cooldownKey = (email: string) => `otp:cooldown:${email}`;

export async function sendOtp(email: string) {
  // Until the email provider is configured, refuse cleanly instead of "sending" a code nobody receives.
  if (!canDeliverOtp()) {
    throw new HttpError(503, 'Login is not available yet. Please try again later.', 'NOTIFICATIONS_NOT_CONFIGURED');
  }

  // Cooldown matches the "Resend code in 00:30" timer; enforced here, not just in the UI.
  const cooldownSet = await redis.set(cooldownKey(email), '1', {
    expiration: { type: 'EX', value: OTP_RESEND_COOLDOWN_SECONDS },
    condition: 'NX',
  });
  if (cooldownSet !== 'OK') throw tooManyRequests('Please wait before requesting another code');

  if (!(await hit(`ratelimit:otp:${email}`, OTP_MAX_SENDS, OTP_SEND_WINDOW_SECONDS))) {
    throw tooManyRequests('Too many code requests, try again later');
  }

  const otp = generateOtp();
  // Hash with attempt counter; HINCRBY keeps the attempt count atomic under concurrent guesses.
  await redis
    .multi()
    .del(otpKey(email))
    .hSet(otpKey(email), { hash: hashOtp(email, otp, env.OTP_HMAC_SECRET), attempts: '0' })
    .expire(otpKey(email), OTP_TTL_SECONDS)
    .exec();

  try {
    await sendLoginOtp(email, otp, OTP_TTL_SECONDS);
  } catch (err) {
    console.error('OTP delivery failed:', err);
    await redis.del(otpKey(email));
    throw new HttpError(502, 'Could not send the code right now, please try again');
  }

  return { success: true, expiresInSeconds: OTP_TTL_SECONDS, resendInSeconds: OTP_RESEND_COOLDOWN_SECONDS };
}

export async function verifyOtp(email: string, otp: string) {
  const key = otpKey(email);
  const storedHash = await redis.hGet(key, 'hash');
  if (!storedHash) throw badRequest('OTP expired or not found', 'OTP_EXPIRED');

  const attempts = await redis.hIncrBy(key, 'attempts', 1);
  if (attempts > OTP_MAX_ATTEMPTS) {
    await redis.del(key);
    throw badRequest('Too many attempts, request a new OTP', 'OTP_TOO_MANY_ATTEMPTS');
  }

  if (!safeEqualHex(hashOtp(email, otp, env.OTP_HMAC_SECRET), storedHash)) {
    throw badRequest('Incorrect code', 'OTP_INCORRECT');
  }
  await redis.del(key);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, emailVerifiedAt: new Date() },
  });

  // "New" means profile not completed (name + contact phone) — covers users who
  // quit the profile screen before finishing it.
  const isNewUser = user.name.trim() === '' || !user.phone;
  const tokens = await issueTokenPair(user.id, 'customer');
  return { ...tokens, isNewUser };
}

// Pre-computed so unknown usernames take as long as wrong passwords.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

export async function adminLogin(username: string, password: string) {
  if (!(await hit(`ratelimit:adminlogin:${username.toLowerCase()}`, 10, 900))) {
    throw tooManyRequests('Too many login attempts, try again later');
  }
  const admin = await prisma.admin.findUnique({ where: { username } });
  const ok = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !ok) throw unauthorized('Invalid username or password');
  return issueTokenPair(admin.id, 'admin');
}
