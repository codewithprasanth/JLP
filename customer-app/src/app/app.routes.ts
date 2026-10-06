import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  // Browsable without login
  { path: '', title: 'Menu', loadComponent: () => import('./features/home/home').then((m) => m.Home) },
  { path: 'item/:id', title: 'Item', loadComponent: () => import('./features/item-detail/item-detail').then((m) => m.ItemDetail) },
  { path: 'login', title: 'Login', loadComponent: () => import('./features/login/login').then((m) => m.Login) },
  { path: 'verify-otp', title: 'Verify OTP', loadComponent: () => import('./features/otp-verify/otp-verify').then((m) => m.OtpVerify) },

  // Login required
  { path: 'welcome', title: 'Welcome', canActivate: [authGuard], loadComponent: () => import('./features/profile-setup/profile-setup').then((m) => m.ProfileSetup) },
  { path: 'cart', title: 'Cart', canActivate: [authGuard], loadComponent: () => import('./features/cart/cart').then((m) => m.Cart) },
  { path: 'addresses', title: 'My addresses', canActivate: [authGuard], loadComponent: () => import('./features/addresses/address-list').then((m) => m.AddressList) },
  { path: 'addresses/new', title: 'Add address', canActivate: [authGuard], loadComponent: () => import('./features/addresses/address-form').then((m) => m.AddressForm) },
  { path: 'addresses/:id/edit', title: 'Edit address', canActivate: [authGuard], loadComponent: () => import('./features/addresses/address-form').then((m) => m.AddressForm) },
  { path: 'checkout', title: 'Checkout', canActivate: [authGuard], loadComponent: () => import('./features/checkout/checkout').then((m) => m.Checkout) },
  { path: 'order-confirmation/:id', title: 'Order placed', canActivate: [authGuard], loadComponent: () => import('./features/order-confirmation/order-confirmation').then((m) => m.OrderConfirmation) },
  { path: 'orders', title: 'My orders', canActivate: [authGuard], loadComponent: () => import('./features/my-orders/my-orders').then((m) => m.MyOrders) },
  { path: 'orders/:id', title: 'Order', canActivate: [authGuard], loadComponent: () => import('./features/order-detail/order-detail').then((m) => m.OrderDetailPage) },
  { path: 'profile', title: 'Profile', canActivate: [authGuard], loadComponent: () => import('./features/profile/profile').then((m) => m.ProfilePage) },

  // Legal & contact (public)
  { path: 'privacy', title: 'Privacy Policy', data: { doc: 'privacy' }, loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage) },
  { path: 'terms', title: 'Terms of Service', data: { doc: 'terms' }, loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage) },
  { path: 'refund-policy', title: 'Cancellation & Refund Policy', data: { doc: 'refunds' }, loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage) },
  { path: 'delivery-policy', title: 'Delivery Policy', data: { doc: 'delivery' }, loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage) },
  { path: 'contact', title: 'Contact us', loadComponent: () => import('./features/legal/contact').then((m) => m.Contact) },

  { path: '**', redirectTo: '' },
];
