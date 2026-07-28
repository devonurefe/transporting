/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Download, FileSpreadsheet, Filter, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { euro } from "../../utils/format";
import { getAdminAuthHeaders } from "../../utils/authHeaders";

interface AdminAccountingProps {
  adminLanguage?: string;
}

// Elke OrderStatus moet hier staan, anders is er geen enkele manier om die
// orders in de omzetrapportage of de CSV te krijgen. "Retour" en "Schade
// gemeld" ontbraken: teruggebrachte maar nog niet afgeronde verhuren vielen
// daardoor volledig uit de cijfers.
const STATUS_OPTIONS = [
  "In behandeling",
  "Goedgekeurd",
  "Onderweg",
  "Retour",
  "Schade gemeld",
  "Voltooid",
  "Geannuleerd",
];

interface ExportSummaryOrder {
  id: string;
  status: string;
  paymentStatus: string | null;
  totalAmount: number;
}

export default function AdminAccounting({ adminLanguage }: AdminAccountingProps) {
  const todayISO = new Date().toISOString().split("T")[0];
  const firstOfMonthISO = todayISO.slice(0, 7) + "-01";

  const [fromDate, setFromDate] = useState(firstOfMonthISO);
  const [toDate, setToDate] = useState(todayISO);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([
    "Goedgekeurd", "Onderweg", "Retour", "Schade gemeld", "Voltooid",
  ]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [lastDownload, setLastDownload] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const dateRangeInvalid = !!fromDate && !!toDate && fromDate > toDate;

  // Server-side filtered summary — mirrors exactly what the CSV download will contain.
  // (The global orders store is capped at 100 most-recent rows for pagination, which
  // silently under-counted older orders here, so the on-screen totals could disagree
  // with the actual export.)
  const [summaryOrders, setSummaryOrders] = useState<ExportSummaryOrder[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  const toggleStatus = (s: string) =>
    setSelectedStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const buildFilterParams = () => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (selectedStatuses.length > 0) params.set("status", selectedStatuses.join(","));
    return params;
  };

  useEffect(() => {
    if (dateRangeInvalid) {
      setSummaryOrders([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoadingSummary(true);
      try {
        const params = buildFilterParams();
        params.set("format", "json");
        const res = await fetch(`/api/orders/export?${params.toString()}`, {
          headers: getAdminAuthHeaders(),
        });
        if (!res.ok) throw new Error();
        const body = await res.json();
        if (!cancelled) setSummaryOrders(body.orders ?? []);
      } catch {
        if (!cancelled) setSummaryOrders([]);
      } finally {
        if (!cancelled) setIsLoadingSummary(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [fromDate, toDate, selectedStatuses, dateRangeInvalid]);

  const totalRevenue = summaryOrders
    .filter((o) => o.status !== "Geannuleerd")
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const paidRevenue = summaryOrders
    .filter((o) => o.paymentStatus === "paid" && o.status !== "Geannuleerd")
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const handleDownload = async () => {
    setIsDownloading(true);
    setExportError(null);
    try {
      const params = buildFilterParams();

      const res = await fetch(`/api/orders/export?${params.toString()}`, {
        headers: getAdminAuthHeaders(),
      });

      if (!res.ok) {
        let msg = t("Export mislukt", "Export failed", "Dışa aktarım başarısız");
        try { const body = await res.json(); if (body?.error) msg = body.error; } catch { /* ignore */ }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `huurgo-orders-${todayISO}.csv`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);

      setLastDownload(new Date().toLocaleTimeString("nl-NL"));
    } catch (e: any) {
      console.error("Export error:", e);
      setExportError(e?.message || t("Er is een fout opgetreden", "An error occurred", "Bir hata oluştu"));
    }
    setIsDownloading(false);
  };

  return (
    <motion.div
      key="accounting-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left: Filters */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-3xl space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Filter className="h-4 w-4 text-amber-500" />
            <h3 className="font-display font-bold text-sm text-slate-900">
              {t("Exportfilters", "Export Filters", "Dışa Aktarma Filtreleri")}
            </h3>
          </div>

          {/* Date range */}
          <div className="space-y-3">
            <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">
              {t("Startdatum periode", "Start date range", "Başlangıç tarihi aralığı")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 block font-bold">{t("Van", "From", "Başlangıç")}</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className={`w-full bg-white border rounded-xl px-3 py-2.5 text-sm text-slate-800 text-center outline-none cursor-pointer ${dateRangeInvalid ? "border-rose-400 focus:border-rose-500" : "border-slate-200 focus:border-amber-400"}`}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 block font-bold">{t("Tot", "To", "Bitiş")}</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className={`w-full bg-white border rounded-xl px-3 py-2.5 text-sm text-slate-800 text-center outline-none cursor-pointer ${dateRangeInvalid ? "border-rose-400 focus:border-rose-500" : "border-slate-200 focus:border-amber-400"}`}
                />
              </div>
            </div>
            {dateRangeInvalid && (
              <p className="text-[10px] text-rose-600 font-bold">
                {t("Begindatum moet vóór of gelijk aan einddatum liggen.", "Start date must be before or equal to end date.", "Başlangıç tarihi bitiş tarihinden önce olmalı.")}
              </p>
            )}
          </div>

          {/* Status filter */}
          <div className="space-y-2">
            <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">
              {t("Status", "Status", "Durum")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                    selectedStatuses.includes(s)
                      ? "bg-amber-500 text-white border-amber-600"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {selectedStatuses.length === 0 && (
              <p className="text-[10px] text-slate-400 italic">
                {t("Geen statusfilter — alle statussen worden geëxporteerd.", "No status filter — all statuses will be exported.", "Durum filtresi yok — tüm durumlar dışa aktarılır.")}
              </p>
            )}
          </div>

          {/* Quick presets */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{t("Snelkeuze", "Quick select", "Hızlı seçim")}</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: t("Deze maand", "This month", "Bu ay"), from: firstOfMonthISO, to: todayISO },
                {
                  label: t("Vorige maand", "Last month", "Geçen ay"),
                  from: (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7) + "-01"; })(),
                  to: (() => { const d = new Date(); d.setDate(0); return d.toISOString().split("T")[0]; })()
                },
                {
                  label: t("Dit jaar", "This year", "Bu yıl"),
                  from: new Date().getFullYear() + "-01-01",
                  to: todayISO
                },
              ].map((p) => {
                const isActive = fromDate === p.from && toDate === p.to;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => { setFromDate(p.from); setToDate(p.to); }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                      isActive
                        ? "bg-amber-500 text-white border-amber-600"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Summary + Download */}
        <div className="lg:col-span-7 space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: t("Geselecteerde orders", "Selected orders", "Seçilen siparişler"), value: isLoadingSummary ? "…" : summaryOrders.length.toString(), color: "text-slate-800" },
              { label: t("Totale omzet", "Total revenue", "Toplam ciro"), value: euro(totalRevenue), color: "text-teal-600" },
              { label: t("Betaald ontvangen", "Paid received", "Ödenen tutar"), value: euro(paidRevenue), color: "text-emerald-600" },
            ].map((stat) => (
              <div key={stat.label} className="glass-panel p-4 rounded-2xl">
                <p className="text-[10px] text-slate-400 font-medium mb-1">{stat.label}</p>
                <p className={`text-sm font-black font-mono ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Download card */}
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <FileSpreadsheet className="h-4 w-4 text-amber-500" />
              <h3 className="font-display font-bold text-sm text-slate-900">
                {t("CSV Export", "CSV Export", "CSV Dışa Aktar")}
              </h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              {t(
                "Exporteer de gefilterde bestellingen als CSV-bestand. Het bestand bevat alle klant-, machine- en financiële gegevens en is direct te openen in Excel of Google Sheets.",
                "Export the filtered orders as a CSV file. The file contains all customer, machine and financial data and can be opened directly in Excel or Google Sheets.",
                "Filtrelenmiş siparişleri CSV dosyası olarak dışa aktarın. Dosya tüm müşteri, makine ve finansal verileri içerir; Excel veya Google Sheets'te doğrudan açılabilir."
              )}
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-[10.5px] text-slate-500 font-mono leading-relaxed">
              {t("Kolommen:", "Columns:", "Sütunlar:")} Order ID · Naam · E-mail · Telefoon · Profiel · Machine · Dagtarief · Startdatum · Einddatum · Dagen · Levertype · Adres · Subtotaal · Transport · Chauffeur · BTW · Totaal · Status · Betaalstatus · Aangemaakt op
            </div>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading || isLoadingSummary || summaryOrders.length === 0 || dateRangeInvalid}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-extrabold text-sm py-3 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2.5 border-none shadow-sm active:scale-95"
            >
              <Download className={`h-4.5 w-4.5 ${isDownloading ? "animate-bounce" : ""}`} />
              <span>
                {isDownloading
                  ? t("Bezig met exporteren…", "Exporting…", "Dışa aktarılıyor…")
                  : isLoadingSummary
                  ? t("Bezig met filteren…", "Filtering…", "Filtreleniyor…")
                  : summaryOrders.length === 0
                  ? t("Geen orders in selectie", "No orders in selection", "Seçimde sipariş yok")
                  : t(`${summaryOrders.length} orders downloaden (CSV)`, `Download ${summaryOrders.length} orders (CSV)`, `${summaryOrders.length} sipariş indir (CSV)`)}
              </span>
            </button>

            {lastDownload && !exportError && (
              <div className="flex items-center gap-1.5 text-[10.5px] text-emerald-600 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{t(`Laatste download: ${lastDownload}`, `Last download: ${lastDownload}`, `Son indirme: ${lastDownload}`)}</span>
              </div>
            )}
            {exportError && (
              <div className="flex items-center gap-1.5 text-[10.5px] text-red-600 font-medium bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <span>⚠ {exportError}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
