import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { apiError } from '../../core/http-error';
import { Category, MenuItem } from '../../core/models';
import { ShopService } from '../../core/shop.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink, CurrencyPipe],
  template: `
    @if (closed()) {
      <div class="banner">🔒 We're not accepting orders right now. You can still browse the menu.</div>
    }

    <input class="search" type="search" placeholder="Search dishes…" [value]="query()" (input)="query.set($any($event.target).value)" />

    <div class="tabs" role="tablist">
      <button [class.active]="activeCategory() === null" (click)="activeCategory.set(null)">All</button>
      @for (c of categories(); track c.id) {
        <button [class.active]="activeCategory() === c.id" (click)="activeCategory.set(c.id)">{{ c.name }}</button>
      }
    </div>

    @if (loading()) {
      <p class="empty">Loading menu…</p>
    } @else if (error()) {
      <div class="empty"><p class="error">{{ error() }}</p><button class="btn btn-outline" (click)="load()">Retry</button></div>
    } @else {
      @for (group of grouped(); track group.category.id) {
        <h2>{{ group.category.name }}</h2>
        <div class="stack">
          @for (item of group.items; track item.id) {
            <div class="card item" [class.unavailable]="!item.isAvailable">
              <a [routerLink]="['/item', item.id]" class="item-link">
                @if (item.imageUrl) {
                  <img class="thumb" [src]="item.imageUrl" [alt]="item.name" loading="lazy" />
                } @else {
                  <div class="thumb">🍽️</div>
                }
                <div class="item-body">
                  <div class="row"><strong>{{ item.name }}</strong>
                    @if (!item.isAvailable) { <span class="badge badge-muted">Unavailable</span> }
                  </div>
                  @if (item.description) { <p class="muted small desc">{{ item.description }}</p> }
                  <span class="price">{{ item.price | currency: 'INR' }}</span>
                </div>
              </a>
              <button class="btn btn-outline add" [disabled]="!item.isAvailable || closed()" (click)="add(item)">Add</button>
            </div>
          }
        </div>
      } @empty {
        <p class="empty">No dishes match your search.</p>
      }
    }
  `,
  styles: `
    .search { margin: 0.75rem 0; }
    .banner { margin-bottom: 0.75rem; }
    .item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; }
    .item-link { display: flex; gap: 0.75rem; flex: 1; min-width: 0; color: inherit; text-decoration: none; }
    .item-body { min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
    .desc { margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .unavailable .thumb, .unavailable .item-body { opacity: 0.55; }
    .add { flex: none; }
  `,
})
export class Home implements OnInit {
  private readonly shop = inject(ShopService);
  private readonly cart = inject(CartService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly categories = signal<Category[]>([]);
  protected readonly items = signal<MenuItem[]>([]);
  protected readonly activeCategory = signal<string | null>(null);
  protected readonly query = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly closed = computed(() => this.shop.settings()?.isAcceptingOrders === false);

  protected readonly grouped = computed(() => {
    const q = this.query().trim().toLowerCase();
    const active = this.activeCategory();
    return this.categories()
      .filter((c) => active === null || c.id === active)
      .map((category) => ({
        category,
        items: this.items().filter(
          (i) => i.categoryId === category.id && (!q || `${i.name} ${i.description ?? ''}`.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.items.length > 0);
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    forkJoin({ categories: this.shop.categories(), items: this.shop.items(), settings: this.shop.loadSettings() }).subscribe({
      next: ({ categories, items }) => {
        this.categories.set(categories);
        this.items.set(items);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(apiError(e, 'Could not load the menu'));
        this.loading.set(false);
      },
    });
  }

  add(item: MenuItem) {
    if (!this.auth.isLoggedIn()) {
      this.cart.deferAdd(item, 1);
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/' } });
      return;
    }
    this.cart.add(item, 1);
    this.toast.show(`${item.name} added to cart`);
  }
}
