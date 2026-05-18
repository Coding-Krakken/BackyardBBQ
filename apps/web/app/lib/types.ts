export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  basePriceCents: number;
  imageUrl: string | null;
  category: string;
  customizations?: unknown;
  isFeatured?: boolean;
}

export interface CartItem {
  menuItemId: string;
  name: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  customizations: Array<{ name: string; priceCents: number }>;
  notes: string;
}

export interface Address {
  id?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  isDefault?: boolean;
}

export interface PaymentSummary {
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
}

export interface Order {
  id: string;
  customerId?: string;
  status: string;
  fulfillmentMode: "pickup" | "delivery";
  fulfillmentTime?: string;
  notes?: string;
  items: CartItem[];
  payment: PaymentSummary;
  createdAt: string;
}

export interface CateringInquiry {
  id?: string;
  eventDate: string;
  guestCount: number;
  packageTier: string;
  eventType?: string;
  contactName: string;
  email: string;
  phone: string;
  notes?: string;
}

export interface Reservation {
  id?: string;
  name: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  partySize: number;
  occasion?: string;
  specialRequests?: string;
}

export interface CustomerProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  addresses: Address[];
}
