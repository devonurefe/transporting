/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Machine, Order, DeliveryType, UserProfile, CartItem } from "../types";
import { useAppStore } from "../store/appStore";
import { checkAvailability } from "../utils/availability";
import { calculateItemSubtotal, isStrictWeekend, countWeekendDays, hasSundayBlock, calculateRentalDays, addonPriceForRental, billableWeeks, buildTierDisplay, computeVatAndTotal, getTransportFees, getGlobalAddons } from "../utils/pricing";

// Global add-ons available on every machine (unless excluded by category — see
// GLOBAL_ADDON_EXCLUDED_CATEGORIES in BookingStep1.tsx / server/routes/orders.ts,
// which must stay in sync). Priced like a weekly cross-sell extra: a flat rate for
// the first started week, +rate for every additional started 7-day block.
// Names/prices come from SiteConfig via getGlobalAddons (admin-editable, defaults
// = historical literals). Mirrored by server/routes/orders.ts — keep identical.
const GLOBAL_ADDON_IDS = ["safety", "rijplaten"] as const;
// qty is the customer-chosen amount (currently only Rijplaten is quantity-based —
// the customer types how many plates they need). Every other global add-on uses qty 1.
//
// `machine` levert minRentalDays aan, en dat is niet optioneel: computeAddonsTotal
// op de server rekent het aantal weken met `max(rentalDays, minRentalDays)`. Zolang
// hier `billableWeeks(days)` stond (die terugvalt op een minimum van 7), gaven beide
// kanten alleen hetzelfde antwoord zolang elke machine een minRentalDays ≤ 7 had.
// Zodra een beheerder er in het machineformulier een hogere waarde invult, wijkt de
// clientprijs af en weigert de server élke boeking van die machine met een globale
// add-on ("Totaalbedrag klopt niet") — zonder dat iemand doorheeft waarom.
function globalAddonLine(
  id: string,
  days: number,
  machine: { minRentalDays?: number },
  qty = 1
): { id: string; name: string; price: number } {
  const addons = getGlobalAddons(useAppStore.getState().siteConfig);
  const def = addons[id as keyof typeof addons];
  const weeks = billableWeeks(days, machine.minRentalDays);
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
  // De ene machine die geboekt wordt, of null als er nog niets gekozen is.
  cartItem?: CartItem | null;
  onClearSelection?: () => void;
  onUpdateSelectedDates?: (start: string, end: string) => void;
}

export default function BookingSection({
  selectedMachine,
  onCreateReservation,
  setActiveTab,
  machines,
  onSelectMachine,
  currentUser,
  cartItem = null,
  onClearSelection = () => {},
  onUpdateSelectedDates = () => {}
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
  const [poNumber, setPoNumber] = useState<string>("");
  // Klant-gekozen betaalwijze bij het afrekenen (laatste stap): "link" = online
  // iDEAL/Tikkie-betaallink (admin stuurt een link), "on_location" = betalen bij
  // ophalen/levering. Bepaalt zowel het WhatsApp-bericht op de succespagina als de
  // knop "Betaallink sturen" in het adminpaneel.
  const [paymentMethod, setPaymentMethod] = useState<"link" | "on_location">("link");
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

  const lastMachineIdRef = React.useRef<string>("");

  useEffect(() => {
    const machine = cartItem?.machine ?? selectedMachine;
    if (!machine) return;
    if (machine.id === lastMachineIdRef.current) return;

    lastMachineIdRef.current = machine.id;
    if (machine.pickupOnly || machine.category === "aanhanger" || machine.category === "ecolift") {
      setDeliveryType("self_pickup");
    } else {
      setDeliveryType("delivery_by_us");
    }
    fetch(`/api/orders/availability?machineId=${encodeURIComponent(machine.id)}`)
      .then(res => (res.ok ? res.json() : []))
      .then(setAllOrders)
      .catch(() => setAllOrders([]));
  }, [selectedMachine, cartItem]);

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

    const realtimeMachine = machines.find(m => m.id === machineId);
    if (realtimeMachine?.operationallyBlocked) {
      setIsAvailable(false);
      setIsDateBlocked(true);
      setBlockingReason("Niet beschikbaar voor deze periode.");
      setOverlappingOrders([]);
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
    const machine = cartItem?.machine.id === machineId ? cartItem.machine : undefined;
    return checkAvailability(machineId, start, end, allOrders, blockedDaysList, undefined, machine?.bufferDays ?? 0, machine?.stockQuantity ?? 1, machine?.operationallyBlocked ?? false);
  };

  // Re-run checking whenever days or machine swap
  useEffect(() => {
    if (selectedMachine) {
      checkRealtimeAvailability(selectedMachine.id, startDate, endDate);
    }
  }, [selectedMachine, startDate, endDate, allOrders, blockedDaysList]);

  // Synchronize local startDate and endDate with the selection to trigger availability updates
  useEffect(() => {
    if (!cartItem) return;
    if (cartItem.startDate && cartItem.startDate !== startDate) {
      setStartDate(cartItem.startDate);
    }
    if (cartItem.endDate && cartItem.endDate !== endDate) {
      setEndDate(cartItem.endDate);
    }
  }, [cartItem, startDate, endDate]);

  // Recalculate invoice specifics with weekly, monthly & campaign discounts.
  //
  // Eén machine per aanvraag: er is precies één (of geen) selectie, dus dit is
  // één rechttoe rechtaan berekening. Hiervoor stonden hier twee paden naast
  // elkaar — een winkelwagenlus over meerdere machines en een "legacy fallback"
  // op selectedMachine — waarvan er in de praktijk maar één bereikbaar was. Die
  // lus rekende de globale add-ons één keer over de opgetelde dagen van alle
  // machines, terwijl het verzendpad ze per machine opnieuw rekende: bij twee
  // machines zag de klant €15 en werd er €30 afgeschreven. Door hier één pad
  // over te houden kán dat verschil niet meer ontstaan.
  const calculationSummary = () => {
    const machine = cartItem?.machine ?? null;
    const itemStart = cartItem?.startDate ?? "";
    const itemEnd = cartItem?.endDate ?? "";

    // Niets gekozen, of nog geen periode geprikt: dan valt er niets te rekenen.
    // De prijssamenvatting toont in dat geval een neutrale placeholder in plaats
    // van een misleidende "€0,00 · 0 dagen".
    if (!machine || !itemStart || !itemEnd) {
      return {
        days: 0,
        rawSubtotal: 0,
        discountAmount: 0,
        discountLabel: "",
        subtotal: 0,
        transport: 0,
        driver: 0,
        addonCost: 0,
        addonDetails: [] as { id: string; name: string; price: number }[],
        vat: 0,
        total: 0,
        deliveryType
      };
    }

    const days = calculateRentalDays(itemStart, itemEnd);

    const subtotal = calculateItemSubtotal(machine, days, customerProfile, campaignRules, itemStart);
    // Weekly-only products bill per week, not per day — the day-rate "raw" total is
    // meaningless and would surface as a phantom discount, so anchor raw to the subtotal.
    const rawSubtotal = machine.weeklyOnly ? subtotal : machine.pricePerDay * days;
    const subtotalNoCampaign = calculateItemSubtotal(
      { ...machine, campaignDiscountPercent: undefined, campaignDiscountAmount: undefined } as any,
      days, customerProfile, [], itemStart
    );
    const discountAmount = Math.max(0, rawSubtotal - subtotal);
    const campaignSavings = Math.max(0, subtotalNoCampaign - subtotal);

    const fees = getTransportFees(useAppStore.getState().siteConfig);
    const transport = deliveryType === "delivery_by_us" ? fees.deliveryFee : 0;
    // Trailer billed per klant-gekozen aantal dagen (niet de huurperiode).
    const trailerCost = deliveryType === "trailer_rental" ? fees.trailerPerDay * trailerDays : 0;
    const driver = 0;

    // Forced Sunday block: when a rental's last work day is Saturday the machine
    // is held over the closed Sunday (return Monday 08:00). Het zit al in het
    // subtotaal; hier apart zodat de samenvatting het als eigen regel kan tonen.
    const sundayBlockTotal = hasSundayBlock(machine, itemStart, days) ? (machine.sundayBlockFee ?? 0) : 0;
    const weekendDays = countWeekendDays(itemStart, itemEnd);

    // Addon calculation
    let addonCost = 0;
    const addonDetails: { id: string; name: string; price: number }[] = [];

    for (const id of GLOBAL_ADDON_IDS) {
      if (!selectedAddons.includes(id)) continue;
      const line = globalAddonLine(id, days, machine, id === "rijplaten" ? rijplatenQty : 1);
      addonCost += line.price;
      addonDetails.push(line);
    }
    // Product-specific cross-sell extras (billed per started week, same week count as the machine)
    for (const a of machine.crossSellAddons ?? []) {
      if (!selectedAddons.includes(a.id)) continue;
      const price = addonPriceForRental(a, days, machine);
      addonCost += price;
      addonDetails.push({ id: a.id, name: a.name, price });
    }

    const { vat, total } = computeVatAndTotal(subtotal, transport + trailerCost, driver, addonCost);

    let discountLabel = "Korting";
    if (days >= 28) discountLabel = "Maandkorting";
    else if (days >= 5) discountLabel = "Weekkorting";
    else if (isStrictWeekend(itemStart, days) && machine.weekendPrice) discountLabel = "Weekendprijs";
    else if (days === 2 && machine.twoDayPrice) discountLabel = "2-Dag Prijs";
    else if (days === 1 && machine.oneDayPrice && machine.oneDayPrice < machine.pricePerDay) discountLabel = "1-Dag Actie";

    const effectiveDailyRate = (!machine.weeklyOnly && days >= 6 && days < 28 && machine.weeklyPrice)
      ? machine.weeklyPrice / 5
      : null;

    // Tier label for flat-rate price display — unit-tested against
    // calculateItemSubtotal in pricing-display.test.ts so the breakdown can never
    // drift from the real charge.
    const display = buildTierDisplay(machine, days, itemStart);

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
      trailerDays: deliveryType === "trailer_rental" ? trailerDays : undefined,
      weekendDays,
      sundayBlockTotal,
      effectiveDailyRate,
      tierLabel: display.tierLabel,
      isFlatRate: display.isFlatRate,
      weeklyBreakdown: display.weeklyBreakdown,
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
      if (!cartItem) {
        setValidationError("Selecteer een machine om door te gaan.");
        return;
      }
      const av = getItemAvailability(cartItem.machine.id, cartItem.startDate || "", cartItem.endDate || "");
      if (!av.available) {
        setValidationError("De gekozen machine is niet beschikbaar voor deze datums.");
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
    if (!cartItem) {
      setBookingError("Selecteer eerst een machine.");
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setBookingError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const machine = cartItem.machine;
      const days = calculateRentalDays(cartItem.startDate, cartItem.endDate);

      const subtotal = calculateItemSubtotal(machine, days, customerProfile, campaignRules, cartItem.startDate);
      const fees = getTransportFees(useAppStore.getState().siteConfig);
      const transport = deliveryType === "delivery_by_us" ? fees.deliveryFee : 0;
      const trailerCost = deliveryType === "trailer_rental" ? fees.trailerPerDay * trailerDays : 0;
      const driver = 0;

      let addonCost = 0;
      const addonsList: { id: string; name: string; price: number; billing: "daily" | "flat" | "weekly"; quantity?: number }[] = [];
      for (const id of GLOBAL_ADDON_IDS) {
        if (!selectedAddons.includes(id)) continue;
        const qty = id === "rijplaten" ? rijplatenQty : 1;
        const line = globalAddonLine(id, days, machine, qty);
        addonCost += line.price;
        addonsList.push({ ...line, billing: "weekly", quantity: qty });
      }
      // Product-specific cross-sell extras (per started week, server recomputes authoritatively)
      for (const a of machine.crossSellAddons ?? []) {
        if (!selectedAddons.includes(a.id)) continue;
        const price = addonPriceForRental(a, days, machine);
        const billing: "daily" | "flat" | "weekly" =
          !machine.weeklyOnly && days === 1 && a.pricePerDay != null && a.pricePerDay > 0 ? "daily"
          : !machine.weeklyOnly && days === 2 && a.pricePerTwoDay != null && a.pricePerTwoDay > 0 ? "flat"
          : "weekly";
        addonCost += price;
        addonsList.push({ id: a.id, name: a.name, price, billing });
      }

      // Zelfde functie als het prijsoverzicht gebruikt, zodat wat de klant ziet
      // exact is wat er verstuurd wordt — en wat de server onafhankelijk narekent.
      const { vat, total } = computeVatAndTotal(subtotal, transport + trailerCost, driver, addonCost);

      const orderObj: Partial<Order> = {
        machineId: machine.id,
        machineName: machine.name,
        machinePrice: machine.pricePerDay,
        startDate: cartItem.startDate,
        endDate: cartItem.endDate,
        rentalDays: days,
        deliveryType,
        deliveryAddress: deliveryType === "self_pickup" ? undefined : deliveryAddress,
        deliveryTimeSlot: deliveryType === "delivery_by_us" ? deliveryTimeSlot || undefined : undefined,
        trailerDays: deliveryType === "trailer_rental" ? trailerDays : undefined,
        customerName,
        customerEmail,
        customerPhone,
        customerProfile,
        poNumber: poNumber.trim() || undefined,
        paymentMethod,
        subtotal,
        transportCost: transport + trailerCost,
        driverCost: driver,
        vatAmount: vat,
        totalAmount: total,
        addons: addonsList
      };

      const placedOrder = await onCreateReservation(orderObj);
      if (!placedOrder) {
        setBookingError("Er is een fout opgetreden bij het verwerken van uw boeking. Controleer uw gegevens en probeer het opnieuw.");
        return;
      }

      if (paymentGateway === "whatsapp") {
        const orderTotals = {
          days: placedOrder.rentalDays,
          subtotal: placedOrder.subtotal,
          transport: placedOrder.transportCost,
          vat: placedOrder.vatAmount,
          total: placedOrder.totalAmount
        };
        setWhatsappUrl(
          buildWhatsAppUrl([cartItem], deliveryType, customerName, customerEmail, customerPhone || undefined, orderTotals, paymentMethod)
        );
      } else {
        setWhatsappUrl("");
      }
      setSuccessOrder(placedOrder);
      onClearSelection();
      setStep(STEP_SUCCESS);
    } catch (err: any) {
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
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const sums = useMemo(
    () => calculationSummary(),
    // calculationSummary closes over these values — re-run only when they change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cartItem, selectedAddons, rijplatenQty, trailerDays, deliveryType, customerProfile, campaignRules, startDate, endDate]
  );

  // Reservation period for the price summary box.
  const summaryStartDate = cartItem?.startDate || startDate;
  const summaryEndDate = cartItem?.endDate || endDate;

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
                    cartItem={cartItem}
                    getItemAvailability={getItemAvailability}
                    onClearSelection={onClearSelection}
                    onUpdateSelectedDates={onUpdateSelectedDates}
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
                    isAvailable={!!cartItem && getItemAvailability(cartItem.machine.id, cartItem.startDate || "", cartItem.endDate || "").available}
                    handleNextStep={handleNextStep}
                    setActiveTab={setActiveTab}
                    customerProfile={customerProfile}
                    sums={sums}
                    selectedMachine={cartItem?.machine ?? null}
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
                    poNumber={poNumber}
                    setPoNumber={setPoNumber}
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
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
                    selectedMachine={cartItem?.machine ?? null}
                    startDate={summaryStartDate}
                    endDate={summaryEndDate}
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
                <BookingPriceSummary selectedMachine={cartItem?.machine ?? null} startDate={summaryStartDate} endDate={summaryEndDate} sums={sums} />
              </div>

            </motion.div>
          ) : (
            <BookingSuccess
              successOrder={successOrder}
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
