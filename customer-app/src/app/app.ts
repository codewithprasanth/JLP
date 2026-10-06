import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BUSINESS } from './core/business';
import { LEGAL_LINKS } from './features/legal/legal-links';
import { AuthService } from './core/auth.service';
import { CartService } from './core/cart.service';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly cart = inject(CartService);
  protected readonly toast = inject(ToastService);
  protected readonly business = BUSINESS;
  protected readonly legalLinks = LEGAL_LINKS;
  protected readonly year = new Date().getFullYear();
}
