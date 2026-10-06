import type { NextFunction, Request, Response } from 'express';
import { redis } from '../redis/client';
import { tooManyRequests } from '../errors';

/** Fixed-window counter (INCR + EXPIRE). Returns false once the limit is exceeded. */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);
  return count <= limit;
}

/** Per-IP limiter middleware — guards against SMS pumping across many phone numbers. */
export function ipRateLimit(name: string, limit: number, windowSeconds: number) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const ok = await hit(`ratelimit:${name}:ip:${req.ip}`, limit, windowSeconds);
    if (!ok) throw tooManyRequests('Too many requests, please try again later');
    next();
  };
}
