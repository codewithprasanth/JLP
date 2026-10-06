import { HttpErrorResponse } from '@angular/common/http';

/** Human-readable message from an API error ({ error: string } bodies). */
export function apiError(err: unknown, fallback = 'Something went wrong, please try again'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Cannot reach the server — check your connection';
    if (typeof err.error?.error === 'string') return err.error.error;
  }
  return fallback;
}

export function apiErrorCode(err: unknown): string | undefined {
  return err instanceof HttpErrorResponse ? err.error?.code : undefined;
}
