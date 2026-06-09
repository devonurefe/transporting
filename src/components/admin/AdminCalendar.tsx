/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Calendar, RefreshCw, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useAppStore } from "../../store/appStore";
import { useAuthStore } from "../../store/authStore";

interface AdminCalendarProps {
  key?: string;
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  adminLanguage?: string;
}

export default function AdminCalendar({ onAddSystemLog, adminLanguage }: AdminCalendarProps) {
  const machines = useAppStore((state) => state.machines);
  const blockedDates = useAppStore((state) => state.blockedDates);
  const orders = useAppStore((state) => state.orders);
  const blockDateAction = useAppStore((state) => state.blockDate);
  const unblockDateAction = useAppStore((state) => state.unblockDate);
  const fetchBlockedDates = useAppStore((state) => state.fetchBlockedDates);
  const adminUser = useAuthStore((state) => state.user);

  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  const [selectedBlockMachineId, setSelectedBlockMachineId] = useState<string>("");
  const [blockDate, setBlockDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [blockEndDate, setBlockEndDate] = useState<string>("");
  const [blockReason, setBlockReason] = useState<string>("Planmatig Onderhoud / Keuring");
  const [isSubmittingBlock, setIsSubmittingBlock] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const handleBlockDateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBlockMachineId || !blockDate) return;
    setIsSubmittingBlock(true);

    // Build list of dates to block (single date or range)
    const datesToBlock: string[] = [];
    const end = blockEndDate && blockEndDate >= blockDate ? blockEndDate : blockDate;
    const cur = new Date(blockDate);
    const endD = new Date(end);
    while (cur <= endD) {
      datesToBlock.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate() + 1);
    }

    let allOk = true;
    for (const d of datesToBlock) {
      const ok = await blockDateAction(selectedBlockMachineId, d, blockReason);
      if (!ok) { allOk = false; break; }
    }

    setIsSubmittingBlock(false);
    if (allOk) {
      setBlockReason("Planmatig Onderhoud / Keuring");
      setBlockEndDate("");
      const rangeLabel = datesToBlock.length > 1 ? `${blockDate} t/m ${end}` : blockDate;
      onAddSystemLog("system", adminUser?.name ?? "Admin", t(`Periode ${rangeLabel} geblokkeerd voor machine ID: ${selectedBlockMachineId}`, `Period ${rangeLabel} blocked for machine ID: ${selectedBlockMachineId}`, `${rangeLabel} tarihleri makine ID'si ${selectedBlockMachineId} için engellendi`));
    } else {
      alert(t("Fout bij het blokkeren van datum.", "Error blocking date.", "Tarih engellenirken hata oluştu."));
    }
  };

  const handleUnblockDate = async (machineId: string, date: string) => {
    const success = await unblockDateAction(machineId, date);
    if (success) {
      onAddSystemLog("system", adminUser?.name ?? "Admin", t(`Blokkade opgeheven voor datum ${date} op machine ID: ${machineId}`, `Block lifted for date ${date} on machine ID: ${machineId}`, `Makine ID'si ${machineId} üzerinde ${date} tarihi için engel kaldırıldı`));
    } else {
      alert(t("Fout bij het vrijgeven van datum.", "Error releasing date.", "Tarih kullanıma açılırken hata oluştu."));
    }
  };

  return (
    <motion.div
      key="calendar"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25 }}
      className="lg:col-span-9 space-y-6 animate-fade-in"
    >
      <div className="glass-panel p-6 rounded-3xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-3">
          <div className="space-y-1">
            <h3 className="font-display font-black text-lg text-slate-900 flex items-start sm:items-center gap-2">
              <Calendar className="h-5.5 w-5.5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
              <span className="flex-1 min-w-0">{t("Kalender Blokkades & Systeemsluitingen", "Calendar Blocks & System Closures", "Takvim Engellemeleri & Sistem Kapatmaları")}</span>
            </h3>
            <p className="text-xs text-slate-500 leading-normal">
              {t("Blokkeer specifiek materieel of pakketten voor onderhoud, keuringen of feestdagen om realtime boekingen te voorkomen.", "Block specific equipment or packages for maintenance, inspections, or holidays to prevent real-time bookings.", "Gerçek zamanlı rezervasyonları önlemek için bakım, denetim veya resmi tatillerde belirli ekipman veya paketleri engelleyin.")}
            </p>
          </div>
          <button
            type="button"
            disabled={isRefreshing}
            onClick={async () => { setIsRefreshing(true); await fetchBlockedDates(); setIsRefreshing(false); }}
            className="text-[11px] font-mono text-slate-700 hover:text-slate-900 flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer shrink-0 self-start sm:self-auto disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 shrink-0 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? t("Verversen...", "Refreshing...", "Yenileniyor...") : t("Ververs kalender", "Refresh calendar", "Takvimi yenile")}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left: block a date form */}
          <form onSubmit={handleBlockDateSubmit} className="lg:col-span-5 p-6 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm space-y-5">
            <h4 className="text-sm font-bold text-amber-600">{t("Selecteer om te Blokkeren", "Select to Block", "Engellemek İçin Seçin")}</h4>

            <div className="space-y-2">
              <label className="text-xs text-slate-700 block font-bold">{t("Kies Machine of Set/Pakket *", "Choose Machine or Set/Package *", "Makine veya Set/Paket Seçin *")}</label>
              <select
                required
                value={selectedBlockMachineId}
                onChange={(e) => setSelectedBlockMachineId(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 w-full rounded-xl px-3 py-3 text-sm outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="">{t("-- Maak uw vlootkeuze --", "-- Choose from fleet --", "-- Filonuzdan seçim yapın --")}</option>
                {machines.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-600 block font-semibold">{t("Begindatum *", "Start Date *", "Başlangıç Tarihi *")}</label>
                <input
                  type="date"
                  required
                  value={blockDate}
                  onChange={(e) => { setBlockDate(e.target.value); if (blockEndDate && blockEndDate < e.target.value) setBlockEndDate(""); }}
                  className="bg-white border border-slate-200 text-slate-800 w-full rounded-xl px-3 py-3 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 cursor-pointer transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-600 block font-semibold">{t("Einddatum", "End Date", "Bitiş Tarihi")}</label>
                <input
                  type="date"
                  value={blockEndDate}
                  min={blockDate}
                  onChange={(e) => setBlockEndDate(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-800 w-full rounded-xl px-3 py-3 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 cursor-pointer transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-700 block font-bold">{t("Reden voor de Blokkade *", "Reason for Block *", "Engelleme Nedeni *")}</label>
              <input
                type="text"
                required
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder={t("bijv: TÜV Keuring / Periodiek onderhoud / Demo", "e.g., TÜV Inspection / Periodic maintenance / Demo", "örn: TÜV Denetimi / Periyodik bakım / Demo")}
                className="bg-white border border-slate-200 text-slate-800 w-full rounded-xl px-3 py-3 text-sm outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingBlock || !selectedBlockMachineId}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl transition-all border-none cursor-pointer flex items-center justify-center space-x-2"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>{isSubmittingBlock ? t("Bezig...", "Processing...", "İşleniyor...") : (blockEndDate && blockEndDate > blockDate ? t("Blokkeer periode", "Block period", "Periyodu Engelle") : t("Blokkeer datum", "Block date", "Tarihi Engelle"))}</span>
            </button>
          </form>

          {/* Right: show active blocked list */}
          <div className="lg:col-span-7 space-y-4">
            <h4 className="text-sm font-bold text-slate-700 flex items-center justify-between">
              <span>{t("Actieve Systeemsluitingen", "Active System Closures", "Aktif Sistem Kapatmaları")} ({blockedDates.length})</span>
              <span className="text-xs font-normal text-slate-400">{t("realtime", "real-time", "gerçek zamanlı veri tabanına göre")}</span>
            </h4>

            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
              {blockedDates.length === 0 ? (
                <div className="p-10 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-500 space-y-2">
                  <Calendar className="h-8 w-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-medium">{t("Alle datums zijn momenteel open voor boekingen.", "All dates are currently open for bookings.", "Şu anda tüm tarihler rezervasyona açıktır.")}</p>
                </div>
              ) : (
                blockedDates.map((block) => {
                  const relatedMachine = machines.find(m => m.id === block.machineId);
                  return (
                    <div key={block.id} className="p-4 rounded-xl bg-amber-500/5 hover:bg-amber-50 border border-amber-200/80 transition-all flex justify-between items-start gap-3">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                          <h4 className="text-sm font-extrabold text-slate-800 leading-tight">
                            {relatedMachine ? relatedMachine.name : block.machineId}
                          </h4>
                        </div>
                        <p className="text-xs font-mono text-amber-700">
                          {t("Datum: ", "Date: ", "Tarih: ")}{block.date}
                        </p>
                        <p className="text-xs text-slate-600">
                          {t("Reden: ", "Reason: ", "Neden: ")}<span className="text-slate-800 font-semibold">{block.reason || t("Geen opgegeven reden", "No reason provided", "Neden belirtilmedi")}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnblockDate(block.machineId, block.date)}
                        className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 cursor-pointer transition-colors shrink-0"
                      >
                        {t("Vrijgeven", "Release", "Kullanıma Aç")}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Google Calendar Linkage Card */}
        <div className="border-t border-slate-200 pt-6 mt-6">
          <div className="flex items-center space-x-2">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-300 shrink-0" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {t("Google Calendar Synchronisatie", "Google Calendar Sync", "Google Takvim Senkronizasyonu")}
            </h4>
            <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Binnenkort</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            {t("Integreer uw vlootagenda met Google Agenda voor automatische updates op mobiel en tablet.", "Integrate your fleet calendar with Google Calendar for automatic updates on mobile and tablet.", "Mobil ve tablet cihazlarda otomatik güncellemeler için filo takviminizi Google Takvim ile entegre edin.")}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
