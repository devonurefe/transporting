/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type OrderStatus = "In behandeling" | "Goedgekeurd" | "Onderweg" | "Retour" | "Schade gemeld" | "Voltooid" | "Geannuleerd" | string;

interface StatusStyle {
  solid: string;
  translucent: string;
  label: { nl: string; en: string; tr: string };
}

// Single source of truth for order-status color + label, previously duplicated
// (with small drifting variations) across AdminOrders and AdminPlanning.
export const ORDER_STATUS_STYLES: Record<string, StatusStyle> = {
  "In behandeling": {
    solid: "bg-amber-100 text-amber-700 border border-amber-200",
    translucent: "bg-amber-400/20 text-amber-500 border border-amber-300/30",
    label: { nl: "In behandeling", en: "Pending", tr: "Beklemede" },
  },
  "Goedgekeurd": {
    solid: "bg-teal-100 text-teal-700 border border-teal-200",
    translucent: "bg-teal-500/20 text-teal-500 border border-teal-400/30",
    label: { nl: "Goedgekeurd", en: "Approved", tr: "Onaylandı" },
  },
  "Onderweg": {
    solid: "bg-blue-100 text-blue-700 border border-blue-200",
    translucent: "bg-blue-500/20 text-blue-500 border border-blue-400/30",
    label: { nl: "Onderweg", en: "Dispatched", tr: "Yolda" },
  },
  "Retour": {
    solid: "bg-indigo-100 text-indigo-700 border border-indigo-200",
    translucent: "bg-indigo-500/20 text-indigo-500 border border-indigo-400/30",
    label: { nl: "Retour — controle", en: "Returned — inspection", tr: "İade — kontrol" },
  },
  "Schade gemeld": {
    solid: "bg-orange-100 text-orange-700 border border-orange-200",
    translucent: "bg-orange-500/20 text-orange-500 border border-orange-400/30",
    label: { nl: "Schade gemeld", en: "Damage reported", tr: "Hasar bildirildi" },
  },
  "Geannuleerd": {
    solid: "bg-rose-100 text-rose-700 border border-rose-200",
    translucent: "bg-rose-500/20 text-rose-500 border border-rose-400/30",
    label: { nl: "Geannuleerd", en: "Cancelled", tr: "İptal Edildi" },
  },
  "Voltooid": {
    solid: "bg-slate-100 text-slate-500 border border-slate-200",
    translucent: "bg-slate-700/30 text-slate-400 border border-slate-500/30",
    label: { nl: "Voltooid", en: "Completed", tr: "Tamamlandı" },
  },
};

const FALLBACK_STYLE: StatusStyle = ORDER_STATUS_STYLES["Voltooid"];

interface AdminStatusBadgeProps {
  status: OrderStatus;
  adminLanguage?: string;
  variant?: "solid" | "translucent";
  className?: string;
}

export default function AdminStatusBadge({ status, adminLanguage, variant = "solid", className = "" }: AdminStatusBadgeProps) {
  const style = ORDER_STATUS_STYLES[status] ?? FALLBACK_STYLE;
  const label = adminLanguage === "tr" ? style.label.tr : adminLanguage === "en" ? style.label.en : style.label.nl;
  return (
    <span
      className={`inline-block text-[9.5px] font-mono px-3 py-1 rounded-full font-extrabold uppercase tracking-wider ${
        variant === "translucent" ? style.translucent : style.solid
      } ${className}`}
    >
      {label}
    </span>
  );
}
