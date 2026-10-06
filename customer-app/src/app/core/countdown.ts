import { DestroyRef, Signal, computed, inject, signal } from '@angular/core';

/**
 * Seconds remaining until `deadline` (ISO string), ticking every second.
 * Must be called in an injection context; the timer stops on destroy.
 */
export function countdownTo(deadline: Signal<string | null>): Signal<number> {
  const now = signal(Date.now());
  const id = setInterval(() => now.set(Date.now()), 1000);
  inject(DestroyRef).onDestroy(() => clearInterval(id));
  return computed(() => {
    const d = deadline();
    return d ? Math.max(0, Math.round((new Date(d).getTime() - now()) / 1000)) : 0;
  });
}
