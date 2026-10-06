import { CurrencyPipe, DatePipe, SlicePipe, UpperCasePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { countdownTo } from '../../core/countdown';
import { CustomerService } from '../../core/customer.service';
import { apiError } from '../../core/http-error';
import { OrderDetail, STATUS_LABEL } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-order-detail',
  imports: [CurrencyPipe, DatePipe, RouterLink, SlicePipe, UpperCasePipe],
  template: `
    <a routerLink="/orders" class="small">← My orders</a>
    @if (order(); as o) {
      <div class="row">
        <h1>Order #{{ o.id | slice: 0 : 8 | uppercase }}</h1>
        <span class="spacer"></span>
        <button class="btn btn-link" (click)="load()">↻ Refresh</button>
      </div>
      <p><span class="badge" [class.badge-danger]="o.status === 'CANCELLED'">{{ statusLabel[o.status] }}</span>
        <span class="muted small"> · placed {{ o.createdAt | date: 'd MMM y, h:mm a' }}</span></p>
      @if (o.cancelReason && o.status === 'CANCELLED') {
        <div class="banner">{{ o.cancelReason }}</div>
      }

      @if (secondsLeft() > 0) {
        <button class="btn btn-danger" (click)="cancel()" [disabled]="busy()">Cancel order ({{ secondsLeft() }}s)</button>
      }

      <h2>Items</h2>
      <div class="card">
        @for (i of o.items; track i.id) {
          <div class="summary-row"><span>{{ i.name }} × {{ i.quantity }}</span><span>{{ i.lineTotal | currency: 'INR' }}</span></div>
        }
        <div class="summary-row muted"><span>Delivery</span><span>Free</span></div>
        <div class="summary-row total-row"><span>Total</span><span>{{ o.totalAmount | currency: 'INR' }}</span></div>
        <p class="muted small">Cash on Delivery · {{ o.isPaid ? 'Paid' : 'Not yet paid' }}</p>
      </div>

      <h2>Delivery address</h2>
      <div class="card">{{ o.deliveryAddressText }}</div>

      <h2>Status</h2>
      <ol class="timeline card">
        @for (h of o.statusHistory; track $index) {
          <li>
            <strong>{{ statusLabel[h.status] }}</strong>
            <div class="muted small">{{ h.changedAt | date: 'd MMM, h:mm a' }}{{ h.actor === 'CUSTOMER' && h.status === 'CANCELLED' ? ' · by you' : '' }}</div>
            @if (h.note) { <div class="small">{{ h.note }}</div> }
          </li>
        }
      </ol>
    } @else if (error()) {
      <p class="empty error">{{ error() }}</p>
    } @else {
      <p class="empty">Loading…</p>
    }
  `,
})
export class OrderDetailPage implements OnInit {
  private readonly customer = inject(CustomerService);
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();
  protected readonly order = signal<OrderDetail | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly secondsLeft = countdownTo(computed(() => this.order()?.cancellableUntil ?? null));

  constructor() {
    const onVisible = () => document.visibilityState === 'visible' && this.load();
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', onVisible));
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.customer.order(this.id()).subscribe({ next: (o) => this.order.set(o), error: (e) => this.error.set(apiError(e)) });
  }

  cancel() {
    this.busy.set(true);
    this.customer.cancelOrder(this.id()).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show('Order cancelled');
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.show(apiError(e), 'error');
        this.load();
      },
    });
  }
}
