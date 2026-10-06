import crypto from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { redis } from '../redis/client';
import { unauthorized } from '../errors';

export type Role = 'customer' | 'admin';

interface RefreshRecord {
  sub: string;
  role: Role;
}

const refreshTtlSeconds = () => env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const refreshKey = (hash: string) => `refresh:${hash}`;
const sessionsKey = (role: Role, sub: string) => `${role}:${sub}:sessions`;

export function signAccessToken(sub: string, role: Role): string {
  return jwt.sign({ role }, env.JWT_ACCESS_SECRET, {
    subject: sub,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): { id: string; role: Role } {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
  if (!payload.sub || (payload.role !== 'customer' && payload.role !== 'admin')) {
    throw unauthorized('Invalid token');
  }
  return { id: payload.sub, role: payload.role };
}

/** Opaque refresh token; only its SHA-256 hash is stored in Redis. */
export async function issueRefreshToken(sub: string, role: Role): Promise<string> {
  const token = crypto.randomBytes(48).toString('base64url');
  const hash = hashToken(token);
  const ttl = refreshTtlSeconds();
  const record: RefreshRecord = { sub, role };
  await redis
    .multi()
    .set(refreshKey(hash), JSON.stringify(record), { expiration: { type: 'EX', value: ttl } })
    .sAdd(sessionsKey(role, sub), hash)
    .expire(sessionsKey(role, sub), ttl)
    .exec();
  return token;
}

export async function issueTokenPair(sub: string, role: Role) {
  return {
    accessToken: signAccessToken(sub, role),
    refreshToken: await issueRefreshToken(sub, role),
  };
}

/**
 * Rotates a refresh token: the presented token is revoked and a new pair issued.
 * GETDEL makes reuse of the same token by a concurrent request fail.
 */
export async function rotateRefreshToken(token: string, expectedRole: Role) {
  const hash = hashToken(token);
  const raw = await redis.getDel(refreshKey(hash));
  if (!raw) throw unauthorized('Refresh token invalid or expired');
  const record = JSON.parse(raw) as RefreshRecord;
  await redis.sRem(sessionsKey(record.role, record.sub), hash);
  if (record.role !== expectedRole) throw unauthorized('Refresh token invalid or expired');
  return issueTokenPair(record.sub, record.role);
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const hash = hashToken(token);
  const raw = await redis.getDel(refreshKey(hash));
  if (!raw) return;
  const record = JSON.parse(raw) as RefreshRecord;
  await redis.sRem(sessionsKey(record.role, record.sub), hash);
}
