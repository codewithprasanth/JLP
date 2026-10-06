import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiError } from '../../core/http-error';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-wrap">
      <h1>Login or sign up</h1>
      <p class="muted">Enter your email address. We'll send you a 6-digit code — no password needed.</p>
      <form class="stack card" (ngSubmit)="submit()">
        <label class="field">
          Email address
          <input
            name="email"
            type="email"
            inputmode="email"
            autocomplete="email"
            autocapitalize="off"
            spellcheck="false"
            maxlength="254"
            placeholder="you@example.com"
            [ngModel]="email()"
            (ngModelChange)="email.set($event)"
            required
          />
        </label>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <button class="btn btn-block" type="submit" [disabled]="!valid() || busy()">
          {{ busy() ? 'Sending…' : 'Send code' }}
        </button>
        <p class="muted small consent">
          By continuing you agree to our <a routerLink="/terms">Terms of Service</a> and
          <a routerLink="/privacy">Privacy Policy</a>.
        </p>
      </form>
    </div>
  `,
  styles: `.auth-wrap { max-width: 420px; margin: 1.5rem auto; } .consent { margin: 0; text-align: center; }`,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly returnUrl = input<string>('/');
  protected readonly email = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected normalized = () => this.email().trim().toLowerCase();
  protected valid = () => EMAIL_RE.test(this.normalized());

  submit() {
    if (!this.valid()) {
      this.error.set('Enter a valid email address');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const email = this.normalized();
    this.auth.sendOtp(email).subscribe({
      next: (r) =>
        this.router.navigate(['/verify-otp'], {
          queryParams: { email, returnUrl: this.returnUrl(), resendIn: r.resendInSeconds },
        }),
      error: (e) => {
        this.error.set(apiError(e));
        this.busy.set(false);
      },
    });
  }
}
