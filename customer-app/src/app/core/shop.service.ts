import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Category, MenuItem, PublicSettings } from './models';

/** Public, unauthenticated menu + restaurant settings. */
@Injectable({ providedIn: 'root' })
export class ShopService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  /** Latest known settings; refreshed whenever the menu or cart is opened. */
  readonly settings = signal<PublicSettings | null>(null);

  loadSettings() {
    return this.http.get<PublicSettings>(`${this.base}/settings/public`).pipe(tap((s) => this.settings.set(s)));
  }

  categories() {
    return this.http.get<Category[]>(`${this.base}/menu/categories`);
  }

  items() {
    return this.http.get<MenuItem[]>(`${this.base}/menu/items`);
  }

  item(id: string) {
    return this.http.get<MenuItem>(`${this.base}/menu/items/${id}`);
  }
}
