export type OrderStatus = 'PLACED' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface DashboardSummary {
  date: string;
  todayOrders: number;
  pendingOrders: number;
  newOrders: number;
  revenueToday: string;
  collectedToday: string;
  unpaidDeliveredToday: number;
  isAcceptingOrders: boolean;
}

export interface AdminOrderRow {
  id: string;
  status: OrderStatus;
  totalAmount: string;
  itemCount: number;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string;
  isNew: boolean;
}

export interface AdminOrderDetail {
  id: string;
  status: OrderStatus;
  totalAmount: string;
  itemCount: number;
  isPaid: boolean;
  createdAt: string;
  customerName: string;
  customerPhone: string | null; // contact only (unverified) — Addendum 1
  customerEmail: string; // verified login email
  deliveryAddressText: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  distanceKm: string;
  cancelReason: string | null;
  allowedTransitions: OrderStatus[];
  items: { id: string; name: string; price: string; quantity: number; lineTotal: string }[];
  statusHistory: { status: OrderStatus; actor: 'CUSTOMER' | 'ADMIN' | 'SYSTEM'; by: string | null; note: string | null; changedAt: string }[];
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  itemCount: number;
}

export interface AdminMenuItem {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isAvailable: boolean;
}

export interface Settings {
  shopLatitude: number;
  shopLongitude: number;
  deliveryRadiusKm: number;
  minOrderValue: string;
  isAcceptingOrders: boolean;
  updatedAt: string;
}

export interface SalesReport {
  from: string;
  to: string;
  totalOrders: number;
  cancelledOrders: number;
  totalRevenue: string;
  collectedRevenue: string;
  dailyBreakdown: { day: string; orders: number; cancelled: number; revenue: string; collected: string }[];
  topItems: { name: string; quantity: number; revenue: string }[];
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: 'New',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** Button text for moving an order INTO a status. */
export const ACTION_LABEL: Record<OrderStatus, string> = {
  PLACED: 'Placed',
  CONFIRMED: 'Confirm',
  PREPARING: 'Start preparing',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Mark delivered',
  CANCELLED: 'Reject',
};
