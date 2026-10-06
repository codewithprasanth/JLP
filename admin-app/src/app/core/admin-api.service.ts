import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  AdminMenuItem,
  AdminOrderDetail,
  AdminOrderRow,
  Category,
  DashboardSummary,
  OrderStatus,
  SalesReport,
  Settings,
} from './models';

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBase}/admin`;

  // Dashboard & reports
  summary() {
    return this.http.get<DashboardSummary>(`${this.base}/dashboard/summary`);
  }
  sales(from: string, to: string) {
    return this.http.get<SalesReport>(`${this.base}/reports/sales`, { params: { from, to } });
  }

  // Orders
  orders(params: { status?: string; since?: string } = {}) {
    const p: Record<string, string> = {};
    if (params.status) p['status'] = params.status;
    if (params.since) p['since'] = params.since;
    return this.http.get<{ serverTime: string; orders: AdminOrderRow[] }>(`${this.base}/orders`, { params: p });
  }
  order(id: string) {
    return this.http.get<AdminOrderDetail>(`${this.base}/orders/${id}`);
  }
  setStatus(id: string, status: OrderStatus, reason?: string) {
    return this.http.patch(`${this.base}/orders/${id}/status`, { status, reason });
  }
  setPaid(id: string, isPaid: boolean) {
    return this.http.patch<{ id: string; isPaid: boolean }>(`${this.base}/orders/${id}/payment`, { isPaid });
  }

  // Menu items
  menuItems() {
    return this.http.get<AdminMenuItem[]>(`${this.base}/menu/items`);
  }
  menuItem(id: string) {
    return this.http.get<AdminMenuItem>(`${this.base}/menu/items/${id}`);
  }
  createMenuItem(form: FormData) {
    return this.http.post<AdminMenuItem>(`${this.base}/menu/items`, form);
  }
  updateMenuItem(id: string, form: FormData) {
    return this.http.patch<AdminMenuItem>(`${this.base}/menu/items/${id}`, form);
  }
  setAvailability(id: string, isAvailable: boolean) {
    return this.http.patch<{ id: string; isAvailable: boolean }>(`${this.base}/menu/items/${id}/availability`, { isAvailable });
  }
  deleteMenuItem(id: string) {
    return this.http.delete(`${this.base}/menu/items/${id}`);
  }

  // Categories
  categories() {
    return this.http.get<Category[]>(`${this.base}/menu/categories`);
  }
  createCategory(name: string) {
    return this.http.post<Category>(`${this.base}/menu/categories`, { name });
  }
  renameCategory(id: string, name: string) {
    return this.http.patch<Category>(`${this.base}/menu/categories/${id}`, { name });
  }
  reorderCategories(ids: string[]) {
    return this.http.put(`${this.base}/menu/categories/order`, { ids });
  }
  deleteCategory(id: string) {
    return this.http.delete(`${this.base}/menu/categories/${id}`);
  }

  // Settings
  settings() {
    return this.http.get<Settings>(`${this.base}/settings`);
  }
  updateSettings(body: Partial<Omit<Settings, 'updatedAt' | 'minOrderValue'>> & { minOrderValue?: number }) {
    return this.http.patch<Settings>(`${this.base}/settings`, body);
  }
}
