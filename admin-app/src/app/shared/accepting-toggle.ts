import { Component, inject, model, signal } from '@angular/core';
import { AdminApi } from '../core/admin-api.service';
import { apiError } from '../core/http-error';
import { ToastService } from '../core/toast.service';

/** The live "Accepting orders" switch — writes settings.is_accepting_orders immediately. */
@Component({
  selector: 'app-accepting-toggle',
  template: `
    <label class="switch">
      <input type="checkbox" [checked]="value()" [disabled]="busy()" (change)="toggle($any($event.target).checked)" />
      <span class="track"></span>
      <span>{{ value() ? 'Accepting orders' : 'Not accepting orders' }}</span>
    </label>
  `,
})
export class AcceptingToggle {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);

  readonly value = model.required<boolean>();
  protected readonly busy = signal(false);

  toggle(next: boolean) {
    this.busy.set(true);
    this.value.set(next); // optimistic, so a failure below is a real signal change that re-binds the checkbox
    this.api.updateSettings({ isAcceptingOrders: next }).subscribe({
      next: (s) => {
        this.value.set(s.isAcceptingOrders);
        this.busy.set(false);
        this.toast.show(s.isAcceptingOrders ? 'Now accepting orders' : 'Orders paused — customers see a "closed" banner');
      },
      error: (e) => {
        this.busy.set(false);
        this.value.set(!next);
        this.toast.show(apiError(e), 'error');
      },
    });
  }
}
