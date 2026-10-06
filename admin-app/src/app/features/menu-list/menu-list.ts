import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminApi } from '../../core/admin-api.service';
import { apiError } from '../../core/http-error';
import { AdminMenuItem, Category } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-menu-list',
  imports: [CurrencyPipe, RouterLink],
  template: `
    <div class="row">
      <h1>My food list</h1>
      <span class="spacer"></span>
      <a class="btn" routerLink="/menu/new">+ Add item</a>
    </div>

    <div class="tabs">
      <button [class.active]="category() === null" (click)="category.set(null)">All ({{ items().length }})</button>
      @for (c of categories(); track c.id) {
        <button [class.active]="category() === c.id" (click)="category.set(c.id)">{{ c.name }} ({{ c.itemCount }})</button>
      }
    </div>

    <div class="stack">
      @for (item of visible(); track item.id) {
        <div class="card item">
          @if (item.imageUrl) {
            <img class="thumb" [src]="item.imageUrl" [alt]="item.name" />
          } @else {
            <div class="thumb">🍽️</div>
          }
          <div class="info">
            <div class="row"><strong>{{ item.name }}</strong><span class="badge badge-muted">{{ item.categoryName }}</span></div>
            <span class="price">{{ item.price | currency: 'INR' }}</span>
          </div>
          <label class="switch" [title]="item.isAvailable ? 'Tap to mark sold out' : 'Tap to make available'">
            <input type="checkbox" [checked]="item.isAvailable" (change)="toggle(item, $any($event.target).checked)" />
            <span class="track"></span>
            <span class="small">{{ item.isAvailable ? 'Available' : 'Sold out' }}</span>
          </label>
          <div class="actions">
            @if (confirmDelete() === item.id) {
              <button class="btn btn-danger" (click)="remove(item)">Delete</button>
              <button class="btn btn-link" (click)="confirmDelete.set(null)">Cancel</button>
            } @else {
              <a class="btn btn-outline" [routerLink]="['/menu', item.id, 'edit']">Edit</a>
              <button class="btn btn-link danger" (click)="confirmDelete.set(item.id)">Delete</button>
            }
          </div>
        </div>
      } @empty {
        <p class="empty">{{ loading() ? 'Loading…' : 'No items yet — add your first dish.' }}</p>
      }
    </div>
    <a class="fab" routerLink="/menu/new" aria-label="Add item">+</a>
  `,
  styles: `
    .item { display: flex; align-items: center; gap: 0.9rem; flex-wrap: wrap; padding: 0.75rem; }
    .info { flex: 1; min-width: 160px; display: flex; flex-direction: column; gap: 0.25rem; }
    .actions { display: flex; gap: 0.25rem; align-items: center; }
    .danger { color: var(--danger); }
    .fab { position: fixed; right: 1.5rem; bottom: 1.5rem; width: 56px; height: 56px; border-radius: 50%; background: var(--brand);
      color: #fff; font-size: 2rem; display: grid; place-items: center; text-decoration: none; box-shadow: 0 6px 18px rgb(0 0 0 / 25%); }
  `,
})
export class MenuList implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<AdminMenuItem[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly category = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly confirmDelete = signal<string | null>(null);
  protected readonly visible = computed(() => {
    const c = this.category();
    return c ? this.items().filter((i) => i.categoryId === c) : this.items();
  });

  ngOnInit() {
    this.load();
  }

  load() {
    forkJoin({ items: this.api.menuItems(), categories: this.api.categories() }).subscribe({
      next: ({ items, categories }) => {
        this.items.set(items);
        this.categories.set(categories);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.show(apiError(e), 'error');
      },
    });
  }

  /** Single tap — no form. Optimistic, reverted on failure. */
  toggle(item: AdminMenuItem, isAvailable: boolean) {
    this.setLocal(item.id, isAvailable);
    this.api.setAvailability(item.id, isAvailable).subscribe({
      next: () => this.toast.show(`${item.name} is now ${isAvailable ? 'available' : 'sold out'}`),
      error: (e) => {
        this.setLocal(item.id, !isAvailable);
        this.toast.show(apiError(e), 'error');
      },
    });
  }

  remove(item: AdminMenuItem) {
    this.api.deleteMenuItem(item.id).subscribe({
      next: () => {
        this.confirmDelete.set(null);
        this.toast.show(`${item.name} deleted`);
        this.load();
      },
      error: (e) => this.toast.show(apiError(e), 'error'),
    });
  }

  private setLocal(id: string, isAvailable: boolean) {
    this.items.update((list) => list.map((i) => (i.id === id ? { ...i, isAvailable } : i)));
  }
}
