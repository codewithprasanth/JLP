import crypto from 'crypto';

/** 6-digit OTP, uniformly distributed over 100000–999999 (randomInt's max is exclusive). */
export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * OTPs are short-lived and only 900k possibilities, so a slow hash adds nothing;
 * an HMAC keyed by a server secret keeps a Redis dump from revealing live codes.
 */
export function hashOtp(identifier: string, otp: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${identifier}:${otp}`).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
