/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Settings, Check, Trash2, Plus, ChevronDown, Upload, Coffee, Camera, Sparkles, Building2, LayoutGrid } from "lucide-react";
import { resizeImage } from "../../utils/image";
import { motion, AnimatePresence } from "motion/react";
import { useAppStore, type GoogleReview } from "../../store/appStore";
import { useAuthStore } from "../../store/authStore";
import AdminConfirmDialog from "./AdminConfirmDialog";
import { showAdminToast } from "./AdminToast";
import AdviesConfigEditor from "./AdviesConfigEditor";

interface AdminCustomizerProps {
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  adminLanguage?: string;
}

export default function AdminCustomizer({ onAddSystemLog, adminLanguage }: AdminCustomizerProps) {
  const siteConfig = useAppStore((state) => state.siteConfig);
  const customCategories = useAppStore((state) => state.customCategories);
  const updateSiteConfig = useAppStore((state) => state.updateSiteConfig);
  const updateCategories = useAppStore((state) => state.updateCategories);
  const adminUser = useAuthStore((state) => state.user);

  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<{ id: string; label: string } | null>(null);

  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [saveConfigMsg, setSaveConfigMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
  const [menuAdmin, setMenuAdmin] = useState(siteConfig.menuAdminLabel || "");
  const [contactEmail, setContactEmail] = useState(siteConfig.contactEmail || "");
  const [contactPhone, setContactPhone] = useState(siteConfig.contactPhone || "");
  const [whatsappNumber, setWhatsappNumber] = useState(siteConfig.whatsappNumber || "");
  const [companyAddress, setCompanyAddress] = useState(siteConfig.companyAddress || "");
  const [kvkNumber, setKvkNumber] = useState(siteConfig.kvkNumber || "");
  const [btwNumber, setBtwNumber] = useState(siteConfig.btwNumber || "");
  const [companyLegalName, setCompanyLegalName] = useState(siteConfig.companyLegalName || "");
  // Coffee Corner homepage-blok — uit tot een admin titel + omschrijving invult en aanzet
  const [coffeeCornerEnabled, setCoffeeCornerEnabled] = useState(siteConfig.coffeeCornerEnabled ?? false);
  const [coffeeCornerTitle, setCoffeeCornerTitle] = useState(siteConfig.coffeeCornerTitle || "");
  const [coffeeCornerDescription, setCoffeeCornerDescription] = useState(siteConfig.coffeeCornerDescription || "");
  const [coffeeCornerImageUrl, setCoffeeCornerImageUrl] = useState(siteConfig.coffeeCornerImageUrl || "");
  const [coffeeCornerCtaLabel, setCoffeeCornerCtaLabel] = useState(siteConfig.coffeeCornerCtaLabel || "");
  const [coffeeCornerCtaHref, setCoffeeCornerCtaHref] = useState(siteConfig.coffeeCornerCtaHref || "");
  const [isUploadingCoffeeCorner, setIsUploadingCoffeeCorner] = useState(false);
  // Photo gallery homepage-blok — uit tot een admin titel + minstens 1 foto invult en aanzet
  const [galleryEnabled, setGalleryEnabled] = useState(siteConfig.galleryEnabled ?? false);
  const [galleryTitle, setGalleryTitle] = useState(siteConfig.galleryTitle || "");
  const [galleryDescription, setGalleryDescription] = useState(siteConfig.galleryDescription || "");
  const [galleryImages, setGalleryImages] = useState<string[]>(siteConfig.galleryImages ?? []);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  // Echte Google-score — leeg = niets tonen in de footer
  const [googleRating, setGoogleRating] = useState(siteConfig.googleRating != null ? String(siteConfig.googleRating) : "");
  const [googleReviewCount, setGoogleReviewCount] = useState(siteConfig.googleReviewCount != null ? String(siteConfig.googleReviewCount) : "");
  // Admin-gecureerde echte Google-reviews (footer-ticker)
  const [googleReviews, setGoogleReviews] = useState<GoogleReview[]>(siteConfig.googleReviews ?? []);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const updateReview = (i: number, patch: Partial<GoogleReview>) =>
    setGoogleReviews((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addReview = () =>
    setGoogleReviews((prev) => [...prev, { author: "", rating: 5, text: "", date: "" }]);
  const removeReview = (i: number) =>
    setGoogleReviews((prev) => prev.filter((_, idx) => idx !== i));

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
      setMenuAdmin(siteConfig.menuAdminLabel || "");
      setContactEmail(siteConfig.contactEmail || "");
      setContactPhone(siteConfig.contactPhone || "");
      setWhatsappNumber(siteConfig.whatsappNumber || "");
      setCompanyAddress(siteConfig.companyAddress || "");
      setKvkNumber(siteConfig.kvkNumber || "");
      setBtwNumber(siteConfig.btwNumber || "");
      setCompanyLegalName(siteConfig.companyLegalName || "");
      setCoffeeCornerEnabled(siteConfig.coffeeCornerEnabled ?? false);
      setCoffeeCornerTitle(siteConfig.coffeeCornerTitle || "");
      setCoffeeCornerDescription(siteConfig.coffeeCornerDescription || "");
      setCoffeeCornerImageUrl(siteConfig.coffeeCornerImageUrl || "");
      setCoffeeCornerCtaLabel(siteConfig.coffeeCornerCtaLabel || "");
      setCoffeeCornerCtaHref(siteConfig.coffeeCornerCtaHref || "");
      setGalleryEnabled(siteConfig.galleryEnabled ?? false);
      setGalleryTitle(siteConfig.galleryTitle || "");
      setGalleryDescription(siteConfig.galleryDescription || "");
      setGalleryImages(siteConfig.galleryImages ?? []);
      setGoogleRating(siteConfig.googleRating != null ? String(siteConfig.googleRating) : "");
      setGoogleReviewCount(siteConfig.googleReviewCount != null ? String(siteConfig.googleReviewCount) : "");
      setGoogleReviews(siteConfig.googleReviews ?? []);
    }
  }, [siteConfig]);

  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingHero(true);
    try {
      // Hero is the LCP image, so keep the upload lean: 1600px / 80% WebP is sharp
      // full-width yet ~5x smaller than the old 2560px/92% (which produced ~1 MB and
      // tanked LCP on mobile). enhance=false preserves the original photo colours —
      // AI-generated images shouldn't get the product colour boost.
      const base64 = await resizeImage(file, 1600, 900, 0.80, false);
      // resizeImage always outputs WebP or JPEG — derive extension from actual output, never from original filename
      const uploadName = base64.startsWith("data:image/webp") ? "hero.webp" : "hero.jpg";
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
        showAdminToast(t("Uploaden mislukt.", "Upload failed.", "Yükleme başarısız."), "error");
      }
    } catch {
      showAdminToast(t("Fout bij uploaden afbeelding.", "Error uploading image.", "Resim yükleme hatası."), "error");
    } finally {
      setIsUploadingHero(false);
      e.target.value = "";
    }
  };

  const handleCoffeeCornerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCoffeeCorner(true);
    try {
      // Below-the-fold photo, not the LCP hero — a smaller size is plenty.
      const base64 = await resizeImage(file, 900, 900, 0.80, false);
      const uploadName = base64.startsWith("data:image/webp") ? "coffee-corner.webp" : "coffee-corner.jpg";
      const token = localStorage.getItem("hwh_admin_token") || localStorage.getItem("hwh_token");
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ fileName: uploadName, base64Data: base64 })
      });
      if (res.ok) {
        const data = await res.json();
        setCoffeeCornerImageUrl(data.url);
      } else {
        showAdminToast(t("Uploaden mislukt.", "Upload failed.", "Yükleme başarısız."), "error");
      }
    } catch {
      showAdminToast(t("Fout bij uploaden afbeelding.", "Error uploading image.", "Resim yükleme hatası."), "error");
    } finally {
      setIsUploadingCoffeeCorner(false);
      e.target.value = "";
    }
  };

  const handleGalleryImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingGallery(true);
    for (let i = 0; i < files.length; i++) {
      if (galleryImages.length + 1 > 10) {
        showAdminToast(t("Maximaal 10 foto's toegestaan.", "Maximum 10 photos allowed.", "En fazla 10 fotoğraf yüklenebilir."), "error");
        break;
      }
      const file = files[i];
      try {
        // Below-the-fold gallery photo, not the LCP hero — a smaller size is plenty.
        const base64 = await resizeImage(file, 1200, 1200, 0.80, false);
        const ext = base64.startsWith("data:image/webp") ? ".webp" : ".jpg";
        const token = localStorage.getItem("hwh_admin_token") || localStorage.getItem("hwh_token");
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ fileName: `gallery${ext}`, base64Data: base64 })
        });
        if (res.ok) {
          const data = await res.json();
          setGalleryImages((prev) => (prev.length < 10 ? [...prev, data.url] : prev));
        } else {
          showAdminToast(t("Uploaden mislukt voor: ", "Upload failed for: ", "Yükleme başarısız: ") + file.name, "error");
        }
      } catch {
        showAdminToast(t("Fout bij uploaden afbeelding.", "Error uploading image.", "Resim yükleme hatası."), "error");
      }
    }
    setIsUploadingGallery(false);
    e.target.value = "";
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
      menuAdminLabel: menuAdmin.trim() || "Portaal",
      contactEmail,
      contactPhone,
      whatsappNumber,
      companyAddress,
      kvkNumber,
      btwNumber,
      companyLegalName,
      coffeeCornerEnabled,
      coffeeCornerTitle,
      coffeeCornerDescription,
      coffeeCornerImageUrl,
      coffeeCornerCtaLabel,
      coffeeCornerCtaHref,
      galleryEnabled,
      galleryTitle,
      galleryDescription,
      galleryImages,
      // Lege string wist de score (server zet dan null); anders het getal
      googleRating: googleRating.trim() === "" ? null : Number(googleRating),
      googleReviewCount: googleReviewCount.trim() === "" ? null : Number(googleReviewCount),
      // Alleen reviews met tekst opslaan
      googleReviews: googleReviews.filter((r) => r.text.trim() !== "")
    });
    setIsSavingConfig(false);
    if (success) {
      onAddSystemLog("system", adminUser?.name ?? "Admin", t("Storefront algemene en navigatie instellingen opgeslagen.", "Storefront general and navigation settings saved.", "Mağaza genel ve gezinme ayarları kaydedildi."));
      setSaveConfigMsg({ ok: true, text: t("Instellingen succesvol opgeslagen!", "Settings saved successfully!", "Ayarlar başarıyla kaydedildi!") });
      setTimeout(() => setSaveConfigMsg(null), 4000);
    } else {
      setSaveConfigMsg({ ok: false, text: t("Fout bij opslaan van instellingen.", "Error saving settings.", "Ayarlar kaydedilirken hata oluştu.") });
    }
  };

  const [editingInfoCatId, setEditingInfoCatId] = useState<string | null>(null);
  const [infoUseCases, setInfoUseCases] = useState("");
  const [infoAdvantages, setInfoAdvantages] = useState("");
  const [infoNotFor, setInfoNotFor] = useState("");

  // Basisvelden (naam, meervoud, hoogte, prijs, omschrijving) — los van de
  // info-editor hierboven. Dit was voorheen alleen via een directe
  // database-wijziging te herstellen (bijv. de "Toe & Go" typefout), zonder
  // enig scherm om het zelf recht te zetten.
  const [editingBasicCatId, setEditingBasicCatId] = useState<string | null>(null);
  const [basicLabel, setBasicLabel] = useState("");
  const [basicListLabel, setBasicListLabel] = useState("");
  const [basicDesc, setBasicDesc] = useState("");
  const [basicHeights, setBasicHeights] = useState("");
  const [basicPrice, setBasicPrice] = useState("");
  const [isSavingBasic, setIsSavingBasic] = useState(false);

  const handleOpenBasicEditor = (cat: typeof customCategories[0]) => {
    if (editingBasicCatId === cat.id) { setEditingBasicCatId(null); return; }
    setBasicLabel(cat.label);
    setBasicListLabel(cat.listLabel || "");
    setBasicDesc(cat.desc);
    setBasicHeights(cat.heights);
    setBasicPrice(cat.price);
    setEditingBasicCatId(cat.id);
  };

  const handleSaveBasicFields = async (catId: string) => {
    if (!basicLabel.trim()) {
      showAdminToast(t("Groep Label mag niet leeg zijn.", "Group Label cannot be empty.", "Grup Etiketi boş olamaz."), "error");
      return;
    }
    setIsSavingBasic(true);
    const updated = customCategories.map(c =>
      c.id === catId ? {
        ...c,
        label: basicLabel.trim(),
        listLabel: basicListLabel.trim() || basicLabel.trim(),
        desc: basicDesc.trim(),
        heights: basicHeights.trim(),
        price: basicPrice.trim()
      } : c
    );
    const success = await updateCategories(updated);
    setIsSavingBasic(false);
    if (success) {
      setEditingBasicCatId(null);
      onAddSystemLog("system", adminUser?.name ?? "Admin", t(`Categorienaam bijgewerkt: ${catId}`, `Category name updated: ${catId}`, `Kategori adı güncellendi: ${catId}`));
    } else {
      showAdminToast(t("Fout bij opslaan van categorie.", "Error saving category.", "Kategori kaydedilirken hata oluştu."), "error");
    }
  };

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

  const handleDeleteCategory = (id: string, label: string) => {
    setPendingDeleteCategory({ id, label });
  };

  const confirmDeleteCategory = async () => {
    if (!pendingDeleteCategory) return;
    const { id, label } = pendingDeleteCategory;
    const updated = customCategories.filter((c) => c.id !== id);
    const success = await updateCategories(updated);
    if (success) {
      onAddSystemLog("system", adminUser?.name ?? "Admin", t("Categorie verwijderd: ", "Category deleted: ", "Kategori silindi: ") + `${label} (${id}).`);
    }
    setPendingDeleteCategory(null);
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

          {/* Sectiekop 1/4 — Merk & Hero (Hero-tekst, navigatielabels) */}
          <div className="col-span-1 md:col-span-2 flex items-center gap-2 pt-1 first:pt-0">
            <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">{t("Merk & Hero", "Brand & Hero", "Marka ve Hero")}</h3>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

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
              <p className="text-[10px] text-slate-400">{t("PNG, JPG en WebP worden geaccepteerd. Aanbevolen: ≥2560×1200px, scherpe foto zonder ingebakken tekst. Leeg laten = standaard hero.", "PNG, JPG and WebP accepted. Recommended: ≥2560×1200px, sharp photo without baked-in text. Leave empty = default hero.", "PNG, JPG ve WebP kabul edilir. Önerilen: ≥2560×1200px, içine yazı gömülmemiş net bir fotoğraf. Boş bırak = varsayılan hero.")}</p>
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
              <label className="text-xs text-slate-700 block font-bold">{t("Labels - Assortiment", "Labels - Assortment", "Etiketler - Ürün Gamı")}</label>
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

            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Labels - Portaal (Admin)", "Labels - Portal (Admin)", "Etiketler - Portal (Yönetici)")}</label>
              <input
                type="text"
                value={menuAdmin}
                onChange={(e) => setMenuAdmin(e.target.value)}
                placeholder="Portaal"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

          </div>

          {/* Sectiekop 2/4 — Bedrijf, Contact & Social Proof (bevat ook Google-reviews, genest in de kaart hieronder) */}
          <div className="col-span-1 md:col-span-2 flex items-center gap-2 pt-3">
            <Building2 className="h-4 w-4 text-amber-500 shrink-0" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">{t("Bedrijf, Contact & Social Proof", "Company, Contact & Social Proof", "Şirket, İletişim ve Sosyal Kanıt")}</h3>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Contact & Company Info Form */}
          <div className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm col-span-1 md:col-span-2">
            <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider">{t("Bedrijfsgegevens & Contact", "Company & Contact Info", "Şirket ve İletişim Bilgileri")}</h4>
            <p className="text-[10px] text-slate-500">{t("Deze gegevens verschijnen in de footer, het contactvenster en op facturen.", "These details appear in the footer, contact modal, and on invoices.", "Bu bilgiler altbilgide, iletişim penceresinde ve faturalarda görünür.")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-700 block font-bold">{t("Juridische Naam (Factuur)", "Legal Name (Invoice)", "Yasal Ad (Fatura)")}</label>
                <input type="text" value={companyLegalName} onChange={(e) => setCompanyLegalName(e.target.value)} placeholder="huurgo B.V." className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700 block font-bold">{t("Contact E-mail", "Contact Email", "İletişim E-postası")}</label>
                <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="info@bedrijf.nl" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700 block font-bold">{t("Telefoonnummer", "Phone Number", "Telefon Numarası")}</label>
                <input type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+31 71 542 8114" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700 block font-bold">{t("WhatsApp-nummer", "WhatsApp Number", "WhatsApp Numarası")}</label>
                <input type="text" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="31611848899" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500" />
                <p className="text-[10px] text-slate-400">{t("Alleen cijfers, met landcode zonder +. Stuurt alle WhatsApp-knoppen aan. Leeg = standaard uit instellingen.", "Digits only, country code without +. Drives every WhatsApp button. Empty = default from settings.", "Sadece rakam, ülke kodu + olmadan. Tüm WhatsApp butonlarını yönetir. Boş = ayarlardaki varsayılan.")}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700 block font-bold">{t("Adres", "Address", "Adres")}</label>
                <input type="text" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="Straat 1, 1234 AB Stad" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700 block font-bold">KvK-nummer</label>
                <input type="text" value={kvkNumber} onChange={(e) => setKvkNumber(e.target.value)} placeholder="12345678" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700 block font-bold">BTW-nummer</label>
                <input type="text" value={btwNumber} onChange={(e) => setBtwNumber(e.target.value)} placeholder="NL000000000B01" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500" />
              </div>
            </div>

            {/* Google-beoordeling: echt cijfer, handmatig ingevoerd */}
            <div className="pt-3 mt-1 border-t border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black" style={{ background: "linear-gradient(135deg, #4285F4 25%, #EA4335 50%, #FBBC05 75%, #34A853 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>G</span>
                <span className="text-xs font-bold text-slate-700">{t("Google-beoordeling (footer)", "Google rating (footer)", "Google puanı (altbilgi)")}</span>
              </div>
              <p className="text-[10px] text-slate-500">{t("Voer het echte cijfer van uw Google-bedrijfsprofiel in. Laat leeg om geen score te tonen — verzin nooit een cijfer.", "Enter the real number from your Google Business profile. Leave empty to show no score — never invent a rating.", "Google İşletme profilinizdeki gerçek sayıyı girin. Boş bırakırsanız puan gösterilmez — asla uydurma bir sayı girmeyin.")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700 block font-bold">{t("Score (0–5)", "Score (0–5)", "Puan (0–5)")}</label>
                  <input type="number" step="0.1" min="0" max="5" value={googleRating} onChange={(e) => setGoogleRating(e.target.value)} placeholder="4.9" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-700 block font-bold">{t("Aantal beoordelingen", "Number of reviews", "Değerlendirme sayısı")}</label>
                  <input type="number" step="1" min="0" value={googleReviewCount} onChange={(e) => setGoogleReviewCount(e.target.value)} placeholder="127" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500" />
                </div>
              </div>

              {/* Inklapbare beheerder voor echte Google-reviews (footer-ticker) */}
              <div className="pt-3 mt-1 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setReviewsOpen((o) => !o)}
                  className="w-full flex items-center justify-between text-left cursor-pointer bg-transparent border-none py-1"
                >
                  <span className="text-xs font-bold text-slate-700">
                    {t("Google-reviews (footer-carrousel)", "Google reviews (footer carousel)", "Google yorumları (altbilgi)")} · {googleReviews.length}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${reviewsOpen ? "rotate-180" : ""}`} />
                </button>

                {reviewsOpen && (
                  <div className="mt-2 space-y-3">
                    <p className="text-[10px] text-slate-500">{t("Plaats hier échte reviews van uw Google-profiel. Elke review verschijnt in de carrousel boven de footer.", "Add real reviews from your Google profile here. Each shows in the carousel above the footer.", "Google profilinizdeki gerçek yorumları girin. Her biri altbilgi üstündeki karuselde görünür.")}</p>

                    {googleReviews.map((rev, i) => (
                      <div key={i} className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={rev.author}
                            onChange={(e) => updateReview(i, { author: e.target.value })}
                            placeholder={t("Naam (Google)", "Name (Google)", "Ad (Google)")}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-500"
                          />
                          <select
                            value={rev.rating}
                            onChange={(e) => updateReview(i, { rating: Number(e.target.value) })}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-500"
                          >
                            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeReview(i)}
                            className="shrink-0 text-rose-600 hover:text-rose-700 cursor-pointer bg-transparent border-none p-1"
                            title={t("Verwijderen", "Remove", "Sil")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={rev.text}
                          onChange={(e) => updateReview(i, { text: e.target.value })}
                          placeholder={t("Reviewtekst", "Review text", "Yorum metni")}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-500 resize-none"
                        />
                        <input
                          type="text"
                          value={rev.date}
                          onChange={(e) => updateReview(i, { date: e.target.value })}
                          placeholder={t("Datum-label (bijv. '2 weken geleden')", "Date label (e.g. '2 weeks ago')", "Tarih etiketi (örn. '2 hafta önce')")}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-500"
                        />
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addReview}
                      className="flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-900 cursor-pointer bg-transparent border-none"
                    >
                      <Plus className="h-3.5 w-3.5" /> {t("Review toevoegen", "Add review", "Yorum ekle")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sectiekop 3/4 — Homepage-vitrine (Coffee Corner + fotogalerij) */}
          <div className="col-span-1 md:col-span-2 flex items-center gap-2 pt-3">
            <LayoutGrid className="h-4 w-4 text-amber-500 shrink-0" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">{t("Homepage-vitrine", "Homepage showcase", "Ana Sayfa Vitrini")}</h3>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Coffee Corner Form */}
          <div className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm col-span-1 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                <Coffee className="h-3.5 w-3.5" /> Coffee Corner
              </h4>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs font-bold text-slate-600">{t("Tonen op homepage", "Show on homepage", "Ana sayfada göster")}</span>
                <input
                  type="checkbox"
                  checked={coffeeCornerEnabled}
                  onChange={(e) => setCoffeeCornerEnabled(e.target.checked)}
                  className="h-4 w-4 accent-amber-500 cursor-pointer"
                />
              </label>
            </div>
            <p className="text-[10px] text-slate-500">{t("Dit blok verschijnt vlak boven de footer op de homepage, met een foto en uitnodigende tekst. Vul titel en omschrijving in en zet 'Tonen' aan.", "This block appears just above the footer on the homepage, with a photo and inviting copy. Fill in a title and description and turn on 'Show'.", "Bu blok ana sayfada footer'ın hemen üstünde görünür. Başlık ve açıklama girip 'Göster' seçeneğini açın.")}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-700 block font-bold">{t("Titel", "Title", "Başlık")}</label>
                <input
                  type="text"
                  value={coffeeCornerTitle}
                  onChange={(e) => setCoffeeCornerTitle(e.target.value)}
                  placeholder={t("Welkom in onze Coffee Corner", "Welcome to our Coffee Corner", "Coffee Corner'ımıza hoş geldiniz")}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700 block font-bold">{t("Knoptekst (optioneel)", "Button text (optional)", "Buton metni (opsiyonel)")}</label>
                <input
                  type="text"
                  value={coffeeCornerCtaLabel}
                  onChange={(e) => setCoffeeCornerCtaLabel(e.target.value)}
                  placeholder={t("Plan uw bezoek", "Plan your visit", "Ziyaretinizi planlayın")}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Omschrijving", "Description", "Açıklama")}</label>
              <textarea
                rows={4}
                value={coffeeCornerDescription}
                onChange={(e) => setCoffeeCornerDescription(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 resize-none font-sans"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Knop-link (optioneel)", "Button link (optional)", "Buton linki (opsiyonel)")}</label>
              <input
                type="text"
                value={coffeeCornerCtaHref}
                onChange={(e) => setCoffeeCornerCtaHref(e.target.value)}
                placeholder="/#contact"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-700 block font-bold">{t("Afbeelding (bedrijfsfoto)", "Image (company photo)", "Görsel (şirket fotoğrafı)")}</label>
              <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${isUploadingCoffeeCorner ? "border-amber-300 bg-amber-50 text-amber-600" : "border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50 text-slate-600 hover:text-amber-700"}`}>
                {isUploadingCoffeeCorner ? (
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
                <input type="file" accept="image/*" className="sr-only" disabled={isUploadingCoffeeCorner} onChange={handleCoffeeCornerImageUpload} />
              </label>
              <input
                type="url"
                value={coffeeCornerImageUrl === "/site-coffee-image" ? "" : coffeeCornerImageUrl}
                onChange={(e) => setCoffeeCornerImageUrl(e.target.value)}
                placeholder={t("of URL plakken... (leeg = placeholder-icoon)", "or paste URL... (empty = placeholder icon)", "veya URL yapıştır... (boş = yer tutucu ikon)")}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white font-mono"
              />
              {coffeeCornerImageUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-24">
                  <img
                    src={coffeeCornerImageUrl === "/site-coffee-image" ? "/site-coffee-image?w=320" : coffeeCornerImageUrl}
                    alt="Coffee Corner preview"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
              <p className="text-[10px] text-slate-400">{t("PNG, JPG en WebP worden geaccepteerd. Aanbevolen: liggende foto (bijv. 1200×800px), scherp en zonder ingebakken tekst — hij wordt uitgesneden (bijgesneden) om de kaart te vullen. Leeg laten = placeholder-icoon.", "PNG, JPG and WebP accepted. Recommended: landscape photo (e.g. 1200×800px), sharp and without baked-in text — it gets cropped to fill the card. Leave empty = placeholder icon.", "PNG, JPG ve WebP kabul edilir. Önerilen: yatay fotoğraf (örn. 1200×800px), net ve içine yazı gömülmemiş — kartı doldurmak için kırpılır. Boş bırak = yer tutucu ikon.")}</p>
            </div>
          </div>

          {/* Photo Gallery Form */}
          <div className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm col-span-1 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5" /> {t("Fotogalerij", "Photo gallery", "Fotoğraf galerisi")}
              </h4>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs font-bold text-slate-600">{t("Tonen op homepage", "Show on homepage", "Ana sayfada göster")}</span>
                <input
                  type="checkbox"
                  checked={galleryEnabled}
                  onChange={(e) => setGalleryEnabled(e.target.checked)}
                  className="h-4 w-4 accent-amber-500 cursor-pointer"
                />
              </label>
            </div>
            <p className="text-[10px] text-slate-500">{t("Dit blok verschijnt op de homepage tussen Coffee Corner en de reviews: een carrousel met echte bedrijfsfoto's. Op mobiel schuift 1 foto per keer, op desktop meerdere naast elkaar. Vul een titel in, upload minstens 1 foto en zet 'Tonen' aan.", "This block appears on the homepage between Coffee Corner and the reviews: a carousel of real company photos. On mobile one photo slides at a time, on desktop several side by side. Fill in a title, upload at least 1 photo and turn on 'Show'.", "Bu blok ana sayfada Coffee Corner ile yorumlar arasında görünür: gerçek şirket fotoğraflarından oluşan bir slayt gösterisi. Mobilde tek tek, masaüstünde yan yana kayar. Bir başlık girin, en az 1 fotoğraf yükleyin ve 'Göster' seçeneğini açın.")}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-700 block font-bold">{t("Titel", "Title", "Başlık")}</label>
                <input
                  type="text"
                  value={galleryTitle}
                  onChange={(e) => setGalleryTitle(e.target.value)}
                  placeholder={t("Onze werkzaamheden", "Our work", "Yaptığımız işler")}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700 block font-bold">{t("Omschrijving (optioneel)", "Description (optional)", "Açıklama (opsiyonel)")}</label>
                <input
                  type="text"
                  value={galleryDescription}
                  onChange={(e) => setGalleryDescription(e.target.value)}
                  placeholder={t("Een impressie van onze machines en klussen in het echt.", "A look at our machines and jobs in real life.", "Makinelerimizden ve işlerimizden gerçek kareler.")}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <label className="text-xs text-slate-700 block font-bold">{t("Foto's (max 10)", "Photos (max 10)", "Fotoğraflar (en fazla 10)")}</label>
                <span className="text-[10px] text-slate-400">{galleryImages.length}/10</span>
              </div>
              <div className="relative">
                <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${isUploadingGallery || galleryImages.length >= 10 ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed" : "border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50 text-slate-600 hover:text-amber-700"}`}>
                  {isUploadingGallery ? (
                    <>
                      <span className="h-3.5 w-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-bold">{t("Uploaden...", "Uploading...", "Yükleniyor...")}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 shrink-0" />
                      <span className="text-xs font-bold">{t("Foto's uploaden", "Upload photos", "Fotoğraf yükle")}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    disabled={isUploadingGallery || galleryImages.length >= 10}
                    onChange={handleGalleryImagesUpload}
                  />
                </label>
              </div>

              {galleryImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1 animate-fade-in">
                  {galleryImages.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group shadow-sm">
                      <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                      <button
                        type="button"
                        onClick={() => setGalleryImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-90 hover:opacity-100 transition-opacity shadow cursor-pointer flex items-center justify-center"
                        title={t("Verwijderen", "Delete", "Sil")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-slate-400">{t("PNG, JPG, WebP en de meeste andere formaten worden geaccepteerd. Meerdere foto's tegelijk selecteren kan.", "PNG, JPG, WebP and most other formats accepted. You can select multiple photos at once.", "PNG, JPG, WebP ve diğer birçok format kabul edilir. Aynı anda birden fazla fotoğraf seçebilirsiniz.")}</p>
            </div>
          </div>

          {/* Save Button for Site Config */}
          <div className="flex items-center justify-end gap-3 pt-2 col-span-1 md:col-span-2">
            {saveConfigMsg && (
              <span className={`text-xs font-bold ${saveConfigMsg.ok ? "text-emerald-600" : "text-rose-600"}`}>
                {saveConfigMsg.ok ? "✓ " : "✗ "}{saveConfigMsg.text}
              </span>
            )}
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

        {/* Sectiekop 4/4 — Categorieën & Adviestool */}
        <div className="flex items-center gap-2 pt-1">
          <LayoutGrid className="h-4 w-4 text-amber-500 shrink-0" />
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">{t("Categorieën & Adviestool", "Categories & Advisor tool", "Kategoriler ve Danışman Aracı")}</h3>
          <div className="h-px flex-1 bg-slate-200" />
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
                  onClick={() => handleOpenBasicEditor(cat)}
                  className="w-full flex items-center justify-between px-3.5 py-2 border-t border-slate-100 text-[10px] font-bold text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer bg-transparent"
                >
                  <span>{t("Naam & prijs bewerken", "Edit name & price", "Ad ve fiyatı düzenle")}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${editingBasicCatId === cat.id ? "rotate-180" : ""}`} />
                </button>
                {editingBasicCatId === cat.id && (
                  <div className="p-3.5 border-t border-amber-100 bg-amber-50/40 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-700 block">{t("Groep Label (enkelvoud)", "Group Label (singular)", "Grup Etiketi (tekil)")}</label>
                        <input
                          type="text"
                          value={basicLabel}
                          onChange={(e) => setBasicLabel(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-[10.5px] text-slate-800 outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-700 block">{t("Meervoud", "Plural", "Çoğul")}</label>
                        <input
                          type="text"
                          value={basicListLabel}
                          onChange={(e) => setBasicListLabel(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-[10.5px] text-slate-800 outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-700 block">{t("Hoogte bereik", "Height range", "Yükseklik aralığı")}</label>
                        <input
                          type="text"
                          value={basicHeights}
                          onChange={(e) => setBasicHeights(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-[10.5px] text-slate-800 outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-700 block">{t("Vanaf-prijs", "Starting price", "Başlangıç fiyatı")}</label>
                        <input
                          type="text"
                          value={basicPrice}
                          onChange={(e) => setBasicPrice(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-[10.5px] text-slate-800 outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700 block">{t("Omschrijving", "Description", "Açıklama")}</label>
                      <textarea
                        rows={2}
                        value={basicDesc}
                        onChange={(e) => setBasicDesc(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-[10px] text-slate-800 outline-none focus:border-amber-500 resize-none font-sans"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingBasicCatId(null)}
                        className="px-3 py-1.5 text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        {t("Annuleren", "Cancel", "Vazgeç")}
                      </button>
                      <button
                        type="button"
                        disabled={isSavingBasic}
                        onClick={() => handleSaveBasicFields(cat.id)}
                        className="px-3 py-1.5 text-[10px] font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                      >
                        <Check className="h-3 w-3" />
                        {t("Opslaan", "Save", "Kaydet")}
                      </button>
                    </div>
                  </div>
                )}
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

        {/* Adviestool (product-finder) copy editor */}
        <AdviesConfigEditor onAddSystemLog={onAddSystemLog} adminLanguage={adminLanguage} />

      </div>

      <AdminConfirmDialog
        open={!!pendingDeleteCategory}
        title={t("Categorie verwijderen", "Delete category", "Kategoriyi sil")}
        message={pendingDeleteCategory ? t(`Weet u zeker dat u de categorie "${pendingDeleteCategory.label}" wilt verwijderen?`, `Are you sure you want to delete the category "${pendingDeleteCategory.label}"?`, `Kategoriyi "${pendingDeleteCategory.label}" silmek istediğinizden emin misiniz?`) : ""}
        confirmLabel={t("Verwijderen", "Delete", "Sil")}
        cancelLabel={t("Annuleren", "Cancel", "İptal")}
        onConfirm={confirmDeleteCategory}
        onCancel={() => setPendingDeleteCategory(null)}
      />
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
      showAdminToast(t("Groep ID en Groep Label zijn verplicht.", "Group ID and Group Label are required.", "Grup ID'si ve Grup Etiketi zorunludur."), "error");
      return;
    }
    const cleanId = id.trim().toLowerCase().replace(/\s+/g, "");
    
    // Check duplication
    if (customCategories.some((c: any) => c.id === cleanId)) {
      showAdminToast(t("Groep met deze ID bestaat al.", "Group with this ID already exists.", "Bu ID'ye sahip grup zaten mevcut."), "error");
      return;
    }

    const newCat = {
      id: cleanId,
      label: label.trim(),
      listLabel: listLabel.trim() || label.trim() + "en",
      desc: desc.trim() || t("Moderne hoogwerkers voor diverse klussen.", "Modern aerial platforms for various jobs.", "Çeşitli işler için modern sepetli platformlar."),
      heights: heights.trim() || "10m - 20m",
      price: price.trim() || "€150/dag"
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
      showAdminToast(t("Fout bij opslaan van categorie.", "Error saving category.", "Kategori kaydedilirken hata oluştu."), "error");
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
          placeholder={t("Startprijs (bijv: €190/dag)", "Starting price (e.g. €190/day)", "Başlangıç ücreti (örn: €190/gün)")} 
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
