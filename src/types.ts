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
  pricePerDay: number; // in EUR
  powerType: "Elektrisch" | "Diesel" | "Hybride";
  imageUrl: string;
  imageAlt: string;
  description: string;
  suitableFor: string[];
  weeklyDiscountPercent?: number; // 7+ days discount %
  monthlyDiscountPercent?: number; // 30+ days discount %
  campaignText?: string; // campaign tag, e.g., "LenteKorting"
  campaignDiscountPercent?: number; // campaign discount %
  campaignDiscountAmount?: number; // campaign discount EUR amount
  packageContents?: string; // Semicolon separated included items checklist
  additionalImages?: string[];
}

export type DeliveryType = "self_pickup" | "delivery_with_driver";

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
  addons?: { id: string; name: string; price: number; billing: "daily" | "flat" }[];
}

export interface ChatMessage {
  id: string;
  sender: "user" | "advisor";
  text: string;
  timestamp: string;
  recommendedMachineIds?: string[];
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


