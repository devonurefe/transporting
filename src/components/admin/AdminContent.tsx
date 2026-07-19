/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  HelpCircle, Star, Clock, Euro, FileText, Search, Tag,
  Plus, Trash2, ShieldCheck, Truck, BadgeCheck, Phone, AlertTriangle
} from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { showAdminToast } from "./AdminToast";
import { FAQ_ITEMS } from "../../data/faq";
import { DEFAULT_PRIVACY_POLICY, DEFAULT_TERMS_CONDITIONS } from "../../data/legalContent";
import { DEFAULT_TRANSPORT_FEES, DEFAULT_GLOBAL_ADDONS } from "../../utils/pricing";
import AdminCampaignRules from "./AdminCampaignRules";

interface AdminContentProps {
  adminLanguage?: string;
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
}

type ContentTab = "faq" | "usp" | "hours" | "fees" | "campaigns" | "seo" | "legal";

const USP_ICON_OPTIONS = ["shield", "clock", "truck", "badge-check", "euro", "phone"] as const;
const USP_ICON_MAP: Record<string, typeof ShieldCheck> = {
  shield: ShieldCheck, clock: Clock, truck: Truck, "badge-check": BadgeCheck, euro: Euro, phone: Phone,
};

export default function AdminContent({ adminLanguage, onAddSystemLog }: AdminContentProps) {
  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  const siteConfig = useAppStore((state) => state.siteConfig);
  const updateSiteConfig = useAppStore((state) => state.updateSiteConfig);
  const [tab, setTab] = useState<ContentTab>("faq");
  const [saving, setSaving] = useState(false);

  // ── Lokale draft-state per sectie, geïnitialiseerd vanuit siteConfig (fallback = code-default) ──
  const [faqItems, setFaqItems] = useState(() => (Array.isArray(siteConfig.faqItems) && siteConfig.faqItems.length > 0 ? siteConfig.faqItems : FAQ_ITEMS));
  const [uspItems, setUspItems] = useState(() => (Array.isArray(siteConfig.uspItems) && siteConfig.uspItems.length > 0
    ? siteConfig.uspItems
    : [
        { icon: "shield", title: "Gecertificeerd materieel", text: "TÜV-gekeurde hoogwerkers (cat. 1-3B), goed onderhouden en bedrijfsklaar afgeleverd." },
        { icon: "truck", title: "Snelle levering in heel NL", text: "Bezorging door eigen chauffeur of zelf ophalen in Zoeterwoude — u kiest wat past." },
        { icon: "phone", title: "Persoonlijk advies via WhatsApp", text: "Twijfelt u over de juiste machine? Wij denken vrijblijvend met u mee, vóór u boekt." },
      ]));
  const [hours, setHours] = useState(() => ({
    monFri: siteConfig.openingHours?.monFri || "Ma – Za: 07:00–19:00",
    sat: siteConfig.openingHours?.sat || "",
    sun: siteConfig.openingHours?.sun || "Zondag gesloten",
  }));
  const [fees, setFees] = useState(() => ({
    deliveryFee: siteConfig.transportFees?.deliveryFee ?? DEFAULT_TRANSPORT_FEES.deliveryFee,
    trailerPerDay: siteConfig.transportFees?.trailerPerDay ?? DEFAULT_TRANSPORT_FEES.trailerPerDay,
  }));
  const [addons, setAddons] = useState(() => ({
    safetyName: siteConfig.globalAddons?.safety?.name || DEFAULT_GLOBAL_ADDONS.safety.name,
    safetyPrice: siteConfig.globalAddons?.safety?.pricePerWeek ?? DEFAULT_GLOBAL_ADDONS.safety.pricePerWeek,
    rijplatenName: siteConfig.globalAddons?.rijplaten?.name || DEFAULT_GLOBAL_ADDONS.rijplaten.name,
    rijplatenPrice: siteConfig.globalAddons?.rijplaten?.pricePerWeek ?? DEFAULT_GLOBAL_ADDONS.rijplaten.pricePerWeek,
  }));
  const [seoTitle, setSeoTitle] = useState(siteConfig.seoTitle || "");
  const [seoDescription, setSeoDescription] = useState(siteConfig.seoDescription || "");
  const [footerDescription, setFooterDescription] = useState(siteConfig.footerDescription || "");
  // Toon de standaard-privacytekst voorgevuld zolang er nog niets is opgeslagen
  // (SiteConfig.privacyPolicy is null), zodat de beheerder de bestaande /privacy-
  // inhoud in het tekstvak ziet en direct kan bijwerken i.p.v. een leeg veld.
  const [privacyPolicy, setPrivacyPolicy] = useState(siteConfig.privacyPolicy || DEFAULT_PRIVACY_POLICY);
  const [termsConditions, setTermsConditions] = useState(siteConfig.termsConditions || DEFAULT_TERMS_CONDITIONS);

  const save = async (payload: Record<string, unknown>, successMsg: string) => {
    setSaving(true);
    const ok = await updateSiteConfig(payload as any);
    setSaving(false);
    showAdminToast(
      ok ? successMsg : t("Opslaan mislukt.", "Save failed.", "Kaydetme başarısız."),
      ok ? "success" : "error"
    );
  };

  const tabs: { id: ContentTab; label: string; icon: typeof HelpCircle }[] = [
    { id: "faq", label: "FAQ", icon: HelpCircle },
    { id: "usp", label: "USP's", icon: Star },
    { id: "hours", label: t("Openingstijden", "Opening hours", "Çalışma saatleri"), icon: Clock },
    { id: "fees", label: t("Tarieven", "Rates", "Ücretler"), icon: Euro },
    { id: "campaigns", label: t("Kortingen", "Discounts", "İndirimler"), icon: Tag },
    { id: "seo", label: "SEO", icon: Search },
    { id: "legal", label: t("Juridisch", "Legal", "Yasal"), icon: FileText },
  ];

  const inputCls = "w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none transition-colors";
  const labelCls = "text-[10px] font-bold text-slate-500 uppercase tracking-wider";
  const btnSave = "text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-xl transition-colors cursor-pointer border-none disabled:opacity-50";

  return (
    <motion.div
      key="content-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4 animate-fade-in"
    >
      {/* Sub-tab nav */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
              tab === tb.id ? "bg-slate-900 text-white border-slate-900" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <tb.icon className="h-3.5 w-3.5" />
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      {tab === "faq" && (
        <div className="glass-panel p-5.5 rounded-3xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="font-display font-bold text-sm text-slate-900">{t("Veelgestelde vragen", "FAQ", "Sıkça Sorulan Sorular")}</h3>
            <button
              onClick={() => setFaqItems((prev) => [...prev, { q: "", a: "" }])}
              className="flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" /> {t("Vraag toevoegen", "Add question", "Soru ekle")}
            </button>
          </div>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    value={item.q}
                    onChange={(e) => setFaqItems((prev) => prev.map((it, j) => j === i ? { ...it, q: e.target.value } : it))}
                    placeholder={t("Vraag", "Question", "Soru")}
                    maxLength={200}
                    className={`${inputCls} flex-1 font-bold min-w-0`}
                  />
                  <button
                    onClick={() => setFaqItems((prev) => prev.filter((_, j) => j !== i))}
                    className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <textarea
                  value={item.a}
                  onChange={(e) => setFaqItems((prev) => prev.map((it, j) => j === i ? { ...it, a: e.target.value } : it))}
                  placeholder={t("Antwoord", "Answer", "Cevap")}
                  maxLength={2000}
                  rows={3}
                  className={`${inputCls} resize-y leading-relaxed`}
                />
              </div>
            ))}
          </div>
          <button disabled={saving} onClick={() => save({ faqItems: faqItems.filter((it) => it.q && it.a).slice(0, 40) }, t("FAQ opgeslagen.", "FAQ saved.", "SSS kaydedildi."))} className={btnSave}>
            {t("Opslaan", "Save", "Kaydet")}
          </button>
        </div>
      )}

      {/* ── USP's ───────────────────────────────────────────────────────── */}
      {tab === "usp" && (
        <div className="glass-panel p-5.5 rounded-3xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="font-display font-bold text-sm text-slate-900">{t("USP's op de homepage", "Homepage USPs", "Ana sayfa USP'leri")}</h3>
            {uspItems.length < 8 && (
              <button
                onClick={() => setUspItems((prev) => [...prev, { icon: "shield", title: "", text: "" }])}
                className="flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="h-3 w-3" /> {t("USP toevoegen", "Add USP", "USP ekle")}
              </button>
            )}
          </div>
          <div className="space-y-3">
            {uspItems.map((item, i) => {
              const Icon = USP_ICON_MAP[item.icon] ?? ShieldCheck;
              return (
                <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  {/* Icoonkeuze op eigen regel — 6 knoppen + titel + verwijderen paste
                      nooit op één regel op mobiel, dus altijd gestapeld (niet alleen sm:). */}
                  <div className="flex flex-wrap gap-1.5">
                    {USP_ICON_OPTIONS.map((ic) => {
                      const OptIcon = USP_ICON_MAP[ic];
                      return (
                        <button
                          key={ic}
                          onClick={() => setUspItems((prev) => prev.map((it, j) => j === i ? { ...it, icon: ic } : it))}
                          className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center border cursor-pointer transition-colors ${
                            item.icon === ic ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          <OptIcon className="h-3.5 w-3.5" />
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={item.title}
                      onChange={(e) => setUspItems((prev) => prev.map((it, j) => j === i ? { ...it, title: e.target.value } : it))}
                      placeholder={t("Titel", "Title", "Başlık")}
                      maxLength={100}
                      className={`${inputCls} flex-1 font-bold min-w-0`}
                    />
                    <button
                      onClick={() => setUspItems((prev) => prev.filter((_, j) => j !== i))}
                      className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={item.text}
                    onChange={(e) => setUspItems((prev) => prev.map((it, j) => j === i ? { ...it, text: e.target.value } : it))}
                    placeholder={t("Tekst", "Text", "Metin")}
                    maxLength={400}
                    rows={3}
                    className={`${inputCls} resize-y leading-relaxed`}
                  />
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Icon className="h-3 w-3" /> {t("Voorbeeld-icoon", "Preview icon", "Önizleme simgesi")}
                  </div>
                </div>
              );
            })}
          </div>
          <button disabled={saving} onClick={() => save({ uspItems: uspItems.filter((it) => it.title && it.text).slice(0, 8) }, t("USP's opgeslagen.", "USPs saved.", "USP'ler kaydedildi."))} className={btnSave}>
            {t("Opslaan", "Save", "Kaydet")}
          </button>
        </div>
      )}

      {/* ── Openingstijden ──────────────────────────────────────────────── */}
      {tab === "hours" && (
        <div className="glass-panel p-5.5 rounded-3xl space-y-4">
          <h3 className="font-display font-bold text-sm text-slate-900 border-b border-slate-200 pb-3">{t("Openingstijden", "Opening hours", "Çalışma saatleri")}</h3>
          <p className="text-[11px] text-slate-500">
            {t("Getoond in de footer en in WhatsApp-berichten bij zelf-ophalen.", "Shown in the footer and in WhatsApp messages for self pickup.", "Footer'da ve kendin al mesajlarında gösterilir.")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
            <div className="space-y-1">
              <label className={labelCls}>{t("Ma–Vr", "Mon–Fri", "Pzt–Cum")}</label>
              <input value={hours.monFri} onChange={(e) => setHours((h) => ({ ...h, monFri: e.target.value }))} maxLength={60} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>{t("Zaterdag", "Saturday", "Cumartesi")}</label>
              <input value={hours.sat} onChange={(e) => setHours((h) => ({ ...h, sat: e.target.value }))} maxLength={60} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>{t("Zondag", "Sunday", "Pazar")}</label>
              <input value={hours.sun} onChange={(e) => setHours((h) => ({ ...h, sun: e.target.value }))} maxLength={60} className={inputCls} />
            </div>
          </div>
          <button disabled={saving} onClick={() => save({ openingHours: hours }, t("Openingstijden opgeslagen.", "Opening hours saved.", "Çalışma saatleri kaydedildi."))} className={btnSave}>
            {t("Opslaan", "Save", "Kaydet")}
          </button>
        </div>
      )}

      {/* ── Tarieven ────────────────────────────────────────────────────── */}
      {tab === "fees" && (
        <div className="glass-panel p-5.5 rounded-3xl space-y-4">
          <h3 className="font-display font-bold text-sm text-slate-900 border-b border-slate-200 pb-3">{t("Transport- en add-on-tarieven", "Transport & add-on rates", "Nakliye ve ek ürün ücretleri")}</h3>
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 font-semibold leading-snug">
              {t(
                "Wijzigingen zijn direct actief in de boekingsflow voor nieuwe paginabezoeken. Een klant met een al open tabblad blijft het oude tarief zien totdat die de pagina ververst — de server rekent bij het afronden altijd het nieuwe tarief af.",
                "Changes take effect immediately in the booking flow for new page visits. A customer with an already-open tab keeps seeing the old rate until they reload the page — the server always charges the new rate at checkout.",
                "Değişiklikler yeni sayfa ziyaretlerinde rezervasyon akışında hemen etkili olur. Sekmesi zaten açık olan bir müşteri sayfayı yenileyene kadar eski ücreti görmeye devam eder — sunucu ödeme sırasında her zaman yeni ücreti uygular."
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
            <div className="space-y-1">
              <label className={labelCls}>{t("Bezorging heen + terug (€)", "Delivery there + back (€)", "Teslimat gidiş+dönüş (€)")}</label>
              <input type="number" min={0} max={1000} step={0.01} value={fees.deliveryFee} onChange={(e) => setFees((f) => ({ ...f, deliveryFee: Number(e.target.value) }))} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>{t("Aanhanger per dag (€)", "Trailer per day (€)", "Römork/gün (€)")}</label>
              <input type="number" min={0} max={1000} step={0.01} value={fees.trailerPerDay} onChange={(e) => setFees((f) => ({ ...f, trailerPerDay: Number(e.target.value) }))} className={inputCls} />
            </div>
          </div>
          <button disabled={saving} onClick={() => save({ transportFees: fees }, t("Transporttarieven opgeslagen.", "Transport rates saved.", "Nakliye ücretleri kaydedildi."))} className={btnSave}>
            {t("Transporttarieven opslaan", "Save transport rates", "Nakliye ücretlerini kaydet")}
          </button>

          <div className="border-t border-slate-200 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <div className="space-y-2">
              <label className={labelCls}>{t("Veiligheidsset — naam", "Safety set — name", "Güvenlik seti — isim")}</label>
              <input value={addons.safetyName} onChange={(e) => setAddons((a) => ({ ...a, safetyName: e.target.value }))} maxLength={60} className={inputCls} />
              <label className={labelCls}>{t("Prijs per week (€)", "Price per week (€)", "Haftalık fiyat (€)")}</label>
              <input type="number" min={0} max={1000} step={0.01} value={addons.safetyPrice} onChange={(e) => setAddons((a) => ({ ...a, safetyPrice: Number(e.target.value) }))} className={inputCls} />
            </div>
            <div className="space-y-2">
              <label className={labelCls}>{t("Rijplaten — naam", "Ground plates — name", "Sürüş plakaları — isim")}</label>
              <input value={addons.rijplatenName} onChange={(e) => setAddons((a) => ({ ...a, rijplatenName: e.target.value }))} maxLength={60} className={inputCls} />
              <label className={labelCls}>{t("Prijs per week (€)", "Price per week (€)", "Haftalık fiyat (€)")}</label>
              <input type="number" min={0} max={1000} step={0.01} value={addons.rijplatenPrice} onChange={(e) => setAddons((a) => ({ ...a, rijplatenPrice: Number(e.target.value) }))} className={inputCls} />
            </div>
          </div>
          <button
            disabled={saving}
            onClick={() => save({
              globalAddons: {
                safety: { name: addons.safetyName, pricePerWeek: addons.safetyPrice },
                rijplaten: { name: addons.rijplatenName, pricePerWeek: addons.rijplatenPrice },
              }
            }, t("Add-on-tarieven opgeslagen.", "Add-on rates saved.", "Ek ürün ücretleri kaydedildi."))}
            className={btnSave}
          >
            {t("Add-on-tarieven opslaan", "Save add-on rates", "Ek ürün ücretlerini kaydet")}
          </button>
        </div>
      )}

      {/* ── Kortingen (campagneregels) ──────────────────────────────────── */}
      {tab === "campaigns" && (
        <AdminCampaignRules onAddSystemLog={onAddSystemLog} adminLanguage={adminLanguage} />
      )}

      {/* ── SEO ─────────────────────────────────────────────────────────── */}
      {tab === "seo" && (
        <div className="glass-panel p-5.5 rounded-3xl space-y-4">
          <h3 className="font-display font-bold text-sm text-slate-900 border-b border-slate-200 pb-3">{t("SEO — homepage", "SEO — homepage", "SEO — ana sayfa")}</h3>
          <div className="space-y-3 max-w-xl">
            <div className="space-y-1">
              <label className={labelCls}>{t("SEO-titel", "SEO title", "SEO başlığı")}</label>
              <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={1000} className={inputCls} placeholder="huurgo — Hoogwerkers Huren | Snel & Eenvoudig" />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>{t("SEO-omschrijving", "SEO description", "SEO açıklaması")}</label>
              <textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} maxLength={1000} rows={3} className={`${inputCls} resize-y`} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>{t("Footer — korte omschrijving", "Footer — short description", "Footer — kısa açıklama")}</label>
              <textarea value={footerDescription} onChange={(e) => setFooterDescription(e.target.value)} maxLength={1000} rows={2} className={`${inputCls} resize-y`} />
            </div>
          </div>
          <button
            disabled={saving}
            onClick={() => save({ seoTitle, seoDescription, footerDescription }, t("SEO-instellingen opgeslagen.", "SEO settings saved.", "SEO ayarları kaydedildi."))}
            className={btnSave}
          >
            {t("Opslaan", "Save", "Kaydet")}
          </button>
        </div>
      )}

      {/* ── Juridisch ───────────────────────────────────────────────────── */}
      {tab === "legal" && (
        <div className="glass-panel p-5.5 rounded-3xl space-y-4">
          <h3 className="font-display font-bold text-sm text-slate-900 border-b border-slate-200 pb-3">{t("Privacybeleid & voorwaarden", "Privacy policy & terms", "Gizlilik politikası ve koşullar")}</h3>
          <p className="text-[11px] text-slate-500">
            {t("Markdown: ## voor koppen, lege regel voor nieuwe alinea, \"- \" voor opsommingen.", "Markdown: ## for headings, blank line for a new paragraph, \"- \" for bullets.", "Markdown: başlıklar için ##, yeni paragraf için boş satır, madde için \"- \".")}
          </p>
          <div className="space-y-1">
            <label className={labelCls}>{t("Privacybeleid (/privacy)", "Privacy policy (/privacy)", "Gizlilik politikası (/privacy)")}</label>
            {!siteConfig.privacyPolicy && (
              <p className="text-[11px] text-slate-500">
                {t(
                  "Voorgevuld met de standaardtekst die nu op /privacy staat. Pas aan en sla op om een eigen versie vast te leggen; laat 'm juridisch controleren.",
                  "Pre-filled with the default text currently shown on /privacy. Edit and save to store your own version; have it legally reviewed.",
                  "/privacy'de şu an görünen varsayılan metinle önceden dolduruldu. Kendi sürümünüz için düzenleyip kaydedin; hukuki kontrolden geçirin."
                )}
              </p>
            )}
            <textarea value={privacyPolicy} onChange={(e) => setPrivacyPolicy(e.target.value)} maxLength={60000} rows={10} className={`${inputCls} resize-y font-mono`} />
          </div>
          <button disabled={saving} onClick={() => save({ privacyPolicy }, t("Privacybeleid opgeslagen.", "Privacy policy saved.", "Gizlilik politikası kaydedildi."))} className={btnSave}>
            {t("Privacybeleid opslaan", "Save privacy policy", "Gizlilik politikasını kaydet")}
          </button>

          <div className="space-y-1 pt-3 border-t border-slate-200">
            <label className={labelCls}>{t("Algemene voorwaarden (/voorwaarden)", "Terms & conditions (/voorwaarden)", "Genel koşullar (/voorwaarden)")}</label>
            {!siteConfig.termsConditions && (
              <p className="text-[11px] text-slate-500">
                {t(
                  "Voorgevuld met de standaardtekst die nu op /voorwaarden staat. Pas aan en sla op om een eigen versie vast te leggen; laat 'm juridisch controleren.",
                  "Pre-filled with the default text currently shown on /voorwaarden. Edit and save to store your own version; have it legally reviewed.",
                  "/voorwaarden'de şu an görünen varsayılan metinle önceden dolduruldu. Kendi sürümünüz için düzenleyip kaydedin; hukuki kontrolden geçirin."
                )}
              </p>
            )}
            <textarea value={termsConditions} onChange={(e) => setTermsConditions(e.target.value)} maxLength={60000} rows={10} className={`${inputCls} resize-y font-mono`} />
          </div>
          <button disabled={saving} onClick={() => save({ termsConditions }, t("Voorwaarden opgeslagen.", "Terms saved.", "Koşullar kaydedildi."))} className={btnSave}>
            {t("Voorwaarden opslaan", "Save terms", "Koşulları kaydet")}
          </button>
        </div>
      )}
    </motion.div>
  );
}
