import { Component, ElementRef, OnInit, computed, inject, input, signal, viewChildren } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { countdownTo } from '../../core/countdown';
import { apiError, apiErrorCode } from '../../core/http-error';
import { ToastService } from '../../core/toast.service';

const LENGTH = 6;

@Component({
  selector: 'app-otp-verify',
  imports: [RouterLink],
  template: `
    <div class="auth-wrap">
      <h1>Check your email</h1>
      <p class="muted">Enter the 6-digit code we sent to <strong class="addr">{{ email() }}</strong>.
        <a routerLink="/login" [queryParams]="{ returnUrl: returnUrl() }">Change</a></p>
      <p class="muted small">Can't find it? Check your Spam or Promotions folder.</p>

      <div class="card stack">
        <div class="boxes" (paste)="onPaste($event)">
          @for (d of digits(); track $index) {
            <input
              #box
              type="text"
              inputmode="numeric"
              maxlength="1"
              [attr.autocomplete]="$index === 0 ? 'one-time-code' : 'off'"
              [attr.aria-label]="'Digit ' + ($index + 1)"
              [value]="d"
              (input)="onInput($index, $event)"
              (keydown)="onKeydown($index, $event)"
            />
          }
        </div>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <button class="btn btn-block" (click)="verify()" [disabled]="code().length !== 6 || busy()">
          {{ busy() ? 'Verifying…' : 'Verify' }}
        </button>
        <div class="row">
          @if (resendIn() > 0) {
            <span class="muted small">Resend code in 00:{{ resendIn().toString().padStart(2, '0') }}</span>
          } @else {
            <button class="btn-link btn" (click)="resend()" [disabled]="busy()">Resend code</button>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .auth-wrap { max-width: 420px; margin: 1.5rem auto; }
    .addr { word-break: break-all; }
    .boxes { display: flex; gap: 0.5rem; justify-content: space-between; }
    .boxes input { width: 3rem; height: 3.2rem; text-align: center; font-size: 1.4rem; font-weight: 700; padding: 0; }
  `,
})
export class OtpVerify implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly boxes = viewChildren<ElementRef<HTMLInputElement>>('box');

  readonly email = input<string>('');
  readonly returnUrl = input<string>('/');
  readonly resendInParam = input<string | undefined>(undefined, { alias: 'resendIn' });

  protected readonly digits = signal<string[]>(Array(LENGTH).fill(''));
  protected readonly code = computed(() => this.digits().join(''));
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private readonly resendDeadline = signal<string | null>(null);
  protected readonly resendIn = countdownTo(this.resendDeadline);

  ngOnInit() {
    if (!this.email().includes('@')) {
      this.router.navigateByUrl('/login');
      return;
    }
    this.startCooldown(Number(this.resendInParam() ?? 30));
    setTimeout(() => this.focus(0));
  }

  onInput(i: number, e: Event) {
    const el = e.target as HTMLInputElement;
    const value = el.value.replace(/\D/g, '');
    if (value.length > 1) return this.fill(value); // autofill can drop the whole code into one box
    this.setDigit(i, value);
    el.value = value;
    if (value && i < LENGTH - 1) this.focus(i + 1);
    if (this.code().length === LENGTH) this.verify();
  }

  onKeydown(i: number, e: KeyboardEvent) {
    if (e.key === 'Backspace' && !this.digits()[i] && i > 0) {
      this.setDigit(i - 1, '');
      this.focus(i - 1);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && i > 0) this.focus(i - 1);
    else if (e.key === 'ArrowRight' && i < LENGTH - 1) this.focus(i + 1);
    else if (e.key === 'Enter') this.verify();
  }

  onPaste(e: ClipboardEvent) {
    const text = e.clipboardData?.getData('text') ?? '';
    e.preventDefault();
    this.fill(text);
  }

  verify() {
    if (this.code().length !== LENGTH || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.auth.verifyOtp(this.email(), this.code()).subscribe({
      next: (r) => {
        const added = this.cart.consumePendingAdd();
        if (added) this.toast.show(`${added.name} added to cart`);
        const returnUrl = this.returnUrl() || '/';
        if (r.isNewUser) this.router.navigate(['/welcome'], { queryParams: { returnUrl } });
        else this.router.navigateByUrl(returnUrl);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(apiError(e));
        const code = apiErrorCode(e);
        if (code === 'OTP_TOO_MANY_ATTEMPTS' || code === 'OTP_EXPIRED') this.resendDeadline.set(null);
        this.fill('');
      },
    });
  }

  resend() {
    this.busy.set(true);
    this.error.set('');
    this.auth.sendOtp(this.email()).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.startCooldown(r.resendInSeconds);
        this.toast.show('A new code is on its way to your inbox');
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(apiError(e));
      },
    });
  }

  private fill(text: string) {
    const chars = text.replace(/\D/g, '').slice(0, LENGTH).split('');
    this.digits.set(Array.from({ length: LENGTH }, (_, i) => chars[i] ?? ''));
    this.boxes().forEach((b, i) => (b.nativeElement.value = chars[i] ?? ''));
    this.focus(Math.min(chars.length, LENGTH - 1));
    if (chars.length === LENGTH) this.verify();
  }

  private setDigit(i: number, d: string) {
    this.digits.update((arr) => arr.map((v, idx) => (idx === i ? d : v)));
  }

  private focus(i: number) {
    this.boxes()[i]?.nativeElement.focus();
  }

  private startCooldown(seconds: number) {
    this.resendDeadline.set(new Date(Date.now() + seconds * 1000).toISOString());
  }
}
