/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Machine {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  height: number; // in meters
  reach: number; // in meters
  weight: number; // in kg
  pricePerDay: number; // in EUR — regular day rate (used for multi-day fallback)
  oneDayPrice?: number; // optional 1-day actie price (e.g. "Slechts 1 dag korting!")
  powerType: "Elektrisch" | "Diesel" | "Hybride";
  imageUrl: string;
  imageAlt: string;
  description: string;
  suitableFor: string[];
  weeklyDiscountPercent?: number; // 5+ days discount % (fallback if no weeklyPrice)
  monthlyDiscountPercent?: number; // 28+ days discount % (fallback if no monthlyPrice)
  campaignText?: string; // campaign tag, e.g., "LenteKorting"
  campaignDiscountPercent?: number; // campaign discount %
  campaignDiscountAmount?: number; // campaign discount EUR amount
  weekendPrice?: number; // flat rate for sat+sun 2-day booking
  twoDayPrice?: number; // flat rate for exactly 2 weekday days (distinct from sat+sun weekendPrice)
  weeklyPrice?: number; // flat rate for 5-day werkweek booking
  monthlyPrice?: number; // flat rate for 28-day booking
  packageContents?: string; // Semicolon separated included items checklist
  additionalImages?: string[];
  specs?: { label: string; value: string }[];
  isActive?: boolean;
  bufferDays?: number; // 0=no buffer, 1=1-day maintenance buffer after each rental
  minRentalDays?: number; // minimum billable rental length in days (e.g. 7 = 1 week)
  weeklyOnly?: boolean; // bill per started week (weeklyPrice = price/week), ignore daily/2-day/monthly tiers
  pickupOnly?: boolean; // only "Afhalen" logistics offered — no delivery / trailer
  crossSellAddons?: CrossSellAddon[]; // product-specific optional extras shown in the cart
}

// Optional per-week extra shown only for the machine it belongs to (e.g. Altrex Uitbreidingsset).
export interface CrossSellAddon {
  id: string;
  name: string;
  description?: string;
  pricePerWeek: number; // excl. BTW, charged per started week (same week count as the machine) — default basis
  pricePerDay?: number; // optional flat price for an exactly-1-day rental (non-weekly products only)
  pricePerTwoDay?: number; // optional flat price for an exactly-2-day rental (non-weekly products only)
}

export type DeliveryType = "self_pickup" | "delivery_by_us" | "trailer_rental" | "trailer_drop_return";

export interface Order {
  id: string;
  machineId: string;
  machineName: string;
  machinePrice: number;
  startDate: string;
  endDate: string;
  rentalDays: number;
  deliveryType: DeliveryType;
  deliveryAddress?: string;
  deliveryTimeSlot?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerProfile: string; // e.g., "Schilder", "Aannemer", "Particulier", etc.
  subtotal: number;
  transportCost: number;
  driverCost: number;
  vatAmount: number;
  totalAmount: number;
  status: "In behandeling" | "Goedgekeurd" | "Onderweg" | "Voltooid" | "Geannuleerd";
  createdAt: string;
  addons?: { id: string; name: string; price: number; billing: "daily" | "flat" | "weekly" }[];
  weekendWork?: "ja" | "nee" | null;
  invoiceNumber?: string;
  paymentStatus?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning";
  read: boolean;
  timestamp: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName?: string;
  profileType: string; // e.g., "Schilder", "Hovenier", "Glazenwasser", "Aannemer", "Particulier"
  pastRentalsCount: number;
  avatarUrl?: string;
  address?: string;
  historyRecommendedIds?: string[];
}

export interface CartItem {
  id: string;
  machine: Machine;
  startDate: string;
  endDate: string;
}

export interface CampaignRule {
  id: string;
  name: string;
  scope: "global" | "category" | "product" | "role";
  scopeValue: string; // e.g., category ID, machine ID, or role name
  discountPercent: number;
  isActive: boolean;
}


