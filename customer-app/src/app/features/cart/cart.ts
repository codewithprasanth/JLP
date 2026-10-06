import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CartService, MAX_QTY } from '../../core/cart.service';
import { ShopService } from '../../core/shop.service';

@Component({
  selector: 'app-cart',
  imports: [CurrencyPipe, RouterLink],
  template: `
    <h1>Your cart</h1>
    @if (cart.lines().length === 0) {
      <div class="empty">
        <p>Your cart is empty.</p>
        <a class="btn" routerLink="/">Browse the menu</a>
      </div>
    } @else {
      @if (closed()) {
        <div class="banner">We're not accepting orders right now.</div>
      }
      @if (unavailable().length) {
        <div class="banner">No longer available: {{ unavailable().join(', ') }} — remove to continue.</div>
      }
      <div class="stack">
        @for (line of cart.lines(); track line.menuItemId) {
          <div class="card line">
            @if (line.imageUrl) {
              <img class="thumb" [src]="line.imageUrl" [alt]="line.name" />
            } @else {
              <div class="thumb">🍽️</div>
            }
            <div class="info">
              <strong>{{ line.name }}</strong>
              <span class="muted small">{{ line.price | currency: 'INR' }} each</span>
              <div class="row">
                <div class="stepper">
                  <button (click)="cart.setQuantity(line.menuItemId, line.quantity - 1)" aria-label="Decrease">−</button>
                  <span>{{ line.quantity }}</span>
                  <button (click)="cart.setQuantity(line.menuItemId, line.quantity + 1)" [disabled]="line.quantity >= max" aria-label="Increase">+</button>
                </div>
                <button class="btn btn-link" (click)="cart.remove(line.menuItemId)">Remove</button>
              </div>
            </div>
            <span class="price">{{ (+line.price * line.quantity) | currency: 'INR' }}</span>
          </div>
        }
      </div>

      <div class="card stack summary">
        <div class="summary-row total-row"><span>Subtotal</span><span>{{ subtotal() | currency: 'INR' }}</span></div>
        @if (belowMinimum()) {
          <p class="error">Minimum order is {{ minOrder() | currency: 'INR' }} — add {{ (minOrder() - subtotal()) | currency: 'INR' }} more.</p>
        }
        <a class="btn btn-block" routerLink="/checkout" [class.disabled]="!canProceed()" [attr.aria-disabled]="!canProceed()"
           (click)="!canProceed() && $event.preventDefault()">Proceed to checkout</a>
      </div>
    }
  `,
  styles: `
    .line { display: flex; gap: 0.75rem; align-items: flex-start; padding: 0.75rem; }
    .info { flex: 1; display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
    .summary { margin-top: 1rem; }
    .banner { margin-bottom: 0.75rem; }
    a.disabled { opacity: 0.5; pointer-events: none; }
  `,
})
export class Cart implements OnInit {
  protected readonly cart = inject(CartService);
  private readonly shop = inject(ShopService);

  protected readonly max = MAX_QTY;
  private readonly unavailableIds = signal<Set<string>>(new Set());
  /** Derived from current lines, so removing an unavailable line clears the warning. */
  protected readonly unavailable = computed(() =>
    this.cart.lines().filter((l) => this.unavailableIds().has(l.menuItemId)).map((l) => l.name),
  );
  protected readonly subtotal = computed(() => this.cart.subtotalPaise() / 100);
  /** Read from settings, never hardcoded. */
  protected readonly minOrder = computed(() => Number(this.shop.settings()?.minOrderValue ?? 0));
  protected readonly belowMinimum = computed(() => this.subtotal() < this.minOrder());
  protected readonly closed = computed(() => this.shop.settings()?.isAcceptingOrders === false);
  protected readonly canProceed = computed(
    () => this.cart.lines().length > 0 && !this.belowMinimum() && !this.closed() && this.unavailable().length === 0,
  );

  ngOnInit() {
    // Re-sync prices/availability with the live menu — the admin may have changed them.
    forkJoin({ items: this.shop.items(), settings: this.shop.loadSettings() }).subscribe({
      next: ({ items }) => this.unavailableIds.set(this.cart.reconcile(items)),
      error: () => {},
    });
  }
}
