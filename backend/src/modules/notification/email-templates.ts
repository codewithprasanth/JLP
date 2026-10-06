import type { OrderStatus } from '../../generated/prisma/client';
import type { Notification, OrderNotice } from './channel';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface Brand {
  name: string;
  appUrl: string;
}

const STATUS_TEXT: Record<OrderStatus, string> = {
  PLACED: 'placed',
  CONFIRMED: 'confirmed',
  PREPARING: 'being prepared',
  OUT_FOR_DELIVERY: 'out for delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

const STATUS_LINE: Record<OrderStatus, string> = {
  PLACED: 'We have received your order.',
  CONFIRMED: 'The restaurant has confirmed your order.',
  PREPARING: 'Your food is being prepared.',
  OUT_FOR_DELIVERY: 'Your order is on its way! Please keep cash ready.',
  DELIVERED: 'Your order has been delivered. Enjoy your meal!',
  CANCELLED: 'Your order has been cancelled.',
};

/** Every interpolated value goes through this — names, addresses and reasons are user input. */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const withFullStop = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
const inr = (amount: string) => `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Simple table layout with inline styles — renders in Gmail, Outlook and mobile clients. */
function layout(brand: Brand, title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f6f3;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2421">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f3;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e3e5e1;border-radius:12px">
<tr><td style="background:#2f5d50;color:#ffffff;padding:16px 24px;border-radius:12px 12px 0 0;font-size:18px;font-weight:700">${esc(brand.name)}</td></tr>
<tr><td style="padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
${bodyHtml}
</td></tr></table>
<p style="font-size:12px;color:#69716c;margin:16px 0 0">This is an automated message from ${esc(brand.name)}. Please do not reply.</p>
</td></tr></table></body></html>`;
}

function orderTable(order: OrderNotice): { html: string; text: string } {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${i.quantity} × ${esc(i.name)}</td><td align="right" style="padding:6px 0">${inr(i.lineTotal)}</td></tr>`,
    )
    .join('');
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid #e3e5e1;margin:16px 0">
${rows}
<tr><td style="padding:10px 0 0;border-top:1px solid #e3e5e1;font-weight:700">Total (Cash on Delivery)</td><td align="right" style="padding:10px 0 0;border-top:1px solid #e3e5e1;font-weight:700">${inr(order.totalAmount)}</td></tr>
</table>
<p style="font-size:14px;margin:0 0 4px;color:#69716c">Deliver to</p>
<p style="font-size:14px;margin:0 0 16px">${esc(order.deliveryAddressText)}</p>`;
  const text = [
    ...order.items.map((i) => `${i.quantity} x ${i.name} — ${inr(i.lineTotal)}`),
    `Total (Cash on Delivery): ${inr(order.totalAmount)}`,
    `Deliver to: ${order.deliveryAddressText}`,
  ].join('\n');
  return { html, text };
}

const button = (href: string, label: string) =>
  `<p style="margin:20px 0 0"><a href="${esc(href)}" style="display:inline-block;background:#2f5d50;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${esc(label)}</a></p>`;

export function renderEmail(message: Notification, brand: Brand): RenderedEmail {
  switch (message.kind) {
    case 'otp': {
      const body = `<p style="font-size:15px;margin:0 0 16px">Use this code to log in:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:0 0 16px;font-family:Consolas,Menlo,monospace">${esc(message.otp)}</p>
<p style="font-size:14px;margin:0 0 8px">It expires in ${message.ttlMinutes} minutes. Never share this code with anyone — ${esc(brand.name)} will never ask for it.</p>
<p style="font-size:13px;color:#69716c;margin:0">If you didn't try to log in, you can safely ignore this email.</p>`;
      return {
        subject: `${message.otp} is your ${brand.name} login code`,
        html: layout(brand, 'Your login code', body),
        text: `Your ${brand.name} login code is ${message.otp}. It expires in ${message.ttlMinutes} minutes. Never share this code. If you didn't try to log in, ignore this email.`,
      };
    }
    case 'order_placed': {
      const o = message.order;
      const table = orderTable(o);
      const url = `${brand.appUrl}/orders/${o.id}`;
      return {
        subject: `Order #${o.shortId} placed — ${inr(o.totalAmount)}`,
        html: layout(
          brand,
          `Thanks! Order #${o.shortId} is placed`,
          `<p style="font-size:15px;margin:0">${STATUS_LINE.PLACED} Pay in cash when it arrives.</p>${table.html}${button(url, 'Track your order')}`,
        ),
        text: `Thanks! Your order #${o.shortId} is placed. Pay in cash on delivery.\n\n${table.text}\n\nTrack your order: ${url}`,
      };
    }
    case 'order_status': {
      const o = message.order;
      const s = message.status;
      const url = `${brand.appUrl}/orders/${o.id}`;
      let line = STATUS_LINE[s];
      if (s === 'CANCELLED') {
        line = message.byCustomer
          ? 'Your order has been cancelled as you requested. You will not be charged.'
          : `Sorry — the restaurant could not accept your order.${message.reason ? ` Reason: ${withFullStop(message.reason.trim())}` : ''} You will not be charged.`;
      }
      return {
        subject: `Order #${o.shortId} is ${STATUS_TEXT[s]}`,
        html: layout(
          brand,
          `Order #${o.shortId} is ${STATUS_TEXT[s]}`,
          `<p style="font-size:15px;margin:0 0 8px">${esc(line)}</p><p style="font-size:14px;margin:0;color:#69716c">Total: ${inr(o.totalAmount)} · Cash on Delivery</p>${button(url, 'View order')}`,
        ),
        text: `Order #${o.shortId} is ${STATUS_TEXT[s]}. ${line}\nTotal: ${inr(o.totalAmount)} (Cash on Delivery)\nView order: ${url}`,
      };
    }
  }
}
