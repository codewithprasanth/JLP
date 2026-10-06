import { CurrencyPipe, DatePipe, SlicePipe, UpperCasePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api.service';
import { apiError } from '../../core/http-error';
import { ACTION_LABEL, AdminOrderDetail, OrderStatus, STATUS_LABEL } from '../../core/models';
import { OrderFeed } from '../../core/order-feed.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-order-detail',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, SlicePipe, UpperCasePipe],
  template: `
    <a routerLink="/orders" class="small">← Orders</a>
    @if (order(); as o) {
      <div class="row">
        <h1>Order #{{ o.id | slice: 0 : 8 | uppercase }}</h1>
        <span class="badge status-{{ o.status }}">{{ statusLabel[o.status] }}</span>
        <span class="spacer"></span>
        <span class="muted small">Placed {{ o.createdAt | date: 'd MMM, h:mm a' }}</span>
      </div>

      <div class="layout">
        <div class="stack">
          <div class="card stack">
            <h2>Next step</h2>
            @if (forward(o).length === 0 && !canReject(o)) {
              <p class="muted">No further actions — this order is {{ statusLabel[o.status].toLowerCase() }}.</p>
            }
            <div class="row">
              @for (s of forward(o); track s) {
                <button class="btn" (click)="move(s)" [disabled]="busy()">{{ actionLabel[s] }}</button>
              }
              @if (canReject(o) && !rejecting()) {
                <button class="btn btn-outline danger" (click)="rejecting.set(true)" [disabled]="busy()">Reject order</button>
              }
            </div>
            @if (rejecting()) {
              <div class="stack reject">
                <label class="field">Reason (shown to the customer)
                  <input [(ngModel)]="reason" maxlength="300" placeholder="e.g. Out of stock, kitchen closing" />
                </label>
                <div class="row">
                  <button class="btn btn-danger" (click)="move('CANCELLED', reason)" [disabled]="busy() || !reason.trim()">Confirm reject</button>
                  <button class="btn btn-link" (click)="rejecting.set(false)">Keep order</button>
                </div>
              </div>
            }
          </div>

          <div class="card">
            <h2>Items</h2>
            @for (i of o.items; track i.id) {
              <div class="summary-row"><span>{{ i.quantity }} × {{ i.name }}</span><span>{{ i.lineTotal | currency: 'INR' }}</span></div>
            }
            <div class="summary-row total-row"><span>Total (COD)</span><span>{{ o.totalAmount | currency: 'INR' }}</span></div>
          </div>

          <div class="card row">
            <label class="switch">
              <input type="checkbox" [checked]="o.isPaid" [disabled]="busy() || o.status === 'CANCELLED'" (change)="setPaid($any($event.target).checked)" />
              <span class="track"></span>
              <span>{{ o.isPaid ? 'Cash collected' : 'Mark cash collected' }}</span>
            </label>
          </div>
        </div>

        <div class="stack">
          <div class="card stack">
            <h2>Customer</h2>
            <div><strong>{{ o.customerName || '—' }}</strong></div>
            @if (o.customerPhone) {
              <div>📞 <a [href]="'tel:+91' + o.customerPhone">+91 {{ o.customerPhone }}</a></div>
            }
            <div class="small">✉️ {{ o.customerEmail }}</div>
          </div>
          <div class="card stack">
            <h2>Deliver to</h2>
            <p class="addr">{{ o.deliveryAddressText }}</p>
            <div class="row">
              <span class="muted small">{{ o.distanceKm }} km from the restaurant</span>
              <span class="spacer"></span>
              <a class="small" target="_blank" rel="noopener"
                [href]="'https://www.google.com/maps/dir/?api=1&destination=' + o.deliveryLatitude + ',' + o.deliveryLongitude">Open in Maps ↗</a>
            </div>
          </div>
          <div class="card">
            <h2>History</h2>
            <ol class="timeline">
              @for (h of o.statusHistory; track $index) {
                <li>
                  <strong>{{ statusLabel[h.status] }}</strong>
                  <div class="muted small">{{ h.changedAt | date: 'd MMM, h:mm:ss a' }} · {{ h.actor === 'ADMIN' ? (h.by ?? 'admin') : h.actor === 'CUSTOMER' ? 'customer' : 'system' }}</div>
                  @if (h.note) { <div class="small">“{{ h.note }}”</div> }
                </li>
              }
            </ol>
          </div>
        </div>
      </div>
    } @else if (error()) {
      <p class="empty error">{{ error() }}</p>
    } @else {
      <p class="empty">Loading…</p>
    }
  `,
  styles: `
    .layout { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); align-items: start; }
    h2 { margin-top: 0; }
    .danger { color: var(--danger); border-color: var(--danger); }
    .reject { border-top: 1px solid var(--border); padding-top: 0.75rem; }
    .addr { margin: 0; }
  `,
})
export class OrderDetail implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly feed = inject(OrderFeed);
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();
  protected readonly order = signal<AdminOrderDetail | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly rejecting = signal(false);
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly actionLabel = ACTION_LABEL;
  protected reason = '';

  ngOnInit() {
    this.load();
    this.feed.patch(this.id(), { isNew: false }); // server clears it on first open
  }

  protected forward = (o: AdminOrderDetail) => o.allowedTransitions.filter((s) => s !== 'CANCELLED');
  protected canReject = (o: AdminOrderDetail) => o.allowedTransitions.includes('CANCELLED');

  move(status: OrderStatus, reason?: string) {
    this.busy.set(true);
    this.api.setStatus(this.id(), status, reason?.trim()).subscribe({
      next: () => {
        this.rejecting.set(false);
        this.reason = '';
        this.toast.show(status === 'CANCELLED' ? 'Order rejected' : `Order ${STATUS_LABEL[status].toLowerCase()}`);
        this.feed.patch(this.id(), { status });
        this.load();
      },
      error: (e) => {
        this.toast.show(apiError(e), 'error');
        this.load(); // e.g. the customer cancelled in the meantime
      },
    });
  }

  setPaid(isPaid: boolean) {
    this.busy.set(true);
    this.api.setPaid(this.id(), isPaid).subscribe({
      next: () => {
        this.feed.patch(this.id(), { isPaid });
        this.load();
      },
      error: (e) => {
        this.toast.show(apiError(e), 'error');
        this.load();
      },
    });
  }

  private load() {
    this.api.order(this.id()).subscribe({
      next: (o) => {
        this.order.set(o);
        this.busy.set(false);
      },
      error: (e) => {
        this.error.set(apiError(e));
        this.busy.set(false);
      },
    });
  }
}
