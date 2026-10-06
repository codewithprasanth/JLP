export type OrderStatus = 'PLACED' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface SendOtpResponse {
  success: boolean;
  expiresInSeconds: number;
  resendInSeconds: number;
}

export interface VerifyOtpResponse extends Tokens {
  isNewUser: boolean;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isAvailable: boolean;
}

export interface PublicSettings {
  isAcceptingOrders: boolean;
  minOrderValue: string;
  deliveryRadiusKm: string;
  shopLatitude: number;
  shopLongitude: number;
}

export interface Profile {
  id: string;
  email: string; // verified login identity (Addendum 1)
  name: string;
  phone: string | null; // delivery contact only — collected at profile setup
}

export interface Address {
  id: string;
  addressText: string;
  latitude: number;
  longitude: number;
  label: string;
  isDefault: boolean;
}

export type AddressInput = Omit<Address, 'id' | 'isDefault'> & { isDefault?: boolean };

export interface OrderSummary {
  id: string;
  status: OrderStatus;
  totalAmount: string;
  itemCount: number;
  isPaid: boolean;
  createdAt: string;
  cancellableUntil: string | null;
}

export interface OrderDetail extends OrderSummary {
  deliveryAddressText: string;
  distanceKm: string;
  cancelReason: string | null;
  paymentMethod: 'COD';
  items: { id: string; menuItemId: string; name: string; price: string; quantity: number; lineTotal: string }[];
  statusHistory: { status: OrderStatus; actor: 'CUSTOMER' | 'ADMIN' | 'SYSTEM'; note: string | null; changedAt: string }[];
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: 'Placed',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};
