import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CustomerService } from '../../core/customer.service';
import { apiError } from '../../core/http-error';
import { isIndianMobile, normalizeIndianMobile } from '../../core/phone';

/**
 * Shown right after a new customer's first email-OTP login (and again if they left it
 * unfinished). Addendum 1: phone is required here, but only as delivery contact info.
 */
@Component({
  selector: 'app-profile-setup',
  imports: [FormsModule],
  template: `
    <div class="wrap">
      <h1>Welcome! 👋</h1>
      <p class="muted">Just two details so the restaurant knows who the order is for and how to reach you.</p>
      <form class="card stack" (ngSubmit)="save()">
        <label class="field">
          Name
          <input name="name" [(ngModel)]="name" autocomplete="name" maxlength="80" required />
        </label>
        <label class="field">
          Mobile number <span class="muted small">(for delivery — we won't send SMS)</span>
          <div class="phone">
            <span class="cc">+91</span>
            <input
              name="phone"
              type="tel"
              inputmode="numeric"
              autocomplete="tel-national"
              maxlength="16"
              placeholder="98765 43210"
              [ngModel]="phone"
              (ngModelChange)="phone = digitsOnly($event)"
              required
            />
          </div>
        </label>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <button class="btn btn-block" type="submit" [disabled]="!valid() || busy()">Continue</button>
      </form>
    </div>
  `,
  styles: `
    .wrap { max-width: 420px; margin: 1.5rem auto; }
    .phone { display: flex; gap: 0.5rem; }
    .cc { display: grid; place-items: center; padding: 0 0.8rem; border: 1px solid var(--border); border-radius: 10px; background: #fff; font-weight: 600; }
  `,
})
export class ProfileSetup implements OnInit {
  private readonly customer = inject(CustomerService);
  private readonly router = inject(Router);

  readonly returnUrl = input<string>('/');
  protected name = '';
  protected phone = '';
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected digitsOnly = normalizeIndianMobile;
  protected valid = () => this.name.trim().length > 0 && isIndianMobile(this.phone);

  ngOnInit() {
    // Pre-fill whatever was saved if they left this screen half-way last time.
    this.customer.profile().subscribe((p) => {
      this.name ||= p.name;
      this.phone ||= p.phone ?? '';
    });
  }

  save() {
    if (!this.valid()) {
      this.error.set('Enter your name and a valid 10-digit mobile number');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.customer.updateProfile({ name: this.name.trim(), phone: this.phone }).subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl() || '/'),
      error: (e) => {
        this.busy.set(false);
        this.error.set(apiError(e));
      },
    });
  }
}
