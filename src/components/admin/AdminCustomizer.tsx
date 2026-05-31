/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Settings, Check, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useAppStore } from "../../store/appStore";

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

  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  // Local copywriting fields state to prevent massive lags and race conditions on keystrokes
  const [storeName, setStoreName] = useState(siteConfig.siteName || "");
  const [tagline, setTagline] = useState(siteConfig.heroTagline || "");
  const [title, setTitle] = useState(siteConfig.heroTitle || "");
  const [subtitle, setSubtitle] = useState(siteConfig.heroSubtitle || "");
  const [menuHome, setMenuHome] = useState(siteConfig.menuHomeLabel || "");
  const [menuCatalog, setMenuCatalog] = useState(siteConfig.menuCatalogLabel || "");
  const [menuAdvisor, setMenuAdvisor] = useState(siteConfig.menuAdvisorLabel || "");
  const [menuOrders, setMenuOrders] = useState(siteConfig.menuOrdersLabel || "");

  // Sync state if backend updates siteConfig
  React.useEffect(() => {
    if (siteConfig) {
      setStoreName(siteConfig.siteName || "");
      setTagline(siteConfig.heroTagline || "");
      setTitle(siteConfig.heroTitle || "");
      setSubtitle(siteConfig.heroSubtitle || "");
      setMenuHome(siteConfig.menuHomeLabel || "");
      setMenuCatalog(siteConfig.menuCatalogLabel || "");
      setMenuAdvisor(siteConfig.menuAdvisorLabel || "");
      setMenuOrders(siteConfig.menuOrdersLabel || "");
    }
  }, [siteConfig]);

  const handleSaveSiteConfig = async () => {
    setIsSavingConfig(true);
    const success = await updateSiteConfig({
      siteName: storeName,
      heroTagline: tagline,
      heroTitle: title,
      heroSubtitle: subtitle,
      menuHomeLabel: menuHome,
      menuCatalogLabel: menuCatalog,
      menuAdvisorLabel: menuAdvisor,
      menuOrdersLabel: menuOrders,
      menuAdminLabel: siteConfig.menuAdminLabel || "Portaal"
    });
    setIsSavingConfig(false);
    if (success) {
      onAddSystemLog("system", "Onur (Eigenaar)", t("Storefront algemene en navigatie instellingen opgeslagen.", "Storefront general and navigation settings saved.", "Mağaza genel ve gezinme ayarları kaydedildi."));
      alert(t("Instellingen succesvol permanent opgeslagen!", "Settings successfully permanently saved!", "Ayarlar kalıcı olarak başarıyla kaydedildi!"));
    } else {
      alert(t("Fout bij opslaan van instellingen.", "Error saving settings.", "Ayarlar kaydedilirken hata oluştu."));
    }
  };

  const handleDeleteCategory = async (id: string, label: string) => {
    if (confirm(t(`Weet u zeker dat u de categorie "${label}" wilt verwijderen?`, `Are you sure you want to delete the category "${label}"?`, `Kategoriyi "${label}" silmek istediğinizden emin misiniz?`))) {
      const updated = customCategories.filter((c) => c.id !== id);
      const success = await updateCategories(updated);
      if (success) {
        onAddSystemLog("system", "Onur (Eigenaar)", t("Categorie verwijderd: ", "Category deleted: ", "Kategori silindi: ") + `${label} (${id}).`);
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
              <label className="text-xs text-slate-700 block font-bold">{t("Labels - AI Vloot Adviseur", "Labels - AI Fleet Advisor", "Etiketler - Yapay Zeka Filo Danışmanı")}</label>
              <input
                type="text"
                value={menuAdvisor}
                onChange={(e) => setMenuAdvisor(e.target.value)}
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
              <div key={cat.id} className="p-3.5 bg-white border border-slate-200 shadow-sm rounded-2xl text-xs space-y-1">
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
            ))}
          </div>

          {/* Add Custom Category Form inline */}
          <AddCategoryForm onAddSystemLog={onAddSystemLog} adminLanguage={adminLanguage} />

        </div>

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
      onAddSystemLog("system", "Onur (Eigenaar)", t("Nieuwe categorie permanent opgeslagen: ", "New category permanently saved: ", "Yeni kategori kalıcı olarak kaydedildi: ") + `${label} (${cleanId}).`);
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
