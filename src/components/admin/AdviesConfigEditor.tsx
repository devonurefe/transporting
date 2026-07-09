/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Sparkles, Save } from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { useAuthStore } from "../../store/authStore";
import { ADVISOR_QUESTIONS, DEFAULT_ADVISOR_FLOW, type AdvisorConfig } from "../../utils/advisor";
import { showAdminToast } from "./AdminToast";

interface Props {
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  adminLanguage?: string;
}

type Overrides = Record<string, { q?: string; options?: Record<string, string> }>;

/**
 * Content-level editor for the Adviestool (product-finder). The owner edits the
 * question texts, option labels, the on/off toggle and the WhatsApp fallback
 * text. Branch structure and matching logic stay in code — only copy is stored
 * (siteConfig.advisorConfig), so scoring can never break from an edit here.
 */
export default function AdviesConfigEditor({ onAddSystemLog, adminLanguage }: Props) {
  const siteConfig = useAppStore((s) => s.siteConfig);
  const updateAdvisorConfig = useAppStore((s) => s.updateAdvisorConfig);
  const adminUser = useAuthStore((s) => s.user);

  const t = (nl: string, en: string, tr: string) =>
    adminLanguage === "tr" ? tr : adminLanguage === "en" ? en : nl;

  const cfg = siteConfig.advisorConfig as AdvisorConfig | null | undefined;

  const [enabled, setEnabled] = useState<boolean>(cfg?.enabled !== false);
  const [waFallback, setWaFallback] = useState<string>(cfg?.waFallback ?? "");
  const [overrides, setOverrides] = useState<Overrides>(cfg?.overrides ?? {});
  const [busy, setBusy] = useState(false);

  // Re-sync when the stored config changes (e.g. after a save round-trip).
  useEffect(() => {
    setEnabled(cfg?.enabled !== false);
    setWaFallback(cfg?.waFallback ?? "");
    setOverrides(cfg?.overrides ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteConfig.advisorConfig]);

  const setQ = (id: string, q: string) =>
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], q } }));
  const setOpt = (id: string, v: string, label: string) =>
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], options: { ...prev[id]?.options, [v]: label } } }));

  // Strip empty strings so blanks fall back to the code defaults.
  const clean = (): AdvisorConfig => {
    const out: Overrides = {};
    for (const q of ADVISOR_QUESTIONS) {
      const entry = overrides[q.id];
      if (!entry) continue;
      const cleaned: { q?: string; options?: Record<string, string> } = {};
      if (entry.q && entry.q.trim()) cleaned.q = entry.q.trim();
      if (entry.options) {
        const opts: Record<string, string> = {};
        for (const [v, lbl] of Object.entries(entry.options)) {
          if (lbl && lbl.trim()) opts[v] = lbl.trim();
        }
        if (Object.keys(opts).length) cleaned.options = opts;
      }
      if (cleaned.q || cleaned.options) out[q.id] = cleaned;
    }
    return { enabled, waFallback: waFallback.trim(), overrides: out };
  };

  const handleSave = async () => {
    setBusy(true);
    const ok = await updateAdvisorConfig(clean());
    setBusy(false);
    if (ok) {
      showAdminToast(t("Adviestool opgeslagen.", "Advisor saved.", "Danışman kaydedildi."), "success");
      onAddSystemLog("system", adminUser?.name ?? "Admin", t("Adviestool-configuratie bijgewerkt.", "Advisor configuration updated.", "Danışman yapılandırması güncellendi."));
    } else {
      showAdminToast(t("Opslaan mislukt.", "Save failed.", "Kaydetme başarısız."), "error");
    }
  };

  const branchLabel = (id: string) =>
    id === "job"
      ? t("gedeeld", "shared", "ortak")
      : id.startsWith("hoogte")
      ? t("tak: op hoogte", "branch: working at height", "dal: yükseklik")
      : id.startsWith("verhuizen")
      ? t("tak: spullen omhoog", "branch: moving up", "dal: taşıma")
      : t("tak: klus", "branch: small job", "dal: iş");

  return (
    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm space-y-4">
      <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
        <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center space-x-1.5">
          <Sparkles className="h-4 w-4 shrink-0 text-indigo-600" />
          <span>{t("Adviestool (Keuzehulp)", "Advisor (Product finder)", "Danışman (Seçim aracı)")}</span>
        </h4>
        {/* Enable toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((e) => !e)}
          className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${enabled ? "bg-indigo-600" : "bg-slate-300"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>

      <p className="text-[10px] text-slate-500">
        {t(
          "Pas hier de teksten van de keuzehulp aan. Laat een veld leeg voor de standaardtekst. De vertakking en het matchen van machines staan vast — alleen de teksten worden opgeslagen.",
          "Edit the wizard copy here. Leave a field empty for the default text. The branching and machine matching are fixed — only copy is stored.",
          "Sihirbaz metinlerini buradan düzenleyin. Varsayılan için boş bırakın. Dallanma ve makine eşleştirme sabittir — yalnızca metinler kaydedilir."
        )}
      </p>

      {/* Questions */}
      <div className="space-y-3">
        {ADVISOR_QUESTIONS.map((q) => (
          <div key={q.id} className="p-3 rounded-xl bg-white border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{branchLabel(q.id)}</span>
            </div>
            <input
              type="text"
              value={overrides[q.id]?.q ?? ""}
              placeholder={q.q}
              onChange={(e) => setQ(q.id, e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
              {q.options.map((o) => (
                <div key={o.v} className="flex items-center gap-1.5">
                  <span className="text-sm shrink-0" aria-hidden="true">{o.icon}</span>
                  <input
                    type="text"
                    value={overrides[q.id]?.options?.[o.v] ?? ""}
                    placeholder={o.label}
                    onChange={(e) => setOpt(q.id, o.v, e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-700 outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* WhatsApp fallback */}
      <div className="p-3 rounded-xl bg-white border border-slate-200">
        <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
          {t("WhatsApp-tekst bij 'geen match'", "WhatsApp text on 'no match'", "'Eşleşme yok' WhatsApp metni")}
        </label>
        <textarea
          rows={2}
          value={waFallback}
          placeholder={DEFAULT_ADVISOR_FLOW.waFallback}
          onChange={(e) => setWaFallback(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] text-slate-700 outline-none focus:border-indigo-500 resize-none"
        />
        <p className="text-[10px] text-slate-400 mt-1">
          {t("Gebruik {samenvatting} voor de antwoorden van de klant.", "Use {samenvatting} for the customer's answers.", "Müşterinin cevapları için {samenvatting} kullanın.")}
        </p>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-xs py-2.5 rounded-xl transition-colors"
      >
        <Save className="h-4 w-4" />
        <span>{t("Adviestool Opslaan", "Save Advisor", "Danışmanı Kaydet")}</span>
      </button>
    </div>
  );
}
