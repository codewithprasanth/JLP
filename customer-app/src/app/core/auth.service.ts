import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, map, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { SendOtpResponse, Tokens, VerifyOtpResponse } from './models';
import { readStore, writeStore } from './storage';

const ACCESS_KEY = 'fo.access';
const REFRESH_KEY = 'fo.refresh';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base = `${environment.apiBase}/customer/auth`;

  private accessToken: string | null = readStore(ACCESS_KEY);
  private readonly refreshToken = signal<string | null>(readStore(REFRESH_KEY));
  private refreshInFlight: Observable<string> | null = null;

  /** A session exists while we hold a refresh token; the access token may be renewed silently. */
  readonly isLoggedIn = computed(() => this.refreshToken() !== null);

  sendOtp(email: string) {
    return this.http.post<SendOtpResponse>(`${this.base}/send-otp`, { email });
  }

  verifyOtp(email: string, otp: string) {
    return this.http.post<VerifyOtpResponse>(`${this.base}/verify-otp`, { email, otp }).pipe(tap((t) => this.setSession(t)));
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Single-flight refresh: concurrent 401s share one refresh request instead of
   * each rotating (and invalidating) the refresh token.
   */
  refresh(): Observable<string> {
    const token = this.refreshToken();
    if (!token) return throwError(() => new Error('No session'));
    this.refreshInFlight ??= this.http.post<Tokens>(`${this.base}/refresh`, { refreshToken: token }).pipe(
      tap((t) => this.setSession(t)),
      map((t) => t.accessToken),
      finalize(() => (this.refreshInFlight = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight;
  }

  logout() {
    const token = this.refreshToken();
    this.clearSession();
    if (token) this.http.post(`${this.base}/logout`, { refreshToken: token }).subscribe({ error: () => {} });
    this.router.navigateByUrl('/');
  }

  /** Called when the refresh token itself is rejected. */
  expireSession() {
    this.clearSession();
    this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
  }

  private setSession(t: Tokens) {
    this.accessToken = t.accessToken;
    this.refreshToken.set(t.refreshToken);
    writeStore(ACCESS_KEY, t.accessToken);
    writeStore(REFRESH_KEY, t.refreshToken);
  }

  private clearSession() {
    this.accessToken = null;
    this.refreshToken.set(null);
    writeStore(ACCESS_KEY, null);
    writeStore(REFRESH_KEY, null);
  }
}
