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
  weekendPrice?: number; // weekend package flat price (Vrijdagmiddag ophalen t/m Maandagochtend 08:00). Legacy: sat+sun 2-day when weekendRulesEnabled is false.
  twoDayPrice?: number; // flat rate for exactly 2 weekday days (distinct from weekend package weekendPrice)
  threeDayPrice?: number; // flat rate for exactly 3 days (falls back to weeklyPrice when unset)
  fourDayPrice?: number; // flat rate for exactly 4 days (falls back to weeklyPrice when unset)
  weeklyPrice?: number; // flat rate for 5-day werkweek booking (base for 6-27 day pricing: weeklyPrice + extra days)
  extraDayPrice?: number; // flat rate per day beyond the 5-day werkweek (6-27 days), added on top of weeklyPrice. Falls back to weeklyPrice/5 when unset.
  monthlyPrice?: number; // flat rate for 28-day booking
  sundayBlockFee?: number; // surcharge added when a rental's last work day is Saturday and the machine is held over the closed Sunday (return Monday). Requires weekendRulesEnabled. Convention: set to (threeDayPrice − twoDayPrice) so Fri+Sat = weekday 3-day price.
  weekendRulesEnabled?: boolean; // depot closed Sat+Sun: enables weekend package + automatic Sunday block. On for the mast & scissor-lift groups; off for Nifty 120/170, Hinowa, ladderlift, kamersteigers, Pecolift.
  packageContents?: string; // Semicolon separated included items checklist
  additionalImages?: string[];
  specs?: { label: string; value: string }[];
  isActive?: boolean;
  showInWeeklyOffers?: boolean; // display in "Weekaanbiedingen" section on catalog
  bufferDays?: number; // 0=no buffer, 1=1-day maintenance buffer after each rental
  minRentalDays?: number; // minimum billable rental length in days (e.g. 7 = 1 week)
  weeklyOnly?: boolean; // bill per started week (weeklyPrice = price/week), ignore daily/2-day/monthly tiers
  pickupOnly?: boolean; // only "Afhalen" logistics offered — no delivery / trailer
  stockQuantity?: number; // physical units of this exact row available for overlapping bookings; default 1
  crossSellAddons?: CrossSellAddon[]; // product-specific optional extras shown in the cart
  isRetired?: boolean; // permanent out-of-fleet flag (admin-set), distinct from isActive (catalog visibility)
  operationallyBlocked?: boolean; // computed server-side: isRetired OR an unresolved DamageReport OR an open MaintenanceEvent — never bookable regardless of stock/dates
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

export type DeliveryType = "self_pickup" | "delivery_by_us" | "trailer_rental";

export type OrderStatus = "In behandeling" | "Goedgekeurd" | "Onderweg" | "Retour" | "Schade gemeld" | "Voltooid" | "Geannuleerd";

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
  // Aantal dagen dat de klant de aanhanger huurt (alleen bij trailer_rental).
  trailerDays?: number | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerProfile: string; // e.g., "Schilder", "Aannemer", "Particulier", etc.
  poNumber?: string | null; // optional customer purchase-order reference, shown on invoice
  subtotal: number;
  transportCost: number;
  driverCost: number;
  vatAmount: number;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  addons?: { id: string; name: string; price: number; billing: "daily" | "flat" | "weekly"; quantity?: number }[];
  weekendWork?: "ja" | "nee" | null;
  invoiceNumber?: string;
  paymentStatus?: string;
  // Door de klant gekozen betaalwijze bij het afrekenen: "link" = online iDEAL/
  // Tikkie-betaallink (admin stuurt een link), "on_location" = betalen bij ophalen/
  // levering. Null/leeg voor legacy-orders van vóór deze keuze (behandeld als "link").
  paymentMethod?: "link" | "on_location";
  // Admin-voorgestelde herplan-datums (ISO). Beide leeg = geen openstaand voorstel.
  proposedStartDate?: string | null;
  proposedEndDate?: string | null;
  proposedAt?: string | null;
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
  emailOptIn?: boolean;
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


