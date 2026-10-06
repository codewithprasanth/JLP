import { Injectable, computed, effect, signal } from '@angular/core';
import { MenuItem } from './models';
import { readStore, writeStore } from './storage';

export interface CartLine {
  menuItemId: string;
  name: string;
  price: string;
  imageUrl: string | null;
  quantity: number;
}

const CART_KEY = 'fo.cart';
const PENDING_KEY = 'fo.pendingAdd';
export const MAX_QTY = 50;

/** Money in paise (integers) so the UI subtotal never suffers float drift. */
const toPaise = (rupees: string) => Math.round(Number(rupees) * 100);

/** Client-side cart (spec: cart lives in the browser until checkout; the server re-validates everything). */
@Injectable({ providedIn: 'root' })
export class CartService {
  readonly lines = signal<CartLine[]>(this.load());
  readonly count = computed(() => this.lines().reduce((n, l) => n + l.quantity, 0));
  readonly subtotalPaise = computed(() => this.lines().reduce((s, l) => s + toPaise(l.price) * l.quantity, 0));

  constructor() {
    effect(() => writeStore(CART_KEY, JSON.stringify(this.lines())));
  }

  add(item: MenuItem, quantity: number) {
    this.lines.update((lines) => {
      const existing = lines.find((l) => l.menuItemId === item.id);
      if (existing) {
        return lines.map((l) =>
          l.menuItemId === item.id ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + quantity), price: item.price } : l,
        );
      }
      return [...lines, { menuItemId: item.id, name: item.name, price: item.price, imageUrl: item.imageUrl, quantity }];
    });
  }

  setQuantity(menuItemId: string, quantity: number) {
    if (quantity <= 0) return this.remove(menuItemId);
    this.lines.update((lines) =>
      lines.map((l) => (l.menuItemId === menuItemId ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l)),
    );
  }

  remove(menuItemId: string) {
    this.lines.update((lines) => lines.filter((l) => l.menuItemId !== menuItemId));
  }

  /** Refresh names/prices from the live menu; returns ids of lines that are no longer orderable. */
  reconcile(menu: MenuItem[]): Set<string> {
    const byId = new Map(menu.map((m) => [m.id, m]));
    const unavailable = new Set<string>();
    this.lines.update((lines) =>
      lines.map((l) => {
        const m = byId.get(l.menuItemId);
        if (!m || !m.isAvailable) unavailable.add(l.menuItemId);
        return m ? { ...l, name: m.name, price: m.price, imageUrl: m.imageUrl } : l;
      }),
    );
    return unavailable;
  }

  clear() {
    this.lines.set([]);
  }

  /** "Add to cart" before login: remember it, complete it right after OTP verification. */
  deferAdd(item: MenuItem, quantity: number) {
    writeStore(PENDING_KEY, JSON.stringify({ item, quantity }), sessionStorage);
  }

  consumePendingAdd(): MenuItem | null {
    const raw = readStore(PENDING_KEY, sessionStorage);
    writeStore(PENDING_KEY, null, sessionStorage);
    if (!raw) return null;
    try {
      const { item, quantity } = JSON.parse(raw) as { item: MenuItem; quantity: number };
      this.add(item, quantity);
      return item;
    } catch {
      return null;
    }
  }

  private load(): CartLine[] {
    try {
      const parsed = JSON.parse(readStore(CART_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
