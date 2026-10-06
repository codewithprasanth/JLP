import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CustomerService } from '../../core/customer.service';
import { haversineKm } from '../../core/geo';
import { apiError } from '../../core/http-error';
import { ShopService } from '../../core/shop.service';
import { ToastService } from '../../core/toast.service';
import { LatLng, MapPicker } from '../../shared/map-picker';

const LABELS = ['Home', 'Work', 'Other'];

@Component({
  selector: 'app-address-form',
  imports: [FormsModule, RouterLink, MapPicker],
  template: `
    <a routerLink="/addresses" class="small">← My addresses</a>
    <h1>{{ id() ? 'Edit address' : 'Add new address' }}</h1>

    @if (position(); as pos) {
      <div class="stack">
        <app-map-picker [(position)]="position$" [shop]="shop()" [radiusKm]="radiusKm()" />
        <div class="row">
          <button class="btn btn-outline" type="button" (click)="useCurrentLocation()" [disabled]="locating()">
            📍 {{ locating() ? 'Locating…' : 'Use current location' }}
          </button>
          @if (distanceKm() !== null) {
            <span class="small" [class.error]="outside()" [class.muted]="!outside()">
              {{ distanceKm()!.toFixed(1) }} km from the restaurant{{ outside() ? ' — outside our delivery area' : '' }}
            </span>
          }
        </div>
        <p class="muted small">Drag the pin (or tap the map) to your exact door.</p>

        <form class="card stack" (ngSubmit)="save()">
          <label class="field">
            Address
            <textarea name="addressText" rows="3" [(ngModel)]="addressText" maxlength="500"
              placeholder="Flat / house no., building, street, area, landmark, PIN code" required></textarea>
          </label>
          <div class="field">
            Save as
            <div class="row chips">
              @for (l of labels; track l) {
                <button type="button" class="chip" [class.active]="label() === l" (click)="label.set(l)">{{ l }}</button>
              }
            </div>
          </div>
          <label class="row check"><input type="checkbox" name="isDefault" [(ngModel)]="isDefault" /> Make this my default address</label>
          @if (error()) { <p class="error">{{ error() }}</p> }
          <button class="btn btn-block" type="submit" [disabled]="busy() || addressText.trim().length < 5 || outside()">Save location</button>
        </form>
      </div>
    } @else {
      <p class="empty">Loading…</p>
    }
  `,
  styles: `
    .chip { border: 1px solid var(--border); background: #fff; border-radius: 999px; padding: 0.4rem 0.9rem; font: inherit; cursor: pointer; }
    .chip.active { background: var(--brand); color: #fff; border-color: var(--brand); }
    .field { font-weight: 600; font-size: 0.9rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .check { font-weight: 500; }
    .check input { width: auto; min-height: auto; }
  `,
})
export class AddressForm implements OnInit {
  private readonly customer = inject(CustomerService);
  private readonly shopService = inject(ShopService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly id = input<string>();
  readonly returnUrl = input<string>('/addresses');

  protected readonly labels = LABELS;
  protected readonly position = signal<LatLng | null>(null);
  protected readonly label = signal('Home');
  protected readonly busy = signal(false);
  protected readonly locating = signal(false);
  protected readonly error = signal('');
  protected addressText = '';
  protected isDefault = false;

  protected readonly shop = computed(() => {
    const s = this.shopService.settings();
    return s ? { lat: s.shopLatitude, lng: s.shopLongitude } : null;
  });
  protected readonly radiusKm = computed(() => Number(this.shopService.settings()?.deliveryRadiusKm ?? 0) || null);
  protected readonly distanceKm = computed(() => {
    const p = this.position();
    const s = this.shop();
    return p && s ? haversineKm(s.lat, s.lng, p.lat, p.lng) : null;
  });
  protected readonly outside = computed(() => {
    const d = this.distanceKm();
    const r = this.radiusKm();
    return d !== null && r !== null && d > r;
  });

  /** Two-way binding target for the map (signal getter/setter pair). */
  protected get position$(): LatLng {
    return this.position()!;
  }
  protected set position$(p: LatLng) {
    this.position.set(p);
  }

  ngOnInit() {
    this.shopService.loadSettings().subscribe({
      next: (s) => {
        const id = this.id();
        if (!id) {
          // Start at the restaurant; most customers are nearby.
          this.position.set({ lat: s.shopLatitude, lng: s.shopLongitude });
          this.useCurrentLocation(true);
          return;
        }
        this.customer.addresses().subscribe((list) => {
          const a = list.find((x) => x.id === id);
          if (!a) {
            this.router.navigateByUrl('/addresses');
            return;
          }
          this.position.set({ lat: a.latitude, lng: a.longitude });
          this.addressText = a.addressText;
          this.label.set(a.label);
          this.isDefault = a.isDefault;
        });
      },
      error: (e) => this.error.set(apiError(e)),
    });
  }

  useCurrentLocation(silent = false) {
    if (!('geolocation' in navigator)) {
      if (!silent) this.toast.show('Location is not available on this device', 'error');
      return;
    }
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.locating.set(false);
        this.position.set({ lat: round6(pos.coords.latitude), lng: round6(pos.coords.longitude) });
      },
      () => {
        this.locating.set(false);
        if (!silent) this.toast.show('Could not get your location — drag the pin instead', 'error');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  save() {
    const p = this.position();
    if (!p) return;
    this.busy.set(true);
    this.error.set('');
    const body = { addressText: this.addressText.trim(), latitude: p.lat, longitude: p.lng, label: this.label(), isDefault: this.isDefault };
    const id = this.id();
    const req = id ? this.customer.updateAddress(id, body) : this.customer.createAddress(body);
    req.subscribe({
      next: () => {
        this.toast.show('Address saved');
        this.router.navigateByUrl(this.returnUrl() || '/addresses');
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(apiError(e)); // e.g. "outside our delivery area" from the server
      },
    });
  }
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
