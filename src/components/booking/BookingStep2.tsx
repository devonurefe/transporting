/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { User, Mail, Phone, MapPin, Search, Check, ShieldAlert, ArrowLeft, ArrowRight, X, LogIn, Paintbrush, Leaf, Droplets, HardHat, Zap, Hammer, Settings, Home, HelpCircle, ChevronDown, Lock } from "lucide-react";
import { motion } from "motion/react";
import { UserProfile, Machine } from "../../types";
import BookingPriceSummary from "./BookingPriceSummary";
import { HuurGoText } from "../Header";

interface BookingStep2Props {
  currentUser: UserProfile | null;
  isGuestConfirmed: boolean;
  setIsGuestConfirmed: (confirmed: boolean) => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  customerEmail: string;
  setCustomerEmail: (email: string) => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  customerProfile: string;
  setCustomerProfile: (profile: string) => void;
  deliveryType: "self_pickup" | "delivery_by_us" | "trailer_rental";
  postcode: string;
  setPostcode: (pc: string) => void;
  houseNumber: string;
  setHouseNumber: (num: string) => void;
  isSearchingAddress: boolean;
  addressSuccessMsg: string;
  streetName?: string;
  deliveryAddress: string;
  setDeliveryAddress: (address: string) => void;
  handleAddressLookup: (e: React.MouseEvent) => void;
  validationError: string | null;
  setValidationError: (err: string | null) => void;
  setStep: (step: number) => void;
  handleNextStep: () => void;
  setActiveTab?: (tab: string) => void;
  deliveryDistanceKm?: number | null;
  isSubmitting?: boolean;
  bookingError?: string | null;
  sums?: {
    days: number; rawSubtotal: number; subtotal: number; discountAmount: number; discountLabel: string;
    transport: number; driver: number; addonCost: number; addonDetails: { id: string; name: string; price: number }[];
    vat: number; total: number; deliveryType?: string;
    weekendDays?: number; sundayBlockTotal?: number; effectiveDailyRate?: number | null;
    tierLabel?: string | null; isFlatRate?: boolean;
    weeklyBreakdown?: { weeks: number; pricePerWeek: number; remainder: number; dailyRate: number; remainderCost?: number } | null;
    campaignSavings?: number;
  };
  selectedMachine?: Machine | null;
  startDate?: string;
  endDate?: string;
  multiplePeriods?: boolean;
}

const PROFESSIONS = [
  { value: "Schilder",                       label: "Schilder",                      Icon: Paintbrush },
  { value: "Hovenier / Groenverzorging",     label: "Hovenier / Groenverzorging",    Icon: Leaf },
  { value: "Glazenwasser / Gevelreiniger",   label: "Glazenwasser & Gevelreiniging", Icon: Droplets },
  { value: "Aannemer",                       label: "Aannemer",                      Icon: HardHat },
  { value: "Installateur / Elektricien",     label: "Installateur / Elektricien",    Icon: Zap },
  { value: "Dakdekker / Gevelwerker",        label: "Dakdekker & Gevelwerker",       Icon: Hammer },
  { value: "Industrieel Onderhoud",          label: "Industrieel Onderhoud",         Icon: Settings },
  { value: "Particulier",                    label: "Particulier",                   Icon: Home },
  { value: "Overig / Anders",                label: "Overig / Anders",               Icon: HelpCircle },
];

export default function BookingStep2({
  currentUser,
  isGuestConfirmed,
  setIsGuestConfirmed,
  customerName,
  setCustomerName,
  customerEmail,
  setCustomerEmail,
  customerPhone,
  setCustomerPhone,
  customerProfile,
  setCustomerProfile,
  deliveryType,
  postcode,
  setPostcode,
  houseNumber,
  setHouseNumber,
  isSearchingAddress,
  addressSuccessMsg,
  streetName,
  deliveryAddress,
  setDeliveryAddress,
  handleAddressLookup,
  validationError,
  setValidationError,
  setStep,
  handleNextStep,
  setActiveTab,
  sums,
  selectedMachine,
  startDate,
  endDate,
  multiplePeriods,
  deliveryDistanceKm,
  isSubmitting,
  bookingError
}: BookingStep2Props) {
  const [sectorOpen, setSectorOpen] = React.useState(false);
  const selectedProfession = PROFESSIONS.find(p => p.value === customerProfile) ?? PROFESSIONS[0];
  // Set once the customer tries to submit — gates the red "missing field"
  // highlights below so they never show before the first attempt.
  const [attempted, setAttempted] = React.useState(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(customerEmail);
  const phoneOk = /^\d{7,15}$/.test(customerPhone.replace(/[\s\-().+]/g, ""));
  const nameInvalid = attempted && !customerName.trim();
  const emailInvalid = attempted && (!customerEmail.trim() || !emailOk);
  const phoneInvalid = attempted && (!customerPhone.trim() || !phoneOk);
  const addressInvalid = attempted && deliveryType === "delivery_by_us" && !deliveryAddress.trim();
  const fieldBorder = (invalid: boolean) => invalid
    ? "border-rose-400 ring-1 ring-rose-200"
    : "border-slate-200 focus-within:border-slate-400";

  // The error banner above reflects a validation snapshot from the last
  // submit attempt — once the customer actually fixes the field it
  // complained about, clear it immediately instead of leaving it stale.
  React.useEffect(() => {
    if (validationError) setValidationError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerName, customerEmail, customerPhone, deliveryAddress, customerProfile]);

  if (!currentUser && !isGuestConfirmed) {
    return (
      <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl space-y-6 animate-fade-in text-center py-10 text-slate-800">
        <h3 className="font-display font-black text-lg text-slate-900 flex items-center justify-center space-x-2">
          <User className="h-5 w-5 text-slate-700" />
          <span>Hoe wilt u doorgaan?</span>
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Kies of u wilt inloggen met uw <HuurGoText /> account of snel wilt bestellen als gast.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto pt-4">
          {/* Guest Card */}
          <div 
            onClick={() => setIsGuestConfirmed(true)}
            className="p-5 rounded-2xl border border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-all flex flex-col items-center text-center space-y-3 group"
          >
            <div className="h-12 w-12 rounded-xl bg-slate-100 group-hover:bg-slate-100 flex items-center justify-center text-slate-500 group-hover:text-slate-700 transition-colors">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">Doorgaan als gast</h4>
              <p className="text-xs text-slate-500 mt-1 leading-normal">
                Snel boeken zonder account. U vult alleen uw contactgegevens in.
              </p>
            </div>
            <button className="text-xs font-bold text-slate-600 group-hover:text-slate-800 mt-2 bg-transparent border-none cursor-pointer">
              Gast Verder &rarr;
            </button>
          </div>

          {/* Login Card — redirects to customer portal */}
          <div
            onClick={() => setActiveTab && setActiveTab("orders")}
            className="p-5 rounded-2xl border border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-all flex flex-col items-center text-center space-y-3 group"
          >
            <div className="h-12 w-12 rounded-xl bg-slate-100 group-hover:bg-slate-100 flex items-center justify-center text-slate-500 group-hover:text-slate-700 transition-colors">
              <LogIn className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">Inloggen</h4>
              <p className="text-xs text-slate-500 mt-1 leading-normal">
                Log in via het klantportaal — uw gegevens worden automatisch ingevuld.
              </p>
            </div>
            <button className="text-xs font-bold text-slate-600 group-hover:text-slate-800 mt-2 bg-transparent border-none cursor-pointer">
              Naar klantportaal &rarr;
            </button>
          </div>
        </div>

        {sums && (
          <div className="lg:hidden">
            <BookingPriceSummary selectedMachine={selectedMachine ?? null} startDate={startDate} endDate={endDate} multiplePeriods={multiplePeriods} sums={sums} />
          </div>
        )}

        <div className="flex justify-start border-t border-slate-100 pt-4 mt-6">
          <button
            onClick={() => setStep(1)}
            className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 font-bold bg-transparent border-none cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Terug naar Logistiek</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl space-y-6 animate-fade-in">
      <h3 className="font-display font-black text-base text-slate-900 flex items-center space-x-2">
        <User className="h-5 w-5 text-slate-700" />
        <span>Contactgegevens & Bedrijfsprofiel</span>
      </h3>

      <p className="text-xs text-slate-600 leading-relaxed border-b border-slate-100 pb-2">
        {currentUser ? (
          <>Hieronder staan uw gegevens vooraf ingevuld op basis van uw geactiveerde profiel <strong>{currentUser.name}</strong>. Controleer deze velden voor de BMWT-verhuuromslag.</>
        ) : (
          <>U bestelt momenteel als <strong>gast</strong> (geen account vereist). Vul uw contact- en adresgegevens in om direct door te gaan naar de betaling of WhatsApp.</>
        )}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        
        <div className="space-y-1.5">
          <label htmlFor="bs2-name" className="text-xs text-slate-700 block font-bold">Naam Contactpersoon</label>
          <div className={`flex items-center bg-white rounded-xl px-3 py-2.5 border transition-colors shadow-inner ${fieldBorder(nameInvalid)}`}>
            <User className="h-4 w-4 text-slate-400 mr-2" />
            <input
              id="bs2-name"
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
          <label htmlFor="bs2-email" className="text-xs text-slate-700 block font-bold">E-mail (Facturatie & updates)</label>
          <div className={`flex items-center bg-white rounded-xl px-3 py-2.5 border transition-colors shadow-inner ${fieldBorder(emailInvalid)}`}>
            <Mail className="h-4 w-4 text-slate-400 mr-2" />
            <input
              id="bs2-email"
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
          <label htmlFor="bs2-phone" className="text-xs text-slate-700 block font-bold">Telefoonnummer</label>
          <div className={`flex items-center bg-white rounded-xl px-3 py-2.5 border transition-colors shadow-inner ${fieldBorder(phoneInvalid)}`}>
            <Phone className="h-4 w-4 text-slate-400 mr-2" />
            <input
              id="bs2-phone"
              type="tel"
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+31 6 12345678"
              className="bg-transparent border-none text-xs text-slate-800 font-semibold outline-none w-full focus:ring-0 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="space-y-1.5 relative">
          <label className="text-xs text-slate-700 block font-bold">Sector / Groep</label>
          <button
            type="button"
            onClick={() => setSectorOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={sectorOpen}
            aria-label="Selecteer uw vakgebied"
            className="flex items-center justify-between w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-bold outline-none focus:border-slate-400 cursor-pointer shadow-sm hover:border-slate-300 transition-colors"
          >
            <span className="flex items-center gap-2">
              <selectedProfession.Icon className="h-4 w-4 text-slate-500 shrink-0" />
              {selectedProfession.label}
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform shrink-0 ${sectorOpen ? "rotate-180" : ""}`} />
          </button>
          {sectorOpen && (
            <div className="absolute z-[55] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-y-auto max-h-52">
              {PROFESSIONS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => { setCustomerProfile(p.value); setSectorOpen(false); }}
                  className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-semibold text-left transition-colors cursor-pointer border-none ${customerProfile === p.value ? "bg-slate-100 text-slate-900" : "bg-white text-slate-700 hover:bg-slate-50"}`}
                >
                  <p.Icon className={`h-4 w-4 shrink-0 ${customerProfile === p.value ? "text-slate-700" : "text-slate-400"}`} />
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Address entry with interactive Postcode Lookup */}
      {deliveryType === "delivery_by_us" && (
        <div className="pt-4 border-t-2 border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <label className="text-xs text-slate-600 block font-black uppercase tracking-wider flex items-center space-x-1.5">
              <MapPin className="h-4 w-4 text-slate-600 shrink-0" />
              <span className="text-slate-700">Bezorgadres in Nederland</span>
            </label>

            <span className="text-xs text-slate-500 font-medium">
              Volledig ondersteund in Zuid- & Noord-Holland
            </span>
          </div>

          {/* Interactive Address lookup grid */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 shadow-inner">
            <span className="text-xs font-black text-slate-800 block">Sneladresvinder (Nederlands Postcodesysteem)</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-12 md:col-span-5 space-y-1">
                <label htmlFor="bs2-postcode" className="text-xs text-slate-500 block font-bold">Postcode</label>
                <input
                  id="bs2-postcode"
                  type="text"
                  placeholder="bijv. 2404 CB"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  className="w-full min-h-[44px] bg-white border border-slate-200 focus:border-slate-400 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-bold outline-none font-mono tracking-wider uppercase focus:ring-0 placeholder:text-slate-400 shadow-sm"
                />
              </div>

              <div className="sm:col-span-12 md:col-span-4 space-y-1">
                <label htmlFor="bs2-housenumber" className="text-xs text-slate-500 block font-bold">Huisnummer</label>
                <input
                  id="bs2-housenumber"
                  type="text"
                  placeholder="bijv. 14"
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  className="w-full min-h-[44px] bg-white border border-slate-200 focus:border-slate-400 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-bold outline-none font-mono focus:ring-0 placeholder:text-slate-400 shadow-sm"
                />
              </div>

              <div className="sm:col-span-12 md:col-span-3">
                <button
                  onClick={handleAddressLookup}
                  disabled={isSearchingAddress}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer h-10 flex items-center justify-center space-x-1.5 shadow-sm active:scale-95 disabled:opacity-50 border-none"
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

            {/* Street name — auto-filled & locked once the postcode lookup resolves.
                A booking has no valid invoice address without a street. */}
            <div className="space-y-1 pt-1">
              <label className="text-xs text-slate-500 block font-bold flex items-center gap-1">
                <span>Straatnaam</span>
                {streetName && <Lock className="h-3 w-3 text-slate-400" />}
              </label>
              <div className={`flex items-center gap-2 w-full rounded-xl px-3.5 py-2.5 border ${streetName ? "bg-slate-100 border-slate-200" : "bg-white border-slate-200"}`}>
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  readOnly
                  value={streetName || ""}
                  placeholder="Wordt automatisch ingevuld na 'Adres Zoeken'"
                  aria-label="Straatnaam"
                  className="bg-transparent border-none text-xs text-slate-700 font-bold outline-none w-full focus:ring-0 placeholder:text-slate-400 placeholder:font-medium cursor-not-allowed"
                />
              </div>
            </div>

            {addressSuccessMsg && (
              <div className="text-xs text-teal-700 font-bold flex items-start gap-1.5 pt-1">
                <Check className="h-4 w-4 shrink-0 bg-teal-50 text-teal-700 p-0.5 rounded-full mt-px" />
                <span className="leading-relaxed">{addressSuccessMsg}</span>
              </div>
            )}

            {deliveryDistanceKm !== null && deliveryDistanceKm !== undefined && deliveryDistanceKm > 20 && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-800">Buiten 20 km — Prijs op aanvraag</p>
                  <p className="text-xs text-red-600 mt-0.5 leading-relaxed">
                    Uw adres ligt ±{deliveryDistanceKm} km van ons depot. Neem contact op via WhatsApp voor een transportofferte op maat.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-2">
              <label className="text-xs text-slate-500 block font-bold uppercase tracking-wider mb-1">Geselecteerd Afleveradres (of handmatig aanpassen)</label>
              <textarea
                rows={2}
                required={deliveryType === "delivery_by_us"}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Kortingstraat 5, 2404 CB Alphen aan den Rijn"
                className={`w-full bg-white border rounded-xl px-4 py-2.5 text-xs text-slate-800 font-semibold outline-none transition-colors focus:ring-0 placeholder:text-slate-400 shadow-sm resize-none leading-relaxed ${addressInvalid ? "border-rose-400 ring-1 ring-rose-200" : "border-slate-200 focus:border-slate-400"}`}
              />
              {addressInvalid && (
                <p className="text-xs font-bold text-rose-600 mt-1.5 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                  Vul een afleveradres in om door te gaan
                </p>
              )}
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
          <button onClick={() => setValidationError(null)} className="p-0.5 hover:bg-slate-100 rounded text-rose-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0 border-none bg-transparent">
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}

      {sums && (
        <div className="lg:hidden">
          <BookingPriceSummary selectedMachine={selectedMachine ?? null} startDate={startDate} endDate={endDate} multiplePeriods={multiplePeriods} sums={sums} />
        </div>
      )}

      {bookingError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-4 py-3 rounded-xl leading-relaxed">
          {bookingError}
        </div>
      )}

      <div className="pt-4 border-t border-slate-200">
        <div className="flex flex-row items-stretch justify-between gap-3">
          <button
            onClick={() => {
              setValidationError(null);
              setStep(1);
            }}
            className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs px-4 sm:px-5 py-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 border border-slate-200 cursor-pointer shadow-sm shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Terug</span>
          </button>

          <button
            onClick={() => { setAttempted(true); handleNextStep(); }}
            disabled={isSubmitting || !!(deliveryDistanceKm && deliveryDistanceKm > 20)}
            className="cta-shine font-extrabold text-xs px-4 sm:px-7 py-3.5 rounded-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none shadow-md flex-1 sm:flex-initial bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-100/50"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Verwerken...</span>
              </>
            ) : (
              <span>Aanvraag versturen via WhatsApp 💬</span>
            )}
          </button>
        </div>
        {attempted && validationError && (
          <p className="text-xs text-rose-600 font-bold mt-2.5 flex items-center gap-1.5 justify-end">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            Vul de verplichte velden hierboven in om door te gaan
          </p>
        )}
      </div>

    </div>
  );
}
