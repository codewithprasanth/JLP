import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { Address, AddressInput, OrderDetail, OrderSummary, Profile } from './models';

/** Authenticated customer endpoints (profile, addresses, orders). */
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBase}/customer`;

  profile() {
    return this.http.get<Profile>(`${this.base}/profile`);
  }

  updateProfile(body: { name?: string; phone?: string }) {
    return this.http.patch<Profile>(`${this.base}/profile`, body);
  }

  addresses() {
    return this.http.get<Address[]>(`${this.base}/addresses`);
  }

  createAddress(body: AddressInput) {
    return this.http.post<Address>(`${this.base}/addresses`, body);
  }

  updateAddress(id: string, body: Partial<AddressInput>) {
    return this.http.patch<Address>(`${this.base}/addresses/${id}`, body);
  }

  deleteAddress(id: string) {
    return this.http.delete<{ success: boolean }>(`${this.base}/addresses/${id}`);
  }

  placeOrder(body: { addressId: string; items: { menuItemId: string; quantity: number }[] }, idempotencyKey: string) {
    return this.http.post<OrderDetail>(`${this.base}/orders`, body, { headers: { 'Idempotency-Key': idempotencyKey } });
  }

  orders(status: 'ongoing' | 'history') {
    return this.http.get<OrderSummary[]>(`${this.base}/orders`, { params: { status } });
  }

  order(id: string) {
    return this.http.get<OrderDetail>(`${this.base}/orders/${id}`);
  }

  cancelOrder(id: string) {
    return this.http.post<{ success: boolean }>(`${this.base}/orders/${id}/cancel`, {});
  }
}
