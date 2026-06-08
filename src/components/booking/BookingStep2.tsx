/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { User, Mail, Phone, MapPin, Search, Check, ShieldAlert, ArrowLeft, ArrowRight, X, LogIn } from "lucide-react";
import { motion } from "motion/react";
import { UserProfile, Machine } from "../../types";
import BookingPriceSummary from "./BookingPriceSummary";

interface BookingStep2Props {
  currentUser: UserProfile | null;
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
  deliveryAddress: string;
  setDeliveryAddress: (address: string) => void;
  handleAddressLookup: (e: React.MouseEvent) => void;
  validationError: string | null;
  setValidationError: (err: string | null) => void;
  setStep: (step: number) => void;
  handleNextStep: () => void;
  setActiveTab?: (tab: string) => void;
  sums?: {
    days: number; rawSubtotal: number; subtotal: number; discountAmount: number; discountLabel: string;
    transport: number; driver: number; addonCost: number; addonDetails: { id: string; name: string; price: number }[];
    vat: number; total: number; borgsom: number;
  };
  selectedMachine?: Machine | null;
}

export default function BookingStep2({
  currentUser,
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
  deliveryAddress,
  setDeliveryAddress,
  handleAddressLookup,
  validationError,
  setValidationError,
  setStep,
  handleNextStep,
  setActiveTab,
  sums,
  selectedMachine
}: BookingStep2Props) {
  const [isGuestConfirmed, setIsGuestConfirmed] = React.useState<boolean>(false);

  if (!currentUser && !isGuestConfirmed) {
    return (
      <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-3xl space-y-6 animate-fade-in text-center py-10 text-slate-800">
        <h3 className="font-display font-black text-lg text-slate-900 flex items-center justify-center space-x-2">
          <User className="h-5 w-5 text-indigo-650 text-indigo-600" />
          <span>Hoe wilt u doorgaan?</span>
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Kies of u wilt inloggen met uw HuurGo account of snel wilt bestellen als gast.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto pt-4">
          {/* Guest Card */}
          <div 
            onClick={() => setIsGuestConfirmed(true)}
            className="p-5 rounded-2xl border border-slate-200 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/10 cursor-pointer transition-all flex flex-col items-center text-center space-y-3 group"
          >
            <div className="h-12 w-12 rounded-xl bg-slate-100 group-hover:bg-indigo-50 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 transition-colors">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">Doorgaan als gast</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                Snel boeken zonder account. U vult alleen uw contactgegevens in.
              </p>
            </div>
            <button className="text-xs font-bold text-indigo-600 group-hover:text-indigo-700 mt-2 bg-transparent border-none cursor-pointer">
              Gast Verder &rarr;
            </button>
          </div>

          {/* Login Card — redirects to customer portal */}
          <div
            onClick={() => setActiveTab && setActiveTab("orders")}
            className="p-5 rounded-2xl border border-slate-200 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/10 cursor-pointer transition-all flex flex-col items-center text-center space-y-3 group"
          >
            <div className="h-12 w-12 rounded-xl bg-slate-100 group-hover:bg-indigo-50 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 transition-colors">
              <LogIn className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">Inloggen</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                Log in via het klantportaal — uw gegevens worden automatisch ingevuld.
              </p>
            </div>
            <button className="text-xs font-bold text-indigo-600 group-hover:text-indigo-700 mt-2 bg-transparent border-none cursor-pointer">
              Naar klantportaal &rarr;
            </button>
          </div>
        </div>

        {sums && (
          <div className="lg:hidden">
            <BookingPriceSummary selectedMachine={selectedMachine ?? null} sums={sums} />
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
    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-3xl space-y-6 animate-fade-in">
      <h3 className="font-display font-black text-base text-slate-900 flex items-center space-x-2">
        <User className="h-5 w-5 text-indigo-650 text-indigo-600" />
        <span>Contactgegevens & Bedrijfsprofiel</span>
      </h3>

      <p className="text-[11px] text-slate-600 leading-relaxed border-b border-slate-100 pb-2">
        {currentUser ? (
          <>Hieronder staan uw gegevens vooraf ingevuld op basis van uw geactiveerde profiel <strong>{currentUser.name}</strong>. Controleer deze velden voor de BMWT-verhuuromslag.</>
        ) : (
          <>U bestelt momenteel als <strong>gast</strong> (geen account vereist). Vul uw contact- en adresgegevens in om direct door te gaan naar de betaling of WhatsApp.</>
        )}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        
        <div className="space-y-1.5">
          <label className="text-xs text-slate-700 block font-bold">Naam Contactpersoon</label>
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
          <label className="text-xs text-slate-700 block font-bold">E-mail (Facturatie & SMS updates)</label>
          <div className="flex items-center bg-white rounded-xl px-3 py-2.5 border border-slate-200 focus-within:border-indigo-500 transition-colors shadow-inner">
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
          <label className="text-xs text-slate-700 block font-bold">Telefoonnummer</label>
          <div className="flex items-center bg-white rounded-xl px-3 py-2.5 border border-slate-200 focus-within:border-indigo-500 transition-colors shadow-inner">
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
          <label className="text-xs text-slate-700 block font-bold">Sector / Groep</label>
          <select
            value={customerProfile}
            onChange={(e) => setCustomerProfile(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-bold outline-none focus:border-indigo-500 w-full cursor-pointer h-10.5 shadow-sm"
          >
            <option value="Schilder">🎨 Schilder</option>
            <option value="Hovenier / Groenverzorging">🌳 Hovenier / Groenverzorging</option>
            <option value="Glazenwasser / Gevelreiniger">🧼 Glazenwasser & Gevelreiniging</option>
            <option value="Aannemer">🧱 Aannemer</option>
            <option value="Installateur / Elektricien">⚡ Installateur / Elektricien</option>
            <option value="Dakdekker / Gevelwerker">🏠 Dakdekker & Gevelwerker</option>
            <option value="Industrieel Onderhoud">⚙️ Industrieel Onderhoud</option>
            <option value="Particulier">🏡 Particulier</option>
            <option value="Overig / Anders">❓ Overig / Anders</option>
          </select>
        </div>
      </div>

      {/* Address entry with interactive Postcode Lookup */}
      {deliveryType === "delivery_by_us" && (
        <div className="pt-4 border-t border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <label className="text-xs text-slate-600 block font-black uppercase tracking-wider flex items-center space-x-1.5">
              <MapPin className="h-4 w-4 text-indigo-650 text-indigo-600 shrink-0" />
              <span className="text-indigo-750 text-indigo-700">Bezorgadres in Nederland</span>
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
                  onChange={(e) => setPostcode(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-bold outline-none font-mono tracking-wider uppercase focus:ring-0 placeholder:text-slate-350 shadow-sm"
                />
              </div>

              <div className="sm:col-span-12 md:col-span-4 space-y-1">
                <label className="text-[10.5px] text-slate-500 block font-bold">Huisnummer</label>
                <input
                  type="text"
                  placeholder="bijv. 14"
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-bold outline-none font-mono focus:ring-0 placeholder:text-slate-350 shadow-sm"
                />
              </div>

              <div className="sm:col-span-12 md:col-span-3">
                <button
                  onClick={handleAddressLookup}
                  disabled={isSearchingAddress}
                  className="w-full bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer h-10 flex items-center justify-center space-x-1.5 shadow-sm active:scale-95 disabled:opacity-50 border-none"
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
                <Check className="h-4 w-4 shrink-0 bg-teal-50 text-teal-700 p-0.5 rounded-full" />
                <span>{addressSuccessMsg}</span>
              </div>
            )}

            <div className="pt-2">
              <label className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider mb-1">Geselecteerd Afleveradres (of handmatig aanpassen)</label>
              <input
                type="text"
                required={deliveryType === "delivery_by_us"}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Kortingstraat 5, 2404 CB Alphen aan den Rijn"
                className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 font-semibold outline-none transition-colors focus:ring-0 placeholder:text-slate-400 shadow-sm"
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
          <button onClick={() => setValidationError(null)} className="p-0.5 hover:bg-slate-100 rounded text-rose-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0 border-none bg-transparent">
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}

      {sums && (
        <div className="lg:hidden">
          <BookingPriceSummary selectedMachine={selectedMachine ?? null} sums={sums} />
        </div>
      )}

      <div className="flex justify-between pt-4 border-t border-slate-200">
        <button
          onClick={() => {
            setValidationError(null);
            setStep(1);
          }}
          className="bg-slate-50 hover:bg-slate-100 text-slate-705 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 border border-slate-200 cursor-pointer text-left shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Terug</span>
        </button>

        <button
          onClick={handleNextStep}
          className="bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 border-none cursor-pointer shadow-indigo-100"
        >
          <span>Doorgaan naar betaling</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

    </div>
  );
}
