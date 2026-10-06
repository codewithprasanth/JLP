import { CurrencyPipe, DatePipe, SlicePipe, UpperCasePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerService } from '../../core/customer.service';
import { apiError } from '../../core/http-error';
import { OrderSummary, STATUS_LABEL } from '../../core/models';

@Component({
  selector: 'app-my-orders',
  imports: [CurrencyPipe, DatePipe, RouterLink, SlicePipe, UpperCasePipe],
  template: `
    <div class="row">
      <h1>My orders</h1>
      <span class="spacer"></span>
      <button class="btn btn-link" (click)="load()" [disabled]="loading()">↻ Refresh</button>
    </div>
    <div class="tabs">
      <button [class.active]="tab() === 'ongoing'" (click)="switchTab('ongoing')">Ongoing</button>
      <button [class.active]="tab() === 'history'" (click)="switchTab('history')">History</button>
    </div>

    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    <div class="stack">
      @for (o of orders(); track o.id) {
        <a class="card order" [routerLink]="['/orders', o.id]">
          <div class="stack tight">
            <strong>#{{ o.id | slice: 0 : 8 | uppercase }}</strong>
            <span class="muted small">{{ o.createdAt | date: 'd MMM, h:mm a' }} · {{ o.itemCount }} item{{ o.itemCount === 1 ? '' : 's' }}</span>
          </div>
          <span class="spacer"></span>
          <div class="stack tight right">
            <span class="badge" [class.badge-danger]="o.status === 'CANCELLED'" [class.badge-muted]="o.status === 'DELIVERED'">{{ statusLabel[o.status] }}</span>
            <span class="price">{{ o.totalAmount | currency: 'INR' }}</span>
          </div>
        </a>
      } @empty {
        @if (!loading()) {
          <p class="empty">{{ tab() === 'ongoing' ? 'No ongoing orders.' : 'No past orders yet.' }}</p>
        }
      }
    </div>
  `,
  styles: `
    .order { display: flex; align-items: center; gap: 0.75rem; color: inherit; text-decoration: none; }
    .tight { gap: 0.2rem; }
    .right { align-items: flex-end; }
  `,
})
export class MyOrders implements OnInit {
  private readonly customer = inject(CustomerService);

  protected readonly tab = signal<'ongoing' | 'history'>('ongoing');
  protected readonly orders = signal<OrderSummary[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly statusLabel = STATUS_LABEL;

  constructor() {
    // No live tracking in v1: refresh when the user returns to the tab.
    const onVisible = () => document.visibilityState === 'visible' && this.load();
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', onVisible));
  }

  ngOnInit() {
    this.load();
  }

  switchTab(t: 'ongoing' | 'history') {
    this.tab.set(t);
    this.orders.set([]);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.customer.orders(this.tab()).subscribe({
      next: (o) => {
        this.orders.set(o);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(apiError(e));
        this.loading.set(false);
      },
    });
  }
}
