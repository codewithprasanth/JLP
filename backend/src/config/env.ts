import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  OTP_HMAC_SECRET: z.string().min(8),
  // Notifications (Addendum 1): email via Brevo in v1; SMS (MSG91) is Phase 2.
  NOTIFICATION_CHANNEL: z.enum(['email', 'sms']).default('email'),
  EMAIL_PROVIDER: z.enum(['brevo']).default('brevo'),
  BREVO_API_KEY: z.string().optional().default(''),
  EMAIL_FROM_ADDRESS: z.union([z.email(), z.literal('')]).optional().default(''),
  EMAIL_FROM_NAME: z.string().trim().min(1).max(60).default('Jinisha Lovely Products'),
  // Which status changes email the customer (PLACED is always sent as the order
  // confirmation, CANCELLED always). Trim to stay inside the provider's quota.
  ORDER_EMAIL_STATUSES: z
    .string()
    .default('CONFIRMED,OUT_FOR_DELIVERY,DELIVERED')
    .transform((s) => s.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean))
    .pipe(z.array(z.enum(['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']))),
  // Testing escape hatch before the provider is set up: print notifications (incl.
  // OTPs) to the log instead of sending. Never leave this on for real customers.
  NOTIFICATIONS_LOG_ONLY: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  // Phase 2 only (SMS after DLT registration):
  MSG91_AUTH_KEY: z.string().optional().default(''),
  MSG91_OTP_TEMPLATE_ID: z.string().optional().default(''),
  MSG91_ORDER_TEMPLATE_ID: z.string().optional().default(''),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  PORT: z.coerce.number().int().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Browsers send the Origin without a trailing slash; tolerate one pasted into the dashboard.
  CORS_ORIGIN_CUSTOMER: z.string().trim().default('http://localhost:4200').transform((s) => s.replace(/\/+$/, '')),
  CORS_ORIGIN_ADMIN: z.string().trim().default('http://localhost:4300').transform((s) => s.replace(/\/+$/, '')),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

if (env.NOTIFICATION_CHANNEL === 'sms') {
  // Login is email + OTP (Addendum 1); an SMS OTP can't verify an email address.
  console.error(
    'Refusing to start: NOTIFICATION_CHANNEL=sms is Phase 2 — it needs DLT approval AND phone-based login. ' +
      'Keep NOTIFICATION_CHANNEL=email for v1.',
  );
  process.exit(1);
}

// Fail fast on weak or placeholder secrets in production rather than running insecurely.
if (isProd) {
  const weak = (['JWT_ACCESS_SECRET', 'OTP_HMAC_SECRET'] as const).filter(
    (k) => env[k].length < 32 || /change-me/i.test(env[k]),
  );
  if (env.JWT_ACCESS_SECRET === env.OTP_HMAC_SECRET) weak.push('OTP_HMAC_SECRET');
  if (weak.length) {
    console.error(`Refusing to start: ${weak.join(', ')} must be unique random values of 32+ characters`);
    process.exit(1);
  }
}
