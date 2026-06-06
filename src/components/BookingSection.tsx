/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Building2, 
  Calendar, 
  User, 
  CheckCircle2,
  CreditCard,
} from "lucide-react";
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

  // Payment channel and inputs
  const [paymentGateway, setPaymentGateway] = useState<"stripe" | "mollie" | "whatsapp">("whatsapp");
  const [idealBank, setIdealBank] = useState<string>("rabobank");
  const [cardNumber, setCardNumber] = useState<string>("");
  const [cardName, setCardName] = useState<string>("");
  const [cardExpiry, setCardExpiry] = useState<string>("");
  const [cardCVC, setCardCVC] = useState<string>("");

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

  // If no machine selection exists, pre-load first available
  useEffect(() => {
    if (!selectedMachine && machines.length > 0) {
      onSelectMachine(machines[0]);
    }
  }, [selectedMachine, machines]);

  // Real-time capacity and collision checking logic
  const checkRealtimeAvailability = async (machineId: string, start: string, end: string) => {
    if (!start || !end) return;
    setValidationError(null);
    
    try {
      // 1. Check orders collision
      const response = await fetch("/api/orders/availability");
      if (!response.ok) throw new Error("Could not fetch orders for availability audit");
      const activeOrders: AvailabilityOrder[] = await response.json();

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

      const overlaps = activeOrders.filter(o => {
        if (o.machineId !== machineId) return false;
        
        const orderStart = new Date(o.startDate).getTime();
        const orderEnd = new Date(o.endDate).getTime();

        return (requestedStart <= orderEnd && requestedEnd >= orderStart);
      });

      // 2. Check manually blocked dates from Admin
      const blockRes = await fetch("/api/blocked-dates");
      const blockedList = blockRes.ok ? await blockRes.json() : [];
      setBlockedDaysList(blockedList);

      let dateIsBlocked = false;
      let reasonTxt = "";

      const sDate = new Date(start);
      const eDate = new Date(end);
      let curr = new Date(sDate);
      
      // Limit safety block check to 100 days
      let safetyCounter = 0;
      while (curr <= eDate && safetyCounter < 100) {
        safetyCounter++;
        const currStr = curr.toISOString().split('T')[0];
        const blockedMatch = blockedList.find((b: any) => b.machineId === machineId && b.date === currStr);
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
        setIsAvailable(false);
        setOverlappingOrders(overlaps);
      } else if (dateIsBlocked) {
        setIsAvailable(false);
        setOverlappingOrders([]);
      } else {
        setIsAvailable(true);
        setOverlappingOrders([]);
      }
    } catch (err) {
      setIsAvailable(true);
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
  }, [selectedMachine, startDate, endDate]);

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
          total: 0
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

      const transport = deliveryType === "delivery_with_driver" ? 120 * cartItems.length : 0;
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
        total
      };
    }

    // Legacy fallback
    if (!selectedMachine) {
      return { days: 0, rawSubtotal: 0, discountAmount: 0, discountLabel: "", subtotal: 0, transport: 0, driver: 0, addonCost: 0, addonDetails: [], vat: 0, total: 0 };
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
      total
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

    const getCityByPostcode = (pc: string): { city: string; street: string } => {
      const digits = parseInt(pc.slice(0, 4)) || 0;
      if (digits >= 1000 && digits <= 1099) return { city: "Amsterdam", street: "Keizersgracht" };
      if (digits >= 1100 && digits <= 1199) return { city: "Amsterdam Zuidoost", street: "Arenaboulevard" };
      if (digits >= 1200 && digits <= 1299) return { city: "Hilversum", street: "Mediapark" };
      if (digits >= 1300 && digits <= 1379) return { city: "Almere", street: "Marktmeesterstraat" };
      if (digits >= 1380 && digits <= 1439) return { city: "Weesp", street: "Sluispad" };
      if (digits >= 1440 && digits <= 1499) return { city: "Purmerend", street: "Gouw" };
      if (digits >= 1500 && digits <= 1599) return { city: "Zaandam", street: "Gedempte Gracht" };
      if (digits >= 1600 && digits <= 1699) return { city: "Enkhuizen", street: "Westerstraat" };
      if (digits >= 1700 && digits <= 1799) return { city: "Heerhugowaard", street: "Middenweg" };
      if (digits >= 1800 && digits <= 1899) return { city: "Alkmaar", street: "Langestraat" };
      if (digits >= 1900 && digits <= 1999) return { city: "Castricum", street: "Dorpsstraat" };
      if (digits >= 2000 && digits <= 2039) return { city: "Haarlem", street: "Zijlweg" };
      if (digits >= 2040 && digits <= 2099) return { city: "Zandvoort", street: "Haltestraat" };
      if (digits >= 2100 && digits <= 2199) return { city: "Heemstede", street: "Binnenweg" };
      if (digits >= 2200 && digits <= 2299) return { city: "Noordwijk", street: "Hoofdstraat" };
      if (digits >= 2300 && digits <= 2399) return { city: "Leiden", street: "Breestraat" };
      if (digits >= 2400 && digits <= 2409) return { city: "Alphen aan den Rijn", street: "Edisonweg" };
      if (digits >= 2410 && digits <= 2459) return { city: "Bodegraven", street: "Kerkstraat" };
      if (digits >= 2460 && digits <= 2464) return { city: "Ter Aar", street: "Koningin Julianastraat" };
      if (digits >= 2465 && digits <= 2499) return { city: "Nieuwkoop", street: "Dorpsstraat" };
      if (digits >= 2500 && digits <= 2599) return { city: "Den Haag", street: "Spui" };
      if (digits >= 2600 && digits <= 2699) return { city: "Delft", street: "Oude Delft" };
      if (digits >= 2700 && digits <= 2799) return { city: "Zoetermeer", street: "Dorpsstraat" };
      if (digits >= 2800 && digits <= 2899) return { city: "Gouda", street: "Kleiweg" };
      if (digits >= 2900 && digits <= 2999) return { city: "Capelle aan den IJssel", street: "Koperstraat" };
      if (digits >= 3000 && digits <= 3099) return { city: "Rotterdam", street: "Coolsingel" };
      if (digits >= 3100 && digits <= 3199) return { city: "Schiedam", street: "Lange Haven" };
      if (digits >= 3200 && digits <= 3299) return { city: "Spijkenisse", street: "Uitstraat" };
      if (digits >= 3300 && digits <= 3399) return { city: "Dordrecht", street: "Voorstraat" };
      if (digits >= 3400 && digits <= 3499) return { city: "IJsselstein", street: "Benschopperstraat" };
      if (digits >= 3500 && digits <= 3599) return { city: "Utrecht", street: "Vredenburg" };
      if (digits >= 3600 && digits <= 3699) return { city: "Maarssen", street: "Kaatsbaan" };
      if (digits >= 3700 && digits <= 3799) return { city: "Zeist", street: "Slotlaan" };
      if (digits >= 3800 && digits <= 3829) return { city: "Amersfoort", street: "Utrechtseweg" };
      if (digits >= 3830 && digits <= 3899) return { city: "Leusden", street: "Hamersveldseweg" };
      if (digits >= 3900 && digits <= 3999) return { city: "Veenendaal", street: "Hoofdstraat" };
      if (digits >= 4000 && digits <= 4099) return { city: "Tiel", street: "Voorstad" };
      if (digits >= 4100 && digits <= 4199) return { city: "Culemborg", street: "Markt" };
      if (digits >= 4200 && digits <= 4299) return { city: "Gorinchem", street: "Gasthuisstraat" };
      if (digits >= 4300 && digits <= 4399) return { city: "Yerseke", street: "Kerkplein" };
      if (digits >= 4400 && digits <= 4499) return { city: "Schore (Kapelle)", street: "Nieuwe Kerkstraat" };
      if (digits >= 4500 && digits <= 4599) return { city: "Oostburg", street: "Ledelplein" };
      if (digits >= 4600 && digits <= 4699) return { city: "Bergen op Zoom", street: "Wouwsestraat" };
      if (digits >= 4700 && digits <= 4799) return { city: "Roosendaal", street: "Raadhuisstraat" };
      if (digits >= 4800 && digits <= 4899) return { city: "Breda", street: "Grote Markt" };
      if (digits >= 4900 && digits <= 4999) return { city: "Oosterhout", street: "Arendstraat" };
      if (digits >= 5000 && digits <= 5049) return { city: "Tilburg", street: "Spoorlaan" };
      if (digits >= 5050 && digits <= 5099) return { city: "Goirle", street: "De Hovel" };
      if (digits >= 5100 && digits <= 5199) return { city: "Dongen", street: "Hoge Ham" };
      if (digits >= 5200 && digits <= 5299) return { city: "s-Hertogenbosch", street: "Markt" };
      if (digits >= 5300 && digits <= 5399) return { city: "Oss", street: "Heuvel" };
      if (digits >= 5400 && digits <= 5499) return { city: "Uden", street: "Promenade" };
      if (digits >= 5500 && digits <= 5599) return { city: "Veldhoven", street: "Kromstraat" };
      if (digits >= 5600 && digits <= 5659) return { city: "Eindhoven", street: "Stratumseind" };
      if (digits >= 5660 && digits <= 5699) return { city: "Geldrop", street: "Heuvel" };
      if (digits >= 5700 && digits <= 5799) return { city: "Helmond", street: "Veestraat" };
      if (digits >= 5800 && digits <= 5899) return { city: "Venray", street: "Groest" };
      if (digits >= 5900 && digits <= 5999) return { city: "Venlo", street: "Parade" };
      if (digits >= 6000 && digits <= 6099) return { city: "Weert", street: "Langstraat" };
      if (digits >= 6100 && digits <= 6199) return { city: "Echt", street: "Bovenstestraat" };
      if (digits >= 6200 && digits <= 6299) return { city: "Maastricht", street: "Vrijthof" };
      if (digits >= 6300 && digits <= 6399) return { city: "Valkenburg", street: "Grendelplein" };
      if (digits >= 6400 && digits <= 6499) return { city: "Heerlen", street: "Promenade" };
      if (digits >= 6500 && digits <= 6599) return { city: "Nijmegen", street: "Grote Markt" };
      if (digits >= 6600 && digits <= 6699) return { city: "Wijchen", street: "Touwslagersbaan" };
      if (digits >= 6700 && digits <= 6799) return { city: "Wageningen", street: "Hoogstraat" };
      if (digits >= 6800 && digits <= 6899) return { city: "Arnhem", street: "Jansstraat" };
      if (digits >= 6900 && digits <= 6999) return { city: "Zevenaar", street: "Grietsestraat" };
      if (digits >= 7000 && digits <= 7099) return { city: "Doetinchem", street: "Hamburgerstraat" };
      if (digits >= 7100 && digits <= 7199) return { city: "Winterswijk", street: "Wooldstraat" };
      if (digits >= 7200 && digits <= 7299) return { city: "Zutphen", street: "Beukerstraat" };
      if (digits >= 7300 && digits <= 7399) return { city: "Apeldoorn", street: "Hoofdstraat" };
      if (digits >= 7400 && digits <= 7499) return { city: "Deventer", street: "Brink" };
      if (digits >= 7500 && digits <= 7549) return { city: "Enschede", street: "Hengelosestraat" };
      if (digits >= 7550 && digits <= 7599) return { city: "Hengelo", street: "Brinkstraat" };
      if (digits >= 7600 && digits <= 7699) return { city: "Almelo", street: "Grotestraat" };
      if (digits >= 7700 && digits <= 7799) return { city: "Dedemsvaart", street: "Julianastraat" };
      if (digits >= 7800 && digits <= 7899) return { city: "Emmen", street: "Hoofdstraat" };
      if (digits >= 7900 && digits <= 7999) return { city: "Hoogeveen", street: "Hoofdstraat" };
      if (digits >= 8000 && digits <= 8099) return { city: "Zwolle", street: "Diezerstraat" };
      if (digits >= 8100 && digits <= 8199) return { city: "Raalte", street: "Herenstraat" };
      if (digits >= 8200 && digits <= 8299) return { city: "Lelystad", street: "Stadhuisplein" };
      if (digits >= 8300 && digits <= 8399) return { city: "Emmeloord", street: "De Deel" };
      if (digits >= 8400 && digits <= 8499) return { city: "Gorredijk", street: "Hoofdstraat" };
      if (digits >= 8500 && digits <= 8599) return { city: "Joure", street: "Midstraat" };
      if (digits >= 8600 && digits <= 8699) return { city: "Sneek", street: "Oosterdijk" };
      if (digits >= 8700 && digits <= 8799) return { city: "Bolsward", street: "Marktstraat" };
      if (digits >= 8800 && digits <= 8899) return { city: "Franeker", street: "Voorstraat" };
      if (digits >= 8900 && digits <= 8999) return { city: "Leeuwarden", street: "Nieuwestad" };
      if (digits >= 9000 && digits <= 9099) return { city: "Grou", street: "Hoofdstraat" };
      if (digits >= 9100 && digits <= 9199) return { city: "Dokkum", street: "Breedstraat" };
      if (digits >= 9200 && digits <= 9299) return { city: "Drachten", street: "Zuiderbuurt" };
      if (digits >= 9300 && digits <= 9399) return { city: "Roden", street: "Heerestraat" };
      if (digits >= 9400 && digits <= 9499) return { city: "Assen", street: "Brink" };
      if (digits >= 9500 && digits <= 9599) return { city: "Stadskanaal", street: "Europalaan" };
      if (digits >= 9600 && digits <= 9699) return { city: "Hoogezand", street: "Meint Veningastraat" };
      if (digits >= 9700 && digits <= 9749) return { city: "Groningen", street: "Hereweg" };
      if (digits >= 9750 && digits <= 9799) return { city: "Haren", street: "Rijksstraatweg" };
      if (digits >= 9800 && digits <= 9899) return { city: "Zuidhorn", street: "Hoofdstraat" };
      if (digits >= 9900 && digits <= 9999) return { city: "Appingedam", street: "Dijkstraat" };
      return { city: "Alphen aan den Rijn", street: "Koningin Julianastraat" };
    };

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
        const rawResolved = bestDoc.weergavenaam;
        setDeliveryAddress(rawResolved);
        setAddressSuccessMsg(`✓ Gevalideerd adres gevonden: ${rawResolved}`);
      } else {
        const { city, street } = getCityByPostcode(cleanPostcode);
        let formattedPC = cleanPostcode;
        if (cleanPostcode.length >= 4) {
          formattedPC = cleanPostcode.substring(0, 4) + " " + (cleanPostcode.substring(4) || "XX");
        }
        const resolvedAddress = `${street} ${cleanHouse}, ${formattedPC} ${city}`;
        setDeliveryAddress(resolvedAddress);
        setAddressSuccessMsg(`✓ Adres samengesteld: ${resolvedAddress}`);
      }
    } catch (err) {
      const { city, street } = getCityByPostcode(cleanPostcode);
      let formattedPC = cleanPostcode;
      if (cleanPostcode.length >= 4) {
        formattedPC = cleanPostcode.substring(0, 4) + " " + (cleanPostcode.substring(4) || "XX");
      }
      const resolvedAddress = `${street} ${cleanHouse}, ${formattedPC} ${city}`;
      setDeliveryAddress(resolvedAddress);
      setAddressSuccessMsg(`✓ Adres samengesteld: ${resolvedAddress}`);
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
    
    // Simulate real security gateway delays
    setTimeout(async () => {
      try {
        let firstSuccessfulOrder: Order | null = null;
        
        if (cartItems && cartItems.length > 0) {
          for (const item of cartItems) {
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
            const transport = deliveryType === "delivery_with_driver" ? 120 : 0;
            const driver = deliveryType === "delivery_with_driver" ? 150 / cartItems.length : 0;

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
              addons: addonsList
            };

            const result = await onCreateReservation(orderObj);
            if (result && !firstSuccessfulOrder) {
              firstSuccessfulOrder = result;
            }
          }

          setIsSubmitting(false);
          if (firstSuccessfulOrder) {
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
            alert("Er is een fout opgetreden bij de gateway-synchronisatie. Probeer het over een paar momenten opnieuw.");
          }
        }
      } catch (err) {
        setIsSubmitting(false);
      }
    }, 1500);
  };

  const sums = calculationSummary();

  return (
    <div className="relative min-h-[calc(100vh-4.5rem)] py-10 px-4 sm:px-6 lg:px-8 bg-slate-50/50">
      
      {/* Decorative ambient rays */}
      <div className="absolute top-1/5 left-10 h-72 w-72 rounded-full bg-teal-500/5 blur-[100px] -z-10" />

      <div className="mx-auto max-w-6xl">
        
        {/* Step Indicator Header (Hide on Success step) */}
        {step < 4 && (
          <div className="mb-10 text-center space-y-6">
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 flex items-center justify-center space-x-2">
                <span>Rond uw Reservatie Af</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Configureer uw huurperiode en bezorgwijze. Veilig, vakkundig en direct verbonden met ons vlootbeheer.
              </p>
            </div>

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
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              
              {/* Left Form column */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Object header helper */}
                <div className="bg-indigo-50 border border-indigo-100 p-4.5 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-3">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                    <div>
                      <span className="text-[9px] text-indigo-600 block uppercase font-mono font-bold">Reserveringsobject</span>
                      <span className="text-xs sm:text-xs font-extrabold text-slate-900 block mt-0.5">
                        {selectedMachine ? selectedMachine.name : "Kies een machine uit de catalogus"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab("catalog")}
                    className="text-[11px] text-indigo-750 hover:text-white transition-all bg-indigo-50 hover:bg-indigo-600 border border-indigo-200 px-2.5 py-1.5 rounded-lg cursor-pointer border-none"
                  >
                    Wissel Model
                  </button>
                </div>

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
                    isAvailable={isAvailable && cartItems.every(item => {
                      const av = getItemAvailability(
                        item.machine.id, 
                        item.startDate || new Date().toISOString().split("T")[0], 
                        item.endDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
                      );
                      return av.available;
                    })}
                    handleNextStep={handleNextStep}
                    setActiveTab={setActiveTab}
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
                    paymentGateway={paymentGateway}
                    setPaymentGateway={setPaymentGateway}
                    idealBank={idealBank}
                    setIdealBank={setIdealBank}
                    cardNumber={cardNumber}
                    setCardNumber={setCardNumber}
                    cardName={cardName}
                    setCardName={setCardName}
                    cardExpiry={cardExpiry}
                    setCardExpiry={setCardExpiry}
                    cardCVC={cardCVC}
                    setCardCVC={setCardCVC}
                    isSubmitting={isSubmitting}
                    setStep={setStep}
                    handleCreateBooking={handleCreateBooking}
                  />
                )}

              </div>

              {/* Sticky breakdown card logic */}
              <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
                <BookingPriceSummary selectedMachine={cartItems && cartItems.length > 0 ? cartItems[0].machine : null} sums={sums} />
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
            />
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
