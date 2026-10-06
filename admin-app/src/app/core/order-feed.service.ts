import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AdminApi } from './admin-api.service';
import { AdminOrderRow } from './models';

const POLL_MS = 10_000;

/**
 * Polls GET /admin/orders?since=… every 10s (no WebSockets in v1) for as long as
 * the admin is signed in, on every page — so a new order is noticed wherever the
 * owner is. Chimes and shows the count in the tab title for new orders.
 */
@Injectable({ providedIn: 'root' })
export class OrderFeed {
  private readonly api = inject(AdminApi);

  private readonly byId = signal(new Map<string, AdminOrderRow>());
  readonly orders = computed(() => [...this.byId().values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  readonly newCount = computed(() => this.orders().filter((o) => o.isNew).length);
  readonly connected = signal(true);
  readonly loaded = signal(false);

  private since: string | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private inFlight = false;
  private audio?: AudioContext;

  constructor() {
    effect(() => {
      const n = this.newCount();
      document.title = n > 0 ? `(${n}) New order${n > 1 ? 's' : ''} · JLP Admin` : 'JLP Admin';
    });
  }

  start() {
    if (this.timer) return;
    this.fetch(true);
    this.timer = setInterval(() => this.fetch(false), POLL_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = undefined;
    this.since = null;
    this.byId.set(new Map());
    this.loaded.set(false);
  }

  refresh() {
    this.fetch(false);
  }

  /** Reflect a change made from this browser immediately, without waiting for the next poll. */
  patch(id: string, changes: Partial<AdminOrderRow>) {
    const current = this.byId().get(id);
    if (!current) return;
    this.byId.update((m) => new Map(m).set(id, { ...current, ...changes }));
  }

  private fetch(initial: boolean) {
    if (this.inFlight) return;
    this.inFlight = true;
    this.api.orders(initial || !this.since ? {} : { since: this.since }).subscribe({
      next: ({ serverTime, orders }) => {
        this.inFlight = false;
        this.connected.set(true);
        this.loaded.set(true);
        const before = this.byId();
        const fresh = orders.filter((o) => o.isNew && !before.has(o.id));
        const next = new Map(before);
        for (const o of orders) next.set(o.id, o);
        this.byId.set(next);
        this.since = serverTime;
        if (!initial && fresh.length) this.chime();
      },
      error: () => {
        this.inFlight = false;
        this.connected.set(false);
      },
    });
  }

  private chime() {
    try {
      this.audio ??= new AudioContext();
      const ctx = this.audio;
      [880, 1175].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime + i * 0.18 + 0.4);
      });
    } catch {
      /* audio blocked until the user interacts with the page — the title badge still shows */
    }
  }
}
