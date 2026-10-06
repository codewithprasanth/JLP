import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { CustomerService } from '../../core/customer.service';
import { apiError } from '../../core/http-error';
import { isIndianMobile, normalizeIndianMobile } from '../../core/phone';
import { Profile } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, RouterLink],
  template: `
    <h1>Profile</h1>
    @if (profile(); as p) {
      <form class="card stack" (ngSubmit)="save()">
        <label class="field">
          Email <span class="muted small">(used to log in)</span>
          <input [value]="p.email" disabled />
        </label>
        <label class="field">
          Name
          <input name="name" [(ngModel)]="name" maxlength="80" required />
        </label>
        <label class="field">
          Mobile number <span class="muted small">(for delivery)</span>
          <div class="phone">
            <span class="cc">+91</span>
            <input name="phone" type="tel" inputmode="numeric" maxlength="16" [ngModel]="phone"
              (ngModelChange)="phone = digitsOnly($event)" required />
          </div>
        </label>
        <button class="btn" type="submit" [disabled]="busy() || !valid()">Save changes</button>
      </form>

      <div class="card row links">
        <a routerLink="/addresses">📍 My addresses</a>
        <span class="spacer"></span>
        <button class="btn btn-outline" (click)="auth.logout()">Log out</button>
      </div>
    } @else {
      <p class="empty">Loading…</p>
    }
  `,
  styles: `
    .links { margin-top: 1rem; }
    .phone { display: flex; gap: 0.5rem; }
    .cc { display: grid; place-items: center; padding: 0 0.8rem; border: 1px solid var(--border); border-radius: 10px; background: #fff; font-weight: 600; }
  `,
})
export class ProfilePage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly customer = inject(CustomerService);
  private readonly toast = inject(ToastService);

  protected readonly profile = signal<Profile | null>(null);
  protected readonly busy = signal(false);
  protected name = '';
  protected phone = '';

  protected digitsOnly = normalizeIndianMobile;
  protected valid = () => this.name.trim().length > 0 && isIndianMobile(this.phone);

  ngOnInit() {
    this.customer.profile().subscribe((p) => this.apply(p));
  }

  save() {
    this.busy.set(true);
    this.customer.updateProfile({ name: this.name.trim(), phone: this.phone }).subscribe({
      next: (p) => {
        this.apply(p);
        this.busy.set(false);
        this.toast.show('Profile updated');
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.show(apiError(e), 'error');
      },
    });
  }

  private apply(p: Profile) {
    this.profile.set(p);
    this.name = p.name;
    this.phone = p.phone ?? '';
  }
}
