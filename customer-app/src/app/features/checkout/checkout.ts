import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/cart.service';
import { CustomerService } from '../../core/customer.service';
import { apiError, apiErrorCode } from '../../core/http-error';
import { Address } from '../../core/models';
import { ShopService } from '../../core/shop.service';

@Component({
  selector: 'app-checkout',
  imports: [CurrencyPipe, RouterLink],
  template: `
    <a routerLink="/cart" class="small">← Back to cart</a>
    <h1>Checkout</h1>

    @if (cart.lines().length === 0) {
      <div class="empty"><p>Your cart is empty.</p><a class="btn" routerLink="/">Browse the menu</a></div>
    } @else {
      <h2>Deliver to</h2>
      @if (loadingAddresses()) {
        <p class="muted">Loading addresses…</p>
      } @else if (addresses().length === 0) {
        <div class="card stack">
          <p class="muted">Add a delivery address to continue.</p>
          <a class="btn" routerLink="/addresses/new" [queryParams]="{ returnUrl: '/checkout' }">+ Add address</a>
        </div>
      } @else {
        <div class="stack">
          @for (a of addresses(); track a.id) {
            <label class="card addr" [class.selected]="selectedId() === a.id">
              <input type="radio" name="address" [checked]="selectedId() === a.id" (change)="selectedId.set(a.id)" />
              <div>
                <span class="badge">{{ a.label }}</span>
                <p class="addr-text">{{ a.addressText }}</p>
              </div>
            </label>
          }
          <a class="small" routerLink="/addresses/new" [queryParams]="{ returnUrl: '/checkout' }">+ Add another address</a>
        </div>
      }

      <h2>Order summary</h2>
      <div class="card">
        @for (line of cart.lines(); track line.menuItemId) {
          <div class="summary-row"><span>{{ line.name }} × {{ line.quantity }}</span><span>{{ (+line.price * line.quantity) | currency: 'INR' }}</span></div>
        }
        <div class="summary-row muted"><span>Delivery</span><span>Free</span></div>
        <div class="summary-row total-row"><span>Total</span><span>{{ total() | currency: 'INR' }}</span></div>
      </div>

      <h2>Payment</h2>
      <div class="card row"><span>💵</span><strong>Cash on Delivery</strong><span class="muted small">Pay when your order arrives</span></div>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      <button class="btn btn-block place" (click)="place()" [disabled]="!selectedId() || busy()">
        {{ busy() ? 'Placing order…' : 'Place order · ' + (total() | currency: 'INR') }}
      </button>
    }
  `,
  styles: `
    .addr { display: flex; gap: 0.75rem; align-items: flex-start; cursor: pointer; }
    .addr input { width: auto; min-height: auto; margin-top: 0.3rem; }
    .addr.selected { border-color: var(--brand); box-shadow: 0 0 0 1px var(--brand); }
    .addr-text { margin: 0.3rem 0 0; }
    .place { margin-top: 1.25rem; }
  `,
})
export class Checkout implements OnInit {
  protected readonly cart = inject(CartService);
  private readonly customer = inject(CustomerService);
  private readonly shop = inject(ShopService);
  private readonly router = inject(Router);

  protected readonly addresses = signal<Address[]>([]);
  protected readonly loadingAddresses = signal(true);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly total = computed(() => this.cart.subtotalPaise() / 100);

  /** One key per checkout visit: retries of the same submission can't create a second order. */
  private readonly idempotencyKey = crypto.randomUUID();

  ngOnInit() {
    this.shop.loadSettings().subscribe({ error: () => {} });
    this.customer.addresses().subscribe({
      next: (list) => {
        this.addresses.set(list);
        this.selectedId.set(list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? null);
        this.loadingAddresses.set(false);
      },
      error: (e) => {
        this.error.set(apiError(e));
        this.loadingAddresses.set(false);
      },
    });
  }

  place() {
    const addressId = this.selectedId();
    if (!addressId) return;
    this.busy.set(true);
    this.error.set('');
    const items = this.cart.lines().map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity }));
    // The server re-validates: shop open, radius, availability, minimum order.
    this.customer.placeOrder({ addressId, items }, this.idempotencyKey).subscribe({
      next: (order) => {
        this.cart.clear();
        this.router.navigate(['/order-confirmation', order.id], { replaceUrl: true });
      },
      error: (e) => {
        this.busy.set(false);
        if (apiErrorCode(e) === 'PROFILE_INCOMPLETE') {
          // Contact phone missing — collect it, then come straight back here.
          this.router.navigate(['/welcome'], { queryParams: { returnUrl: '/checkout' } });
          return;
        }
        this.error.set(apiError(e));
      },
    });
  }
}
