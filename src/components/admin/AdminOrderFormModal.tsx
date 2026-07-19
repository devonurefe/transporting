/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Loader2, Save, PlusCircle } from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { calculateItemSubtotal, getTransportFees } from "../../utils/pricing";
import { euro } from "../../utils/format";
import type { Machine } from "../../types";

// Shared create/edit form for orders (Faz 1 back-office). The server recomputes
// every price authoritatively (PATCH /api/orders/:id · POST /api/orders/admin);
// the live total shown here is only a preview using the same frontend pricing utils.

const PROFILES = [
  "Schilder", "Hovenier / Groenverzorging", "Glazenwasser / Gevelreiniger",
  "Aannemer", "Installateur / Elektricien", "Dakdekker / Gevelwerker",
  "Industrieel Onderhoud", "Particulier", "Overig / Anders",
];
const DELIVERY_TYPES: { value: string; label: string }[] = [
  { value: "self_pickup", label: "Zelf ophalen" },
  { value: "delivery_by_us", label: "Bezorging door ons" },
  { value: "trailer_rental", label: "Aanhanger huren" },
];

interface AdminOrderFormModalProps {
  mode: "create" | "edit";
  order?: any;               // existing order (edit mode)
  onClose: () => void;
  onSaved: (msg: string) => void;
  adminLanguage?: string;
}

export default function AdminOrderFormModal({ mode, order, onClose, onSaved, adminLanguage }: AdminOrderFormModalProps) {
  const machines = useAppStore((s) => s.machines);
  const campaignRules = useAppStore((s) => s.campaignRules);
  const siteConfig = useAppStore((s) => s.siteConfig);
  const updateOrder = useAppStore((s) => s.updateOrder);
  const createManualOrder = useAppStore((s) => s.createManualOrder);

  const t = (nl: string, en: string, tr: string) => (adminLanguage === "tr" ? tr : adminLanguage === "en" ? en : nl);

  const [machineId, setMachineId] = useState<string>(order?.machineId ?? "");
  const [startDate, setStartDate] = useState<string>(order?.startDate ?? "");
  const [endDate, setEndDate] = useState<string>(order?.endDate ?? "");
  const [customerName, setCustomerName] = useState<string>(order?.customerName ?? "");
  const [customerEmail, setCustomerEmail] = useState<string>(order?.customerEmail ?? "");
  const [customerPhone, setCustomerPhone] = useState<string>(order?.customerPhone ?? "");
  const [customerProfile, setCustomerProfile] = useState<string>(order?.customerProfile ?? "Particulier");
  const [deliveryType, setDeliveryType] = useState<string>(order?.deliveryType ?? "self_pickup");
  const [deliveryAddress, setDeliveryAddress] = useState<string>(order?.deliveryAddress ?? "");
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState<string>(order?.deliveryTimeSlot ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeMachines = useMemo(
    () => machines.filter((m) => m.isActive !== false).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [machines]
  );
  const selectedMachine: Machine | undefined = useMemo(
    () => machines.find((m) => m.id === machineId),
    [machines, machineId]
  );

  // Live price preview (server is authoritative). Mirrors the booking summary math.
  const preview = useMemo(() => {
    if (!selectedMachine || !startDate || !endDate) return null;
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return null;
    const days = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);
    const subtotal = calculateItemSubtotal(selectedMachine, days, customerProfile, campaignRules, startDate);
    const fees = getTransportFees(siteConfig);
    const transport = deliveryType === "self_pickup" ? 0 : deliveryType === "delivery_by_us" ? fees.deliveryFee : fees.trailerPerDay * days;
    const vat = Math.round((subtotal + transport) * 21) / 100;
    return { days, subtotal, transport, vat, total: Math.round((subtotal + transport + vat) * 100) / 100 };
  }, [selectedMachine, startDate, endDate, customerProfile, campaignRules, siteConfig, deliveryType]);

  const pickupOnly = Boolean((selectedMachine as any)?.pickupOnly);

  const handleSubmit = async () => {
    setError(null);
    if (mode === "create" && !machineId) { setError(t("Kies een machine.", "Select a machine.", "Bir makine seçin.")); return; }
    if (!startDate || !endDate) { setError(t("Vul start- en einddatum in.", "Enter start and end date.", "Başlangıç ve bitiş tarihini girin.")); return; }
    if (new Date(endDate) < new Date(startDate)) { setError(t("Einddatum moet op of na de startdatum liggen.", "End date must be on or after start date.", "Bitiş tarihi başlangıçtan önce olamaz.")); return; }
    if (!customerName.trim() || !customerEmail.trim()) { setError(t("Naam en e-mail zijn verplicht.", "Name and email are required.", "Ad ve e-posta zorunludur.")); return; }
    if (pickupOnly && deliveryType !== "self_pickup") { setError(t("Voor dit product is alleen afhalen mogelijk.", "This product is pickup-only.", "Bu ürün yalnızca teslim alınabilir.")); return; }

    setSaving(true);
    if (mode === "create") {
      const payload = {
        machineId, startDate, endDate,
        customerName: customerName.trim(), customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim() || undefined, customerProfile,
        deliveryType, deliveryAddress: deliveryAddress.trim() || undefined,
        deliveryTimeSlot: deliveryTimeSlot || undefined,
      };
      const res = await createManualOrder(payload);
      setSaving(false);
      if (res.ok) { onSaved(t("Bestelling aangemaakt.", "Order created.", "Sipariş oluşturuldu.")); onClose(); }
      else setError(res.error);
    } else {
      // Only send changed fields.
      const patch: Record<string, unknown> = {};
      if (startDate !== order.startDate) patch.startDate = startDate;
      if (endDate !== order.endDate) patch.endDate = endDate;
      if (customerName.trim() !== (order.customerName ?? "")) patch.customerName = customerName.trim();
      if (customerEmail.trim() !== (order.customerEmail ?? "")) patch.customerEmail = customerEmail.trim();
      if (customerPhone.trim() !== (order.customerPhone ?? "")) patch.customerPhone = customerPhone.trim();
      if (customerProfile !== (order.customerProfile ?? "")) patch.customerProfile = customerProfile;
      if (deliveryType !== order.deliveryType) patch.deliveryType = deliveryType;
      if (deliveryAddress.trim() !== (order.deliveryAddress ?? "")) patch.deliveryAddress = deliveryAddress.trim();
      if ((deliveryTimeSlot || null) !== (order.deliveryTimeSlot ?? null)) patch.deliveryTimeSlot = deliveryTimeSlot || "";
      if (Object.keys(patch).length === 0) { setSaving(false); setError(t("Geen wijzigingen.", "No changes.", "Değişiklik yok.")); return; }
      const res = await updateOrder(order.id, patch);
      setSaving(false);
      if (res.ok) { onSaved(t("Bestelling bijgewerkt.", "Order updated.", "Sipariş güncellendi.")); onClose(); }
      else setError(res.error);
    }
  };

  const inputCls = "w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500";
  const labelCls = "text-[11px] text-slate-600 block font-bold mb-1";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
          className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] overflow-y-auto"
        >
          <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between z-10">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              {mode === "create" ? <PlusCircle className="h-4 w-4 text-indigo-600" /> : <Save className="h-4 w-4 text-indigo-600" />}
              {mode === "create" ? t("Nieuwe bestelling", "New order", "Yeni sipariş") : t("Bestelling bewerken", "Edit order", "Siparişi düzenle")}
              {mode === "edit" && <span className="font-mono text-[11px] text-slate-400">{order?.id}</span>}
            </h3>
            <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"><X className="h-4 w-4" /></button>
          </div>

          <div className="p-5 space-y-3.5">
            {mode === "create" && (
              <div>
                <label className={labelCls}>{t("Machine", "Machine", "Makine")}</label>
                <select value={machineId} onChange={(e) => setMachineId(e.target.value)} className={inputCls}>
                  <option value="">{t("— Kies een machine —", "— Select a machine —", "— Makine seçin —")}</option>
                  {activeMachines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
            {mode === "edit" && (
              <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{order?.machineName}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t("Startdatum", "Start date", "Başlangıç")}</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("Einddatum", "End date", "Bitiş")}</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>{t("Klantnaam", "Customer name", "Müşteri adı")}</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>E-mail</label>
                <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("Telefoon", "Phone", "Telefon")}</label>
                <input type="text" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t("Profiel", "Profile", "Profil")}</label>
              <select value={customerProfile} onChange={(e) => setCustomerProfile(e.target.value)} className={inputCls}>
                {PROFILES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t("Bezorgtype", "Delivery", "Teslimat")}</label>
                <select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)} className={inputCls} disabled={pickupOnly}>
                  {DELIVERY_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{t("Tijdslot", "Time slot", "Zaman aralığı")}</label>
                <select value={deliveryTimeSlot} onChange={(e) => setDeliveryTimeSlot(e.target.value)} className={inputCls}>
                  <option value="">{t("Geen", "None", "Yok")}</option>
                  <option value="morning">{t("Ochtend", "Morning", "Sabah")}</option>
                  <option value="afternoon">{t("Middag", "Afternoon", "Öğleden sonra")}</option>
                </select>
              </div>
            </div>
            {deliveryType !== "self_pickup" && (
              <div>
                <label className={labelCls}>{t("Bezorgadres", "Delivery address", "Teslimat adresi")}</label>
                <input type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className={inputCls} />
              </div>
            )}

            {preview && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3.5 py-2.5 text-[11px] text-indigo-900 space-y-0.5">
                <div className="flex justify-between"><span>{t("Huurperiode", "Rental period", "Kiralama süresi")}</span><span className="font-mono">{preview.days} {t("dagen", "days", "gün")}</span></div>
                <div className="flex justify-between"><span>{t("Subtotaal", "Subtotal", "Ara toplam")}</span><span className="font-mono">{euro(preview.subtotal)}</span></div>
                <div className="flex justify-between"><span>{t("Transport", "Transport", "Nakliye")}</span><span className="font-mono">{euro(preview.transport)}</span></div>
                <div className="flex justify-between"><span>BTW 21%</span><span className="font-mono">{euro(preview.vat)}</span></div>
                <div className="flex justify-between font-extrabold border-t border-indigo-200 mt-1 pt-1"><span>{t("Totaal", "Total", "Toplam")}</span><span className="font-mono">{euro(preview.total)}</span></div>
                <p className="text-[10px] text-indigo-500 pt-1">{t("Indicatie — de server berekent het definitieve bedrag.", "Estimate — the server computes the final amount.", "Tahmini — kesin tutarı sunucu hesaplar.")}</p>
              </div>
            )}

            {error && <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 text-[11px] text-rose-700 font-medium">{error}</div>}
          </div>

          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <button onClick={onClose} className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer">{t("Annuleren", "Cancel", "İptal")}</button>
            <button onClick={handleSubmit} disabled={saving} className="flex-1 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {mode === "create" ? t("Aanmaken", "Create", "Oluştur") : t("Opslaan", "Save", "Kaydet")}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
