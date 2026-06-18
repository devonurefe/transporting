/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Settings, Check, Trash2, Tag, Plus, ChevronDown, Upload } from "lucide-react";
import { resizeImage } from "../../utils/image";
import { motion, AnimatePresence } from "motion/react";
import { useAppStore } from "../../store/appStore";
import { useAuthStore } from "../../store/authStore";
import { CampaignRule } from "../../types";

interface AdminCustomizerProps {
  key?: string;
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  adminLanguage?: string;
}

export default function AdminCustomizer({ onAddSystemLog, adminLanguage }: AdminCustomizerProps) {
  const siteConfig = useAppStore((state) => state.siteConfig);
  const customCategories = useAppStore((state) => state.customCategories);
  const updateSiteConfig = useAppStore((state) => state.updateSiteConfig);
  const updateCategories = useAppStore((state) => state.updateCategories);
  const machines = useAppStore((state) => state.machines);
  const campaignRules = useAppStore((state) => state.campaignRules);
  const updateCampaignRules = useAppStore((state) => state.updateCampaignRules);
  const adminUser = useAuthStore((state) => state.user);

  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  // Password change state
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwRepeat, setPwRepeat] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);
    if (pwNew.length < 8) {
      setPwMessage({ ok: false, text: t("Nieuw wachtwoord moet minimaal 8 tekens bevatten.", "New password must be at least 8 characters.", "Yeni şifre en az 8 karakter olmalı.") });
      return;
    }
    if (pwNew !== pwRepeat) {
      setPwMessage({ ok: false, text: t("Wachtwoorden komen niet overeen.", "Passwords do not match.", "Şifreler eşleşmiyor.") });
      return;
    }
    setPwBusy(true);
    try {
      const token = localStorage.getItem("hwh_admin_token") || localStorage.getItem("hwh_token");
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew })
      });
      const data = await res.json();
      if (res.ok) {
        setPwMessage({ ok: true, text: t("Wachtwoord succesvol gewijzigd.", "Password changed successfully.", "Şifre başarıyla değiştirildi.") });
        setPwCurrent(""); setPwNew(""); setPwRepeat("");
        onAddSystemLog("system", adminUser?.name ?? "Admin", "Admin wachtwoord gewijzigd");
      } else {
        setPwMessage({ ok: false, text: data.error || t("Wachtwoord wijzigen mislukt.", "Password change failed.", "Şifre değiştirilemedi.") });
      }
    } catch {
      setPwMessage({ ok: false, text: t("Netwerkfout. Probeer opnieuw.", "Network error. Try again.", "Ağ hatası. Tekrar deneyin.") });
    } finally {
      setPwBusy(false);
    }
  };

  // Campaign Rule form state
  const [ruleName, setRuleName] = useState("");
  const [ruleScope, setRuleScope] = useState<"global" | "category" | "product" | "role">("global");
  const [ruleScopeValue, setRuleScopeValue] = useState("global");
  const [ruleDiscount, setRuleDiscount] = useState<number>(5);

  const handleToggleRule = (id: string) => {
    const updated = campaignRules.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r);
    updateCampaignRules(updated);
    onAddSystemLog("system", adminUser?.name ?? "Admin", t("Campagneregel status bijgewerkt.", "Campaign rule status updated.", "Kampanya kuralı durumu güncellendi."));
  };

  const handleDeleteRule = (id: string, name: string) => {
    if (confirm(t(`Weet u zeker dat u de campagneregel "${name}" wilt verwijderen?`, `Are you sure you want to delete the campaign rule "${name}"?`, `Kampanya kuralını "${name}" silmek istediğinizden emin misiniz?`))) {
      const updated = campaignRules.filter(r => r.id !== id);
      updateCampaignRules(updated);
      onAddSystemLog("system", adminUser?.name ?? "Admin", t("Campagneregel verwijderd: ", "Campaign rule deleted: ", "Kampanya kuralı silindi: ") + name);
    }
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    const newRule = {
      id: `rule-${Date.now()}`,
      name: ruleName.trim(),
      scope: ruleScope,
      scopeValue: ruleScopeValue,
      discountPercent: Number(ruleDiscount),
      isActive: true
    };

    updateCampaignRules([...campaignRules, newRule]);
    onAddSystemLog("system", adminUser?.name ?? "Admin", t("Nieuwe campagneregel toegevoegd: ", "New campaign rule added: ", "Yeni kampanya kuralı eklendi: ") + newRule.name);
    
    // reset form
    setRuleName("");
    setRuleScope("global");
    setRuleScopeValue("global");
  };

  // Campaign Rule Edit Modal state
  const [editingRule, setEditingRule] = useState<CampaignRule | null>(null);
  const [editName, setEditName] = useState("");
  const [editScope, setEditScope] = useState<"global" | "category" | "product" | "role">("global");
  const [editScopeValue, setEditScopeValue] = useState("global");
  const [editDiscount, setEditDiscount] = useState<number>(5);

  const handleOpenEditModal = (rule: CampaignRule) => {
    setEditingRule(rule);
    setEditName(rule.name);
    setEditScope(rule.scope);
    setEditScopeValue(rule.scopeValue);
    setEditDiscount(rule.discountPercent);
  };

  const handleSaveEditRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule || !editName.trim()) return;

    const updated = campaignRules.map(r => 
      r.id === editingRule.id 
        ? { ...r, name: editName.trim(), scope: editScope, scopeValue: editScopeValue, discountPercent: Number(editDiscount) } 
        : r
    );

    updateCampaignRules(updated);
    onAddSystemLog("system", adminUser?.name ?? "Admin", t("Campagneregel gewijzigd: ", "Campaign rule edited: ", "Kampanya kuralı düzenlendi: ") + editName.trim());
    setEditingRule(null);
  };

  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  // Local copywriting fields state to prevent massive lags and race conditions on keystrokes
  const [storeName, setStoreName] = useState(siteConfig.siteName || "");
  const [tagline, setTagline] = useState(siteConfig.heroTagline || "");
  const [title, setTitle] = useState(siteConfig.heroTitle || "");
  const [subtitle, setSubtitle] = useState(siteConfig.heroSubtitle || "");
  const [heroImageUrl, setHeroImageUrl] = useState(siteConfig.heroImageUrl || "");
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [menuHome, setMenuHome] = useState(siteConfig.menuHomeLabel || "");
  const [menuCatalog, setMenuCatalog] = useState(siteConfig.menuCatalogLabel || "");
  const [menuOrders, setMenuOrders] = useState(siteConfig.menuOrdersLabel || "");

  // Sync state if backend updates siteConfig
  React.useEffect(() => {
    if (siteConfig) {
      setStoreName(siteConfig.siteName || "");
      setTagline(siteConfig.heroTagline || "");
      setTitle(siteConfig.heroTitle || "");
      setSubtitle(siteConfig.heroSubtitle || "");
      setHeroImageUrl(siteConfig.heroImageUrl || "");
      setMenuHome(siteConfig.menuHomeLabel || "");
      setMenuCatalog(siteConfig.menuCatalogLabel || "");
      setMenuOrders(siteConfig.menuOrdersLabel || "");
    }
  }, [siteConfig]);

  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingHero(true);
    try {
      const base64 = await resizeImage(file, 1920, 800);
      // resizeImage may convert to WebP regardless of original format — derive extension from output
      const isWebp = base64.startsWith("data:image/webp");
      const uploadName = isWebp ? "hero.webp" : `hero${file.name.slice(file.name.lastIndexOf("."))}`;
      const token = localStorage.getItem("hwh_admin_token") || localStorage.getItem("hwh_token");
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ fileName: uploadName, base64Data: base64 })
      });
      if (res.ok) {
        const data = await res.json();
        setHeroImageUrl(data.url);
      } else {
        alert(t("Uploaden mislukt.", "Upload failed.", "Yükleme başarısız."));
      }
    } catch {
      alert(t("Fout bij uploaden afbeelding.", "Error uploading image.", "Resim yükleme hatası."));
    } finally {
      setIsUploadingHero(false);
      e.target.value = "";
    }
  };

  const handleSaveSiteConfig = async () => {
    setIsSavingConfig(true);
    const success = await updateSiteConfig({
      siteName: storeName,
      heroTagline: tagline,
      heroTitle: title,
      heroSubtitle: subtitle,
      heroImageUrl,
      menuHomeLabel: menuHome,
      menuCatalogLabel: menuCatalog,
      menuOrdersLabel: menuOrders,
      menuAdminLabel: siteConfig.menuAdminLabel || "Portaal"
    });
    setIsSavingConfig(false);
    if (success) {
      onAddSystemLog("system", adminUser?.name ?? "Admin", t("Storefront algemene en navigatie instellingen opgeslagen.", "Storefront general and navigation settings saved.", "Mağaza genel ve gezinme ayarları kaydedildi."));
      alert(t("Instellingen succesvol permanent opgeslagen!", "Settings successfully permanently saved!", "Ayarlar kalıcı olarak başarıyla kaydedildi!"));
    } else {
      alert(t("Fout bij opslaan van instellingen.", "Error saving settings.", "Ayarlar kaydedilirken hata oluştu."));
    }
  };

  const [editingInfoCatId, setEditingInfoCatId] = useState<string | null>(null);
  const [infoUseCases, setInfoUseCases] = useState("");
  const [infoAdvantages, setInfoAdvantages] = useState("");
  const [infoNotFor, setInfoNotFor] = useState("");

  const handleOpenInfoEditor = (cat: typeof customCategories[0]) => {
    if (editingInfoCatId === cat.id) { setEditingInfoCatId(null); return; }
    const info = (cat as any).infoContent;
    setInfoUseCases(info?.useCases?.join("\n") || "");
    setInfoAdvantages(info?.advantages?.join("\n") || "");
    setInfoNotFor(info?.notFor?.join("\n") || "");
    setEditingInfoCatId(cat.id);
  };

  const handleSaveInfoContent = async (catId: string) => {
    const updated = customCategories.map(c =>
      c.id === catId ? {
        ...c,
        infoContent: {
          useCases: infoUseCases.split("\n").map(s => s.trim()).filter(Boolean),
          advantages: infoAdvantages.split("\n").map(s => s.trim()).filter(Boolean),
          notFor: infoNotFor.split("\n").map(s => s.trim()).filter(Boolean)
        }
      } : c
    );
    const success = await updateCategories(updated);
    if (success) {
      setEditingInfoCatId(null);
      onAddSystemLog("system", adminUser?.name ?? "Admin", t(`Info-inhoud opgeslagen voor categorie: ${catId}`, `Info content saved for category: ${catId}`, `Kategori bilgi içeriği kaydedildi: ${catId}`));
    }
  };

  const handleDeleteCategory = async (id: string, label: string) => {
    if (confirm(t(`Weet u zeker dat u de categorie "${label}" wilt verwijderen?`, `Are you sure you want to delete the category "${label}"?`, `Kategoriyi "${label}" silmek istediğinizden emin misiniz?`))) {
      const updated = customCategories.filter((c) => c.id !== id);
      const success = await updateCategories(updated);
      if (success) {
        onAddSystemLog("system", adminUser?.name ?? "Admin", t("Categorie verwijderd: ", "Category deleted: ", "Kategori silindi: ") + `${label} (${id}).`);
      }
    }
  };

  return (
    <motion.div
      key="customizer-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="glass-panel p-6 rounded-3xl space-y-6">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="font-display font-bold text-sm text-slate-900 flex items-center space-x-2">
            <Settings className="h-5 w-5 text-amber-600" />
            <span>{t("Beheer Storefront & Customizer", "Manage Storefront & Customizer", "Mağaza Arayüzü ve Özelleştirici Yönetimi")}</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">{t("Pas logo's, banners, menu-namen of product-categorieën direct aan op de website.", "Adjust logos, banners, menu names, or product categories directly on the website.", "Web sitesindeki logoları, afişleri, menü adlarını veya ürün kategorilerini doğrudan düzenleyin.")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Store Details Form */}
          <div className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm">
            <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider">{t("Algemene Storefront Copywriting", "General Storefront Copywriting", "Genel Mağaza Metin Yazarlığı")}</h4>
            
            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Store Naam (Logo)", "Store Name (Logo)", "Mağaza Adı (Logo)")}</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Hero Tagline Banner", "Hero Tagline Banner", "Hero Slogan Afişi")}</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Hero Grote Titel", "Hero Main Title", "Hero Ana Başlığı")}</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Hero Korte Paragraaf (Subtitle)", "Hero Short Paragraph (Subtitle)", "Hero Kısa Paragrafı (Alt Başlık)")}</label>
              <textarea
                rows={3}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 resize-none font-sans"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-700 block font-bold">{t("Hero Afbeelding", "Hero Image", "Hero Görseli")}</label>
              <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${isUploadingHero ? "border-amber-300 bg-amber-50 text-amber-600" : "border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50 text-slate-600 hover:text-amber-700"}`}>
                {isUploadingHero ? (
                  <>
                    <span className="h-3.5 w-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold">{t("Uploaden...", "Uploading...", "Yükleniyor...")}</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-bold">{t("Afbeelding uploaden", "Upload image", "Resim yükle")}</span>
                  </>
                )}
                <input type="file" accept="image/*" className="sr-only" disabled={isUploadingHero} onChange={handleHeroImageUpload} />
              </label>
              <input
                type="url"
                value={heroImageUrl}
                onChange={(e) => setHeroImageUrl(e.target.value)}
                placeholder={t("of URL plakken... (leeg = standaard)", "or paste URL... (empty = default)", "veya URL yapıştır... (boş = varsayılan)")}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white font-mono"
              />
              {heroImageUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-24">
                  <img
                    src={heroImageUrl}
                    alt="Hero preview"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
              <p className="text-[10px] text-slate-400">{t("Aanbevolen: 1920×600px JPEG ≤ 400 KB. Leeg laten = standaard hero.", "Recommended: 1920×600px JPEG ≤ 400 KB. Leave empty = default hero.", "Önerilen: 1920×600px JPEG ≤ 400 KB. Boş bırak = varsayılan hero.")}</p>
            </div>

          </div>

          {/* Header Menu Labels Form */}
          <div className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm">
            <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider">{t("Navigatiemenu Aanpassen", "Adjust Navigation Menu", "Gezinme Menüsünü Düzenle")}</h4>

            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Labels - Homepagina", "Labels - Homepage", "Etiketler - Ana Sayfa")}</label>
              <input
                type="text"
                value={menuHome}
                onChange={(e) => setMenuHome(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Labels - Catalogus", "Labels - Catalog", "Etiketler - Katalog")}</label>
              <input
                type="text"
                value={menuCatalog}
                onChange={(e) => setMenuCatalog(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Labels - Mijn Account", "Labels - My Account", "Etiketler - Hesabım")}</label>
              <input
                type="text"
                value={menuOrders}
                onChange={(e) => setMenuOrders(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

          </div>

          {/* Save Button for Site Config */}
          <div className="flex justify-end pt-2 col-span-1 md:col-span-2">
            <button
              type="button"
              onClick={handleSaveSiteConfig}
              disabled={isSavingConfig}
              className="flex items-center space-x-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 border-none"
            >
              {isSavingConfig ? (
                <>
                  <span className="h-3.5 w-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mr-1" />
                  <span>{t("Opslaan...", "Saving...", "Kaydediliyor...")}</span>
                </>
              ) : (
                <>
                  <Check className="h-4.5 w-4.5 shrink-0 text-white" />
                  <span>{t("Storefront Instellingen Opslaan", "Save Storefront Settings", "Mağaza Ayarlarını Kaydet")}</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* Category Manager */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider">{t("Actuele Groep Categoriseringen & Filter Opties", "Current Group Categorizations & Filter Options", "Mevcut Ürün Gruplandırmaları ve Filtre Seçenekleri")}</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {customCategories.map((cat) => (
              <div key={cat.id} className="bg-white border border-slate-200 shadow-sm rounded-2xl text-xs overflow-hidden">
                <div className="p-3.5 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">{cat.label}</span>
                    <div className="flex items-center space-x-1">
                      <span className="text-[9px] font-mono text-amber-700 uppercase bg-amber-500/10 px-1.5 py-0.5 rounded font-extrabold">{cat.id}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id, cat.label)}
                        className="text-rose-600 hover:text-rose-700 font-extrabold px-1 cursor-pointer transition-colors border-none bg-transparent"
                        title={t("Verwijder Categorie", "Delete Category", "Kategoriyi Sil")}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <p className="text-[10.5px] text-slate-600 line-clamp-2 leading-relaxed">{cat.desc}</p>
                  <div className="flex justify-between text-[10px] text-slate-500 pt-1 font-mono">
                    <span>{t("Hoogten: ", "Heights: ", "Yükseklikler: ")}{cat.heights}</span>
                    <span>{t("Prijzen: ", "Prices: ", "Ücretler: ")}{cat.price}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenInfoEditor(cat)}
                  className="w-full flex items-center justify-between px-3.5 py-2 border-t border-slate-100 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer bg-transparent"
                >
                  <span>{t("Info bewerken", "Edit info", "Bilgileri düzenle")}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${editingInfoCatId === cat.id ? "rotate-180" : ""}`} />
                </button>
                {editingInfoCatId === cat.id && (
                  <div className="p-3.5 border-t border-indigo-100 bg-indigo-50/40 space-y-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700 block">{t("Waarvoor (één per regel)", "Use cases (one per line)", "Kullanım alanları (satır satır)")}</label>
                      <textarea
                        rows={3}
                        value={infoUseCases}
                        onChange={(e) => setInfoUseCases(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-[10px] text-slate-800 outline-none focus:border-indigo-400 resize-none font-sans"
                        placeholder="Schilderwerk aan gevels&#10;Dakgootreiniging&#10;..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700 block">{t("Voordelen (één per regel)", "Advantages (one per line)", "Avantajlar (satır satır)")}</label>
                      <textarea
                        rows={3}
                        value={infoAdvantages}
                        onChange={(e) => setInfoAdvantages(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-[10px] text-slate-800 outline-none focus:border-indigo-400 resize-none font-sans"
                        placeholder="Geen transportkosten&#10;In 5 minuten opgesteld&#10;..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700 block">{t("Niet geschikt voor (één per regel)", "Not suitable for (one per line)", "Uygun olmayan durumlar (satır satır)")}</label>
                      <textarea
                        rows={3}
                        value={infoNotFor}
                        onChange={(e) => setInfoNotFor(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-[10px] text-slate-800 outline-none focus:border-indigo-400 resize-none font-sans"
                        placeholder="Zachte bodem&#10;Binnenwerk&#10;..."
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingInfoCatId(null)}
                        className="px-3 py-1.5 text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        {t("Annuleren", "Cancel", "Vazgeç")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveInfoContent(cat.id)}
                        className="px-3 py-1.5 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                      >
                        <Check className="h-3 w-3" />
                        {t("Opslaan", "Save", "Kaydet")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Custom Category Form inline */}
          <AddCategoryForm onAddSystemLog={onAddSystemLog} adminLanguage={adminLanguage} />

        </div>

        {/* Campaign Rules Manager */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
            <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center space-x-1.5">
              <Tag className="h-4 w-4 shrink-0 text-amber-600" />
              <span>{t("Slimme Campagne- & Kortingsregels", "Smart Campaign & Discount Rules", "Akıllı Kampanya ve İndirim Kuralları")}</span>
            </h4>
            <span className="text-[10px] font-mono text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full font-bold">
              {campaignRules.length} {t("Regels", "Rules", "Kural")}
            </span>
          </div>

          {/* Active Rules List */}
          <div className="space-y-2">
            {campaignRules.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">{t("Geen actieve kortingsregels geconfigureerd.", "No active discount rules configured.", "Yapılandırılmış aktif indirim kuralı bulunmamaktadır.")}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {campaignRules.map((rule) => (
                  <div 
                    key={rule.id} 
                    onClick={() => handleOpenEditModal(rule)}
                    className="p-3.5 bg-white border border-slate-200 shadow-sm rounded-2xl text-xs flex justify-between items-center hover:border-amber-400 hover:shadow-md transition-all cursor-pointer select-none group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-800 group-hover:text-amber-800 transition-colors">{rule.name}</span>
                        <span className={`text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                          rule.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {rule.isActive ? t("Actief", "Active", "Aktif") : t("Inactief", "Inactive", "Pasif")}
                        </span>
                      </div>
                      <div className="text-[10.5px] text-slate-500 space-y-0.5">
                        <div>
                          <span className="font-semibold text-slate-700">{t("Bereik: ", "Scope: ", "Kapsam: ")}</span>
                          <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[10px] text-slate-700">
                            {rule.scope === "global" && t("Globaal", "Global", "Genel")}
                            {rule.scope === "category" && `${t("Categorie", "Category", "Kategori")} (${rule.scopeValue})`}
                            {rule.scope === "product" && `${t("Product ID", "Product ID", "Ürün ID")} (${rule.scopeValue})`}
                            {rule.scope === "role" && `${t("Gebruikersrol", "User Role", "Kullanıcı Rolü")} (${rule.scopeValue})`}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-700">{t("Korting: ", "Discount: ", "İndirim: ")}</span>
                          <span className="font-extrabold text-amber-600 font-mono text-[11px]">{rule.discountPercent}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleRule(rule.id);
                        }}
                        className={`px-2 py-1 rounded-md text-[10px] font-extrabold uppercase transition-all border-none bg-transparent cursor-pointer ${
                          rule.isActive 
                            ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100" 
                            : "text-slate-400 bg-slate-100 hover:bg-slate-200"
                        }`}
                        title={rule.isActive ? t("Deactiveren", "Deactivate", "Devre Dışı Bırak") : t("Activeren", "Activate", "Etkinleştir")}
                      >
                        {rule.isActive ? t("AAN", "ON", "AÇIK") : t("UIT", "OFF", "KAPALI")}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRule(rule.id, rule.name);
                        }}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                        title={t("Verwijderen", "Delete", "Sil")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Campaign Rule Form Inline */}
          <form onSubmit={handleAddRule} className="mt-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/25 space-y-3.5">
            <h5 className="text-[10.5px] font-bold text-amber-700 uppercase tracking-tight flex items-center space-x-1">
              <Plus className="h-3 w-3" />
              <span>{t("Voeg Nieuwe Campagneregel Toe", "Add New Campaign Rule", "Yeni Kampanya Kuralı Ekle")}</span>
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-700 font-extrabold uppercase tracking-wider block">{t("Kortingsnaam", "Discount Name", "İndirim Adı")}</label>
                <input 
                  type="text" 
                  value={ruleName} 
                  onChange={(e) => setRuleName(e.target.value)} 
                  required 
                  placeholder={t("bijv: Zomer Actie", "e.g., Summer Promo", "örn: Yaz Kampanyası")} 
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-700 font-extrabold uppercase tracking-wider block">{t("Toepassingsgebied (Scope)", "Target Scope", "Uygulama Kapsamı")}</label>
                <select
                  value={ruleScope}
                  onChange={(e) => {
                    const newScope = e.target.value as "global" | "category" | "product" | "role";
                    setRuleScope(newScope);
                    if (newScope === "global") setRuleScopeValue("global");
                    else if (newScope === "category") setRuleScopeValue(customCategories[0]?.id || "schaarlift");
                    else if (newScope === "product") setRuleScopeValue(machines[0]?.id || "");
                    else if (newScope === "role") setRuleScopeValue("Schilder");
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                >
                  <option value="global">{t("Globaal (Hele vloot)", "Global (Entire fleet)", "Genel (Tüm filo)")}</option>
                  <option value="category">{t("Product Categorie", "Product Category", "Ürün Kategorisi")}</option>
                  <option value="product">{t("Specifiek Product", "Specific Product", "Belirli Ürün")}</option>
                  <option value="role">{t("Klant Rollen", "Customer Roles", "Müşteri Rolleri")}</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-700 font-extrabold uppercase tracking-wider block">{t("Koppel Waarde", "Link Value", "Eşleşme Değeri")}</label>
                {ruleScope === "global" && (
                  <input
                    type="text"
                    disabled
                    value={t("Van toepassing op alle items", "Applies to all items", "Tüm ürünlerde geçerli")}
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-xs text-slate-500 outline-none"
                  />
                )}

                {ruleScope === "category" && (
                  <select
                    value={ruleScopeValue}
                    onChange={(e) => setRuleScopeValue(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                  >
                    {customCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.label} ({c.id})</option>
                    ))}
                  </select>
                )}

                {ruleScope === "product" && (
                  <select
                    value={ruleScopeValue}
                    onChange={(e) => setRuleScopeValue(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                  >
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.categoryLabel})</option>
                    ))}
                  </select>
                )}

                {ruleScope === "role" && (
                  <select
                    value={ruleScopeValue}
                    onChange={(e) => setRuleScopeValue(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                  >
                    <option value="Schilder">{t("Schilder", "Painter", "Boyacı")}</option>
                    <option value="Hovenier">{t("Hovenier", "Gardener", "Bahçıvan")}</option>
                    <option value="Glazenwasser">{t("Glazenwasser", "Window Cleaner", "Cam Temizlikçisi")}</option>
                    <option value="Aannemer">{t("Aannemer", "Contractor", "Müteahhit")}</option>
                    <option value="Particulier">{t("Particulier", "Private Individual", "Bireysel Müşteri")}</option>
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-700 font-extrabold uppercase tracking-wider block">{t("Kortingspercentage (%)", "Discount Percentage (%)", "İndirim Oranı (%)")}</label>
                <div className="relative">
                  <input 
                    type="number" 
                    min={1} 
                    max={100}
                    value={ruleDiscount} 
                    onChange={(e) => setRuleDiscount(Number(e.target.value))} 
                    required 
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 pr-7 text-xs text-slate-800 outline-none focus:border-amber-500" 
                  />
                  <span className="absolute right-2.5 top-2.5 text-xs text-slate-500 font-mono font-bold">%</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button 
                type="submit" 
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 font-bold text-xs text-white rounded-lg transition-all cursor-pointer border-none shadow-sm flex items-center space-x-1"
              >
                <Plus className="h-3.5 w-3.5 shrink-0 text-white" />
                <span>{t("Campagneregel Opslaan", "Save Campaign Rule", "Kampanya Kuralını Kaydet")}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Campaign Rule Edit Modal Pop-up */}
        <AnimatePresence>
          {editingRule && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingRule(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: "spring", stiffness: 350, damping: 26 }}
                className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden z-10 space-y-5 text-slate-800"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
                
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="font-display font-bold text-sm text-slate-900 flex items-center space-x-2">
                    <Tag className="h-4.5 w-4.5 text-amber-600" />
                    <span>{t("Campagneregel Bewerken", "Edit Campaign Rule", "Kampanya Kuralını Düzenle")}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingRule(null)}
                    className="text-slate-400 hover:text-slate-600 text-xl font-bold border-none bg-transparent cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleSaveEditRule} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-700 block font-bold">{t("Kortingsnaam", "Discount Name", "İndirim Adı")}</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-700 block font-bold">{t("Toepassingsgebied (Scope)", "Target Scope", "Uygulama Kapsamı")}</label>
                    <select
                      value={editScope}
                      onChange={(e) => {
                        const newScope = e.target.value as "global" | "category" | "product" | "role";
                        setEditScope(newScope);
                        if (newScope === "global") setEditScopeValue("global");
                        else if (newScope === "category") setEditScopeValue(customCategories[0]?.id || "schaarlift");
                        else if (newScope === "product") setEditScopeValue(machines[0]?.id || "");
                        else if (newScope === "role") setEditScopeValue("Schilder");
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                    >
                      <option value="global">{t("Globaal (Hele vloot)", "Global (Entire fleet)", "Genel (Tüm filo)")}</option>
                      <option value="category">{t("Product Categorie", "Product Category", "Ürün Kategorisi")}</option>
                      <option value="product">{t("Specifiek Product", "Specific Product", "Belirli Ürün")}</option>
                      <option value="role">{t("Klant Rollen", "Customer Roles", "Müşteri Rolleri")}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-700 block font-bold">{t("Koppel Waarde", "Link Value", "Eşleşme Değeri")}</label>
                    {editScope === "global" && (
                      <input
                        type="text"
                        disabled
                        value={t("Van toepassing op alle items", "Applies to all items", "Tüm ürünlerde geçerli")}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-500 outline-none"
                      />
                    )}

                    {editScope === "category" && (
                      <select
                        value={editScopeValue}
                        onChange={(e) => setEditScopeValue(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                      >
                        {customCategories.map((c) => (
                          <option key={c.id} value={c.id}>{c.label} ({c.id})</option>
                        ))}
                      </select>
                    )}

                    {editScope === "product" && (
                      <select
                        value={editScopeValue}
                        onChange={(e) => setEditScopeValue(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                      >
                        {machines.map((m) => (
                          <option key={m.id} value={m.id}>{m.name} ({m.categoryLabel})</option>
                        ))}
                      </select>
                    )}

                    {editScope === "role" && (
                      <select
                        value={editScopeValue}
                        onChange={(e) => setEditScopeValue(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                      >
                        <option value="Schilder">{t("Schilder", "Painter", "Boyacı")}</option>
                        <option value="Hovenier">{t("Hovenier", "Gardener", "Bahçıvan")}</option>
                        <option value="Glazenwasser">{t("Glazenwasser", "Window Cleaner", "Cam Temizlikçisi")}</option>
                        <option value="Aannemer">{t("Aannemer", "Contractor", "Müteahhit")}</option>
                        <option value="Particulier">{t("Particulier", "Private Individual", "Bireysel Müşteri")}</option>
                      </select>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-700 block font-bold">{t("Kortingspercentage (%)", "Discount Percentage (%)", "İndirim Oranı (%)")}</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        required
                        value={editDiscount}
                        onChange={(e) => setEditDiscount(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 pr-7 text-xs text-slate-800 outline-none focus:border-amber-500"
                      />
                      <span className="absolute right-3 top-2 text-xs text-slate-500 font-mono font-bold">%</span>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingRule(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer border-none"
                    >
                      {t("Annuleren", "Cancel", "Vazgeç")}
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer border-none shadow-sm hover:shadow"
                    >
                      {t("Opslaan", "Save", "Kaydet")}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>

      {/* Security: change admin password */}
      <div className="glass-panel p-6 rounded-3xl space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="font-display font-bold text-sm text-slate-900">
            🔐 {t("Beveiliging — Wachtwoord wijzigen", "Security — Change password", "Güvenlik — Şifre değiştir")}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {t("Wijzig hier het wachtwoord van uw admin-account.", "Change your admin account password here.", "Admin hesabınızın şifresini buradan değiştirin.")}
          </p>
        </div>
        <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs text-slate-700 block font-bold">{t("Huidig wachtwoord", "Current password", "Mevcut şifre")}</label>
            <input
              type="password"
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-700 block font-bold">{t("Nieuw wachtwoord (min. 8)", "New password (min. 8)", "Yeni şifre (min. 8)")}</label>
            <input
              type="password"
              value={pwNew}
              onChange={(e) => setPwNew(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-700 block font-bold">{t("Herhaal nieuw wachtwoord", "Repeat new password", "Yeni şifreyi tekrarla")}</label>
            <input
              type="password"
              value={pwRepeat}
              onChange={(e) => setPwRepeat(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
            />
          </div>
          <div className="md:col-span-3 flex items-center justify-between gap-3">
            {pwMessage ? (
              <span className={`text-xs font-bold ${pwMessage.ok ? "text-emerald-600" : "text-rose-600"}`}>{pwMessage.text}</span>
            ) : <span />}
            <button
              type="submit"
              disabled={pwBusy}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer border-none shadow-sm flex items-center gap-1.5"
            >
              {pwBusy && <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {t("Wachtwoord opslaan", "Save password", "Şifreyi kaydet")}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

interface AddCategoryFormProps {
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  adminLanguage?: string;
}

function AddCategoryForm({ onAddSystemLog, adminLanguage }: AddCategoryFormProps) {
  const customCategories = useAppStore((state) => state.customCategories);
  const updateCategories = useAppStore((state) => state.updateCategories);
  const adminUser = useAuthStore((state) => state.user);

  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [listLabel, setListLabel] = useState("");
  const [desc, setDesc] = useState("");
  const [heights, setHeights] = useState("");
  const [price, setPrice] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !label.trim()) {
      alert(t("Groep ID en Groep Label zijn verplicht.", "Group ID and Group Label are required.", "Grup ID'si ve Grup Etiketi zorunludur."));
      return;
    }
    const cleanId = id.trim().toLowerCase().replace(/\s+/g, "");
    
    // Check duplication
    if (customCategories.some((c: any) => c.id === cleanId)) {
      alert(t("Groep met deze ID bestaat al.", "Group with this ID already exists.", "Bu ID'ye sahip grup zaten mevcut."));
      return;
    }

    const newCat = {
      id: cleanId,
      label: label.trim(),
      listLabel: listLabel.trim() || label.trim() + "en",
      desc: desc.trim() || t("Moderne hoogwerkers voor diverse klussen.", "Modern aerial platforms for various jobs.", "Çeşitli işler için modern sepetli platformlar."),
      heights: heights.trim() || "10m - 20m",
      price: price.trim() || "v.a. €150/dag"
    };

    const updated = [...customCategories, newCat];
    const success = await updateCategories(updated);
    if (success) {
      onAddSystemLog("system", adminUser?.name ?? "Admin", t("Nieuwe categorie permanent opgeslagen: ", "New category permanently saved: ", "Yeni kategori kalıcı olarak kaydedildi: ") + `${label} (${cleanId}).`);
      // Reset inputs
      setId("");
      setLabel("");
      setListLabel("");
      setDesc("");
      setHeights("");
      setPrice("");
    } else {
      alert(t("Fout bij opslaan van categorie.", "Error saving category.", "Kategori kaydedilirken hata oluştu."));
    }
  };

  return (
    <form onSubmit={handleAdd} className="mt-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/25 space-y-3">
      <h5 className="text-[10.5px] font-bold text-amber-700 uppercase tracking-tight">{t("Voeg Nieuwe Categorie Toe", "Add New Category", "Yeni Kategori Ekle")}</h5>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input 
          type="text" 
          value={id} 
          onChange={(e) => setId(e.target.value)} 
          required 
          placeholder={t("Groep ID (bijv: rupslift)", "Group ID (e.g., crawlerlift)", "Grup ID'si (örn: paletliplatform)")} 
          className="bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white" 
        />
        <input 
          type="text" 
          value={label} 
          onChange={(e) => setLabel(e.target.value)} 
          required 
          placeholder={t("Groep Label (bijv: Rupslift)", "Group Label (e.g., Crawler Lift)", "Grup Etiketi (örn: Paletli Platform)")} 
          className="bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white" 
        />
        <input 
          type="text" 
          value={listLabel} 
          onChange={(e) => setListLabel(e.target.value)} 
          placeholder={t("Meervoud (bijv: Rupsliften)", "Plural (e.g., Crawler Lifts)", "Çoğul Etiket (örn: Paletli Platformlar)")} 
          className="bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white" 
        />
        <input 
          type="text" 
          value={heights} 
          onChange={(e) => setHeights(e.target.value)} 
          placeholder={t("Hoogte bereik (bijv: 12m - 18m)", "Height range (e.g., 12m - 18m)", "Yükseklik aralığı (örn: 12m - 18m)")} 
          className="bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white" 
        />
        <input 
          type="text" 
          value={price} 
          onChange={(e) => setPrice(e.target.value)} 
          placeholder={t("Startprijs (bijv: v.a. €190/dag)", "Starting price (e.g., from €190/day)", "Başlangıç ücreti (örn: en az €190/gün)")} 
          className="bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white" 
        />
        <input 
          type="text" 
          value={desc} 
          onChange={(e) => setDesc(e.target.value)} 
          placeholder={t("Korte omschrijving van de groep...", "Short description of the group...", "Grup hakkında kısa açıklama...")} 
          className="bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-amber-500" 
        />
      </div>
      <div className="flex justify-end pt-1">
        <button 
          type="submit" 
          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 font-bold text-xs text-white rounded-lg transition-all cursor-pointer border-none shadow-sm"
        >
          {t("Categorie Toevoegen", "Add Category", "Kategori Ekle")}
        </button>
      </div>
    </form>
  );
}
