import { z } from 'zod';

export const idParam = z.object({ id: z.uuid() });

/** Login identifier: trimmed + lower-cased before validation, so lookups are case-insensitive. */
export const loginEmail = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address').max(254));

export const indianPhone = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

/** Money input: accepts "120", "120.5", 120.5 — at most 2 decimal places. */
export const money = z.coerce
  .number()
  .nonnegative()
  .max(1_000_000)
  .refine((n) => Math.round(n * 100) === n * 100, 'At most 2 decimal places');

export const latitude = z.coerce.number().min(-90).max(90);
export const longitude = z.coerce.number().min(-180).max(180);

/** Multipart forms send booleans as strings. */
export const formBoolean = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);
