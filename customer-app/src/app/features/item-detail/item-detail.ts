import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { CartService, MAX_QTY } from '../../core/cart.service';
import { apiError } from '../../core/http-error';
import { MenuItem } from '../../core/models';
import { ShopService } from '../../core/shop.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-item-detail',
  imports: [CurrencyPipe, RouterLink],
  template: `
    <a routerLink="/" class="small">← Back to menu</a>
    @if (item(); as item) {
      <div class="card stack detail">
        @if (item.imageUrl) {
          <img class="hero" [src]="item.imageUrl" [alt]="item.name" />
        } @else {
          <div class="hero placeholder">🍽️</div>
        }
        <div class="row">
          <h1>{{ item.name }}</h1>
          <span class="spacer"></span>
          <span class="price big">{{ item.price | currency: 'INR' }}</span>
        </div>
        @if (item.description) { <p>{{ item.description }}</p> }

        @if (!item.isAvailable) {
          <div class="banner">This dish is currently unavailable.</div>
        } @else if (closed()) {
          <div class="banner">We're not accepting orders right now.</div>
        }

        <div class="row">
          <div class="stepper">
            <button (click)="qty.set(qty() - 1)" [disabled]="qty() <= 1" aria-label="Decrease">−</button>
            <span>{{ qty() }}</span>
            <button (click)="qty.set(qty() + 1)" [disabled]="qty() >= max" aria-label="Increase">+</button>
          </div>
          <button class="btn spacer" [disabled]="!item.isAvailable || closed()" (click)="add(item)">
            Add to cart · {{ lineTotal() | currency: 'INR' }}
          </button>
        </div>
      </div>
    } @else if (error()) {
      <p class="empty error">{{ error() }}</p>
    } @else {
      <p class="empty">Loading…</p>
    }
  `,
  styles: `
    .detail { margin-top: 0.75rem; }
    .hero { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; border-radius: 10px; background: var(--brand-soft); }
    .placeholder { display: grid; place-items: center; font-size: 4rem; }
    h1 { margin: 0; }
    .big { font-size: 1.2rem; }
  `,
})
export class ItemDetail implements OnInit {
  private readonly shop = inject(ShopService);
  private readonly cart = inject(CartService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();
  protected readonly item = signal<MenuItem | null>(null);
  protected readonly error = signal('');
  protected readonly qty = signal(1);
  protected readonly max = MAX_QTY;
  protected readonly closed = computed(() => this.shop.settings()?.isAcceptingOrders === false);
  protected readonly lineTotal = computed(() => (Number(this.item()?.price ?? 0) * 100 * this.qty()) / 100);

  ngOnInit() {
    this.shop.item(this.id()).subscribe({ next: (i) => this.item.set(i), error: (e) => this.error.set(apiError(e)) });
    if (!this.shop.settings()) this.shop.loadSettings().subscribe({ error: () => {} });
  }

  add(item: MenuItem) {
    if (!this.auth.isLoggedIn()) {
      // Login first, then come back here with the item already in the cart.
      this.cart.deferAdd(item, this.qty());
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.cart.add(item, this.qty());
    this.toast.show(`${item.name} × ${this.qty()} added to cart`);
    this.qty.set(1);
  }
}
