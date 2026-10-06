import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <router-outlet />
    @if (toast.message(); as t) {
      <div class="toast" [class.toast-error]="t.kind === 'error'" role="status">{{ t.text }}</div>
    }
  `,
})
export class App {
  protected readonly toast = inject(ToastService);
}
