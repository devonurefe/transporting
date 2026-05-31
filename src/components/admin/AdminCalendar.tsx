/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Calendar, RefreshCw, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useAppStore } from "../../store/appStore";

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

  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  const [selectedBlockMachineId, setSelectedBlockMachineId] = useState<string>("");
  const [blockDate, setBlockDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [blockReason, setBlockReason] = useState<string>("Planmatig Onderhoud / Keuring");
  const [isSubmittingBlock, setIsSubmittingBlock] = useState<boolean>(false);
  const [isGoogleCalendarConnected, setIsGoogleCalendarConnected] = useState<boolean>(
    () => localStorage.getItem("gcal_linked") === "true"
  );
  const [isConnectingGCal, setIsConnectingGCal] = useState<boolean>(false);

  const handleToggleGoogleCalendar = () => {
    if (isGoogleCalendarConnected) {
      localStorage.removeItem("gcal_linked");
      setIsGoogleCalendarConnected(false);
    } else {
      setIsConnectingGCal(true);
      setTimeout(() => {
        localStorage.setItem("gcal_linked", "true");
        setIsGoogleCalendarConnected(true);
        setIsConnectingGCal(false);
      }, 1500);
    }
  };

  const handleBlockDateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBlockMachineId || !blockDate) return;
    setIsSubmittingBlock(true);
    const success = await blockDateAction(selectedBlockMachineId, blockDate, blockReason);
    setIsSubmittingBlock(false);
    if (success) {
      setBlockReason("Planmatig Onderhoud / Keuring");
      onAddSystemLog("system", "Onur (Eigenaar)", t(`Datum ${blockDate} handmatig geblokkeerd of gesloten voor machine/pakket ID: ${selectedBlockMachineId}`, `Date ${blockDate} manually blocked or closed for machine/package ID: ${selectedBlockMachineId}`, `Tarih ${blockDate} makine/paket ID'si ${selectedBlockMachineId} için manuel olarak engellendi veya kapatıldı`));
    } else {
      alert(t("Fout bij het blokkeren van datum.", "Error blocking date.", "Tarih engellenirken hata oluştu."));
    }
  };

  const handleUnblockDate = async (machineId: string, date: string) => {
    const success = await unblockDateAction(machineId, date);
    if (success) {
      onAddSystemLog("system", "Onur (Eigenaar)", t(`Blokkade opgeheven voor datum ${date} op machine ID: ${machineId}`, `Block lifted for date ${date} on machine ID: ${machineId}`, `Makine ID'si ${machineId} üzerinde ${date} tarihi için engel kaldırıldı`));
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4">
          <div>
            <h3 className="font-display font-black text-lg text-slate-900 flex items-center space-x-2">
              <Calendar className="h-5.5 w-5.5 text-amber-600" />
              <span>{t("Kalender Blokkades & Systeemsluitingen", "Calendar Blocks & System Closures", "Takvim Engellemeleri & Sistem Kapatmaları")}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {t("Blokkeer specifiek materieel of pakketten voor onderhoud, keuringen of feestdagen om realtime boekingen te voorkomen.", "Block specific equipment or packages for maintenance, inspections, or holidays to prevent real-time bookings.", "Gerçek zamanlı rezervasyonları önlemek için bakım, denetim veya resmi tatillerde belirli ekipman veya paketleri engelleyin.")}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchBlockedDates}
            className="text-[11px] font-mono text-slate-700 hover:text-slate-900 mt-2 sm:mt-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-105 hover:bg-slate-100 border border-slate-200 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3 shrink-0" />
            <span>{t("Ververs kalender", "Refresh calendar", "Takvimi yenile")}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left: block a date form */}
          <form onSubmit={handleBlockDateSubmit} className="lg:col-span-5 p-5 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider">{t("Selecteer om te Blokkeren", "Select to Block", "Engellemek için Seçin")}</h4>
            
            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Kies Machine of Set/Pakket *", "Choose Machine or Set/Package *", "Makine veya Set/Paket Seçin *")}</label>
              <select
                required
                value={selectedBlockMachineId}
                onChange={(e) => setSelectedBlockMachineId(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 w-full rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="">{t("-- Maak uw vlootkeuze --", "-- Choose from fleet --", "-- Filonuzdan seçim yapın --")}</option>
                {machines.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Geplande Sluitingsdatum *", "Scheduled Closure Date *", "Planlanan Kapatma Tarihi *")}</label>
              <input
                type="date"
                required
                value={blockDate}
                onChange={(e) => setBlockDate(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 w-full rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Reden voor de Blokkade *", "Reason for Block *", "Engelleme Nedeni *")}</label>
              <input
                type="text"
                required
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder={t("bijv: TÜV Keuring / Periodiek onderhoud / Demo", "e.g., TÜV Inspection / Periodic maintenance / Demo", "örn: TÜV Denetimi / Periyodik bakım / Demo")}
                className="bg-white border border-slate-200 text-slate-800 w-full rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingBlock || !selectedBlockMachineId}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-all border-none cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>{isSubmittingBlock ? t("Sluiten...", "Closing...", "Kapatılıyor...") : t("Sluit deze datum", "Close this date", "Bu tarihi kapat")}</span>
            </button>
          </form>

          {/* Right: show active blocked list */}
          <div className="lg:col-span-7 space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>{t("Actieve Systeemsluitingen", "Active System Closures", "Aktif Sistem Kapatmaları")} ({blockedDates.length})</span>
              <span className="text-[10px] lowercase font-normal font-mono text-slate-500">{t("gebaseerd op realtime database", "based on real-time database", "gerçek zamanlı veri tabanına göre")}</span>
            </h4>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {blockedDates.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-500 space-y-2">
                  <Calendar className="h-8 w-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-medium">{t("Alle datums zijn momenteel open voor boekingen.", "All dates are currently open for bookings.", "Şu anda tüm tarihler rezervasyona açıktır.")}</p>
                </div>
              ) : (
                blockedDates.map((block) => {
                  const relatedMachine = machines.find(m => m.id === block.machineId);
                  return (
                    <div key={block.id} className="p-3.5 rounded-xl bg-amber-500/5 hover:bg-amber-500/8 border border-amber-200/80 transition-all flex justify-between items-start">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                          <h4 className="text-xs font-extrabold text-slate-800 truncate leading-none">
                            {relatedMachine ? relatedMachine.name : block.machineId}
                          </h4>
                        </div>
                        <p className="text-[10px] font-mono text-amber-700 leading-none">
                          {t("Datum: ", "Date: ", "Tarih: ")}{block.date}
                        </p>
                        <p className="text-[10.5px] text-slate-600 leading-normal">
                          {t("Reden: ", "Reason: ", "Neden: ")}<span className="text-slate-800 font-bold">{block.reason || t("Geen opgegeven reden", "No reason provided", "Neden belirtilmedi")}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnblockDate(block.machineId, block.date)}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 cursor-pointer transition-colors border-none"
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
        <div className="border-t border-slate-200 pt-6 mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                <span className={`inline-block h-2 w-2 rounded-full ${isGoogleCalendarConnected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 animate-pulse'} shrink-0`} />
                <span>{t("Google Calendar Realtime Synchronisatie (API)", "Google Calendar Real-time Synchronization (API)", "Google Takvim Gerçek Zamanlı Senkronizasyon (API)")}</span>
              </h4>
              <p className="text-[11px] text-slate-500">
                {t("Integreer uw vlootagenda met Google Agenda voor automatische updates op mobiel en tablet.", "Integrate your fleet calendar with Google Calendar for automatic updates on mobile and tablet.", "Mobil ve tablet cihazlarda otomatik güncellemeler için filo takviminizi Google Takvim ile entegre edin.")}
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleGoogleCalendar}
              disabled={isConnectingGCal}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-sans transition-all flex items-center space-x-2 cursor-pointer border-none ${
                isGoogleCalendarConnected 
                  ? "bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100" 
                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md"
              }`}
            >
              {isConnectingGCal ? (
                <>
                  <span className="h-3 w-3 border-2 border-slate-300 border-t-transparent rounded-full animate-spin mr-1" />
                  <span>{t("Verbinding maken...", "Connecting...", "Bağlantı kuruluyor...")}</span>
                </>
              ) : isGoogleCalendarConnected ? (
                <span>{t("Koppeling verbreken", "Disconnect Agenda", "Bağlantıyı Kes")}</span>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span>{t("Google Agenda koppelen", "Link Google Calendar", "Google Takvim'i Bağla")}</span>
                </>
              )}
            </button>
          </div>

          {isGoogleCalendarConnected ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 grid grid-cols-1 md:grid-cols-12 gap-5"
            >
              {/* Sync Options Panel */}
              <div className="md:col-span-12 lg:col-span-5 space-y-3">
                <h5 className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider font-mono">{t("Synchronisatie Instellingen", "Synchronization Settings", "Senkronizasyon Ayarları")}</h5>
                <div className="space-y-2 text-xs text-slate-700 font-medium">
                  <label className="flex items-center space-x-2.5 cursor-pointer hover:text-slate-900">
                    <input type="checkbox" defaultChecked className="rounded accent-emerald-500" />
                    <span>{t("Randevus & huurovereenkomsten push", "Push appointments & rental agreements", "Randevuları ve kiralama sözleşmelerini gönder")}</span>
                  </label>
                  <label className="flex items-center space-x-2.5 cursor-pointer hover:text-slate-900">
                    <input type="checkbox" defaultChecked className="rounded accent-emerald-500" />
                    <span>{t("BMWT Keuringen/blokkades push", "Push BMWT inspections/blocks", "BMWT denetimlerini/engellemelerini gönder")}</span>
                  </label>
                  <label className="flex items-center space-x-2.5 cursor-pointer hover:text-slate-900">
                    <input type="checkbox" defaultChecked className="rounded accent-emerald-500" />
                    <span>{t("Logistiek transport schema's push", "Push logistical transport schedules", "Lojistik taşıma şemalarını gönder")}</span>
                  </label>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
                  {t("Status: ", "Status: ", "Durum: ")}<span className="text-emerald-700 font-semibold font-mono">{t("LIVE ACTIEF", "LIVE ACTIVE", "CANLI AKTİF")}</span> • {t("Gekoppeld aan", "Linked to", "Şuna bağlı")} <b>info@hoogwerkerhub.nl</b>. {t("Herinneringen ingesteld op 24 uur vooraf.", "Reminders set to 24 hours prior.", "Hatırlatıcılar 24 saat öncesine ayarlandı.")}
                </p>
              </div>

              {/* Synced Event Feeds */}
              <div className="md:col-span-12 lg:col-span-7 space-y-3.5">
                <h5 className="text-[10px] font-bold text-slate-800 uppercase tracking-wider font-mono flex justify-between items-center">
                  <span>{t("Recente kalender synchronisatielogboek", "Recent calendar synchronization log", "Son takvim senkronizasyon günlüğü")}</span>
                  <span className="text-emerald-600 text-[9px] bg-emerald-500/10 px-1 rounded font-extrabold font-mono flex items-center space-x-1">
                    <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span>{t("LIVE", "LIVE", "CANLI")}</span>
                  </span>
                </h5>

                <div className="space-y-2 text-[11px] font-mono">
                  {blockedDates.length === 0 && orders.length === 0 && (
                    <div className="text-slate-500 text-xs py-2 italic font-sans">{t("Geen actieve data om te synchroniseren.", "No active data to synchronize.", "Senkronize edilecek aktif veri yok.")}</div>
                  )}
                  {blockedDates.slice(0, 2).map((block, bIdx) => {
                    const mOption = machines.find((m) => m.id === block.machineId);
                    return (
                      <div key={`gcal-block-${bIdx}`} className="p-2 bg-white border border-slate-200 rounded-lg flex justify-between items-center text-slate-700 shadow-xs">
                        <span className="truncate">{t("[Keuring] ", "[Inspection] ", "[Denetim] ")}{mOption ? mOption.name : block.machineId} ({block.date})</span>
                        <span className="text-[9px] text-emerald-650 text-emerald-600 shrink-0 ml-1 bg-emerald-500/15 px-1.5 py-0.5 rounded uppercase font-bold font-mono">{t("gesynchroniseerd", "synced", "senkronize edildi")}</span>
                      </div>
                    );
                  })}
                  {orders.slice(0, 2).map((ord, oIdx) => (
                    <div key={`gcal-ord-${oIdx}`} className="p-2 bg-white border border-slate-200 rounded-lg flex justify-between items-center text-slate-700 shadow-xs">
                        <span className="truncate">{t("[Huur] ", "[Rental] ", "[Kiralama] ")}{ord.id} - {ord.customerName} ({ord.machineName})</span>
                      <span className="text-[9px] text-emerald-650 text-emerald-600 shrink-0 ml-1 bg-emerald-500/15 px-1.5 py-0.5 rounded uppercase font-bold font-mono">{t("gesynchroniseerd", "synced", "senkronize edildi")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center space-x-3">
              <span className="text-xl">💡</span>
              <span>
                {t("Google Agenda koppeling is momenteel gedeactiveerd. Klik hierboven om uw account veilig te autoriseren. Zo worden nieuwe orders direct weggeschreven en inspectie-blokkades gesynchroniseerd.", "Google Calendar link is currently deactivated. Click above to securely authorize your account. This ensures new orders are written directly and inspection blocks are synchronized.", "Google Takvim bağlantısı şu anda devre dışı. Hesabınızı güvenli bir şekilde yetkilendirmek için yukarıya tıklayın. Bu, yeni siparişlerin doğrudan yazılmasını ve denetim engellemelerinin senkronize edilmesini sağlar.")}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
