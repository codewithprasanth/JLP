import { Routes } from '@angular/router';
import { adminAuthGuard } from './core/admin-auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login').then((m) => m.AdminLogin) },
  {
    path: '',
    canActivate: [adminAuthGuard],
    loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard) },
      { path: 'orders', loadComponent: () => import('./features/orders-queue/orders-queue').then((m) => m.OrdersQueue) },
      { path: 'orders/:id', loadComponent: () => import('./features/order-detail/order-detail').then((m) => m.OrderDetail) },
      { path: 'menu', loadComponent: () => import('./features/menu-list/menu-list').then((m) => m.MenuList) },
      { path: 'menu/new', loadComponent: () => import('./features/menu-item-form/menu-item-form').then((m) => m.MenuItemForm) },
      { path: 'menu/:id/edit', loadComponent: () => import('./features/menu-item-form/menu-item-form').then((m) => m.MenuItemForm) },
      { path: 'categories', loadComponent: () => import('./features/categories/categories').then((m) => m.Categories) },
      { path: 'settings', loadComponent: () => import('./features/settings/settings').then((m) => m.SettingsPage) },
      { path: 'reports', loadComponent: () => import('./features/sales-report/sales-report').then((m) => m.SalesReportPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
