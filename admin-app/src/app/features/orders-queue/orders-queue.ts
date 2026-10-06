import { CurrencyPipe, SlicePipe, UpperCasePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminOrderRow, OrderStatus, STATUS_LABEL } from '../../core/models';
import { OrderFeed } from '../../core/order-feed.service';

type Filter = 'ACTIVE' | OrderStatus | 'ALL';
const ACTIVE: OrderStatus[] = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'];

@Component({
  selector: 'app-orders-queue',
  imports: [CurrencyPipe, RouterLink, SlicePipe, UpperCasePipe],
  template: `
    <div class="row">
      <h1>Orders</h1>
      <span class="muted small">Updates every 10 seconds</span>
      <span class="spacer"></span>
      <button class="btn btn-link" (click)="feed.refresh()">↻ Refresh now</button>
    </div>

    <div class="tabs">
      @for (f of filters; track f.key) {
        <button [class.active]="filter() === f.key" (click)="filter.set(f.key)">
          {{ f.label }} @if (count(f.key); as n) { <span class="muted">({{ n }})</span> }
        </button>
      }
    </div>

    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr><th>Order</th><th>Customer</th><th>Phone</th><th class="num">Items</th><th class="num">Total</th><th>Status</th><th>Paid</th><th>Placed</th></tr>
        </thead>
        <tbody>
          @for (o of visible(); track o.id) {
            <tr class="clickable" [class.is-new]="o.isNew" (click)="open(o)">
              <td><a [routerLink]="['/orders', o.id]" (click)="$event.stopPropagation()">#{{ o.id | slice: 0 : 8 | uppercase }}</a>
                @if (o.isNew) { <span class="badge status-PLACED">NEW</span> }</td>
              <td>{{ o.customerName || '—' }}</td>
              <td>{{ o.customerPhone ?? '—' }}</td>
              <td class="num">{{ o.itemCount }}</td>
              <td class="num">{{ o.totalAmount | currency: 'INR' }}</td>
              <td><span class="badge status-{{ o.status }}">{{ statusLabel[o.status] }}</span></td>
              <td>{{ o.status === 'CANCELLED' ? '—' : o.isPaid ? '✓ Cash' : 'COD' }}</td>
              <td>{{ ago(o.createdAt) }}</td>
            </tr>
          } @empty {
            <tr><td colspan="8" class="muted">{{ feed.loaded() ? 'No orders here.' : 'Loading…' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class OrdersQueue {
  protected readonly feed = inject(OrderFeed);
  private readonly router = inject(Router);

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly filter = signal<Filter>('ACTIVE');
  protected readonly filters: { key: Filter; label: string }[] = [
    { key: 'ACTIVE', label: 'Active' },
    { key: 'PLACED', label: 'New' },
    { key: 'CONFIRMED', label: 'Confirmed' },
    { key: 'PREPARING', label: 'Preparing' },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
    { key: 'DELIVERED', label: 'Delivered' },
    { key: 'CANCELLED', label: 'Cancelled' },
    { key: 'ALL', label: 'All' },
  ];

  /** Wall clock for the "x min ago" column, ticking every 30s. */
  private readonly now = signal(Date.now());

  constructor() {
    const id = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  protected readonly visible = computed(() => this.feed.orders().filter((o) => this.matches(o, this.filter())));

  protected count(f: Filter): number {
    return f === 'ALL' || f === 'DELIVERED' || f === 'CANCELLED' ? 0 : this.feed.orders().filter((o) => this.matches(o, f)).length;
  }

  protected ago(iso: string): string {
    const mins = Math.floor((this.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const h = Math.floor(mins / 60);
    return h < 24 ? `${h} h ${mins % 60} min ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  protected open(o: AdminOrderRow) {
    this.router.navigate(['/orders', o.id]);
  }

  private matches(o: AdminOrderRow, f: Filter) {
    return f === 'ALL' || (f === 'ACTIVE' ? ACTIVE.includes(o.status) : o.status === f);
  }
}
