import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiError } from '../../core/http-error';

@Component({
  selector: 'app-admin-login',
  imports: [FormsModule],
  template: `
    <div class="wrap">
      <h1>JLP Admin</h1>
      <p class="muted">Jinisha Lovely Products — restaurant panel</p>
      <form class="card stack" (ngSubmit)="submit()">
        <label class="field">Username
          <input name="username" [(ngModel)]="username" autocomplete="username" required />
        </label>
        <label class="field">Password
          <input name="password" type="password" [(ngModel)]="password" autocomplete="current-password" required />
        </label>
        @if (error()) { <p class="error">{{ error() }}</p> }
        <button class="btn btn-block" type="submit" [disabled]="busy() || !username || !password">
          {{ busy() ? 'Signing in…' : 'Log in' }}
        </button>
      </form>
    </div>
  `,
  styles: `.wrap { max-width: 380px; margin: 12vh auto 0; padding: 0 1rem; }`,
})
export class AdminLogin {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly returnUrl = input<string>('/');
  protected username = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  submit() {
    this.busy.set(true);
    this.error.set('');
    this.auth.login(this.username.trim(), this.password).subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl() || '/'),
      error: (e) => {
        this.busy.set(false);
        this.password = '';
        this.error.set(apiError(e));
      },
    });
  }
}
