import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/** Attaches the access token; on 401 refreshes once and retries. Never loops. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // Auth endpoints (login, refresh, logout) never carry or refresh tokens.
  if (!req.url.startsWith(environment.apiBase) || req.url.includes('/auth/')) return next(req);

  const withToken = (r: HttpRequest<unknown>, token: string | null) =>
    token ? r.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : r;

  return next(withToken(req, auth.getAccessToken())).pipe(
    catchError((err) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || !auth.isLoggedIn()) {
        return throwError(() => err);
      }
      return auth.refresh().pipe(
        catchError(() => {
          auth.expireSession();
          return throwError(() => err);
        }),
        switchMap((token) => next(withToken(req, token))),
      );
    }),
  );
};
