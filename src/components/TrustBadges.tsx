/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Star, ShieldCheck, Truck, Layers } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { useLanguageStore } from "../store/languageStore";

/**
 * Compact trust-badge pill row shown directly under the hero CTA's. Echte
 * cijfers alleen: de Google-score komt uit siteConfig (door de admin ingevoerd,
 * zelfde bron als de footer-reviewsectie) en het machinetal is live geteld —
 * zonder ingevoerde score verschijnt er simpelweg geen Google-pill, nooit een
 * verzonnen waarde.
 */
export default function TrustBadges() {
  const t = useLanguageStore((state) => state.t);
  const siteConfig = useAppStore((state) => state.siteConfig);
  const machines = useAppStore((state) => state.machines);

  const googleRating = siteConfig.googleRating ?? null;
  const machineCount = machines.filter((m) => m.isActive !== false).length;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {googleRating != null && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 shadow-sm px-3 py-1.5 text-[11px] font-semibold text-slate-600">
          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 shrink-0" />
          <span><span className="font-black text-slate-900">{googleRating.toFixed(1)}</span> {t("op Google", "on Google", "Google'da")}</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 shadow-sm px-3 py-1.5 text-[11px] font-semibold text-slate-600">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        {t("TÜV-gekeurd · cat. 1-3B", "TÜV-certified · cat. 1-3B", "TÜV sertifikalı · kat. 1-3B")}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 shadow-sm px-3 py-1.5 text-[11px] font-semibold text-slate-600">
        <Truck className="h-3.5 w-3.5 text-orange-500 shrink-0" />
        {t("Snelle levering in heel NL", "Fast delivery across NL", "Tüm Hollanda'ya hızlı teslimat")}
      </span>
      {machineCount >= 5 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 shadow-sm px-3 py-1.5 text-[11px] font-semibold text-slate-600">
          <Layers className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          {t(`${machineCount} machines direct te boeken`, `${machineCount} machines bookable now`, `${machineCount} makine hemen kiralanabilir`)}
        </span>
      )}
    </div>
  );
}
