import { CurrencyPipe, SlicePipe, UpperCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { countdownTo } from '../../core/countdown';
import { CustomerService } from '../../core/customer.service';
import { apiError } from '../../core/http-error';
import { OrderDetail, STATUS_LABEL } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-order-confirmation',
  imports: [CurrencyPipe, RouterLink, SlicePipe, UpperCasePipe],
  template: `
    @if (order(); as o) {
      <div class="card stack center">
        @if (o.status === 'CANCELLED') {
          <div class="icon">✖️</div>
          <h1>Order cancelled</h1>
        } @else {
          <div class="icon">✅</div>
          <h1>Order placed!</h1>
          <p class="muted">Pay <strong>{{ o.totalAmount | currency: 'INR' }}</strong> in cash when it arrives.</p>
        }
        <p>Order <strong>#{{ o.id | slice: 0 : 8 | uppercase }}</strong> · <span class="badge">{{ statusLabel[o.status] }}</span></p>

        @if (secondsLeft() > 0) {
          <button class="btn btn-danger" (click)="cancel()" [disabled]="busy()">Cancel order ({{ secondsLeft() }}s)</button>
          <p class="muted small">You can cancel within 60 seconds of placing the order.</p>
        }
      </div>

      <div class="card summary">
        @for (i of o.items; track i.id) {
          <div class="summary-row"><span>{{ i.name }} × {{ i.quantity }}</span><span>{{ i.lineTotal | currency: 'INR' }}</span></div>
        }
        <div class="summary-row total-row"><span>Total</span><span>{{ o.totalAmount | currency: 'INR' }}</span></div>
      </div>

      <div class="row actions">
        <a class="btn btn-outline" [routerLink]="['/orders', o.id]">Track order</a>
        <a class="btn" routerLink="/">Back to menu</a>
      </div>
    } @else if (error()) {
      <p class="empty error">{{ error() }}</p>
    } @else {
      <p class="empty">Loading…</p>
    }
  `,
  styles: `
    .center { text-align: center; align-items: center; margin-top: 1rem; }
    .icon { font-size: 3rem; }
    h1 { margin: 0; }
    .summary { margin-top: 1rem; }
    .actions { margin-top: 1rem; justify-content: center; }
  `,
})
export class OrderConfirmation implements OnInit {
  private readonly customer = inject(CustomerService);
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();
  protected readonly order = signal<OrderDetail | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly statusLabel = STATUS_LABEL;
  // UX aid only — the server enforces the 60s window.
  protected readonly secondsLeft = countdownTo(computed(() => this.order()?.cancellableUntil ?? null));

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
