/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Machine, Order, DeliveryType, UserProfile, CartItem } from "../types";
import { useAppStore } from "../store/appStore";
import { checkAvailability } from "../utils/availability";
import { calculateItemSubtotal, isStrictWeekend, countWeekendDays, hasSundayBlock, calculateRentalDays, addonPriceForRental, billableWeeks, buildTierDisplay, WeeklyBreakdown, getTransportFees, getGlobalAddons } from "../utils/pricing";

// Global add-ons available on every machine (unless excluded by category — see
// GLOBAL_ADDON_EXCLUDED_CATEGORIES in BookingStep1.tsx / server/routes/orders.ts,
// which must stay in sync). Priced like a weekly cross-sell extra: a flat rate for
// the first started week, +rate for every additional started 7-day block.
// Names/prices come from SiteConfig via getGlobalAddons (admin-editable, defaults
// = historical literals). Mirrored by server/routes/orders.ts — keep identical.
const GLOBAL_ADDON_IDS = ["safety", "rijplaten"] as const;
// qty is the customer-chosen amount (currently only Rijplaten is quantity-based —
// the customer types how many plates they need). Every other global add-on uses qty 1.
function globalAddonLine(id: string, days: number, qty = 1): { id: string; name: string; price: number } {
  const addons = getGlobalAddons(useAppStore.getState().siteConfig);
  const def = addons[id as keyof typeof addons];
  const weeks = billableWeeks(days);
  const price = def.pricePerWeek * weeks * qty;
  const weekSuffix = weeks > 1 ? ` (${weeks}× €${def.pricePerWeek})` : "";
  const name = id === "rijplaten"
    ? `${def.name} (${qty} ${qty === 1 ? "stuk" : "stuks"})${weekSuffix}`
    : `${def.name}${weekSuffix}`;
  return { id, name, price };
}

// Import modular Step components
import { buildWhatsAppUrl } from "../utils/whatsapp";
import BookingStep1 from "./booking/BookingStep1";
import BookingStep2 from "./booking/BookingStep2";
import BookingSuccess from "./booking/BookingSuccess";
import BookingPriceSummary from "./booking/BookingPriceSummary";

type AvailabilityOrder = Pick<Order, "id" | "machineId" | "startDate" | "endDate" | "status">;

const MB_LAT = 52.1398936;
const MB_LON = 4.5166788;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface BookingSectionProps {
  selectedMachine: Machine | null;
  onCreateReservation: (orderData: Partial<Order>) => Promise<Order | null>;
  setActiveTab: (tab: string) => void;
  machines: Machine[];
  onSelectMachine: (machine: Machine | null) => void;
  currentUser: UserProfile | null;
  cartItems?: CartItem[];
  onRemoveCartItem?: (id: string) => void;
  onUpdateCartItemDates?: (id: string, start: string, end: string) => void;
  onClearCart?: () => void;
}

export default function BookingSection({
  selectedMachine,
  onCreateReservation,
  setActiveTab,
  machines,
  onSelectMachine,
  currentUser,
  cartItems = [],
  onRemoveCartItem = () => {},
  onUpdateCartItemDates = () => {},
  onClearCart = () => {}
}: BookingSectionProps) {
  // Booking Stepper state. Twee echte stappen (1: Logistiek, 2: Gegevens); na
  // het plaatsen komt de succespagina. Voorheen was succes de "magische" stap 4
  // (stap 3 werd overgeslagen); nu een expliciete, aaneengesloten constante.
  const TOTAL_STEPS = 2;
  const STEP_SUCCESS = 3;
  const campaignRules = useAppStore((state) => state.campaignRules);
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [successOrders, setSuccessOrders] = useState<Order[]>([]);
  const [whatsappUrl, setWhatsappUrl] = useState<string>("");

  // Address lookup & Inline validation states
  const [validationError, setValidationError] = useState<string | null>(null);
  const [postcode, setPostcode] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [addressSuccessMsg, setAddressSuccessMsg] = useState("");

  // Form Fields State
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState<string>(() => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("delivery_by_us");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [streetName, setStreetName] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>(currentUser ? currentUser.name : "");
  const [customerEmail, setCustomerEmail] = useState<string>(currentUser ? currentUser.email : "");
  const [customerPhone, setCustomerPhone] = useState<string>(currentUser ? currentUser.phone : "");
  const [customerProfile, setCustomerProfile] = useState<string>(currentUser ? currentUser.profileType : "Particulier");
  // Lifted out of BookingStep2 (was local useState there) — that component is
  // conditionally rendered ({step === 2 && <BookingStep2 .../>}) so it fully
  // unmounts when the customer steps back to Logistiek, wiping local state on
  // remount. A guest who'd already confirmed "Doorgaan als gast" and filled in
  // their details was dropped back onto the guest/login choice screen, reading
  // as "all my selections reset to default" even though the underlying form
  // fields (name/email/etc., already lifted) were untouched.
  const [isGuestConfirmed, setIsGuestConfirmed] = useState<boolean>(false);

  // Availability checking state
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [overlappingOrders, setOverlappingOrders] = useState<AvailabilityOrder[]>([]);
  const [blockedDaysList, setBlockedDaysList] = useState<{ machineId: string; date: string; reason?: string }[]>([]);
  const [allOrders, setAllOrders] = useState<AvailabilityOrder[]>([]);
  const [isDateBlocked, setIsDateBlocked] = useState<boolean>(false);
  const [blockingReason, setBlockingReason] = useState<string>("");

  useEffect(() => {
    fetch("/api/blocked-dates")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setBlockedDaysList(data))
      .catch(() => {});
  }, []);

  const lastMachineIdsRef = React.useRef<string>("");

  useEffect(() => {
    const allMachines = cartItems.length > 0
      ? cartItems.map(item => item.machine)
      : (selectedMachine ? [selectedMachine] : []);

    if (allMachines.length === 0) return;

    const leadMachine = allMachines[0];
    const machineIdsKey = allMachines.map(m => m.id).sort().join(",");

    if (machineIdsKey !== lastMachineIdsRef.current) {
      lastMachineIdsRef.current = machineIdsKey;
      if (leadMachine.pickupOnly || leadMachine.category === "aanhanger" || leadMachine.category === "ecolift") {
        setDeliveryType("self_pickup");
      } else {
        setDeliveryType("delivery_by_us");
      }
      // Fetch availability for ALL machines in cart to correctly guard multi-machine bookings
      Promise.all(
        allMachines.map(m =>
          fetch(`/api/orders/availability?machineId=${encodeURIComponent(m.id)}`)
            .then(res => res.ok ? res.json() : [])
            .catch(() => [])
        )
      ).then(results => setAllOrders(results.flat()));
    }
  }, [selectedMachine, cartItems]);

  // Addon / Shopping Cart Options state
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  // Rijplaten is quantity-based — the customer types how many plates they need.
  // Default 4 (one under each wheel); clamped/validated again on the server.
  const [rijplatenQty, setRijplatenQty] = useState<number>(4);
  // Aanhanger huren is dagen-gebaseerd — de klant kiest zelf hoeveel dagen hij de
  // aanhanger houdt (in de praktijk alleen bij ophalen + terugbrengen, niet de hele
  // huurperiode). Start op 0; de klant moet ≥1 kiezen om door te kunnen. Op de
  // server geclampt op [1, rentalDays].
  const [trailerDays, setTrailerDays] = useState<number>(0);

  // Delivery distance & time slot
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number | null>(null);
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState<string>("");

  // Clear stale distance when user switches away from delivery_by_us
  useEffect(() => {
    if (deliveryType !== "delivery_by_us") setDeliveryDistanceKm(null);
  }, [deliveryType]);

  // Wrapper for BookingStep2 textarea — clears PDOK distance on manual edit
  const handleManualAddressChange = useCallback((address: string) => {
    setDeliveryAddress(address);
    setDeliveryDistanceKm(null);
    setStreetName(""); // manual edit overrides the auto-filled street
  }, []);

  const paymentGateway = "whatsapp";

  // Populate data when current user swaps
  useEffect(() => {
    if (currentUser) {
      setCustomerName(currentUser.name);
      setCustomerEmail(currentUser.email);
      setCustomerPhone(currentUser.phone);
      setCustomerProfile(currentUser.profileType);
      setDeliveryAddress(currentUser.address || "");
    } else {
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setCustomerProfile("Particulier");
      setDeliveryAddress("");
    }
  }, [currentUser]);

  // Scroll to top of the page when changing steps
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);


  // Strip " (Unit N)" suffix — same logic as CatalogSection grouping
  const getBaseName = (name: string) => name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "").trim();

  // Real-time capacity and collision checking logic
  const checkRealtimeAvailability = (machineId: string, start: string, end: string) => {
    if (!start || !end) return;
    setValidationError(null);

    const requestedStart = new Date(start).getTime();
    const requestedEnd = new Date(end).getTime();
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTime = new Date(todayStr).getTime();

    if (requestedStart > requestedEnd) {
      setIsAvailable(false);
      setValidationError("De retourdatum moet na de begindatum liggen.");
      return;
    }

    if (requestedStart < todayTime) {
      setIsAvailable(false);
      setValidationError("De begindatum kan niet in het verleden liggen.");
      return;
    }

    const overlaps = allOrders.filter(o => {
      if (o.machineId !== machineId) return false;

      const orderStart = new Date(o.startDate).getTime();
      const orderEnd = new Date(o.endDate).getTime();

      return (requestedStart <= orderEnd && requestedEnd >= orderStart);
    });

    let dateIsBlocked = false;
    let reasonTxt = "";

    // O(1) per-day lookup instead of O(n) find() inside the iteration loop
    const blockedMap = new Map<string, string>(
      blockedDaysList
        .filter((b: any) => b.machineId === machineId)
        .map((b: any) => [b.date as string, (b.reason as string) || "Geblokkeerd door beheerder / Onderhoud"])
    );

    const sDate = new Date(start);
    const eDate = new Date(end);
    let curr = new Date(sDate);
    let safetyCounter = 0;
    while (curr <= eDate && safetyCounter < 1000) {
      safetyCounter++;
      const currStr = curr.toISOString().split('T')[0];
      const reason = blockedMap.get(currStr);
      if (reason !== undefined) {
        dateIsBlocked = true;
        reasonTxt = reason;
        break;
      }
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    setIsDateBlocked(dateIsBlocked);
    setBlockingReason(reasonTxt);

    if (overlaps.length > 0) {
      // Auto-assign: try a sibling unit (same base model, different ID) for this period
      if (selectedMachine) {
        const base = getBaseName(selectedMachine.name);
        const sibling = machines.find(m => {
          if (m.id === machineId) return false;
          if (getBaseName(m.name) !== base) return false;
          const siblingOverlaps = allOrders.filter(o => {
            if (o.machineId !== m.id) return false;
            const os = new Date(o.startDate).getTime();
            const oe = new Date(o.endDate).getTime();
            return requestedStart <= oe && requestedEnd >= os;
          });
          return siblingOverlaps.length === 0;
        });
        if (sibling) {
          onSelectMachine(sibling);
          return;
        }
      }
      setIsAvailable(false);
      setOverlappingOrders(overlaps);
    } else if (dateIsBlocked) {
      setIsAvailable(false);
      setOverlappingOrders([]);
    } else {
      setIsAvailable(true);
      setOverlappingOrders([]);
    }
  };

  const getItemAvailability = (machineId: string, start: string, end: string) => {
    const machine = cartItems.find(item => item.machine.id === machineId)?.machine;
    return checkAvailability(machineId, start, end, allOrders, blockedDaysList, undefined, machine?.bufferDays ?? 0, machine?.stockQuantity ?? 1);
  };

  // Re-run checking whenever days or machine swap
  useEffect(() => {
    if (selectedMachine) {
      checkRealtimeAvailability(selectedMachine.id, startDate, endDate);
    }
  }, [selectedMachine, startDate, endDate, allOrders, blockedDaysList]);

  // Synchronize local startDate and endDate with cart items to trigger availability updates
  useEffect(() => {
    if (cartItems.length > 0) {
      const firstItem = cartItems[0];
      if (firstItem.startDate && firstItem.startDate !== startDate) {
        setStartDate(firstItem.startDate);
      }
      if (firstItem.endDate && firstItem.endDate !== endDate) {
        setEndDate(firstItem.endDate);
      }
    }
  }, [cartItems, startDate, endDate]);

  // Recalculate invoice specifics with weekly, monthly & campaign discounts
  const calculationSummary = () => {
    // If we have cartItems list, use the multi-product calculation!
    if (cartItems) {
      if (cartItems.length === 0) {
        return {
          days: 0,
          rawSubtotal: 0,
          discountAmount: 0,
          discountLabel: "",
          subtotal: 0,
          transport: 0,
          driver: 0,
          addonCost: 0,
          addonDetails: [],
          vat: 0,
          total: 0,
          deliveryType
        };
      }
      // Lead item dates pre-computed for transport/trailer cost (only item[0] pays these)
      const leadCartStart = cartItems[0]?.startDate;
      const leadCartEnd = cartItems[0]?.endDate;
      const leadCartDays = (leadCartStart && leadCartEnd) ? calculateRentalDays(leadCartStart, leadCartEnd) : 1;

      let totalDays = 0;
      let rawSubtotal = 0;
      let discountAmount = 0;
      let subtotal = 0;
      let campaignSavings = 0;

      for (const item of cartItems) {
        // No period picked yet for this item — it contributes nothing to the
        // price until the customer actually selects dates in the calendar.
        if (!item.startDate || !item.endDate) continue;
        const itemStart = item.startDate;
        const itemEnd = item.endDate;
        const start = new Date(itemStart);
        const end = new Date(itemEnd);
        const timeDiff = end.getTime() - start.getTime();
        const days = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1);
        totalDays += days;

        const itemSub = calculateItemSubtotal(item.machine, days, customerProfile, campaignRules, itemStart);
        // Weekly-only products bill per week, not per day — the day-rate "raw" total is
        // meaningless and would surface as a phantom discount, so anchor raw to the subtotal.
        const itemRaw = item.machine.weeklyOnly ? itemSub : item.machine.pricePerDay * days;
        const itemSubNoCampaign = calculateItemSubtotal(
          { ...item.machine, campaignDiscountPercent: undefined, campaignDiscountAmount: undefined } as any,
          days, customerProfile, [], itemStart
        );
        const itemDisc = Math.max(0, itemRaw - itemSub);
        rawSubtotal += itemRaw;
        discountAmount += itemDisc;
        subtotal += itemSub;
        campaignSavings += Math.max(0, itemSubNoCampaign - itemSub);
      }

      const cartFees = getTransportFees(useAppStore.getState().siteConfig);
      const transport = deliveryType === "delivery_by_us" ? cartFees.deliveryFee : 0;
      // Trailer billed per klant-gekozen aantal dagen (niet de huurperiode).
      const trailerCost = deliveryType === "trailer_rental" ? cartFees.trailerPerDay * trailerDays : 0;
      const driver = 0;

      // Forced Sunday block total: when a rental's last work day is Saturday the
      // machine is held over the closed Sunday (return Monday 08:00) — sum the flat
      // sundayBlockFee across cart items so the price summary can surface it.
      const sundayBlockTotal = cartItems.reduce((sum, item) => {
        if (!item.startDate || !item.endDate) return sum;
        const d = calculateRentalDays(item.startDate, item.endDate);
        return hasSundayBlock(item.machine, item.startDate, d) ? sum + (item.machine.sundayBlockFee ?? 0) : sum;
      }, 0);
      const weekendDays = (leadCartStart && leadCartEnd) ? countWeekendDays(leadCartStart, leadCartEnd) : 0;

      // Addon calculation
      let addonCost = 0;
      const addonDetails: { id: string; name: string; price: number }[] = [];

      for (const id of GLOBAL_ADDON_IDS) {
        if (!selectedAddons.includes(id)) continue;
        const line = globalAddonLine(id, totalDays, id === "rijplaten" ? rijplatenQty : 1);
        addonCost += line.price;
        addonDetails.push(line);
      }
      // Product-specific cross-sell extras (billed per started week, same week count as the machine)
      for (const item of cartItems) {
        const cs = item.machine.crossSellAddons;
        if (!cs?.length) continue;
        const itemDays = (item.startDate && item.endDate) ? calculateRentalDays(item.startDate, item.endDate) : 1;
        for (const a of cs) {
          if (selectedAddons.includes(a.id)) {
            const price = addonPriceForRental(a, itemDays, item.machine);
            addonCost += price;
            addonDetails.push({ id: a.id, name: a.name, price });
          }
        }
      }

      const totalExcl = subtotal + transport + trailerCost + driver + addonCost;
      const vat = totalExcl * 0.21;
      const total = totalExcl + vat;

      let discountLabel = "Korting";
      const leadItem = cartItems[0]?.machine;
      const leadStart = leadCartStart;
      if (leadItem) {
        if (totalDays >= 28) discountLabel = "Maandkorting";
        else if (totalDays >= 5) discountLabel = "Weekkorting";
        else if (isStrictWeekend(leadStart, leadCartDays) && leadItem.weekendPrice) discountLabel = "Weekendprijs";
        else if (totalDays === 2 && leadItem.twoDayPrice) discountLabel = "2-Dag Prijs";
        else if (totalDays === 1 && leadItem.oneDayPrice && leadItem.oneDayPrice < leadItem.pricePerDay) discountLabel = "1-Dag Actie";
      }

      const effectiveDailyRate = (!leadItem?.weeklyOnly && totalDays >= 6 && totalDays < 28 && leadItem?.weeklyPrice)
        ? leadItem.weeklyPrice / 5
        : null;

      // Tier label for flat-rate price display (single-item cart only) — shared
      // with the legacy path and unit-tested against calculateItemSubtotal in
      // pricing-display.test.ts so the breakdown can never drift from the real charge.
      let tierLabel: string | null = null;
      let isFlatRate = false;
      let weeklyBreakdown: WeeklyBreakdown | null = null;
      if (cartItems.length === 1 && leadItem) {
        const display = buildTierDisplay(leadItem, totalDays, leadStart);
        tierLabel = display.tierLabel;
        isFlatRate = display.isFlatRate;
        weeklyBreakdown = display.weeklyBreakdown;
      }

      return {
        days: totalDays,
        rawSubtotal,
        discountAmount,
        discountLabel,
        subtotal,
        transport: transport + trailerCost,
        driver,
        addonCost,
        addonDetails,
        vat,
        total,
        deliveryType,
        weekendDays,
        sundayBlockTotal,
        effectiveDailyRate,
        tierLabel,
        isFlatRate,
        weeklyBreakdown,
        campaignSavings
      };
    }

    // Legacy fallback
    if (!selectedMachine) {
      return { days: 0, rawSubtotal: 0, discountAmount: 0, discountLabel: "", subtotal: 0, transport: 0, driver: 0, addonCost: 0, addonDetails: [], vat: 0, total: 0, deliveryType };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    const days = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1);

    const rawSubtotal = selectedMachine.pricePerDay * days;
    const itemSub = calculateItemSubtotal(selectedMachine, days, customerProfile, campaignRules, startDate);
    const itemSubNoCampaign = calculateItemSubtotal(
      { ...selectedMachine, campaignDiscountPercent: undefined, campaignDiscountAmount: undefined } as any,
      days, customerProfile, [], startDate
    );
    const discountAmount = Math.max(0, rawSubtotal - itemSub);
    const campaignSavings = Math.max(0, itemSubNoCampaign - itemSub);

    let discountLabel = "Korting";
    if (days >= 28) {
      discountLabel = "Maandkorting";
    } else if (days >= 5) {
      discountLabel = "Weekkorting";
    } else if (isStrictWeekend(startDate, days) && selectedMachine.weekendPrice) {
      discountLabel = "Weekendprijs";
    } else if (days === 2 && selectedMachine.twoDayPrice) {
      discountLabel = "2-Dag Prijs";
    } else if (days === 1 && selectedMachine.oneDayPrice && selectedMachine.oneDayPrice < selectedMachine.pricePerDay) {
      discountLabel = "1-Dag Actie";
    }

    const subtotal = itemSub;
    const singleFees = getTransportFees(useAppStore.getState().siteConfig);
    const transport = deliveryType === "delivery_by_us" ? singleFees.deliveryFee : 0;
    const trailerCost = deliveryType === "trailer_rental" ? singleFees.trailerPerDay * trailerDays : 0;
    const driver = 0;

    let addonCost = 0;
    const addonDetails: { id: string; name: string; price: number }[] = [];

    for (const id of GLOBAL_ADDON_IDS) {
      if (!selectedAddons.includes(id)) continue;
      const line = globalAddonLine(id, days, id === "rijplaten" ? rijplatenQty : 1);
      addonCost += line.price;
      addonDetails.push(line);
    }

    const totalExcl = subtotal + transport + trailerCost + driver + addonCost;
    const vat = totalExcl * 0.21;
    const total = totalExcl + vat;

    const weekendDays = countWeekendDays(startDate, endDate);
    const sundayBlockTotal = hasSundayBlock(selectedMachine, startDate, days) ? (selectedMachine.sundayBlockFee ?? 0) : 0;
    const effectiveDailyRate = (days >= 6 && days < 28 && selectedMachine.weeklyPrice)
      ? selectedMachine.weeklyPrice / 5
      : null;

    const legacyDisplay = buildTierDisplay(selectedMachine, days, startDate);
    const tierLabel: string | null = legacyDisplay.tierLabel;
    const isFlatRate = legacyDisplay.isFlatRate;
    const weeklyBreakdown: WeeklyBreakdown | null = legacyDisplay.weeklyBreakdown;

    return {
      days,
      rawSubtotal,
      discountAmount,
      discountLabel,
      subtotal,
      transport: transport + trailerCost,
      driver,
      addonCost,
      addonDetails,
      vat,
      total,
      deliveryType,
      weekendDays,
      sundayBlockTotal,
      effectiveDailyRate,
      tierLabel,
      isFlatRate,
      weeklyBreakdown,
      campaignSavings
    };
  };

  const handleAddressLookup = async (e: React.MouseEvent) => {
    e.preventDefault();
    setValidationError(null);
    setAddressSuccessMsg("");
    setStreetName("");

    const cleanPostcode = postcode.trim().replace(/\s+/g, "").toUpperCase();
    const cleanHouse = houseNumber.trim();

    if (!cleanPostcode || !cleanHouse) {
      setValidationError("Voer alstublieft een postcode en huisnummer in.");
      return;
    }

    // Validate Dutch postcode format (4 digits, 2 letters)
    const postcodeRegex = /^[1-9][0-9]{3}[A-Z]{2}$/;
    if (!postcodeRegex.test(cleanPostcode)) {
      setValidationError("Voer alstublieft een geldige Nederlandse postcode in (bijv. 1234 AB).");
      return;
    }

    // Validate that the house number starts with a digit
    const houseNumberRegex = /^\d+/;
    if (!houseNumberRegex.test(cleanHouse)) {
      setValidationError("Voer alstublieft een geldig huisnummer in (moet beginnen met een getal, bijv. 14 of 14A).");
      return;
    }

    setIsSearchingAddress(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      // Use exact postcode filter (fq=postcode:XXXX99XX) so PDOK doesn't fuzzy-match
      // to a different city. Also add huisnummer to the free-text query for best ranking.
      const response = await fetch(
        `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${cleanPostcode}+${encodeURIComponent(cleanHouse)}&fq=type:adres&fq=postcode:${cleanPostcode}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("Systeem kon locatieserver niet bereiken.");
      }

      const data = await response.json();

      if (data && data.response && data.response.docs && data.response.docs.length > 0) {
        const bestDoc = data.response.docs[0];

        // Sanity check: returned postcode must match what the user entered
        const returnedPostcode = (bestDoc.postcode as string | undefined)?.replace(/\s/g, "").toUpperCase();
        if (returnedPostcode && returnedPostcode !== cleanPostcode) {
          setAddressSuccessMsg("");
          setValidationError("Postcode niet gevonden. Controleer of de postcode klopt en probeer opnieuw.");
          return;
        }

        const street = bestDoc.straatnaam || bestDoc.straatnaam_verkort || "";
        const city = bestDoc.woonplaatsnaam || bestDoc.woonplaats || "";
        const resolvedAddress = street && city
          ? `${street} ${cleanHouse}, ${cleanPostcode} ${city}`
          : bestDoc.weergavenaam;
        setDeliveryAddress(resolvedAddress);
        setStreetName(street || "");
        setAddressSuccessMsg(`Gevalideerd adres gevonden: ${resolvedAddress}`);

        // Distance check — parse PDOK centroide_ll "POINT(lon lat)"
        const centroide = bestDoc.centroide_ll as string | undefined;
        if (centroide) {
          const m = centroide.match(/POINT\(([^ ]+) ([^ )]+)\)/);
          if (m) {
            const km = Math.round(haversineKm(parseFloat(m[2]), parseFloat(m[1]), MB_LAT, MB_LON));
            setDeliveryDistanceKm(km > 20 ? km : null);
          }
        }
      } else {
        setAddressSuccessMsg("");
        setValidationError("Adres kon niet automatisch worden gevonden. Controleer de postcode of vul het adres handmatig in.");
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      setAddressSuccessMsg("");
      if (err?.name === "AbortError") {
        setValidationError("Adres opzoeken mislukt (time-out). Vul alstublieft uw adres handmatig in.");
      } else {
        setValidationError("Adres kon niet automatisch worden geverifieerd (netwerkfout). Vul alstublieft uw adres handmatig in.");
      }
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleNextStep = () => {
    setValidationError(null);
    if (step === 1) {
      if (cartItems.length === 0) {
        setValidationError("Selecteer minstens één machine om door te gaan.");
        return;
      }
      // Check that all items in cart are available
      const anyUnavailable = cartItems.some((item) => {
        const av = getItemAvailability(item.machine.id, item.startDate || "", item.endDate || "");
        return !av.available;
      });
      if (anyUnavailable) {
        setValidationError("Eén of meer machines in uw winkelwagen zijn niet beschikbaar voor de gekozen datums.");
        return;
      }
      if (deliveryType === "delivery_by_us" && !deliveryTimeSlot) {
        setValidationError("Kies een gewenst bezorgmoment (ochtend of middag) om door te gaan.");
        return;
      }
      if (deliveryType === "trailer_rental" && trailerDays < 1) {
        setValidationError("Kies bij 'Aanhanger huren' voor hoeveel dagen u de aanhanger meeneemt (minimaal 1 dag).");
        return;
      }
      if (deliveryType === "delivery_by_us" && deliveryDistanceKm !== null && deliveryDistanceKm > 20) {
        setValidationError("Bezorging buiten 20 km is alleen op aanvraag. Neem contact op via WhatsApp.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!customerName || !customerEmail || !customerPhone) {
        setValidationError("U dient alle contactgegevens (Naam, E-mail en Telefoonnummer) in te vullen.");
        return;
      }
      const emailOk = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(customerEmail);
      if (!emailOk) {
        setValidationError("Voer een geldig e-mailadres in (bijv. naam@voorbeeld.nl).");
        return;
      }
      const phoneClean = customerPhone.replace(/[\s\-().+]/g, "");
      if (!/^\d{7,15}$/.test(phoneClean)) {
        setValidationError("Voer een geldig telefoonnummer in (bijv. 06 12345678 of +31 6 12345678).");
        return;
      }
      if (deliveryType === "delivery_by_us" && !deliveryAddress.trim()) {
        setValidationError("Een afleveradres is verplicht bij bezorging door ons.");
        return;
      }
      if (deliveryType === "delivery_by_us" && deliveryDistanceKm !== null && deliveryDistanceKm > 20) {
        setValidationError("Bezorging buiten 20 km is alleen op aanvraag. Vraag een offerte aan via WhatsApp.");
        return;
      }
      handleCreateBooking();
    }
  };

  const handleCreateBooking = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setBookingError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    let firstSuccessfulOrder: Order | null = null;
    const placedOrders: Order[] = [];
    try {
        
        if (cartItems && cartItems.length > 0) {
          for (let i = 0; i < cartItems.length; i++) {
            const item = cartItems[i];
            const start = new Date(item.startDate);
            const end = new Date(item.endDate);
            const timeDiff = end.getTime() - start.getTime();
            const days = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1);

            const itemSubtotal = calculateItemSubtotal(item.machine, days, customerProfile, campaignRules, item.startDate);
            const submitFees = getTransportFees(useAppStore.getState().siteConfig);
            const transport = (deliveryType === "delivery_by_us" && i === 0) ? submitFees.deliveryFee : 0;
            const trailerCost = (deliveryType === "trailer_rental" && i === 0) ? submitFees.trailerPerDay * trailerDays : 0;
            const driver = 0;

            let addonCost = 0;
            const addonsList: { id: string; name: string; price: number; billing: "daily" | "flat" | "weekly"; quantity?: number }[] = [];
            for (const id of GLOBAL_ADDON_IDS) {
              if (!selectedAddons.includes(id)) continue;
              const qty = id === "rijplaten" ? rijplatenQty : 1;
              const line = globalAddonLine(id, days, qty);
              addonCost += line.price;
              addonsList.push({ ...line, billing: "weekly", quantity: qty });
            }
            // Product-specific cross-sell extras (per started week, server recomputes authoritatively)
            for (const a of (item.machine.crossSellAddons ?? [])) {
              if (selectedAddons.includes(a.id)) {
                const price = addonPriceForRental(a, days, item.machine);
                const billing: "daily" | "flat" | "weekly" =
                  !item.machine.weeklyOnly && days === 1 && a.pricePerDay != null && a.pricePerDay > 0 ? "daily"
                  : !item.machine.weeklyOnly && days === 2 && a.pricePerTwoDay != null && a.pricePerTwoDay > 0 ? "flat"
                  : "weekly";
                addonCost += price;
                addonsList.push({ id: a.id, name: a.name, price, billing });
              }
            }

            const itemVat = Math.round((itemSubtotal + transport + trailerCost + driver + addonCost) * 21) / 100;
            const itemTotal = itemSubtotal + transport + trailerCost + driver + addonCost + itemVat;

            const orderObj: Partial<Order> = {
              machineId: item.machine.id,
              machineName: item.machine.name,
              machinePrice: item.machine.pricePerDay,
              startDate: item.startDate,
              endDate: item.endDate,
              rentalDays: days,
              deliveryType,
              deliveryAddress: deliveryType === "self_pickup" ? undefined : deliveryAddress,
              deliveryTimeSlot: deliveryType === "delivery_by_us" ? deliveryTimeSlot || undefined : undefined,
              // Aantal aanhangerdagen alleen op item 0 en alleen bij trailer_rental
              // (mirror van de trailerCost-toewijzing hierboven).
              trailerDays: (deliveryType === "trailer_rental" && i === 0) ? trailerDays : undefined,
              customerName,
              customerEmail,
              customerPhone,
              customerProfile,
              subtotal: itemSubtotal,
              transportCost: transport + trailerCost,
              driverCost: parseFloat(driver.toFixed(2)),
              vatAmount: parseFloat(itemVat.toFixed(2)),
              totalAmount: parseFloat(itemTotal.toFixed(2)),
              addons: addonsList
            };

            const result = await onCreateReservation(orderObj);
            if (result) {
              placedOrders.push(result);
              if (!firstSuccessfulOrder) {
                firstSuccessfulOrder = result;
              }
            }
          }

          if (firstSuccessfulOrder) {
            setSuccessOrders(placedOrders);
            if (paymentGateway === "whatsapp") {
              const checkoutItems: CartItem[] = cartItems.length > 0 ? cartItems : (selectedMachine ? [{
                id: selectedMachine.id,
                machine: selectedMachine,
                startDate: startDate,
                endDate: endDate
              }] : []);
              const orderTotals = {
                days: placedOrders.reduce((s, o) => s + o.rentalDays, 0),
                subtotal: placedOrders.reduce((s, o) => s + o.subtotal, 0),
                transport: placedOrders.reduce((s, o) => s + o.transportCost, 0),
                vat: placedOrders.reduce((s, o) => s + o.vatAmount, 0),
                total: placedOrders.reduce((s, o) => s + o.totalAmount, 0)
              };
              const waUrl = buildWhatsAppUrl(checkoutItems, deliveryType, customerName, customerEmail, customerPhone || undefined, orderTotals);
              setWhatsappUrl(waUrl);
            } else {
              setWhatsappUrl("");
            }
            setSuccessOrder(firstSuccessfulOrder);
            onClearCart();
            setStep(STEP_SUCCESS);
          } else {
            setBookingError("Er is een fout opgetreden bij het verwerken van uw boeking. Controleer uw gegevens en probeer het opnieuw.");
          }
        }
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        } catch (err: any) {
        isSubmittingRef.current = false;
        setIsSubmitting(false);

        if (placedOrders.length > 0) {
          // Partial success: at least one item was placed before the failure.
          // Surface the placed orders so the customer can see confirmation and
          // reach WhatsApp, then explain the remaining item(s) failed.
          setSuccessOrders(placedOrders);
          setSuccessOrder(placedOrders[0]);
          onClearCart();
          setBookingError(
            `Let op: ${placedOrders.length} machine(s) zijn geboekt (${placedOrders.map(o => o.id).join(", ")}), ` +
            `maar ${cartItems.length - placedOrders.length} machine(s) konden niet worden verwerkt. ` +
            `Neem contact op via WhatsApp zodat wij dit kunnen oplossen.`
          );
          setStep(STEP_SUCCESS);
          return;
        }

        const msg: string = err?.message || "";
        if (msg.includes("409") || msg.toLowerCase().includes("conflict") || msg.toLowerCase().includes("gereserveerd")) {
          setBookingError("Deze machine is helaas niet meer beschikbaar op de geselecteerde datums. Kies andere datums.");
        } else if (msg.toLowerCase().includes("geblokkeerde") || msg.toLowerCase().includes("blokkeer")) {
          setBookingError("De geselecteerde periode bevat een geblokkeerde datum. Kies andere datums.");
        } else if (msg) {
          setBookingError(msg);
        } else {
          setBookingError("Er is een technische fout opgetreden. Probeer het over een paar momenten opnieuw.");
        }
      }
  };

  const sums = useMemo(
    () => calculationSummary(),
    // calculationSummary closes over these values — re-run only when they change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cartItems, selectedAddons, rijplatenQty, trailerDays, deliveryType, customerProfile, campaignRules, startDate, endDate]
  );

  // Reservation period for the price summary box — neutral copy when the cart
  // mixes machines booked for different periods.
  const leadCartItem = cartItems[0];
  const mixedCartPeriods = cartItems.length > 1 && cartItems.some(
    (i) => i.startDate !== leadCartItem?.startDate || i.endDate !== leadCartItem?.endDate
  );
  const summaryStartDate = leadCartItem?.startDate ?? startDate;
  const summaryEndDate = leadCartItem?.endDate ?? endDate;

  return (
    <div className="relative min-h-[calc(100vh-4.5rem)] py-10 px-5 sm:px-6 lg:px-8">
      
      {/* Decorative ambient rays */}
      <div className="absolute top-1/5 left-10 h-72 w-72 rounded-full bg-teal-500/5 blur-[100px] -z-10" />

      <div className="mx-auto max-w-6xl">
        
        {/* Stepper — hide on success */}
        {step < STEP_SUCCESS && (
          <div className="mb-8">
            <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-5">
              Stap {step} van {TOTAL_STEPS}
            </p>
            <div className="flex items-center justify-center max-w-xs mx-auto">
              {[
                { number: 1, label: "Logistiek" },
                { number: 2, label: "Gegevens" }
              ].map((s, idx) => {
                const isDone = step > s.number;
                const isCurrent = step === s.number;
                return (
                  <React.Fragment key={idx}>
                    {idx > 0 && (
                      <div className="flex-1 h-0.5 mx-4 rounded-full overflow-hidden bg-slate-200">
                        <div className={`h-full rounded-full transition-all duration-500 ease-out ${isDone ? "w-full bg-orange-500" : "w-0"}`} />
                      </div>
                    )}
                    <div className="flex flex-col items-center">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                        isCurrent
                          ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25 scale-110"
                          : isDone
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-100 text-slate-500"
                      }`}>
                        {isDone ? (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : s.number}
                      </div>
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider mt-2 ${
                        isCurrent ? "text-orange-700" : isDone ? "text-emerald-700" : "text-slate-500"
                      }`}>
                        {s.label}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}


        {/* initial={false}: don't fade+slide the step content in on first
            landing on this tab — only animate the transition between steps,
            so opening "Boeken" feels instant instead of jittery. */}
        <AnimatePresence mode="wait" initial={false}>
          {step < STEP_SUCCESS ? (
            <motion.div
              key="booking-content"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start"
            >

              {/* Form column — left on desktop, full-width on mobile */}
              <div className="lg:col-span-8 space-y-6">

                <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                  <BookingStep1
                    cartItems={cartItems}
                    getItemAvailability={getItemAvailability}
                    onRemoveCartItem={onRemoveCartItem}
                    onUpdateCartItemDates={onUpdateCartItemDates}
                    deliveryType={deliveryType}
                    setDeliveryType={setDeliveryType}
                    setDeliveryAddress={setDeliveryAddress}
                    selectedAddons={selectedAddons}
                    setSelectedAddons={setSelectedAddons}
                    rijplatenQty={rijplatenQty}
                    setRijplatenQty={setRijplatenQty}
                    trailerDays={trailerDays}
                    setTrailerDays={setTrailerDays}
                    validationError={validationError}
                    setValidationError={setValidationError}
                    isAvailable={cartItems.length > 0 && cartItems.every(item => {
                      const av = getItemAvailability(item.machine.id, item.startDate || "", item.endDate || "");
                      return av.available;
                    })}
                    handleNextStep={handleNextStep}
                    setActiveTab={setActiveTab}
                    customerProfile={customerProfile}
                    sums={sums}
                    selectedMachine={cartItems.length > 0 ? cartItems[0].machine : null}
                    deliveryDistanceKm={deliveryDistanceKm}
                    deliveryTimeSlot={deliveryTimeSlot}
                    setDeliveryTimeSlot={setDeliveryTimeSlot}
                    deliveryAddress={deliveryAddress}
                  />
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                  <BookingStep2
                    currentUser={currentUser}
                    isGuestConfirmed={isGuestConfirmed}
                    setIsGuestConfirmed={setIsGuestConfirmed}
                    customerName={customerName}
                    setCustomerName={setCustomerName}
                    customerEmail={customerEmail}
                    setCustomerEmail={setCustomerEmail}
                    customerPhone={customerPhone}
                    setCustomerPhone={setCustomerPhone}
                    customerProfile={customerProfile}
                    setCustomerProfile={setCustomerProfile}
                    deliveryType={deliveryType}
                    postcode={postcode}
                    setPostcode={setPostcode}
                    houseNumber={houseNumber}
                    setHouseNumber={setHouseNumber}
                    isSearchingAddress={isSearchingAddress}
                    addressSuccessMsg={addressSuccessMsg}
                    streetName={streetName}
                    deliveryAddress={deliveryAddress}
                    setDeliveryAddress={handleManualAddressChange}
                    handleAddressLookup={handleAddressLookup}
                    validationError={validationError}
                    setValidationError={setValidationError}
                    setStep={setStep}
                    handleNextStep={handleNextStep}
                    setActiveTab={setActiveTab}
                    sums={sums}
                    selectedMachine={cartItems.length > 0 ? cartItems[0].machine : null}
                    startDate={summaryStartDate}
                    endDate={summaryEndDate}
                    multiplePeriods={mixedCartPeriods}
                    deliveryDistanceKm={deliveryDistanceKm}
                    isSubmitting={isSubmitting}
                    bookingError={bookingError}
                  />
                  </motion.div>
                )}
                </AnimatePresence>

              </div>

              {/* Price summary — desktop only, sticky right column */}
              <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-24 space-y-4">
                <BookingPriceSummary selectedMachine={cartItems && cartItems.length > 0 ? cartItems[0].machine : null} machineCount={cartItems.length || 1} startDate={summaryStartDate} endDate={summaryEndDate} multiplePeriods={mixedCartPeriods} sums={sums} />
              </div>

            </motion.div>
          ) : (
            <BookingSuccess
              successOrder={successOrder}
              successOrders={successOrders}
              paymentGateway={paymentGateway}
              setStep={setStep}
              setSuccessOrder={setSuccessOrder}
              setActiveTab={setActiveTab}
              currentUser={currentUser}
              whatsappUrl={whatsappUrl}
              bookingError={bookingError}
            />
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
