/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Machine, Order, DeliveryType, UserProfile, CartItem, CampaignRule } from "../types";
import { useAppStore } from "../store/appStore";
import { checkAvailability } from "../utils/availability";

// Import modular Step components
import { buildWhatsAppUrl } from "../utils/whatsapp";
import BookingStep1 from "./booking/BookingStep1";
import BookingStep2 from "./booking/BookingStep2";
import BookingStep3 from "./booking/BookingStep3";
import BookingSuccess from "./booking/BookingSuccess";
import BookingPriceSummary from "./booking/BookingPriceSummary";

type AvailabilityOrder = Pick<Order, "id" | "machineId" | "startDate" | "endDate" | "status">;

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
  // Booking Stepper state
  const campaignRules = useAppStore((state) => state.campaignRules);
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const evaluateDiscountPercent = (machine: Machine, days: number, profile: string, rules: CampaignRule[]) => {
    let highestDiscount = 0;
    
    // 1. Weekly/Monthly volume discounts
    if (days >= 30 && machine.monthlyDiscountPercent) {
      highestDiscount = Math.max(highestDiscount, machine.monthlyDiscountPercent);
    } else if (days >= 7 && machine.weeklyDiscountPercent) {
      highestDiscount = Math.max(highestDiscount, machine.weeklyDiscountPercent);
    }

    // 2. Active custom campaign rules
    const activeRules = rules.filter(r => r.isActive);
    for (const rule of activeRules) {
      let matches = false;
      if (rule.scope === "global") {
        matches = true;
      } else if (rule.scope === "category") {
        matches = machine.category.toLowerCase() === rule.scopeValue.toLowerCase();
      } else if (rule.scope === "product") {
        matches = machine.id === rule.scopeValue;
      } else if (rule.scope === "role") {
        matches = profile.toLowerCase() === rule.scopeValue.toLowerCase();
      }

      if (matches) {
        highestDiscount = Math.max(highestDiscount, rule.discountPercent);
      }
    }

    // 3. Fallback to default machine campaignDiscountPercent
    if (machine.campaignDiscountPercent) {
      highestDiscount = Math.max(highestDiscount, machine.campaignDiscountPercent);
    }

    return highestDiscount;
  };
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
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("delivery_with_driver");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>(currentUser ? currentUser.name : "");
  const [customerEmail, setCustomerEmail] = useState<string>(currentUser ? currentUser.email : "");
  const [customerPhone, setCustomerPhone] = useState<string>(currentUser ? currentUser.phone : "");
  const [customerProfile, setCustomerProfile] = useState<string>(currentUser ? currentUser.profileType : "Particulier");

  // Availability checking state
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [overlappingOrders, setOverlappingOrders] = useState<AvailabilityOrder[]>([]);
  const [blockedDaysList, setBlockedDaysList] = useState<{ machineId: string; date: string; reason?: string }[]>([]);
  const [allOrders, setAllOrders] = useState<AvailabilityOrder[]>([]);
  const [isDateBlocked, setIsDateBlocked] = useState<boolean>(false);
  const [blockingReason, setBlockingReason] = useState<string>("");

  useEffect(() => {
    fetch("/api/orders/availability")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAllOrders(data))
      .catch(() => {});
    fetch("/api/blocked-dates")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setBlockedDaysList(data))
      .catch(() => {});
  }, []);

  const lastMachineIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    const leadMachine = cartItems.length > 0 ? cartItems[0].machine : selectedMachine;
    if (leadMachine && leadMachine.id !== lastMachineIdRef.current) {
      lastMachineIdRef.current = leadMachine.id;
      if (leadMachine.category === "aanhanger" || leadMachine.category === "ecolift") {
        setDeliveryType("self_pickup");
      } else {
        setDeliveryType("delivery_with_driver");
      }
    }
  }, [selectedMachine, cartItems]);

  // Addon / Shopping Cart Options state
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

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

  // If no machine selection exists, pre-load first available
  useEffect(() => {
    if (!selectedMachine && machines.length > 0) {
      onSelectMachine(machines[0]);
    }
  }, [selectedMachine, machines]);

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

    const sDate = new Date(start);
    const eDate = new Date(end);
    let curr = new Date(sDate);

    // Limit safety block check to 1000 days
    let safetyCounter = 0;
    while (curr <= eDate && safetyCounter < 1000) {
      safetyCounter++;
      const currStr = curr.toISOString().split('T')[0];
      const blockedMatch = blockedDaysList.find((b: any) => b.machineId === machineId && b.date === currStr);
      if (blockedMatch) {
        dateIsBlocked = true;
        reasonTxt = blockedMatch.reason || "Geblokkeerd door beheerder / Onderhoud";
        break;
      }
      curr.setDate(curr.getDate() + 1);
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
    return checkAvailability(machineId, start, end, allOrders, blockedDaysList);
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
          borgsom: 0
        };
      }
      let totalDays = 0;
      let rawSubtotal = 0;
      let discountAmount = 0;
      let subtotal = 0;

      for (const item of cartItems) {
        const itemStart = item.startDate || new Date().toISOString().split("T")[0];
        const itemEnd = item.endDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const start = new Date(itemStart);
        const end = new Date(itemEnd);
        const timeDiff = end.getTime() - start.getTime();
        const days = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1);
        totalDays += days;

        const itemRaw = item.machine.pricePerDay * days;
        const discountPercent = evaluateDiscountPercent(item.machine, days, customerProfile, campaignRules);
        let itemDisc = itemRaw * (discountPercent / 100);

        if (item.machine.campaignDiscountAmount) {
          itemDisc += item.machine.campaignDiscountAmount;
        }

        const itemSub = Math.max(0, itemRaw - itemDisc);
        rawSubtotal += itemRaw;
        discountAmount += itemDisc;
        subtotal += itemSub;
      }

      const transport = deliveryType === "delivery_with_driver" ? 120 : 0;
      const driver = deliveryType === "delivery_with_driver" ? 150 : 0; // Flat chauffeur support

      // Addon calculation
      let addonCost = 0;
      const addonDetails: { id: string; name: string; price: number }[] = [];

      if (selectedAddons.includes("clean")) {
        addonCost += 45 * cartItems.length;
        addonDetails.push({ id: "clean", name: `Reiniging & Schoonmaak Service (${cartItems.length}x)`, price: 45 * cartItems.length });
      }
      if (selectedAddons.includes("safety")) {
        addonCost += 15 * totalDays;
        addonDetails.push({ id: "safety", name: "Gecertificeerd Harnas & Veiligheidskit", price: 15 * totalDays });
      }
      if (selectedAddons.includes("insurance")) {
        addonCost += 25 * totalDays;
        addonDetails.push({ id: "insurance", name: "Extra All-Risk Schadeverzekering", price: 25 * totalDays });
      }

      const borgsom = parseFloat((cartItems.reduce((sum, item) => sum + item.machine.pricePerDay * 0.20, 0)).toFixed(2));

      const totalExcl = subtotal + transport + driver + addonCost;
      const vat = totalExcl * 0.21;
      const total = totalExcl + vat;

      let discountLabel = "Korting";
      const leadItem = cartItems[0]?.machine;
      if (leadItem) {
        if (totalDays >= 30) discountLabel = "Maandkorting";
        else if (totalDays >= 7) discountLabel = "Weekkorting";

        const activeRules = campaignRules.filter(r => r.isActive);
        const matchingRuleName = activeRules.find(rule => {
          if (rule.scope === "global") return true;
          if (rule.scope === "category" && leadItem.category.toLowerCase() === rule.scopeValue.toLowerCase()) return true;
          if (rule.scope === "product" && leadItem.id === rule.scopeValue) return true;
          if (rule.scope === "role" && customerProfile.toLowerCase() === rule.scopeValue.toLowerCase()) return true;
          return false;
        })?.name;

        if (matchingRuleName) {
          discountLabel = `${discountLabel} + ${matchingRuleName}`;
        } else if (leadItem.campaignText) {
          discountLabel = `${discountLabel} + ${leadItem.campaignText}`;
        }
      }

      return {
        days: totalDays,
        rawSubtotal,
        discountAmount,
        discountLabel,
        subtotal,
        transport,
        driver,
        addonCost,
        addonDetails,
        vat,
        total,
        borgsom
      };
    }

    // Legacy fallback
    if (!selectedMachine) {
      return { days: 0, rawSubtotal: 0, discountAmount: 0, discountLabel: "", subtotal: 0, transport: 0, driver: 0, addonCost: 0, addonDetails: [], vat: 0, total: 0, borgsom: 0 };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    const days = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1);

    const rawSubtotal = selectedMachine.pricePerDay * days;
    const discountPercent = evaluateDiscountPercent(selectedMachine, days, customerProfile, campaignRules);
    let discountAmount = rawSubtotal * (discountPercent / 100);

    if (selectedMachine.campaignDiscountAmount) {
      discountAmount += selectedMachine.campaignDiscountAmount;
    }

    let discountLabel = "Korting";
    if (days >= 30) {
      discountLabel = "Maandkorting";
    } else if (days >= 7) {
      discountLabel = "Weekkorting";
    }

    const activeRules = campaignRules.filter(r => r.isActive);
    const matchingRuleName = activeRules.find(rule => {
      if (rule.scope === "global") return true;
      if (rule.scope === "category" && selectedMachine.category.toLowerCase() === rule.scopeValue.toLowerCase()) return true;
      if (rule.scope === "product" && selectedMachine.id === rule.scopeValue) return true;
      if (rule.scope === "role" && customerProfile.toLowerCase() === rule.scopeValue.toLowerCase()) return true;
      return false;
    })?.name;

    if (matchingRuleName) {
      discountLabel = `${discountLabel} + ${matchingRuleName}`;
    } else if (selectedMachine.campaignText) {
      discountLabel = `${discountLabel} + ${selectedMachine.campaignText}`;
    }

    const subtotal = Math.max(0, rawSubtotal - discountAmount);
    const transport = deliveryType === "delivery_with_driver" ? 120 : 0;
    const driver = deliveryType === "delivery_with_driver" ? 150 : 0;

    let addonCost = 0;
    const addonDetails: { id: string; name: string; price: number }[] = [];

    if (selectedAddons.includes("clean")) {
      addonCost += 45;
      addonDetails.push({ id: "clean", name: "Reiniging & Schoonmaak Service", price: 45 });
    }
    if (selectedAddons.includes("safety")) {
      addonCost += 15 * days;
      addonDetails.push({ id: "safety", name: "Gecertificeerd Harnas & Veiligheidskit", price: 15 * days });
    }
    if (selectedAddons.includes("insurance")) {
      addonCost += 25 * days;
      addonDetails.push({ id: "insurance", name: "Extra All-Risk Schadeverzekering", price: 25 * days });
    }

    const borgsom = parseFloat((selectedMachine.pricePerDay * 0.20).toFixed(2));

    const totalExcl = subtotal + transport + driver + addonCost;
    const vat = totalExcl * 0.21;
    const total = totalExcl + vat;

    return {
      days,
      rawSubtotal,
      discountAmount,
      discountLabel,
      subtotal,
      transport,
      driver,
      addonCost,
      addonDetails,
      vat,
      total,
      borgsom
    };
  };

  const handleAddressLookup = async (e: React.MouseEvent) => {
    e.preventDefault();
    setValidationError(null);
    setAddressSuccessMsg("");

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

    try {
      const response = await fetch(
        `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${cleanPostcode}+${encodeURIComponent(cleanHouse)}&fq=type:adres`
      );
      
      if (!response.ok) {
        throw new Error("Systeem kon locatieserver niet bereiken.");
      }
      
      const data = await response.json();
      
      if (data && data.response && data.response.docs && data.response.docs.length > 0) {
        const bestDoc = data.response.docs[0];
        // Build address using user's house number, not the API's nearest match
        const street = bestDoc.straatnaam || bestDoc.straatnaam_verkort || "";
        const city = bestDoc.woonplaatsnaam || bestDoc.woonplaats || "";
        const resolvedAddress = street && city
          ? `${street} ${cleanHouse}, ${cleanPostcode} ${city}`
          : bestDoc.weergavenaam;
        setDeliveryAddress(resolvedAddress);
        setAddressSuccessMsg(`✓ Gevalideerd adres gevonden:\n${resolvedAddress}`);
      } else {
        setDeliveryAddress("");
        setAddressSuccessMsg("");
        setValidationError("Adres kon niet automatisch worden gevonden. Vul alstublieft uw adres handmatig in.");
      }
    } catch (err) {
      setDeliveryAddress("");
      setAddressSuccessMsg("");
      setValidationError("Adres kon niet automatisch worden geverifieerd (netwerkfout). Vul alstublieft uw adres handmatig in.");
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
      setStep(2);
    } else if (step === 2) {
      if (!customerName || !customerEmail || !customerPhone) {
        setValidationError("U dient alle contactgegevens (Naam, E-mail en Telefoonnummer) in te vullen.");
        return;
      }
      if (deliveryType === "delivery_with_driver" && !deliveryAddress.trim()) {
        setValidationError("Een afleveradres is verplicht bij bezorging door onze chauffeur.");
        return;
      }
      setStep(3);
    }
  };

  const handleCreateBooking = async () => {
    setIsSubmitting(true);
    setBookingError(null);
    try {
      let firstSuccessfulOrder: Order | null = null;
      const placedOrders: Order[] = [];
        
        if (cartItems && cartItems.length > 0) {
          for (let i = 0; i < cartItems.length; i++) {
            const item = cartItems[i];
            const start = new Date(item.startDate);
            const end = new Date(item.endDate);
            const timeDiff = end.getTime() - start.getTime();
            const days = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1);

            const rawPrice = item.machine.pricePerDay * days;
            let disc = 0;
            if (days >= 30 && item.machine.monthlyDiscountPercent) {
              disc = rawPrice * (item.machine.monthlyDiscountPercent / 100);
            } else if (days >= 7 && item.machine.weeklyDiscountPercent) {
              disc = rawPrice * (item.machine.weeklyDiscountPercent / 100);
            }

            if (item.machine.campaignText) {
              if (item.machine.campaignDiscountPercent) {
                disc += rawPrice * (item.machine.campaignDiscountPercent / 100);
              } else if (item.machine.campaignDiscountAmount) {
                disc += item.machine.campaignDiscountAmount;
              }
            }

            const itemSubtotal = Math.max(0, rawPrice - disc);
            const transport = (deliveryType === "delivery_with_driver" && i === 0) ? 120 : 0;
            const driver = (deliveryType === "delivery_with_driver" && i === 0) ? 150 : 0;

            let addonCost = 0;
            const addonsList: { id: string; name: string; price: number; billing: "daily" | "flat" }[] = [];
            if (selectedAddons.includes("clean")) {
              addonCost += 45;
              addonsList.push({ id: "clean", name: "Reiniging & Schoonmaak Service", price: 45, billing: "flat" });
            }
            if (selectedAddons.includes("safety")) {
              addonCost += 15 * days;
              addonsList.push({ id: "safety", name: "Gecertificeerd Harnas & Veiligheidskit", price: 15 * days, billing: "daily" });
            }
            if (selectedAddons.includes("insurance")) {
              addonCost += 25 * days;
              addonsList.push({ id: "insurance", name: "Extra All-Risk Schadeverzekering", price: 25 * days, billing: "daily" });
            }

            const itemVat = (itemSubtotal + transport + driver + addonCost) * 0.21;
            const itemTotal = itemSubtotal + transport + driver + addonCost + itemVat;

            const orderObj: Partial<Order> = {
              machineId: item.machine.id,
              machineName: item.machine.name,
              machinePrice: item.machine.pricePerDay,
              startDate: item.startDate,
              endDate: item.endDate,
              rentalDays: days,
              deliveryType,
              deliveryAddress,
              customerName,
              customerEmail,
              customerPhone,
              customerProfile,
              subtotal: itemSubtotal,
              transportCost: transport,
              driverCost: parseFloat(driver.toFixed(2)),
              vatAmount: parseFloat(itemVat.toFixed(2)),
              totalAmount: parseFloat(itemTotal.toFixed(2)),
              addons: addonsList,
              borgsom: parseFloat((item.machine.pricePerDay * 0.20).toFixed(2))
            };

            const result = await onCreateReservation(orderObj);
            if (result) {
              placedOrders.push(result);
              if (!firstSuccessfulOrder) {
                firstSuccessfulOrder = result;
              }
            }
          }

          setIsSubmitting(false);
          if (firstSuccessfulOrder) {
            setSuccessOrders(placedOrders);
            if (paymentGateway === "whatsapp") {
              const checkoutItems: CartItem[] = cartItems.length > 0 ? cartItems : (selectedMachine ? [{
                id: selectedMachine.id,
                machine: selectedMachine,
                startDate: startDate,
                endDate: endDate
              }] : []);
              const waUrl = buildWhatsAppUrl(checkoutItems, deliveryType, customerName, customerEmail, customerPhone || undefined);
              setWhatsappUrl(waUrl);
            } else {
              setWhatsappUrl("");
            }
            setSuccessOrder(firstSuccessfulOrder);
            onClearCart();
            setStep(4);
          } else {
            setBookingError("Er is een fout opgetreden bij het verwerken van uw boeking. Controleer uw gegevens en probeer het opnieuw.");
          }
        }
      } catch (err: any) {
        setIsSubmitting(false);
        const msg = err?.message || "";
        if (msg.includes("409") || msg.toLowerCase().includes("conflict")) {
          setBookingError("Deze machine is helaas niet meer beschikbaar op de geselecteerde datums. Kies andere datums.");
        } else {
          setBookingError("Er is een technische fout opgetreden. Probeer het over een paar momenten opnieuw.");
        }
      }
  };

  const sums = calculationSummary();

  return (
    <div className="relative min-h-[calc(100vh-4.5rem)] py-10 px-5 sm:px-6 lg:px-8">
      
      {/* Decorative ambient rays */}
      <div className="absolute top-1/5 left-10 h-72 w-72 rounded-full bg-teal-500/5 blur-[100px] -z-10" />

      <div className="mx-auto max-w-6xl">
        
        {/* Stepper — hide on success */}
        {step < 4 && (
          <div className="mb-8 text-center">

            {/* Stepper tracker */}
            <div className="flex items-center justify-center max-w-md mx-auto relative px-6">
              {[
                { number: 1, label: "Logistiek" },
                { number: 2, label: "Gegevens" },
                { number: 3, label: "Betaling" }
              ].map((s, idx) => {
                const isActive = step >= s.number;
                const isCurrent = step === s.number;
                return (
                  <React.Fragment key={idx}>
                    {idx > 0 && (
                      <div className={`flex-grow h-0.5 transition-all duration-300 ${
                        step >= s.number ? "bg-indigo-600" : "bg-slate-200"
                      }`} />
                    )}
                    <div className="flex flex-col items-center relative z-10">
                      <div className={`h-8 w-8 rounded-full border flex items-center justify-center font-mono font-bold text-xs transition-all duration-300 ${
                        isCurrent 
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-md scale-110" 
                          : isActive 
                            ? "bg-teal-50 border-teal-300 text-teal-700" 
                            : "bg-white border-slate-200 text-slate-400"
                      }`}>
                        {isActive && !isCurrent ? (
                          <svg className="h-4 w-4 text-teal-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                          </svg>
                        ) : s.number}
                      </div>
                      <span className={`text-[9.5px] tracking-wider font-extrabold uppercase mt-2.5 ${
                        isCurrent ? "text-indigo-600" : isActive ? "text-teal-600" : "text-slate-400"
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

        <AnimatePresence mode="wait">
          {step < 4 ? (
            <motion.div 
              key="booking-content"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start"
            >

              {/* Price summary — desktop only sticky right column */}
              <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-24 space-y-4">
                <BookingPriceSummary selectedMachine={cartItems && cartItems.length > 0 ? cartItems[0].machine : null} sums={sums} />
              </div>

              {/* Form column */}
              <div className="lg:col-span-8 space-y-6">

                {step === 1 && (
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
                    validationError={validationError}
                    setValidationError={setValidationError}
                    isAvailable={cartItems.length > 0 && cartItems.every(item => {
                      const av = getItemAvailability(
                        item.machine.id,
                        item.startDate || new Date().toISOString().split("T")[0],
                        item.endDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
                      );
                      return av.available;
                    })}
                    handleNextStep={handleNextStep}
                    setActiveTab={setActiveTab}
                    sums={sums}
                    selectedMachine={cartItems.length > 0 ? cartItems[0].machine : null}
                  />
                )}

                {step === 2 && (
                  <BookingStep2 
                    currentUser={currentUser}
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
                    deliveryAddress={deliveryAddress}
                    setDeliveryAddress={setDeliveryAddress}
                    handleAddressLookup={handleAddressLookup}
                    validationError={validationError}
                    setValidationError={setValidationError}
                    setStep={setStep}
                    handleNextStep={handleNextStep}
                    setActiveTab={setActiveTab}
                  />
                )}

                {step === 3 && (
                  <BookingStep3
                    isSubmitting={isSubmitting}
                    setStep={setStep}
                    handleCreateBooking={handleCreateBooking}
                    bookingError={bookingError}
                  />
                )}

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
            />
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
