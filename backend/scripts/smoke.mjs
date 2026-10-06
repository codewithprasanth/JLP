// End-to-end smoke test against a running local API (npm run dev).
import 'dotenv/config';
// Reads OTPs from the dev log, so run with: node scripts/smoke.mjs <path-to-api-log>
// Uses a random phone each run so rate limits don't collide.
import { readFileSync } from 'node:fs';

const BASE = process.env.API ?? 'http://localhost:4000';
const LOG = process.argv[2];
let failures = 0;

// Never run against an API that really sends email: this test signs up @example.com
// addresses — real sends would bounce, hurt the sender's reputation and burn quota.
// Start the API for testing with an empty key:  BREVO_API_KEY= npm run dev
if (/^Notifications: .* — live/m.test(readFileSync(LOG, 'utf8'))) {
  console.error('Refusing to run: the API is sending real email. Restart it with  BREVO_API_KEY= npm run dev  (log-only).');
  process.exit(2);
}

// Local runs only: reset the per-IP limiter so back-to-back runs don't trip it.
if (new URL(BASE).hostname === 'localhost' && process.env.REDIS_URL) {
  const { createClient } = await import('redis');
  const redis = await createClient({ url: process.env.REDIS_URL }).connect();
  for await (const keys of redis.scanIterator({ MATCH: 'ratelimit:*:ip:*', COUNT: 100 })) {
    if (keys.length) await redis.del(keys);
  }
  await redis.quit();
}

async function call(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

function check(name, cond, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `  -> ${JSON.stringify(detail)}`}`);
  if (!cond) failures++;
}

/** Notifications are logged as JSON lines in dev: [notify:log] {"to":…,"kind":…} */
function notices(email) {
  return readFileSync(LOG, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('[notify:log] '))
    .map((l) => JSON.parse(l.slice('[notify:log] '.length)))
    .filter((n) => n.to === email);
}
const latestOtp = (email) => notices(email).filter((n) => n.kind === 'otp').at(-1).otp;

const email = `smoke.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;

// 1. Auth routes reachable (route-order fix) — Addendum 1: email + OTP
let r = await call('POST', '/api/customer/auth/send-otp', { body: { email: email.toUpperCase() } });
check('send-otp (email) reachable without token', r.status === 200, r);
r = await call('POST', '/api/customer/auth/send-otp', { body: { email } });
check('resend within 30s blocked (email normalised to lower-case)', r.status === 429, r);
r = await call('POST', '/api/customer/auth/send-otp', { body: { email: 'not-an-email' } });
check('invalid email rejected', r.status === 400, r);
r = await call('POST', '/api/customer/auth/send-otp', { body: { phone: '9876543210' } });
check('phone login no longer accepted', r.status === 400, r);

r = await call('POST', '/api/customer/auth/verify-otp', { body: { email, otp: '000000' } });
check('wrong OTP rejected', r.status === 400 && r.body.code === 'OTP_INCORRECT', r);
r = await call('POST', '/api/customer/auth/verify-otp', { body: { email: `  ${email.toUpperCase()} `, otp: latestOtp(email) } });
check('correct OTP returns tokens + isNewUser', r.status === 200 && r.body.isNewUser === true && r.body.accessToken, r);
let { accessToken: cTok, refreshToken: cRefresh } = r.body;

// 2. Public settings mounted
r = await call('GET', '/api/settings/public');
check('GET /api/settings/public mounted', r.status === 200 && 'minOrderValue' in r.body, r);
const shop = r.body;

// 3. Role isolation
r = await call('GET', '/api/admin/settings', { token: cTok });
check('customer token on admin route -> 403', r.status === 403, r);

// 4. Profile — name now; contact phone deliberately left out until just before ordering
r = await call('PATCH', '/api/customer/profile', { token: cTok, body: { name: 'Test Customer' } });
check('profile update (name)', r.status === 200 && r.body.name === 'Test Customer' && r.body.email === email && r.body.phone === null, r);
r = await call('PATCH', '/api/customer/profile', { token: cTok, body: { email: 'other@example.com' } });
check('email (login identity) not editable via profile', r.status === 400, r);
r = await call('PATCH', '/api/customer/profile', { token: cTok, body: { phone: '12345' } });
check('invalid contact phone rejected', r.status === 400, r);

// 5. Refresh rotation
r = await call('POST', '/api/customer/auth/refresh', { body: { refreshToken: cRefresh } });
check('refresh issues new pair', r.status === 200 && r.body.refreshToken && r.body.refreshToken !== cRefresh, r);
const reuse = await call('POST', '/api/customer/auth/refresh', { body: { refreshToken: cRefresh } });
check('old refresh token cannot be reused', reuse.status === 401, reuse);
cTok = r.body.accessToken; cRefresh = r.body.refreshToken;

// 6. Addresses + radius
r = await call('POST', '/api/customer/addresses', {
  token: cTok, body: { addressText: 'Far away, Mysuru', latitude: 12.2958, longitude: 76.6394, label: 'Other' },
});
check('address outside radius rejected', r.status === 400 && r.body.code === 'OUTSIDE_DELIVERY_RADIUS', r);
r = await call('POST', '/api/customer/addresses', {
  token: cTok, body: { addressText: 'Near the shop, MG Road', latitude: shop.shopLatitude + 0.005, longitude: shop.shopLongitude, label: 'Home' },
});
check('address inside radius saved as default', r.status === 201 && r.body.isDefault === true, r);
const addressId = r.body.id;
r = await call('POST', '/api/customer/addresses', {
  token: cTok, body: { addressText: 'Office nearby, Residency Rd', latitude: shop.shopLatitude, longitude: shop.shopLongitude + 0.004, label: 'Work', isDefault: true },
});
const list = await call('GET', '/api/customer/addresses', { token: cTok });
check('only one default address', list.body.filter((a) => a.isDefault).length === 1, list.body);

// 7. Orders
const items = (await call('GET', '/api/menu/items')).body;
const coffee = items.find((i) => i.name === 'Filter Coffee');
const thali = items.find((i) => i.name === 'Veg Thali');

r = await call('POST', '/api/customer/orders', { token: cTok, body: { addressId, items: [{ menuItemId: thali.id, quantity: 1 }] } });
check('ordering without a contact phone blocked', r.status === 400 && r.body.code === 'PROFILE_INCOMPLETE', r);
r = await call('PATCH', '/api/customer/profile', { token: cTok, body: { phone: '9876543210' } });
check('contact phone saved', r.status === 200 && r.body.phone === '9876543210', r);

r = await call('POST', '/api/customer/orders', { token: cTok, body: { addressId, items: [{ menuItemId: coffee.id, quantity: 1 }] } });
check('below minimum order rejected', r.status === 400 && r.body.code === 'BELOW_MINIMUM', r);
r = await call('POST', '/api/customer/orders', { token: cTok, body: { addressId, items: [{ menuItemId: thali.id, quantity: -3 }] } });
check('negative quantity rejected', r.status === 400, r);

const idem = 'test-' + Date.now();
r = await call('POST', '/api/customer/orders', {
  token: cTok, headers: { 'Idempotency-Key': idem },
  body: { addressId, items: [{ menuItemId: thali.id, quantity: 1 }, { menuItemId: coffee.id, quantity: 1 }, { menuItemId: coffee.id, quantity: 1 }] },
});
check('order placed, duplicate lines merged, decimal total', r.status === 201 && r.body.totalAmount === '210.00' && r.body.items.length === 2, r);
const order1 = r.body.id;
r = await call('POST', '/api/customer/orders', {
  token: cTok, headers: { 'Idempotency-Key': idem },
  body: { addressId, items: [{ menuItemId: thali.id, quantity: 1 }] },
});
check('idempotent retry returns same order', r.status === 200 && r.body.id === order1, r);

r = await call('POST', `/api/customer/orders/${order1}/cancel`, { token: cTok });
check('cancel within 60s succeeds', r.status === 200, r);
await new Promise((ok) => setTimeout(ok, 300)); // notifications are fire-and-forget
const sent = notices(email).map((n) => (n.kind === 'otp' ? 'otp' : `${n.kind}:${n.status}`));
check('emails: order confirmation + cancellation sent to login email',
  sent.includes('order_placed:PLACED') && sent.includes('order_status:CANCELLED'), sent);
r = await call('GET', `/api/customer/orders/${order1}`, { token: cTok });
check('timeline has PLACED + CANCELLED by customer',
  r.body.statusHistory?.map((h) => `${h.status}:${h.actor}`).join(',') === 'PLACED:CUSTOMER,CANCELLED:CUSTOMER', r.body.statusHistory);
check('customer view hides admin identity', r.body.statusHistory?.every((h) => !('adminId' in h) && !('by' in h)), r.body.statusHistory);

r = await call('POST', '/api/customer/orders', { token: cTok, body: { addressId, items: [{ menuItemId: thali.id, quantity: 2 }] } });
const order2 = r.body.id;

// 8. Admin
r = await call('POST', '/api/admin/auth/login', { body: { username: 'admin', password: 'wrong-password' } });
check('admin bad password rejected', r.status === 401, r);
r = await call('POST', '/api/admin/auth/login', { body: { username: 'admin', password: process.env.SEED_ADMIN_PASSWORD } });
check('admin login', r.status === 200 && r.body.accessToken, r);
const aTok = r.body.accessToken;
r = await call('POST', '/api/admin/auth/refresh', { body: { refreshToken: r.body.refreshToken } });
check('admin refresh endpoint exists', r.status === 200, r);
r = await call('GET', '/api/customer/profile', { token: aTok });
check('admin token on customer route -> 403', r.status === 403, r);

r = await call('GET', '/api/admin/orders?status=active', { token: aTok });
check('admin queue shows new order flagged isNew', r.body.orders?.find((o) => o.id === order2)?.isNew === true, r.body);
r = await call('GET', `/api/admin/orders/${order2}`, { token: aTok });
check('admin order detail lists allowed transitions', JSON.stringify(r.body.allowedTransitions) === '["CONFIRMED","CANCELLED"]', r.body);
check('admin sees customer email + contact phone', r.body.customerEmail === email && r.body.customerPhone === '9876543210', r.body);

r = await call('PATCH', `/api/admin/orders/${order2}/status`, { token: aTok, body: { status: 'DELIVERED' } });
check('invalid transition PLACED -> DELIVERED rejected', r.status === 400 && r.body.code === 'INVALID_TRANSITION', r);
for (const s of ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
  r = await call('PATCH', `/api/admin/orders/${order2}/status`, { token: aTok, body: { status: s } });
  check(`transition -> ${s}`, r.status === 200 && r.body.status === s, r);
}
r = await call('POST', `/api/customer/orders/${order2}/cancel`, { token: cTok });
check('customer cannot cancel non-PLACED order', r.status === 400 && r.body.code === 'NOT_CANCELLABLE', r);
r = await call('PATCH', `/api/admin/orders/${order2}/payment`, { token: aTok, body: { isPaid: true } });
check('admin marks cash collected', r.status === 200 && r.body.isPaid === true, r);
await new Promise((ok) => setTimeout(ok, 300));
const statusMails = notices(email).filter((n) => n.kind === 'order_status' && n.order === order2.slice(0, 8).toUpperCase()).map((n) => n.status);
check('status emails follow ORDER_EMAIL_STATUSES (default skips PREPARING)',
  statusMails.join(',') === 'CONFIRMED,OUT_FOR_DELIVERY,DELIVERED', statusMails);

r = await call('GET', '/api/admin/dashboard/summary', { token: aTok });
check('dashboard summary', r.status === 200 && Number(r.body.revenueToday) >= 300, r.body);
r = await call('GET', '/api/admin/reports/sales', { token: aTok });
check('sales report has 7 IST days', r.status === 200 && r.body.dailyBreakdown.length === 7, r.body);

// 9. Soft delete + category guard
const cats = (await call('GET', '/api/admin/menu/categories', { token: aTok })).body;
const lunch = cats.find((c) => c.name === 'Lunch');
r = await call('DELETE', `/api/admin/menu/categories/${lunch.id}`, { token: aTok });
check('deleting non-empty category -> 409', r.status === 409, r);
// Throwaway dish, so repeated runs never archive the seeded menu.
const form = new FormData();
form.set('name', `Smoke Dish ${Date.now()}`);
form.set('categoryId', lunch.id);
form.set('price', '120'); // must clear the minimum order (₹100)
const tmp = await (await fetch(`${BASE}/api/admin/menu/items`, { method: 'POST', headers: { authorization: `Bearer ${aTok}` }, body: form })).json();
r = await call('POST', '/api/customer/orders', { token: cTok, body: { addressId, items: [{ menuItemId: tmp.id, quantity: 1 }] } });
const order3 = r.body.id;
r = await call('DELETE', `/api/admin/menu/items/${tmp.id}`, { token: aTok });
check('menu item with past orders can be deleted (soft delete)', r.status === 200, r);
r = await call('GET', `/api/customer/orders/${order3}`, { token: cTok });
check('past order still shows deleted item name', r.body.items?.[0]?.name === tmp.name, r.body);
await call('PATCH', `/api/admin/orders/${order3}/status`, { token: aTok, body: { status: 'CANCELLED', reason: 'smoke test cleanup' } });

// 10. Shop closed
await call('PATCH', '/api/admin/settings', { token: aTok, body: { isAcceptingOrders: false } });
r = await call('POST', '/api/customer/orders', { token: cTok, body: { addressId, items: [{ menuItemId: coffee.id, quantity: 3 }] } });
check('orders blocked when shop closed', r.status === 400 && r.body.code === 'SHOP_CLOSED', r);
await call('PATCH', '/api/admin/settings', { token: aTok, body: { isAcceptingOrders: true } });

// 11. Logout works without access token
r = await call('POST', '/api/customer/auth/logout', { body: { refreshToken: cRefresh } });
check('logout without access token', r.status === 200, r);

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
