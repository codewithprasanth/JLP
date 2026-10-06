import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { OrderFeed } from '../../core/order-feed.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="topbar">
      <a routerLink="/" class="brand" title="Jinisha Lovely Products"><span class="logo">JLP</span> Admin</a>
      <nav>
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
        <a routerLink="/orders" routerLinkActive="active">Orders
          @if (feed.newCount() > 0) { <span class="pill">{{ feed.newCount() }}</span> }
        </a>
        <a routerLink="/menu" routerLinkActive="active">Menu</a>
        <a routerLink="/categories" routerLinkActive="active">Categories</a>
        <a routerLink="/reports" routerLinkActive="active">Reports</a>
        <a routerLink="/settings" routerLinkActive="active">Settings</a>
      </nav>
      <span class="spacer"></span>
      @if (!feed.connected()) {
        <span class="offline" title="Order updates paused — retrying every 10s">● Offline</span>
      }
      <button class="btn btn-link light" (click)="auth.logout()">Log out</button>
    </header>
    <main class="container">
      <router-outlet />
    </main>
  `,
  styles: `
    .topbar { position: sticky; top: 0; z-index: 1000; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
      padding: 0.5rem 1rem; background: var(--brand); color: #fff; }
    .brand { color: #fff; font-weight: 700; text-decoration: none; white-space: nowrap; display: flex; align-items: center; gap: 0.45rem; }
    .logo { background: #fff; color: var(--brand); font-weight: 800; font-size: 0.8rem; letter-spacing: 0.04em; padding: 0.25rem 0.4rem; border-radius: 7px; }
    nav { display: flex; gap: 0.15rem; flex-wrap: wrap; }
    nav a { color: rgb(255 255 255 / 82%); text-decoration: none; padding: 0.4rem 0.65rem; border-radius: 8px; font-size: 0.92rem; }
    nav a.active { color: #fff; background: rgb(255 255 255 / 16%); }
    .pill { background: #fff; color: var(--accent); font-weight: 700; font-size: 0.72rem; border-radius: 999px; padding: 0.05rem 0.45rem; margin-left: 0.2rem; }
    .offline { color: #ffd3c9; font-size: 0.85rem; font-weight: 600; }
    .light { color: #fff; }
  `,
})
export class Shell implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly feed = inject(OrderFeed);

  ngOnInit() {
    this.feed.start();
  }

  ngOnDestroy() {
    this.feed.stop();
  }
}
