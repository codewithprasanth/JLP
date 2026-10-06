import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../../core/admin-api.service';
import { apiError } from '../../core/http-error';
import { SalesReport } from '../../core/models';
import { BarChart, BarDatum } from '../../shared/bar-chart';

type Preset = 'today' | 'week' | 'month' | 'custom';
const IST_OFFSET_MS = 5.5 * 3600_000;
const istToday = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

@Component({
  selector: 'app-sales-report',
  imports: [BarChart, CurrencyPipe, DatePipe, FormsModule],
  template: `
    <h1>Sales report</h1>

    <!-- filters: one row above the chart -->
    <div class="row filters">
      <div class="tabs">
        <button [class.active]="preset() === 'today'" (click)="choose('today')">Today</button>
        <button [class.active]="preset() === 'week'" (click)="choose('week')">This week</button>
        <button [class.active]="preset() === 'month'" (click)="choose('month')">This month</button>
        <button [class.active]="preset() === 'custom'" (click)="preset.set('custom')">Custom</button>
      </div>
      @if (preset() === 'custom') {
        <input type="date" [(ngModel)]="from" [max]="to" />
        <span class="muted">to</span>
        <input type="date" [(ngModel)]="to" [min]="from" [max]="today" />
        <button class="btn" (click)="load()">Apply</button>
      }
    </div>

    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (report(); as r) {
      <div class="grid">
        <div class="card stat"><span class="label">Orders</span><span class="value">{{ r.totalOrders }}</span>
          <span class="muted small">{{ r.cancelledOrders }} cancelled (excluded)</span></div>
        <div class="card stat"><span class="label">Revenue (delivered)</span><span class="value">{{ r.totalRevenue | currency: 'INR' : 'symbol' : '1.0-0' }}</span></div>
        <div class="card stat"><span class="label">Cash collected</span><span class="value">{{ r.collectedRevenue | currency: 'INR' : 'symbol' : '1.0-0' }}</span>
          @if (+r.totalRevenue > +r.collectedRevenue) {
            <span class="muted small">{{ (+r.totalRevenue - +r.collectedRevenue) | currency: 'INR' : 'symbol' : '1.0-0' }} not yet marked collected</span>
          }</div>
      </div>

      <div class="card chart-card">
        <div class="row">
          <h2>Delivered revenue per day</h2>
          <span class="spacer"></span>
          <button class="btn btn-link" (click)="showTable.set(!showTable())">{{ showTable() ? 'Hide table' : 'Show as table' }}</button>
        </div>
        @if (r.dailyBreakdown.length > 1) {
          <app-bar-chart [data]="chart()" ariaLabel="Delivered revenue per day" />
        }
        @if (showTable() || r.dailyBreakdown.length === 1) {
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Day</th><th class="num">Orders</th><th class="num">Cancelled</th><th class="num">Revenue</th><th class="num">Collected</th></tr></thead>
              <tbody>
                @for (d of r.dailyBreakdown; track d.day) {
                  <tr><td>{{ d.day | date: 'EEE d MMM' }}</td><td class="num">{{ d.orders }}</td><td class="num">{{ d.cancelled }}</td>
                    <td class="num">{{ d.revenue | currency: 'INR' }}</td><td class="num">{{ d.collected | currency: 'INR' }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <div class="card">
        <h2>Top-selling items</h2>
        @for (t of r.topItems; track t.name; let i = $index) {
          <div class="summary-row"><span>{{ i + 1 }}. {{ t.name }}</span><span><strong>{{ t.quantity }}</strong> sold · {{ t.revenue | currency: 'INR' : 'symbol' : '1.0-0' }}</span></div>
        } @empty {
          <p class="muted">No delivered orders in this period.</p>
        }
      </div>
    }
  `,
  styles: `
    .filters { margin-bottom: 0.5rem; }
    .filters .tabs { margin-bottom: 0; }
    .filters input { width: auto; }
    .chart-card { margin: 1rem 0; }
    h2 { margin-top: 0; }
  `,
})
export class SalesReportPage implements OnInit {
  private readonly api = inject(AdminApi);

  protected readonly today = istToday();
  protected readonly preset = signal<Preset>('week');
  protected readonly report = signal<SalesReport | null>(null);
  protected readonly error = signal('');
  protected readonly showTable = signal(false);
  protected from = addDays(this.today, -6);
  protected to = this.today;

  protected readonly chart = computed<BarDatum[]>(() => {
    const days = this.report()?.dailyBreakdown ?? [];
    const long = days.length > 14;
    return days.map((d) => ({
      key: d.day,
      label: new Date(d.day + 'T00:00:00').toLocaleDateString('en-IN', long ? { day: 'numeric' } : { weekday: 'short', day: 'numeric' }),
      value: Number(d.revenue),
      detail: `₹${Number(d.revenue).toLocaleString('en-IN')} · ${d.orders} order${d.orders === 1 ? '' : 's'}`,
    }));
  });

  ngOnInit() {
    this.load();
  }

  choose(p: Preset) {
    this.preset.set(p);
    this.to = this.today;
    if (p === 'today') this.from = this.today;
    if (p === 'week') this.from = addDays(this.today, -6);
    if (p === 'month') this.from = this.today.slice(0, 8) + '01';
    this.load();
  }

  load() {
    this.error.set('');
    this.api.sales(this.from, this.to).subscribe({ next: (r) => this.report.set(r), error: (e) => this.error.set(apiError(e)) });
  }
}
