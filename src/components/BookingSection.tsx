/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Building2, 
  MapPin, 
  Calendar, 
  User, 
  Mail, 
  Phone, 
  ShieldCheck, 
  Truck, 
  Info, 
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  FileText,
  CreditCard,
  XCircle,
  HelpCircle,
  ShieldAlert,
  Sparkle,
  X,
  Search,
  Check,
  TrendingDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Machine, Order, DeliveryType, UserProfile, CartItem } from "../types";

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
  onRemoveCartItem,
  onUpdateCartItemDates,
  onClearCart
}: BookingSectionProps) {
  // Booking Stepper state
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);

  // Address lookup & Inline validation states
  const [validationError, setValidationError] = useState<string | null>(null);
  const [postcode, setPostcode] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [addressSuccessMsg, setAddressSuccessMsg] = useState("");

  // Form Fields State
  const [startDate, setStartDate] = useState<string>("2026-06-05");
  const [endDate, setEndDate] = useState<string>("2026-06-08");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("delivery_with_driver");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>(currentUser ? currentUser.name : "");
  const [customerEmail, setCustomerEmail] = useState<string>(currentUser ? currentUser.email : "");
  const [customerPhone, setCustomerPhone] = useState<string>(currentUser ? currentUser.phone : "");
  const [customerProfile, setCustomerProfile] = useState<string>(currentUser ? currentUser.profileType : "Particulier");

  // Availability checking state
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [overlappingOrders, setOverlappingOrders] = useState<Order[]>([]);
  const [blockedDaysList, setBlockedDaysList] = useState<{ machineId: string; date: string; reason?: string }[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isDateBlocked, setIsDateBlocked] = useState<boolean>(false);
  const [blockingReason, setBlockingReason] = useState<string>("");

  useEffect(() => {
    fetch("/api/orders")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAllOrders(data))
      .catch(() => {});
    fetch("/api/blocked-dates")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setBlockedDaysList(data))
      .catch(() => {});
  }, []);

  // Addon / Shopping Cart Options state
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  // Payment channel and inputs
  const [paymentGateway, setPaymentGateway] = useState<"stripe" | "mollie">("mollie");
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
    } else {
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setCustomerProfile("Particulier");
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
    
    try {
      // 1. Check orders collision
      const response = await fetch("/api/orders");
      if (!response.ok) throw new Error("Could not fetch orders for availability audit");
      const activeOrders: Order[] = await response.json();

      const requestedStart = new Date(start).getTime();
      const requestedEnd = new Date(end).getTime();

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
    if (!start || !end) return { available: true, blocked: false, overlap: false, reason: "" };

    const requestedStart = new Date(start).getTime();
    const requestedEnd = new Date(end).getTime();

    // Check overlaps
    const overlaps = allOrders.filter(o => {
      if (o.machineId !== machineId) return false;
      const orderStart = new Date(o.startDate).getTime();
      const orderEnd = new Date(o.endDate).getTime();
      return (requestedStart <= orderEnd && requestedEnd >= orderStart);
    });

    if (overlaps.length > 0) {
      return { available: false, blocked: false, overlap: true, reason: `Bezet (overlapping met boekingsnummer: ${overlaps[0].id})` };
    }

    // Check manual blocked dates
    const sDate = new Date(start);
    const eDate = new Date(end);
    let curr = new Date(sDate);
    let safetyCounter = 0;
    while (curr <= eDate && safetyCounter < 100) {
      safetyCounter++;
      const currStr = curr.toISOString().split('T')[0];
      const blockedMatch = blockedDaysList.find(b => b.machineId === machineId && b.date === currStr);
      if (blockedMatch) {
        return { available: false, blocked: true, overlap: false, reason: blockedMatch.reason || "Planning gesloten door beheerder" };
      }
      curr.setDate(curr.getDate() + 1);
    }

    return { available: true, blocked: false, overlap: false, reason: "" };
  };

  // Re-run checking whenever days or machine swap
  useEffect(() => {
    if (selectedMachine) {
      checkRealtimeAvailability(selectedMachine.id, startDate, endDate);
    }
  }, [selectedMachine, startDate, endDate]);

  // Recalculate invoice specifics with weekly, monthly & campaign discounts
  const calculationSummary = () => {
    // If we have cartItems list, use the multi-product calculation!
    if (cartItems && cartItems.length > 0) {
      let totalDays = 0;
      let rawSubtotal = 0;
      let discountAmount = 0;
      let subtotal = 0;

      for (const item of cartItems) {
        const itemStart = item.startDate || "2026-06-05";
        const itemEnd = item.endDate || "2026-06-08";
        const start = new Date(itemStart);
        const end = new Date(itemEnd);
        const timeDiff = end.getTime() - start.getTime();
        const days = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1);
        totalDays += days;

        const itemRaw = item.machine.pricePerDay * days;
        let itemDisc = 0;

        if (days >= 30 && item.machine.monthlyDiscountPercent) {
          itemDisc = itemRaw * (item.machine.monthlyDiscountPercent / 100);
        } else if (days >= 7 && item.machine.weeklyDiscountPercent) {
          itemDisc = itemRaw * (item.machine.weeklyDiscountPercent / 100);
        }

        if (item.machine.campaignText) {
          if (item.machine.campaignDiscountPercent) {
            itemDisc += itemRaw * (item.machine.campaignDiscountPercent / 100);
          } else if (item.machine.campaignDiscountAmount) {
            itemDisc += item.machine.campaignDiscountAmount;
          }
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
      const addonDetails: { id: string; name: string; price: number; billing: "daily" | "flat" }[] = [];

      if (selectedAddons.includes("clean")) {
        addonCost += 45 * cartItems.length;
        addonDetails.push({ id: "clean", name: `Reiniging & Schoonmaak Service (${cartItems.length}x)`, price: 45 * cartItems.length, billing: "flat" });
      }
      if (selectedAddons.includes("safety")) {
        addonCost += 15 * totalDays;
        addonDetails.push({ id: "safety", name: "Gecertificeerd Harnas & Veiligheidskit", price: 15 * totalDays, billing: "daily" });
      }
      if (selectedAddons.includes("insurance")) {
        addonCost += 25 * totalDays;
        addonDetails.push({ id: "insurance", name: "Extra All-Risk Schadeverzekering", price: 25 * totalDays, billing: "daily" });
      }

      const vat = (subtotal + transport + driver + addonCost) * 0.21;
      const total = subtotal + transport + driver + addonCost + vat;

      return {
        days: totalDays,
        rawSubtotal,
        discountAmount,
        subtotal,
        transport,
        driver,
        addonCost,
        addonDetails,
        vat,
        total,
        discountLabel: discountAmount > 0 ? "Pakket kortingen toegepast" : ""
      };
    }

    if (!selectedMachine) return { days: 0, rawSubtotal: 0, discountAmount: 0, subtotal: 0, transport: 0, driver: 0, vat: 0, total: 0, discountLabel: "" };
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    const days = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1);

    const rawSubtotal = selectedMachine.pricePerDay * days;
    let discountAmount = 0;
    let discountLabel = "";

    // 1. Check Duration discounts
    if (days >= 30 && selectedMachine.monthlyDiscountPercent) {
      discountAmount = rawSubtotal * (selectedMachine.monthlyDiscountPercent / 100);
      discountLabel = `Maandkorting (${selectedMachine.monthlyDiscountPercent}%)`;
    } else if (days >= 7 && selectedMachine.weeklyDiscountPercent) {
      discountAmount = rawSubtotal * (selectedMachine.weeklyDiscountPercent / 100);
      discountLabel = `Weekkorting (${selectedMachine.weeklyDiscountPercent}%)`;
    }

    // 2. Check Campaign discounts
    if (selectedMachine.campaignText) {
      if (selectedMachine.campaignDiscountPercent) {
        const campDiscount = rawSubtotal * (selectedMachine.campaignDiscountPercent / 100);
        discountAmount += campDiscount;
        discountLabel += (discountLabel ? " + " : "") + `${selectedMachine.campaignText} (-${selectedMachine.campaignDiscountPercent}%)`;
      } else if (selectedMachine.campaignDiscountAmount) {
        discountAmount += selectedMachine.campaignDiscountAmount;
        discountLabel += (discountLabel ? " + " : "") + `${selectedMachine.campaignText} (-€${selectedMachine.campaignDiscountAmount})`;
      }
    }

    const subtotal = Math.max(0, rawSubtotal - discountAmount);
    const transport = deliveryType === "delivery_with_driver" ? 120 : 0;
    const driver = deliveryType === "delivery_with_driver" ? 150 : 0; // Flat chauffeur & safety demonstrator support
    
    // Addon calculation
    let addonCost = 0;
    const addonDetails: { id: string; name: string; price: number; billing: "daily" | "flat" }[] = [];

    if (selectedAddons.includes("clean")) {
      addonCost += 45;
      addonDetails.push({ id: "clean", name: "Reiniging & Schoonmaak Service", price: 45, billing: "flat" });
    }
    if (selectedAddons.includes("safety")) {
      addonCost += 15 * days;
      addonDetails.push({ id: "safety", name: "Gecertificeerd Harnas & Veiligheidskit", price: 15 * days, billing: "daily" });
    }
    if (selectedAddons.includes("insurance")) {
      addonCost += 25 * days;
      addonDetails.push({ id: "insurance", name: "Extra All-Risk Schadeverzekering", price: 25 * days, billing: "daily" });
    }

    const vat = (subtotal + transport + driver + addonCost) * 0.21;
    const total = subtotal + transport + driver + addonCost + vat;

    return {
      days,
      rawSubtotal,
      discountAmount,
      subtotal,
      transport,
      driver,
      addonCost,
      addonDetails,
      vat,
      total,
      discountLabel
    };
  };

  const sums = calculationSummary();

  const handleAddressLookup = async (e: React.MouseEvent) => {
    e.preventDefault();
    setValidationError(null);
    setAddressSuccessMsg("");

    const cleanPostcode = postcode.trim().toUpperCase().replace(/\s+/g, "");
    const cleanHouse = houseNumber.trim();

    if (!cleanPostcode || !cleanHouse) {
      setValidationError("Voer alstublieft een geldige postcode en huisnummer in.");
      return;
    }

    setIsSearchingAddress(true);

    const getCityByPostcode = (pc: string): { city: string; street: string } => {
      const digits = parseInt(pc.slice(0, 4)) || 0;
      if (digits >= 1000 && digits <= 1099) return { city: "Amsterdam", street: "Keizersgracht" };
      if (digits >= 3000 && digits <= 3099) return { city: "Rotterdam", street: "Coolsingel" };
      if (digits >= 3500 && digits <= 3599) return { city: "Utrecht", street: "Vredenburg" };
      if (digits >= 2500 && digits <= 2599) return { city: "Den Haag", street: "Spui" };
      if (digits >= 2400 && digits <= 2409) return { city: "Alphen aan den Rijn", street: "Edisonweg" };
      if (digits >= 2460 && digits <= 2464) return { city: "Ter Aar", street: "Koningin Julianastraat" };
      if (digits >= 3800 && digits <= 3829) return { city: "Amersfoort", street: "Utrechtseweg" };
      if (digits >= 9700 && digits <= 9749) return { city: "Groningen", street: "Hereweg" };
      if (digits >= 5600 && digits <= 5659) return { city: "Eindhoven", street: "Stratumseind" };
      if (digits >= 1300 && digits <= 1379) return { city: "Almere", street: "Marktmeesterstraat" };
      if (digits >= 2000 && digits <= 2039) return { city: "Haarlem", street: "Zijlweg" };
      if (digits >= 7500 && digits <= 7549) return { city: "Enschede", street: "Hengelosestraat" };
      if (digits >= 5000 && digits <= 5049) return { city: "Tilburg", street: "Spoorlaan" };
      return { city: "Alphen aan den Rijn", street: "Koningin Julianastraat" };
    };

    try {
      // Query official Locatieserver free geo indexing service (https://api.pdok.nl/bzk/locatieserver/v3)
      const response = await fetch(
        `https://api.pdok.nl/bzk/locatieserver/v3/free?q=postcode:${cleanPostcode}+AND+huisnummer:${cleanHouse}`
      );
      
      if (!response.ok) {
        throw new Error("Systeem kon locatieserver niet bereiken.");
      }
      
      const data = await response.json();
      
      if (data && data.response && data.response.docs && data.response.docs.length > 0) {
        const bestDoc = data.response.docs[0];
        // weergavenaam has form 'Koningin Julianastraat 176, 2461XJ Ter Aar'
        const rawResolved = bestDoc.weergavenaam;
        setDeliveryAddress(rawResolved);
        setAddressSuccessMsg(`✓ Gevalideerd adres gevonden: ${rawResolved}`);
      } else {
        // Dynamic region identifier fallback
        const { city, street } = getCityByPostcode(cleanPostcode);
        // Format post code visually e.g., 2461 XJ
        let formattedPC = cleanPostcode;
        if (cleanPostcode.length >= 4) {
          formattedPC = cleanPostcode.substring(0, 4) + " " + (cleanPostcode.substring(4) || "XX");
        }
        const resolvedAddress = `${street} ${cleanHouse}, ${formattedPC} ${city}`;
        setDeliveryAddress(resolvedAddress);
        setAddressSuccessMsg(`✓ Adres samengesteld via vlootcoördinaten: ${resolvedAddress}`);
      }
    } catch (err) {
      // Offline fallback
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
        setValidationError("U dient tenminste één machine in uw boekinglijst op te nemen om verder te gaan.");
        return;
      }
      
      for (const item of cartItems) {
        if (!item.startDate || !item.endDate) {
          setValidationError(`Vul alstublieft een geldige huurperiode in voor: ${item.machine.name}.`);
          return;
        }
        if (new Date(item.startDate) > new Date(item.endDate)) {
          setValidationError(`De begindatum van ${item.machine.name} mag niet na de einddatum liggen.`);
          return;
        }
        
        const avail = getItemAvailability(item.machine.id, item.startDate, item.endDate);
        if (!avail.available) {
          setValidationError(`De geselecteerde dates voor "${item.machine.name}" zijn niet beschikbaar. Reden: ${avail.reason}`);
          return;
        }
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
            // Calculate specific sums for this single item so that subtotal matches perfectly
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
            const driver = deliveryType === "delivery_with_driver" ? 150 / cartItems.length : 0; // Distribute chauffeur cost

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
            setSuccessOrder(firstSuccessfulOrder);
            if (onClearCart) onClearCart(); // Empty the cart on checkout success
            setStep(4);
          } else {
            alert("Er is een fout opgetreden bij de gateway-synchronisatie. Probeer het over een paar momenten opnieuw.");
          }
        } else {
          // Legacy single machine selection fallback
          if (!selectedMachine) {
            setIsSubmitting(false);
            return;
          }

          const orderObj: Partial<Order> = {
            machineId: selectedMachine.id,
            machineName: selectedMachine.name,
            machinePrice: selectedMachine.pricePerDay,
            startDate,
            endDate,
            rentalDays: sums.days,
            deliveryType,
            deliveryAddress,
            customerName,
            customerEmail,
            customerPhone,
            customerProfile,
            subtotal: sums.subtotal,
            transportCost: sums.transport,
            driverCost: sums.driver,
            vatAmount: parseFloat(sums.vat.toFixed(2)),
            totalAmount: parseFloat(sums.total.toFixed(2)),
            addons: sums.addonDetails
          };

          const result = await onCreateReservation(orderObj);
          setIsSubmitting(false);
          if (result) {
            setSuccessOrder(result);
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
                        {isActive && !isCurrent ? <CheckCircle2 className="h-4 w-4 text-teal-600" /> : s.number}
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
                    className="text-[11px] text-indigo-750 hover:text-white transition-all bg-indigo-55 bg-indigo-50 hover:bg-indigo-600 border border-indigo-205 border-indigo-200 px-2.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    Wissel Model
                  </button>
                </div>

                {/* STEP 1: DATE SELECT & CAPACITY CHECK */}
                {step === 1 && (
                  <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-3xl space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                      <h3 className="font-display font-black text-base text-slate-900 flex items-center space-x-2">
                        <Calendar className="h-5 w-5 text-indigo-600" />
                        <span>Datumselectie & Capaciteitscontrole</span>
                      </h3>
                      <button
                        onClick={() => setActiveTab("catalog")}
                        className="text-xs text-indigo-700 hover:text-indigo-900 font-bold bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-100 shadow-sm animate-fade-in"
                      >
                        + Voeg machine toe
                      </button>
                    </div>

                    {cartItems.length === 0 ? (
                      <div className="text-center py-10 space-y-4">
                        <div className="mx-auto h-12 w-12 bg-indigo-50 text-indigo-600 flex items-center justify-center rounded-full shadow-sm">
                          <Building2 className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-slate-900 font-bold text-sm">Uw winkelwagen is leeg</p>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                            Selecteer een of meer specialistische hoogwerkers uit onze catalogus om uw offerte of huur te configureren.
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveTab("catalog")}
                          className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all border-none cursor-pointer"
                        >
                          Catalogus Bekijken
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {cartItems.map((item) => {
                          const availability = getItemAvailability(item.machine.id, item.startDate, item.endDate);
                          return (
                            <div key={item.id} className="p-4 rounded-2xl bg-slate-50/50 border border-slate-200 space-y-4 shadow-sm">
                              <div className="flex justify-between items-start gap-4">
                                <div className="flex items-center space-x-3">
                                  <div className="h-12 w-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-mono text-[10px] text-slate-400 overflow-hidden shadow-sm">
                                    <img 
                                      src={item.machine.imageUrl || `/api/placeholder/100/100`} 
                                      alt={item.machine.name} 
                                      className="object-cover h-full w-full"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-extrabold text-slate-900">{item.machine.name}</h4>
                                    <p className="text-[10px] text-slate-500 font-medium font-mono">Tarief: <span className="text-teal-700 font-bold">€{item.machine.pricePerDay},-</span> / dag</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onRemoveCartItem && onRemoveCartItem(item.id)}
                                  className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors border-none cursor-pointer"
                                  title="Verwijderen"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-200">
                                <div className="space-y-1.5">
                                  <label className="text-[10.5px] text-slate-500 block font-bold">Begindatum</label>
                                  <div className="flex items-center bg-white rounded-xl px-2.5 py-2 border border-slate-200 focus-within:border-indigo-500 transition-colors shadow-sm">
                                    <Calendar className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
                                    <input
                                      type="date"
                                      value={item.startDate}
                                      onChange={(e) => onUpdateCartItemDates && onUpdateCartItemDates(item.id, e.target.value, item.endDate)}
                                      className="bg-transparent border-none text-xs text-slate-800 outline-none w-full cursor-pointer font-bold focus:ring-0"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-[10.5px] text-slate-550 block font-bold">Einddatum (Retour)</label>
                                  <div className="flex items-center bg-white rounded-xl px-2.5 py-2 border border-slate-200 focus-within:border-indigo-500 transition-colors shadow-sm">
                                    <Calendar className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
                                    <input
                                      type="date"
                                      value={item.endDate}
                                      onChange={(e) => onUpdateCartItemDates && onUpdateCartItemDates(item.id, item.startDate, e.target.value)}
                                      className="bg-transparent border-none text-xs text-slate-800 outline-none w-full cursor-pointer font-bold focus:ring-0"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Item Availability status bar */}
                              <div className={`p-2.5 rounded-xl border text-[11px] flex items-center space-x-2 shadow-sm ${
                                availability.available
                                  ? "bg-teal-50 border-teal-200 text-teal-800 font-semibold"
                                  : "bg-rose-50 border-rose-205 border-rose-200 text-rose-705 text-rose-700 font-semibold"
                              }`}>
                                {availability.available ? (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                                    <span>Beschikbaar op uw geselecteerde datums!</span>
                                  </>
                                ) : (
                                  <>
                                    <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                                    <span className="font-semibold">{availability.reason}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Logistical preference setup */}
                    <div className="space-y-3.5 pt-4 border-t border-slate-200/80">
                      <span className="text-xs text-slate-600 font-bold uppercase tracking-wider font-mono">Selecteer Logistieke Methode</span>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div
                          onClick={() => {
                            setDeliveryType("self_pickup");
                            setDeliveryAddress("");
                          }}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            deliveryType === "self_pickup" 
                              ? "bg-indigo-50 border-indigo-405 border-indigo-400 shadow-sm" 
                              : "bg-white border-slate-203 border-slate-200 hover:border-indigo-300 shadow-sm"
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 mb-2">
                            <span className="h-7 w-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-teal-650 text-teal-600" />
                            </span>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900">Zelf ophalen bij de Hub</h4>
                              <span className="text-[9.5px] text-slate-400 block font-mono">Geen additioneel transport-tarief</span>
                            </div>
                          </div>
                          <p className="text-[10.5px] text-slate-650 text-slate-650 text-slate-600 leading-normal">
                            U haalt het materieel kosteloos af bij onze hoofdhub in Alphen a/d Rijn. Ervaren aanhangwagen (min. klasse BE) of dieplader is vereist.
                          </p>
                          <span className="text-xs font-mono font-bold text-teal-650 text-teal-600 mt-2 block">Kosteloos / € 0,-</span>
                        </div>

                        <div
                          onClick={() => setDeliveryType("delivery_with_driver")}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            deliveryType === "delivery_with_driver" 
                              ? "bg-indigo-50 border-indigo-405 border-indigo-400 shadow-sm" 
                              : "bg-white border-slate-203 border-slate-200 hover:border-indigo-300 shadow-sm"
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 mb-2">
                            <span className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                              <Truck className="h-4 w-4 text-indigo-605 text-indigo-600" />
                            </span>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900">Transporteren & Chauffeur</h4>
                              <span className="text-[9.5px] text-slate-405 text-slate-400 block font-mono">Met demonstratie en instructie</span>
                            </div>
                          </div>
                          <p className="text-[10.5px] text-slate-650 text-slate-600 leading-normal">
                            Wij leveren de hoogwerker af. Gecertificeerde demonstratie (10 min) en TÜV veiligheidsinstructie zijn contractueel co-verzekerd.
                          </p>
                          <span className="text-xs font-mono font-bold text-indigo-650 text-indigo-600 mt-2 block">€120,- transport + €150,- chauffeur</span>
                        </div>
                      </div>
                    </div>

                    {/* Shopping Basket & Add-ons Selection Row */}
                    <div className="space-y-3.5 pt-5 border-t border-slate-200">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-indigo-700 font-bold uppercase tracking-wider font-mono flex items-center space-x-1.5">
                          <Sparkles className="h-4 w-4 text-indigo-600" />
                          <span>Winkelwagen: Kies Extra Opties & Services</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">Combineer naar wens</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div
                          onClick={() => {
                            if (selectedAddons.includes("clean")) {
                              setSelectedAddons(selectedAddons.filter(x => x !== "clean"));
                            } else {
                              setSelectedAddons([...selectedAddons, "clean"]);
                            }
                          }}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                            selectedAddons.includes("clean") 
                              ? "bg-indigo-50 border-indigo-400 shadow-sm" 
                              : "bg-white border-slate-200 hover:border-indigo-305 hover:border-indigo-300 shadow-sm"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-bold text-slate-900">Schoonmaak service</h4>
                              <input 
                                type="checkbox"
                                checked={selectedAddons.includes("clean")}
                                onChange={()=>{}}
                                className="h-4 w-4 accent-indigo-605 rounded cursor-pointer animate-fade-in"
                              />
                            </div>
                            <p className="text-[10.5px] text-slate-600 leading-normal">
                              Geen zorgen over verfresten, modder of zaagsel. Wij verzorgen de complete eindreiniging na inlevering.
                            </p>
                          </div>
                          <span className="text-xs font-mono font-bold text-teal-700 mt-3 block">€45,- (Eénmalig)</span>
                        </div>

                        <div
                          onClick={() => {
                            if (selectedAddons.includes("safety")) {
                              setSelectedAddons(selectedAddons.filter(x => x !== "safety"));
                            } else {
                              setSelectedAddons([...selectedAddons, "safety"]);
                            }
                          }}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                            selectedAddons.includes("safety") 
                              ? "bg-indigo-50 border-indigo-400 shadow-sm" 
                              : "bg-white border-slate-200 hover:border-indigo-305 hover:border-indigo-300 shadow-sm"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-bold text-slate-900">Veiligheidsset Pro</h4>
                              <input 
                                type="checkbox"
                                checked={selectedAddons.includes("safety")}
                                onChange={()=>{}}
                                className="h-4 w-4 accent-indigo-605 rounded cursor-pointer"
                              />
                            </div>
                            <p className="text-[10.5px] text-slate-650 text-slate-600 leading-normal">
                              Luxe veiligheidsharnas combi, lijn met valdemper en TÜV goedgekeurde bouwhelm met gehoorbescherming.
                            </p>
                          </div>
                          <span className="text-xs font-mono font-bold text-indigo-700 mt-3 block">€15,- / per dag</span>
                        </div>                          <div
                          onClick={() => {
                            if (selectedAddons.includes("insurance")) {
                              setSelectedAddons(selectedAddons.filter(x => x !== "insurance"));
                            } else {
                              setSelectedAddons([...selectedAddons, "insurance"]);
                            }
                          }}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                            selectedAddons.includes("insurance") 
                              ? "bg-indigo-50 border-indigo-400 shadow-sm" 
                              : "bg-white border-slate-200 hover:border-indigo-300 shadow-sm"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-bold text-slate-900">All-Risk Kasko</h4>
                              <input 
                                type="checkbox"
                                checked={selectedAddons.includes("insurance")}
                                onChange={()=>{}}
                                className="h-4 w-4 accent-indigo-600 rounded cursor-pointer"
                              />
                            </div>
                            <p className="text-[10.5px] text-slate-600 leading-normal">
                              Volledige kaskodekking tegen diefstal, stormschade of breuk met een gereduceerd eigen risico van €250.
                            </p>
                          </div>
                          <span className="text-xs font-mono font-bold text-indigo-700 mt-3 block">€25,- / per dag</span>
                        </div>
                      </div>
                    </div>

                    {/* Dynamic inline warning banner replacement */}
                    {validationError && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98, x: -6 }}
                        animate={{ opacity: 1, scale: 1, x: [0, -6, 6, -4, 4, 0] }}
                        transition={{ duration: 0.4 }}
                        className="p-4 bg-rose-50 border-rose-200 border text-rose-800 text-xs rounded-xl flex items-start space-x-2.5 my-3 shadow-sm"
                      >
                        <ShieldAlert className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1 font-semibold leading-normal">
                          <span className="font-extrabold text-slate-900 block mb-0.5">Invoerfout gedetecteerd</span>
                          {validationError}
                        </div>
                        <button onClick={() => setValidationError(null)} className="p-0.5 hover:bg-slate-100 rounded text-rose-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0 border-none">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    )}

                    {/* Step control */}
                    <div className="flex justify-end pt-4 border-t border-slate-100">
                      <button
                        onClick={handleNextStep}
                        disabled={!isAvailable}
                        className={`font-semibold text-xs px-6 py-3 rounded-xl transition-all flex items-center space-x-1.5 border-none shadow-md ${
                          isAvailable 
                            ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95 shadow-indigo-200" 
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        <span>Doorgaan</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                               {/* STEP 2: USER PROFILE & BILLING REGISTRATOR */}
                {step === 2 && (
                  <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-3xl space-y-6 animate-fade-in">
                    <h3 className="font-display font-black text-base text-slate-900 flex items-center space-x-2">
                      <User className="h-5 w-5 text-indigo-600" />
                      <span>Contactgegevens & Bedrijfsprofiel</span>
                    </h3>

                    <p className="text-[11px] text-slate-605 text-slate-600 leading-relaxed border-b border-slate-100 pb-2">
                      {currentUser ? (
                        <>Hieronder staan uw gegevens vooraf ingevuld op basis van uw geactiveerde profiel <strong>{currentUser.name}</strong>. Controleer deze velden voor de BMWT-verhuuromslag.</>
                      ) : (
                        <>Vul uw contact- en adresgegevens in voor de BMWT-verhuurovereenkomst en de transportplanning.</>
                      )}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-600 block font-bold">Naam Contactpersoon</label>
                        <div className="flex items-center bg-white rounded-xl px-3 py-2.5 border border-slate-200 focus-within:border-indigo-500 transition-colors shadow-inner">
                          <User className="h-4 w-4 text-slate-400 mr-2" />
                          <input
                            type="text"
                            required
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Jan de Vries"
                            className="bg-transparent border-none text-xs text-slate-800 font-semibold outline-none w-full focus:ring-0 placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-600 block font-bold">E-mail (Facturatie & SMS updates)</label>
                        <div className="flex items-center bg-white rounded-xl px-3 py-2.5 border border-slate-200 focus-within:border-indigo-505 focus-within:border-indigo-500 transition-colors shadow-inner">
                          <Mail className="h-4 w-4 text-slate-400 mr-2" />
                          <input
                            type="email"
                            required
                            value={customerEmail}
                            onChange={(e) => setCustomerEmail(e.target.value)}
                            placeholder="jan@devriesschilderwerken.nl"
                            className="bg-transparent border-none text-xs text-slate-800 font-semibold outline-none w-full focus:ring-0 placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-600 block font-bold">Telefoonnummer</label>
                        <div className="flex items-center bg-white rounded-xl px-3 py-2.5 border border-slate-200 focus-within:border-indigo-505 focus-within:border-indigo-500 transition-colors shadow-inner">
                          <Phone className="h-4 w-4 text-slate-400 mr-2" />
                          <input
                            type="tel"
                            required
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="+31 6 12345678"
                            className="bg-transparent border-none text-xs text-slate-800 font-semibold outline-none w-full focus:ring-0 placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-600 block font-bold">Sector / Groep</label>
                        <select
                          value={customerProfile}
                          onChange={(e) => setCustomerProfile(e.target.value)}
                          className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-805 text-slate-800 font-bold outline-none focus:border-indigo-500 w-full cursor-pointer h-10.5 shadow-sm"
                        >
                          <option value="Schilder">🎨 Schilder</option>
                          <option value="Hovenier / Groenverzorging">🌳 Hovenier / Groenverzorging</option>
                          <option value="Glazenwasser / Gevelreiniger">🧼 Glazenwasser & Gevelreiniging</option>
                          <option value="Aannemer">🧱 Aannemer</option>
                          <option value="Particulier">🏡 Particulier</option>
                        </select>
                      </div>
                    </div>

                    {/* Address entry with interactive Postcode Lookup */}
                    {deliveryType === "delivery_with_driver" && (
                      <div className="pt-4 border-t border-slate-205 border-slate-200 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <label className="text-xs text-slate-655 text-slate-600 block font-black uppercase tracking-wider flex items-center space-x-1.5">
                            <MapPin className="h-4 w-4 text-indigo-600 shrink-0" />
                            <span className="text-indigo-700">Bezorgadres in Nederland</span>
                          </label>

                          <span className="text-[10px] text-slate-400 font-mono font-bold">
                            Volledig ondersteund in Zuid- & Noord-Holland
                          </span>
                        </div>

                        {/* Interactive Address lookup grid */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 shadow-inner">
                          <span className="text-[10.5px] font-black text-slate-800 block">Sneladresvinder (Nederlands Postcodesysteem)</span>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                            <div className="sm:col-span-12 md:col-span-5 space-y-1">
                              <label className="text-[10.5px] text-slate-500 block font-bold">Postcode</label>
                              <input
                                type="text"
                                placeholder="bijv. 2404 CB"
                                value={postcode}
                                onChange={(e) => {
                                  setPostcode(e.target.value);
                                  setAddressSuccessMsg("");
                                }}
                                className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-bold outline-none font-mono tracking-wider uppercase focus:ring-0 placeholder:text-slate-350 shadow-sm"
                              />
                            </div>

                            <div className="sm:col-span-12 md:col-span-4 space-y-1">
                              <label className="text-[10.5px] text-slate-500 block font-bold">Huisnummer</label>
                              <input
                                type="text"
                                placeholder="bijv. 14"
                                value={houseNumber}
                                onChange={(e) => {
                                  setHouseNumber(e.target.value);
                                  setAddressSuccessMsg("");
                                }}
                                className="w-full bg-white border border-slate-200 focus:border-indigo-505 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-bold outline-none font-mono focus:ring-0 placeholder:text-slate-350 shadow-sm"
                              />
                            </div>

                            <div className="sm:col-span-12 md:col-span-3">
                              <button
                                onClick={handleAddressLookup}
                                disabled={isSearchingAddress}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer h-10 flex items-center justify-center space-x-1.5 shadow-sm active:scale-95 disabled:opacity-50 border-none"
                              >
                                {isSearchingAddress ? (
                                  <span className="h-4.5 w-4.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                ) : (
                                  <>
                                    <Search className="h-3.5 w-3.5" />
                                    <span>Adres Zoeken</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {addressSuccessMsg && (
                            <div className="text-[11px] text-teal-700 font-bold font-mono flex items-center space-x-1.5 pt-1">
                              <Check className="h-4 w-4 shrink-0 bg-teal-50 text-teal-750 p-0.5 rounded-full" />
                              <span>{addressSuccessMsg}</span>
                            </div>
                          )}

                          <div className="pt-2">
                            <label className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider mb-1">Geselecteerd Afleveradres (of handmatig aanpassen)</label>
                            <input
                              type="text"
                              required={deliveryType === "delivery_with_driver"}
                              value={deliveryAddress}
                              onChange={(e) => setDeliveryAddress(e.target.value)}
                              placeholder="Kortingstraat 5, 2404 CB Alphen aan den Rijn"
                              className="w-full bg-white border border-slate-200 focus:border-indigo-505 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 font-semibold outline-none transition-colors focus:ring-0 placeholder:text-slate-400 shadow-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {validationError && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98, x: -6 }}
                        animate={{ opacity: 1, scale: 1, x: [0, -6, 6, -4, 4, 0] }}
                        transition={{ duration: 0.4 }}
                        className="p-4 bg-rose-50 border-rose-200 border text-rose-800 text-xs rounded-xl flex items-start space-x-2.5 my-3 shadow-md"
                      >
                        <ShieldAlert className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1 font-semibold leading-normal">
                          <span className="font-extrabold text-slate-900 block mb-0.5">Contactgegevens onvolledig</span>
                          {validationError}
                        </div>
                        <button onClick={() => setValidationError(null)} className="p-0.5 hover:bg-slate-100 rounded text-rose-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0 border-none">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    )}

                    <div className="flex justify-between pt-4 border-t border-slate-200">
                      <button
                        onClick={() => {
                          setValidationError(null);
                          setStep(1);
                        }}
                        className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 border border-slate-200 cursor-pointer text-left shadow-sm"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Terug</span>
                      </button>

                      <button
                        onClick={handleNextStep}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 border-none cursor-pointer shadow-indigo-100"
                      >
                        <span>Doorgaan</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>

                  </div>
                )}

                {/* STEP 3: MOLLIE & STRIPE GATEWAY PAYMENT INTEGRATION CHECKS */}
                {step === 3 && (
                  <div className="bg-white border border-slate-205 border-slate-200 shadow-sm p-6 rounded-3xl space-y-6 animate-fade-in">
                    <h3 className="font-display font-black text-base text-slate-900 flex items-center space-x-2">
                      <CreditCard className="h-5 w-5 text-indigo-600 animate-pulse" />
                      <span>Veilige Afrekening via Bank of Inkoopkaart</span>
                    </h3>

                    {/* Choose gateway simulation standard */}
                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-500 font-mono font-extrabold uppercase block">Kies Payment Gateway SDK</span>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => setPaymentGateway("mollie")}
                          className={`p-3 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all ${
                            paymentGateway === "mollie" 
                              ? "bg-indigo-50 border-indigo-400 text-indigo-900 shadow-sm" 
                              : "bg-white border-slate-200 text-slate-500 hover:border-slate-350 hover:text-slate-800 hover:bg-slate-50"
                          }`}
                        >
                          <span className="text-xs font-black flex items-center space-x-1.5">
                            <Sparkle className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                            <span>Mollie (Zelf iDEAL, Bancontact)</span>
                          </span>
                        </button>

                        <button
                          onClick={() => setPaymentGateway("stripe")}
                          className={`p-3 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all ${
                            paymentGateway === "stripe" 
                              ? "bg-indigo-50 border-indigo-400 text-indigo-900 shadow-sm" 
                              : "bg-white border-slate-200 text-slate-500 hover:border-slate-350 hover:text-slate-800 hover:bg-slate-50"
                          }`}
                        >
                          <span className="text-xs font-black flex items-center space-x-1.5">
                            <CreditCard className="h-3.5 w-3.5 text-[#635BFF] shrink-0" />
                            <span>Stripe (Inkoopkaart, Creditcard)</span>
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Toggle Payment fields based on integration selected */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 shadow-inner">
                      
                      {paymentGateway === "mollie" ? (
                        /* MOLLIE iDEAL FLOW */
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2 pb-1.5 border-b border-slate-200">
                            <div className="h-2 w-2 rounded-full bg-indigo-600 animate-ping" />
                            <span className="text-xs font-black text-slate-800">Live iDEAL Selectie via Mollie API v2</span>
                          </div>
                          
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-500 font-mono font-extrabold uppercase">Kies uw bank-instelling</label>
                            <select
                              value={idealBank}
                              onChange={(e) => setIdealBank(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-bold outline-none focus:border-indigo-505 focus:border-indigo-500 cursor-pointer h-10.5 shadow-sm"
                            >
                              <option value="rabobank">Rabobank (NL)</option>
                              <option value="ing">ING Bank (NL)</option>
                              <option value="abnamro">ABN AMRO Bank (NL)</option>
                              <option value="sns">SNS Bank (NL)</option>
                              <option value="regiobank">RegioBank (NL)</option>
                            </select>
                          </div>

                          <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-[10.5px] text-slate-600 leading-relaxed">
                            Bij het akkoord gaan, wordt u doorgestuurd naar uw beveiligde bankapplicatie. Na betaling keert u automatisch terug voor het downloaden van uw huurovereenkomst.
                          </div>
                        </div>
                      ) : (
                        /* STRIPE SDK CREDIT CARD FLOW */
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2 pb-1.5 border-b border-slate-200">
                            <div className="h-2 w-2 rounded-full bg-[#635BFF] animate-ping" />
                            <span className="text-xs font-black text-slate-800">Stripe Elements Secure Form</span>
                          </div>

                          {/* Visual Credit Card */}
                          <div className="w-full h-36 rounded-2xl bg-gradient-to-tr from-slate-900 to-indigo-950 border border-white/5 p-4.5 flex flex-col justify-between relative overflow-hidden text-xs text-white font-mono shadow-md">
                            <div className="absolute top-0 right-0 h-28 w-28 bg-[#635BFF]/10 rounded-full blur-2xl pointer-events-none" />
                            <div className="flex justify-between items-start">
                              <span className="font-bold uppercase text-[10px] tracking-widest text-[#635BFF]">Inkoopkaart</span>
                              <CreditCard className="h-6 w-6 text-white" />
                            </div>
                            <div className="text-sm font-bold tracking-[3px] py-1.5">
                              {cardNumber || "•••• •••• •••• ••••"}
                            </div>
                            <div className="flex justify-between items-end text-[10px] uppercase text-slate-400">
                              <div>
                                <span className="text-[8px] block leading-none">Kaarthouder</span>
                                <span className="text-white font-bold leading-normal mt-0.5 block truncate max-w-[130px]">{cardName || "J. de Vries"}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[8px] block leading-none">EXPIRE</span>
                                <span className="text-white font-bold leading-normal mt-0.5 block">{cardExpiry || "MM/JJ"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Stripe Input Entries */}
                          <div className="space-y-3 pt-2">
                            <div className="space-y-1">
                              <label className="text-[9.5px] text-slate-500 block font-bold uppercase">Kaarthouder Naam</label>
                              <input
                                type="text"
                                value={cardName}
                                onChange={(e) => setCardName(e.target.value)}
                                placeholder="Jan de Vries"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-semibold outline-none focus:border-[#635BFF] focus:ring-0 placeholder:text-slate-400 shadow-sm"
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <label className="text-[9.5px] text-slate-500 block font-bold uppercase">Inkoopkaart Nummer (Creditcard)</label>
                              <input
                                type="text"
                                value={cardNumber}
                                onChange={(e) => {
                                  // Simple regex spacing for credit card input
                                  const text = e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim();
                                  setCardNumber(text);
                                }}
                                maxLength={19}
                                placeholder="5248 1234 5678 9921"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-semibold outline-none focus:border-[#635BFF] focus:ring-0 placeholder:text-slate-400 shadow-sm"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[9.5px] text-slate-500 block font-bold uppercase">Vervaldatum</label>
                                <input
                                  type="text"
                                  value={cardExpiry}
                                  onChange={(e) => setCardExpiry(e.target.value)}
                                  placeholder="08/28"
                                  maxLength={5}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-semibold outline-none focus:border-[#635BFF] focus:ring-0 placeholder:text-slate-400 shadow-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9.5px] text-slate-500 block font-bold uppercase">Beveiligingscode (CVC)</label>
                                <input
                                  type="password"
                                  value={cardCVC}
                                  onChange={(e) => setCardCVC(e.target.value)}
                                  placeholder="•••"
                                  maxLength={3}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-semibold outline-none focus:border-[#635BFF] focus:ring-0 placeholder:text-slate-400 shadow-sm"
                                />
                              </div>
                            </div>
                          </div>

                        </div>
                      )}

                    </div>

                    {/* CE Certified Assurance Info */}
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-250 border-emerald-200 flex items-start space-x-2.5 text-[10.5px] text-emerald-805 text-emerald-800 leading-normal leading-relaxed shadow-sm">
                      <ShieldCheck className="h-5 w-5 text-emerald-605 text-emerald-600 shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <strong>BMWT Class-C Verzekeringsdekking:</strong> Uw betaling accrediteert direct de verzekeringsdekking voor windvlagen tot windkracht 6 Beaufort en mechanische schade-indemniteit.
                      </div>
                    </div>

                    <div className="flex justify-between pt-4 border-t border-slate-200">
                      <button
                        onClick={() => setStep(2)}
                        className="bg-slate-50 hover:bg-slate-100 text-slate-705 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center space-x-1 border border-slate-200 cursor-pointer shadow-sm"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Terug</span>
                      </button>

                      <button
                        onClick={handleCreateBooking}
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-extrabold text-xs px-7 py-3 rounded-xl transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer border-none shadow-md shadow-indigo-100"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                            <span>Verwerken...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 text-emerald-100 shrink-0 animate-pulse" />
                            <span>Betaling Geverifieerd ({paymentGateway === 'mollie' ? 'Mollie' : 'Stripe'})</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                )}

              </div>

              {/* Sticky breakdown card logic */}
              <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
                
                {selectedMachine ? (
                  <div className="glass-panel p-5 rounded-3xl space-y-4 shadow-xl">
                    <div className="border-b border-white/5 pb-2.5">
                      <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider text-slate-500">
                        Huur Specificatie
                      </h4>
                    </div>

                    {/* Product Card */}
                    <div className="flex items-center space-x-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 shadow-sm">
                      <div className="h-12 w-16 rounded-lg overflow-hidden bg-slate-200 shrink-0">
                        <img src={selectedMachine.imageUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 truncate leading-none">{selectedMachine.name}</h4>
                        <span className="text-[9.5px] text-teal-700 block font-bold font-mono mt-1.5 leading-none">€ {selectedMachine.pricePerDay} / dag</span>
                      </div>
                    </div>

                    {/* Sum details */}
                    <div className="space-y-2 pt-2 text-xs">
                      
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Aantal dagen gevraagd:</span>
                        <span className="font-bold text-slate-800 font-mono">{sums.days} {sums.days === 1 ? 'dag' : 'dagen'}</span>
                      </div>

                      <div className="flex justify-between items-center text-slate-500">
                        <span>Bruto lokatieduur tarief:</span>
                        <span className="font-bold text-slate-800 font-mono">€ {sums.rawSubtotal}</span>
                      </div>

                      {sums.discountAmount > 0 && (
                        <div className="flex justify-between items-center text-emerald-700 font-bold">
                          <span className="flex items-center space-x-1">
                            <TrendingDown className="h-3 w-3 shrink-0" />
                            <span>{sums.discountLabel}:</span>
                          </span>
                          <span className="font-mono font-bold">- € {sums.discountAmount.toFixed(0)}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-slate-500 border-b border-slate-100 pb-2">
                        <span>Netto lokatieduur tarief:</span>
                        <span className="font-bold text-slate-800 font-mono">€ {sums.subtotal.toFixed(0)}</span>
                      </div>

                      <div className="flex justify-between items-center text-slate-500">
                        <span>Transportkosten (Heen/Weer):</span>
                        <span className="font-bold text-slate-800 font-mono">
                          {sums.transport > 0 ? `€ ${sums.transport}` : "Zelf ophalen"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-slate-500 border-b border-slate-100 pb-2">
                        <span>Chauffeur & Demonstratie:</span>
                        <span className="font-bold text-slate-800 font-mono">
                          {sums.driver > 0 ? `€ ${sums.driver}` : "Enkel Afhalen"}
                        </span>
                      </div>

                      {sums.addonCost > 0 && (
                        <div className="border-b border-slate-100 pb-2">
                          <span className="text-[10px] text-indigo-700 font-mono font-bold uppercase tracking-wider block mb-1">Toegevoegde Extra's (Sepet):</span>
                          <div className="space-y-1">
                            {sums.addonDetails.map(addon => (
                              <div key={addon.id} className="flex justify-between items-center text-slate-500 text-[11px]">
                                <span>• {addon.name}:</span>
                                <span className="font-bold text-teal-700 font-mono">€ {addon.price}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-slate-500">
                        <span>Omzetbelasting BTW (21%):</span>
                        <span className="font-bold text-slate-800 font-mono">€ {sums.vat.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between items-end pt-3 border-t border-slate-100">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-500 font-mono tracking-wider block leading-none">Totaal Overeenkomst</span>
                          <span className="text-[8px] text-slate-400">Inclusief BTW & Training</span>
                        </div>
                        <span className="text-xl font-mono font-black text-indigo-650 text-indigo-600 leading-none">
                          € {sums.total.toFixed(2)}
                        </span>
                      </div>

                    </div>

                  </div>
                ) : (
                  <div className="bg-white border border-slate-205 border-slate-200 p-5 rounded-3xl text-center text-xs text-slate-550 text-slate-500 shadow-sm">
                    Geen materieel object actief.
                  </div>
                )}

              </div>

            </motion.div>
          ) : (
            
            /* SUCCESS CELEBRATION COMPONENT */
            <motion.div
              key="success-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border border-slate-200 shadow-xl max-w-2xl mx-auto p-8 rounded-3xl space-y-6 text-center relative overflow-hidden"
            >
              {/* Green/teal glow radiant */}
              <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-emerald-50 to-transparent -z-10" />

              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-sm animate-bounce mb-2">
                <CheckCircle2 className="h-9 w-9" />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full font-extrabold tracking-wider">
                  Boeking Succesvol Verwerkt
                </span>
                <h1 className="font-display text-2xl font-black text-slate-900 mt-4">
                  Factuur & Overeenkomst Geaccordeerd!
                </h1>
                <p className="text-xs text-slate-600 font-medium mt-2 max-w-md mx-auto">
                  Uw hoogwerker is officieel geregistreerd onder referentienummer{" "}
                  <strong className="text-indigo-600 font-mono">{successOrder?.id}</strong>. Inkoop-betaling is met succes voldaan via de beveiligde <strong className="text-teal-700 uppercase">{paymentGateway} Gateway</strong>.
                </p>
              </div>

              {/* Booking specifications board */}
              {successOrder && (
                <div className="bg-slate-50 p-5 rounded-2xl text-left border border-slate-200 space-y-3 max-w-lg mx-auto text-xs font-semibold shadow-sm">
                  <div className="flex justify-between items-center text-slate-500 pb-1.5 border-b border-slate-100">
                    <span>Huurder:</span>
                    <span className="text-slate-800 font-bold">{successOrder.customerName}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-505 text-slate-500 pb-1.5 border-b border-slate-100">
                    <span>Hoogwerker Model:</span>
                    <span className="text-indigo-700 font-bold">{successOrder.machineName}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-505 text-slate-500 pb-1.5 border-b border-slate-100">
                    <span>Gereserveerde Periode:</span>
                    <span className="text-slate-800 font-bold">{successOrder.startDate} t/m {successOrder.endDate} ({successOrder.rentalDays} {successOrder.rentalDays === 1 ? 'dag' : 'dagen'})</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-505 text-slate-500 pb-1.5 border-b border-slate-100">
                    <span>Logistieke Omgang:</span>
                    <span className="text-teal-700 font-bold">
                      {successOrder.deliveryType === "self_pickup" ? "Zelf ophalen bij de Hub" : "Transport door Hub Chauffeur"}
                    </span>
                  </div>
                  {successOrder.deliveryAddress && (
                    <div className="flex justify-between items-start text-slate-505 text-slate-500 pb-1.5 border-b border-slate-100">
                      <span className="shrink-0 mr-3">Afleveradres:</span>
                      <span className="text-slate-800 text-right leading-snug">{successOrder.deliveryAddress}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 font-bold">Mollie Betaalbedrag:</span>
                    <span className="text-base font-mono font-bold text-teal-700">€ {successOrder.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Action routes */}
              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-6 border-t border-slate-200">
                <button
                  onClick={() => {
                    setStep(1);
                    setSuccessOrder(null);
                    setActiveTab("home");
                  }}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs px-5 py-3 rounded-xl transition-all border border-slate-205 border-slate-200 cursor-pointer shadow-sm"
                >
                  Terug naar Home
                </button>

                <button
                  onClick={() => {
                    setStep(1);
                    setSuccessOrder(null);
                    setActiveTab("orders");
                  }}
                  className="bg-indigo-600 hover:bg-indigo-750 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-md shadow-indigo-100 cursor-pointer border-none"
                >
                  Mijn Bestellingen Bekijken
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
