import { CurrencyPipe, DatePipe, SlicePipe, UpperCasePipe } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api.service';
import { DashboardSummary, SalesReport, STATUS_LABEL } from '../../core/models';
import { OrderFeed } from '../../core/order-feed.service';
import { AcceptingToggle } from '../../shared/accepting-toggle';
import { BarChart, BarDatum } from '../../shared/bar-chart';

const IST_OFFSET_MS = 5.5 * 3600_000;
const istDate = (offsetDays = 0) => new Date(Date.now() + IST_OFFSET_MS + offsetDays * 86_400_000).toISOString().slice(0, 10);

@Component({
  selector: 'app-dashboard',
  imports: [AcceptingToggle, BarChart, CurrencyPipe, DatePipe, RouterLink, SlicePipe, UpperCasePipe],
  template: `
    <div class="row">
      <h1>Dashboard</h1>
      <span class="spacer"></span>
      @if (summary(); as s) {
        <div class="card toggle-card"><app-accepting-toggle [(value)]="accepting" /></div>
      }
    </div>

    @if (summary(); as s) {
      <div class="grid">
        <a class="card stat link" routerLink="/orders">
          <span class="label">New orders</span>
          <span class="value" [class.alert]="s.newOrders > 0">{{ s.newOrders }}</span>
        </a>
        <a class="card stat link" routerLink="/orders">
          <span class="label">In progress</span>
          <span class="value">{{ s.pendingOrders }}</span>
        </a>
        <div class="card stat">
          <span class="label">Orders today</span>
          <span class="value">{{ s.todayOrders }}</span>
        </div>
        <div class="card stat">
          <span class="label">Revenue today (delivered)</span>
          <span class="value">{{ s.revenueToday | currency: 'INR' : 'symbol' : '1.0-0' }}</span>
          <span class="muted small">{{ s.collectedToday | currency: 'INR' : 'symbol' : '1.0-0' }} cash collected
            @if (s.unpaidDeliveredToday > 0) { · {{ s.unpaidDeliveredToday }} unpaid }</span>
        </div>
      </div>
    }

    <div class="card chart-card">
      <div class="row">
        <h2>Revenue · last 7 days</h2>
        <span class="spacer"></span>
        <a routerLink="/reports" class="small">Full report →</a>
      </div>
      @if (chart().length) {
        <app-bar-chart [data]="chart()" ariaLabel="Delivered revenue per day, last 7 days" />
      }
    </div>

    <div class="row">
      <h2>Latest orders</h2>
      <span class="spacer"></span>
      <a routerLink="/orders" class="small">Orders queue →</a>
    </div>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th class="num">Total</th><th>Placed</th></tr></thead>
        <tbody>
          @for (o of latest(); track o.id) {
            <tr class="clickable" [class.is-new]="o.isNew" [routerLink]="['/orders', o.id]">
              <td>#{{ o.id | slice: 0 : 8 | uppercase }}</td>
              <td>{{ o.customerName || '—' }}</td>
              <td><span class="badge status-{{ o.status }}">{{ statusLabel[o.status] }}</span></td>
              <td class="num">{{ o.totalAmount | currency: 'INR' }}</td>
              <td>{{ o.createdAt | date: 'h:mm a' }}</td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="muted">No orders yet.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .toggle-card { padding: 0.6rem 0.9rem; }
    .link { color: inherit; text-decoration: none; }
    .alert { color: var(--accent); }
    .chart-card { margin: 1rem 0; }
    .chart-card h2 { margin-top: 0; }
  `,
})
export class Dashboard implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly feed = inject(OrderFeed);

  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly report = signal<SalesReport | null>(null);
  protected readonly accepting = signal(true);
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly latest = computed(() => this.feed.orders().slice(0, 8));
  protected readonly chart = computed<BarDatum[]>(() =>
    (this.report()?.dailyBreakdown ?? []).map((d) => ({
      key: d.day,
      label: new Date(d.day + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
      value: Number(d.revenue),
      detail: `₹${Number(d.revenue).toLocaleString('en-IN')} · ${d.orders} order${d.orders === 1 ? '' : 's'}`,
    })),
  );

  constructor() {
    // Re-pull the summary whenever the feed sees new/changed orders.
    effect(() => {
      this.feed.orders();
      this.loadSummary();
    });
  }

  ngOnInit() {
    this.api.sales(istDate(-6), istDate(0)).subscribe((r) => this.report.set(r));
  }

  private loadSummary() {
    this.api.summary().subscribe((s) => {
      this.summary.set(s);
      this.accepting.set(s.isAcceptingOrders);
    });
  }
}
