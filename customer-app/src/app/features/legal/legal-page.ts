import { Component, OnInit, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BUSINESS } from '../../core/business';
import { ShopService } from '../../core/shop.service';
import { LEGAL_DOCS, LegalDocKey } from './legal-content';
import { LEGAL_LINKS } from './legal-links';

/** Renders one legal document; which one comes from the route's `doc` data. */
@Component({
  selector: 'app-legal-page',
  imports: [RouterLink],
  template: `
    @if (doc(); as d) {
      <article class="legal">
        <h1>{{ d.title }}</h1>
        <p class="muted small">Last updated: {{ business.legal.lastUpdated }}</p>
        @if (business.legal.isDraft) {
          <p class="draft small">This is a draft and may change.</p>
        }
        <p>{{ fill(d.intro) }}</p>
        @for (s of d.sections; track s.heading) {
          <h2>{{ s.heading }}</h2>
          @for (p of s.paragraphs ?? []; track $index) {
            <p>{{ fill(p) }}</p>
          }
          @if (s.bullets?.length) {
            <ul>
              @for (b of s.bullets; track $index) {
                <li>{{ fill(b) }}</li>
              }
            </ul>
          }
        }
        <p class="muted small more">
          See also:
          @for (l of otherLinks(); track l.path; let last = $last) {
            <a [routerLink]="l.path">{{ l.label }}</a>{{ last ? '' : ' · ' }}
          }
        </p>
      </article>
    }
  `,
  styles: `
    .legal { max-width: 680px; }
    .legal h2 { font-size: 1.05rem; margin: 1.4rem 0 0.4rem; }
    .legal p, .legal li { line-height: 1.6; }
    .legal ul { padding-left: 1.2rem; margin: 0.3rem 0; }
    .legal li { margin: 0.25rem 0; }
    .draft { background: var(--warn-bg); color: var(--warn-fg); padding: 0.4rem 0.7rem; border-radius: 8px; display: inline-block; }
    .more { margin-top: 2rem; }
  `,
})
export class LegalPage implements OnInit {
  private readonly shop = inject(ShopService);
  protected readonly business = BUSINESS;

  /** Bound from route data via withComponentInputBinding. */
  readonly docKey = input.required<LegalDocKey>({ alias: 'doc' });
  protected readonly doc = computed(() => LEGAL_DOCS[this.docKey()]);
  protected readonly otherLinks = computed(() => LEGAL_LINKS.filter((l) => l.key !== this.docKey()));

  ngOnInit() {
    if (!this.shop.settings()) this.shop.loadSettings().subscribe({ error: () => {} });
  }

  /** Live values from admin Settings, so the policy never contradicts the app. */
  protected fill(text: string): string {
    const s = this.shop.settings();
    return text
      .replaceAll('{radius}', s ? String(Number(s.deliveryRadiusKm)) : '—')
      .replaceAll('{minOrder}', s ? String(Number(s.minOrderValue)) : '—');
  }
}

