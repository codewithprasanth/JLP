import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BUSINESS } from '../../core/business';

@Component({
  selector: 'app-contact',
  imports: [RouterLink],
  template: `
    <h1>Contact us</h1>
    <div class="card stack">
      <div>
        <strong>{{ b.name }}</strong>
        <p class="muted addr">{{ b.address }}</p>
      </div>
      <div class="row-item"><span class="label">Email</span><span>{{ b.email }}</span></div>
      <div class="row-item"><span class="label">Phone</span><span>{{ b.phone ?? 'To be added' }}</span></div>
      <div class="row-item"><span class="label">Hours</span><span>{{ b.hours ?? 'Whenever the app shows we are accepting orders' }}</span></div>
      <div class="row-item"><span class="label">FSSAI Lic. No.</span><span>{{ b.fssai ?? 'Application in progress' }}</span></div>
      <div class="row-item"><span class="label">Grievance Officer</span>
        <span>{{ b.grievanceOfficer.name ?? 'To be appointed' }} · {{ b.grievanceOfficer.email }}</span></div>
    </div>
    <p class="muted small">For a problem with an order, include your order number (shown as #XXXXXXXX in the app).
      See our <a routerLink="/refund-policy">Cancellation &amp; Refund Policy</a>.</p>
  `,
  styles: `
    .addr { margin: 0.25rem 0 0; }
    .row-item { display: flex; flex-direction: column; gap: 0.15rem; border-top: 1px solid var(--border); padding-top: 0.6rem; }
    .label { color: var(--muted); font-size: 0.85rem; }
  `,
})
export class Contact {
  protected readonly b = BUSINESS;
}
