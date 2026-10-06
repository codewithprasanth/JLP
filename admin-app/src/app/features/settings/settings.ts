import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../../core/admin-api.service';
import { apiError } from '../../core/http-error';
import { ToastService } from '../../core/toast.service';
import { AcceptingToggle } from '../../shared/accepting-toggle';
import { LatLng, MapPicker } from '../../shared/map-picker';

/** Everything that would otherwise be hardcoded — changes apply without a deploy. */
@Component({
  selector: 'app-settings',
  imports: [AcceptingToggle, FormsModule, MapPicker],
  template: `
    <h1>Settings</h1>
    @if (shop(); as pos) {
      <div class="layout">
        <div class="card stack">
          <h2>Restaurant location</h2>
          <p class="muted small">Drag the pin to your shop's entrance. The circle shows the delivery area.</p>
          <app-map-picker [(position)]="shopPos" [radiusKm]="radius" [shop]="pos" [showShopIcon]="false" [fitToRadius]="true" />
          <span class="muted small">{{ pos.lat.toFixed(6) }}, {{ pos.lng.toFixed(6) }}</span>
        </div>

        <form class="card stack" (ngSubmit)="save()">
          <h2>Ordering</h2>
          <app-accepting-toggle [(value)]="accepting" />
          <label class="field">Delivery radius (km)
            <input name="radius" type="number" min="0.1" max="50" step="0.1" [(ngModel)]="radius" required />
          </label>
          <label class="field">Minimum order value (₹)
            <input name="minOrder" type="number" min="0" step="1" [(ngModel)]="minOrder" required />
          </label>
          <p class="muted small">Changing the location or radius never alters distances already recorded on past orders.</p>
          @if (error()) { <p class="error">{{ error() }}</p> }
          <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save settings' }}</button>
        </form>
      </div>
    } @else {
      <p class="empty">Loading…</p>
    }
  `,
  styles: `
    .layout { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); align-items: start; }
    h2 { margin-top: 0; }
  `,
})
export class SettingsPage implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);

  protected readonly shop = signal<LatLng | null>(null);
  protected readonly accepting = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected radius = 2;
  protected minOrder = 50;

  protected get shopPos(): LatLng {
    return this.shop()!;
  }
  protected set shopPos(p: LatLng) {
    this.shop.set(p);
  }

  ngOnInit() {
    this.api.settings().subscribe({
      next: (s) => {
        this.shop.set({ lat: s.shopLatitude, lng: s.shopLongitude });
        this.radius = s.deliveryRadiusKm;
        this.minOrder = Number(s.minOrderValue);
        this.accepting.set(s.isAcceptingOrders);
      },
      error: (e) => this.error.set(apiError(e)),
    });
  }

  save() {
    const p = this.shop();
    if (!p) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .updateSettings({ shopLatitude: p.lat, shopLongitude: p.lng, deliveryRadiusKm: Number(this.radius), minOrderValue: Number(this.minOrder) })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.toast.show('Settings saved — live for customers now');
        },
        error: (e) => {
          this.busy.set(false);
          this.error.set(apiError(e));
        },
      });
  }
}
