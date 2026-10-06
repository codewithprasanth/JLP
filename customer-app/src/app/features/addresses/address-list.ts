import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerService } from '../../core/customer.service';
import { apiError } from '../../core/http-error';
import { Address } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-address-list',
  imports: [RouterLink],
  template: `
    <div class="row">
      <h1>My addresses</h1>
      <span class="spacer"></span>
      <a class="btn" routerLink="/addresses/new">+ Add new address</a>
    </div>

    @if (loading()) {
      <p class="empty">Loading…</p>
    } @else {
      <div class="stack">
        @for (a of addresses(); track a.id) {
          <div class="card stack">
            <div class="row">
              <span class="badge">{{ a.label }}</span>
              @if (a.isDefault) { <span class="badge badge-muted">Default</span> }
              <span class="spacer"></span>
              <a class="btn btn-link" [routerLink]="['/addresses', a.id, 'edit']">Edit</a>
              @if (confirmingDelete() === a.id) {
                <button class="btn btn-link danger" (click)="remove(a)">Confirm delete</button>
                <button class="btn btn-link" (click)="confirmingDelete.set(null)">Keep</button>
              } @else {
                <button class="btn btn-link danger" (click)="confirmingDelete.set(a.id)">Delete</button>
              }
            </div>
            <p class="addr">{{ a.addressText }}</p>
            @if (!a.isDefault) {
              <button class="btn btn-outline" (click)="makeDefault(a)">Set as default</button>
            }
          </div>
        } @empty {
          <div class="empty">
            <p>No saved addresses yet.</p>
            <a class="btn" routerLink="/addresses/new">Add your first address</a>
          </div>
        }
      </div>
    }
  `,
  styles: `
    .addr { margin: 0; }
    .danger { color: var(--danger); }
    .card .btn-outline { align-self: flex-start; }
  `,
})
export class AddressList implements OnInit {
  private readonly customer = inject(CustomerService);
  private readonly toast = inject(ToastService);

  protected readonly addresses = signal<Address[]>([]);
  protected readonly loading = signal(true);
  protected readonly confirmingDelete = signal<string | null>(null);

  ngOnInit() {
    this.load();
  }

  load() {
    this.customer.addresses().subscribe({
      next: (list) => {
        this.addresses.set(list);
        this.loading.set(false);
      },
      error: (e) => {
        this.toast.show(apiError(e), 'error');
        this.loading.set(false);
      },
    });
  }

  makeDefault(a: Address) {
    this.customer.updateAddress(a.id, { isDefault: true }).subscribe({
      next: () => this.load(),
      error: (e) => this.toast.show(apiError(e), 'error'),
    });
  }

  remove(a: Address) {
    this.customer.deleteAddress(a.id).subscribe({
      next: () => {
        this.confirmingDelete.set(null);
        this.toast.show('Address deleted');
        this.load();
      },
      error: (e) => this.toast.show(apiError(e), 'error'),
    });
  }
}
