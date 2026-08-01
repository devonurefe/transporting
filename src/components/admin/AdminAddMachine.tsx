/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { PlusCircle, Sparkles, Trash2, Plus, X, FileText } from "lucide-react";
import { motion } from "motion/react";
import { useAppStore } from "../../store/appStore";
import { resizeImage } from "../../utils/image";
import { readFileAsDataUrl } from "../../utils/file";
import { showAdminToast } from "./AdminToast";
import type { AdminSubTab } from "../AdminSection";

interface AdminAddMachineProps {
  setSubTab: (tab: AdminSubTab) => void;
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  adminLanguage?: string;
}

export default function AdminAddMachine({ setSubTab, onAddSystemLog, adminLanguage }: AdminAddMachineProps) {
  const addMachine = useAppStore((state) => state.addMachine);
  const customCategories = useAppStore((state) => state.customCategories);

  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  // New Machine form state
  const [newName, setNewName] = useState("");
  // "schaarlift" is only a fallback for the (should-never-happen) case where
  // customCategories is completely empty — the real default is the first live
  // category, so a controlled <select> below never silently holds an id that
  // isn't actually one of its own <option>s (e.g. right after that category
  // was deleted via AdminCustomizer, which lets any category be removed with
  // no protection).
  const [newCategory, setNewCategory] = useState(() => customCategories[0]?.id ?? "schaarlift");
  const [newHeight, setNewHeight] = useState("16");
  const [newReach, setNewReach] = useState("12");
  const [newWeight, setNewWeight] = useState("3200");
  const [newPrice, setNewPrice] = useState("150");
  const [newPower, setNewPower] = useState<"Elektrisch" | "Diesel" | "Hybride">("Elektrisch");
  const [newDescription, setNewDescription] = useState("");
  const [suitableInput, setSuitableInput] = useState("Schilder, Aannemer");
  const [weeklyDiscountPercent, setWeeklyDiscountPercent] = useState("");
  const [monthlyDiscountPercent, setMonthlyDiscountPercent] = useState("");
  const [newOneDayPrice, setNewOneDayPrice] = useState("");
  const [newWeekendPrice, setNewWeekendPrice] = useState("");
  const [newTwoDayPrice, setNewTwoDayPrice] = useState("");
  const [newThreeDayPrice, setNewThreeDayPrice] = useState("");
  const [newFourDayPrice, setNewFourDayPrice] = useState("");
  const [newWeeklyPrice, setNewWeeklyPrice] = useState("");
  const [newExtraDayPrice, setNewExtraDayPrice] = useState("");
  const [newMonthlyFlatPrice, setNewMonthlyFlatPrice] = useState("");
  const [newSundayBlockFee, setNewSundayBlockFee] = useState("");
  const [newWeekendRulesEnabled, setNewWeekendRulesEnabled] = useState(false);
  const [campaignText, setCampaignText] = useState("");
  const [campaignDiscountPercent, setCampaignDiscountPercent] = useState("");
  const [campaignDiscountAmount, setCampaignDiscountAmount] = useState("");
  const [newBufferDays, setNewBufferDays] = useState(0);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [isUploadingAdditional, setIsUploadingAdditional] = useState(false);
  const [packageContents, setPackageContents] = useState("");
  const [datasheetUrl, setDatasheetUrl] = useState("");
  const [isUploadingDatasheet, setIsUploadingDatasheet] = useState(false);
  const [newSpecs, setNewSpecs] = useState<{ label: string; value: string }[]>([]);
  const [minRentalDays, setMinRentalDays] = useState("");
  const [newStockQuantity, setNewStockQuantity] = useState("1");
  const [weeklyOnly, setWeeklyOnly] = useState(false);
  const [pickupOnly, setPickupOnly] = useState(false);
  const [showInWeeklyOffers, setShowInWeeklyOffers] = useState(false);
  const [crossSell, setCrossSell] = useState<{ id: string; name: string; description: string; pricePerWeek: string; pricePerDay: string; pricePerTwoDay: string }[]>([]);

  // Keep the category selection valid if customCategories loads/changes after
  // mount (async fetch on first load, or a category deleted while this tab is
  // open) — otherwise the controlled <select> above could silently keep an id
  // that no longer has a matching <option>.
  useEffect(() => {
    if (customCategories.length > 0 && !customCategories.some((c) => c.id === newCategory)) {
      setNewCategory(customCategories[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customCategories]);

  const handleAdditionalImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingAdditional(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64 = await resizeImage(file);
        const ext = base64.startsWith("data:image/webp") ? ".webp" : ".jpg";
        const token = localStorage.getItem("hwh_admin_token") || localStorage.getItem("hwh_token");
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            fileName: `machine-extra${ext}`,
            base64Data: base64
          })
        });

        if (res.ok) {
          const data = await res.json();
          setAdditionalImages((prev) => [...prev, data.url]);
          onAddSystemLog("fleet", "Beheerder", t("Extra afbeelding geüpload: ", "Extra image uploaded: ", "Ek resim yüklendi: ") + file.name);
        } else {
          showAdminToast(t("Uploaden mislukt voor: ", "Upload failed for: ", "Yükleme başarısız: ") + file.name, "error");
        }
      } catch (err) {
        console.error(err);
        showAdminToast(t("Fout bij uploaden afbeelding.", "Error uploading image.", "Resim yükleme hatası."), "error");
      }
    }
    setIsUploadingAdditional(false);
    e.target.value = "";
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const base64 = await resizeImage(file);
      const ext = base64.startsWith("data:image/webp") ? ".webp" : ".jpg";
      const token = localStorage.getItem("hwh_admin_token") || localStorage.getItem("hwh_token");
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          fileName: `machine${ext}`,
          base64Data: base64
        })
      });

      if (res.ok) {
        const data = await res.json();
        setImageUrl(data.url);
        onAddSystemLog("fleet", "Beheerder", t("Afbeelding lokaal geüpload: ", "Image uploaded locally: ", "Resim yerel olarak yüklendi: ") + file.name);
      } else {
        showAdminToast(t("Uploaden mislukt.", "Upload failed.", "Yükleme başarısız."), "error");
      }
    } catch (err) {
      console.error(err);
      showAdminToast(t("Fout bij uploaden afbeelding.", "Error uploading image.", "Resim yükleme hatası."), "error");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleDatasheetFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDatasheet(true);
    try {
      const base64 = await readFileAsDataUrl(file);
      const token = localStorage.getItem("hwh_admin_token") || localStorage.getItem("hwh_token");
      const res = await fetch("/api/upload-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ fileName: file.name, base64Data: base64 })
      });

      if (res.ok) {
        const data = await res.json();
        setDatasheetUrl(data.url);
        onAddSystemLog("fleet", "Beheerder", t("Datasheet (PDF) geüpload: ", "Datasheet (PDF) uploaded: ", "Teknik döküman (PDF) yüklendi: ") + file.name);
      } else {
        const data = await res.json().catch(() => ({}));
        showAdminToast(data.error || t("Uploaden mislukt.", "Upload failed.", "Yükleme başarısız."), "error");
      }
    } catch (err) {
      console.error(err);
      showAdminToast(t("Fout bij uploaden PDF.", "Error uploading PDF.", "PDF yükleme hatası."), "error");
    } finally {
      setIsUploadingDatasheet(false);
      e.target.value = "";
    }
  };

  const handleSubmitNewMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newName.trim() || !newHeight || !newPrice) {
      setFormError(t("Naam, Hoogte en Prijs per dag zijn verplicht.", "Name, Height, and Price per day are required.", "Ad, Yükseklik ve Günlük Ücret zorunludur."));
      return;
    }

    const numHeight = Number(newHeight);
    const numReach = Number(newReach || 0);
    const numWeight = Number(newWeight || 1500);
    const numPrice = Number(newPrice);

    if (isNaN(numHeight) || numHeight <= 0) {
      setFormError(t("Werkhoogte moet een positief getal groter dan 0 zijn.", "Working height must be a positive number greater than 0.", "Çalışma yüksekliği 0'dan büyük pozitif bir sayı olmalıdır."));
      return;
    }
    if (isNaN(numReach) || numReach < 0) {
      setFormError(t("Zijwaarts bereik moet 0 of groter zijn.", "Horizontal reach must be 0 or greater.", "Yatay erişim 0 veya daha büyük olmalıdır."));
      return;
    }
    if (isNaN(numWeight) || numWeight <= 0) {
      setFormError(t("Gewicht moet een positief getal groter dan 0 zijn.", "Weight must be a positive number greater than 0.", "Ağırlık 0'dan büyük pozitif bir sayı olmalıdır."));
      return;
    }
    if (isNaN(numPrice) || numPrice <= 0) {
      setFormError(t("Huurtarief moet een positief getal groter dan 0 zijn.", "Rental rate must be a positive number greater than 0.", "Kiralama ücreti 0'dan büyük pozitif bir sayı olmalıdır."));
      return;
    }

    if (weeklyDiscountPercent) {
      const numWeekly = Number(weeklyDiscountPercent);
      if (isNaN(numWeekly) || numWeekly < 0 || numWeekly > 100) {
        setFormError(t("Weekkorting moet tussen 0% en 100% liggen.", "Weekly discount must be between 0% and 100%.", "Haftalık indirim %0 ile %100 arasında olmalıdır."));
        return;
      }
    }
    if (monthlyDiscountPercent) {
      const numMonthly = Number(monthlyDiscountPercent);
      if (isNaN(numMonthly) || numMonthly < 0 || numMonthly > 100) {
        setFormError(t("Maandkorting moet tussen 0% en 100% liggen.", "Monthly discount must be between 0% and 100%.", "Aylık indirim %0 ile %100 arasında olmalıdır."));
        return;
      }
    }
    if (campaignDiscountPercent) {
      const numCampPercent = Number(campaignDiscountPercent);
      if (isNaN(numCampPercent) || numCampPercent < 0 || numCampPercent > 100) {
        setFormError(t("Campagne kortingspercentage moet tussen 0% en 100% liggen.", "Campaign discount percentage must be between 0% and 100%.", "Kampanya indirim oranı %0 ile %100 arasında olmalıdır."));
        return;
      }
    }
    if (campaignDiscountAmount) {
      const numCampAmt = Number(campaignDiscountAmount);
      if (isNaN(numCampAmt) || numCampAmt < 0) {
        setFormError(t("Campagne kortingsbedrag moet 0 of groter zijn.", "Campaign discount amount must be 0 or greater.", "Kampanya indirim tutarı 0 veya daha büyük olmalıdır."));
        return;
      }
    }

    setIsAdding(true);
    
    const parsedSuitable = suitableInput.split(",").map(s => s.trim()).filter(s => s.length > 0);

    const success = await addMachine({
      name: newName,
      category: newCategory,
      height: Number(newHeight),
      reach: Number(newReach),
      weight: Number(newWeight),
      pricePerDay: Number(newPrice),
      oneDayPrice: newOneDayPrice ? Number(newOneDayPrice) : undefined,
      powerType: newPower,
      imageUrl: imageUrl.trim() || undefined,
      imageAlt: imageAlt.trim() || undefined,
      description: newDescription,
      suitableFor: parsedSuitable.length > 0 ? parsedSuitable : ["Algemeen"],
      weeklyDiscountPercent: weeklyDiscountPercent ? Number(weeklyDiscountPercent) : undefined,
      monthlyDiscountPercent: monthlyDiscountPercent ? Number(monthlyDiscountPercent) : undefined,
      weekendPrice: newWeekendPrice ? Number(newWeekendPrice) : undefined,
      twoDayPrice: newTwoDayPrice ? Number(newTwoDayPrice) : undefined,
      threeDayPrice: newThreeDayPrice ? Number(newThreeDayPrice) : undefined,
      fourDayPrice: newFourDayPrice ? Number(newFourDayPrice) : undefined,
      weeklyPrice: newWeeklyPrice ? Number(newWeeklyPrice) : undefined,
      extraDayPrice: newExtraDayPrice ? Number(newExtraDayPrice) : undefined,
      monthlyPrice: newMonthlyFlatPrice ? Number(newMonthlyFlatPrice) : undefined,
      sundayBlockFee: newSundayBlockFee ? Number(newSundayBlockFee) : undefined,
      weekendRulesEnabled: newWeekendRulesEnabled,
      campaignText: campaignText.trim() || undefined,
      campaignDiscountPercent: campaignDiscountPercent ? Number(campaignDiscountPercent) : undefined,
      campaignDiscountAmount: campaignDiscountAmount ? Number(campaignDiscountAmount) : undefined,
      packageContents: packageContents.trim() || undefined,
      additionalImages: additionalImages,
      datasheetUrl: datasheetUrl || undefined,
      specs: newSpecs.filter(s => s.label.trim() && s.value.trim()).length > 0
        ? newSpecs.filter(s => s.label.trim() && s.value.trim())
        : undefined,
      bufferDays: newBufferDays,
      minRentalDays: minRentalDays ? Number(minRentalDays) : undefined,
      stockQuantity: newStockQuantity ? Number(newStockQuantity) : undefined,
      weeklyOnly,
      pickupOnly,
      showInWeeklyOffers,
      crossSellAddons: crossSell
        .filter(a => a.name.trim())
        .map(a => ({
          id: a.id,
          name: a.name.trim(),
          description: a.description.trim(),
          pricePerWeek: Number(a.pricePerWeek) || 0,
          pricePerDay: a.pricePerDay !== "" && Number(a.pricePerDay) > 0 ? Number(a.pricePerDay) : undefined,
          pricePerTwoDay: a.pricePerTwoDay !== "" && Number(a.pricePerTwoDay) > 0 ? Number(a.pricePerTwoDay) : undefined,
        })),
    });

    setIsAdding(false);

    if (success) {
      onAddSystemLog(
        "fleet", 
        "Onur (Bedrijfseigenaar)", 
        t(`Nieuw apparaat toegevoegd aan vloot: ${newName} (${newPower}).`, `New device added to fleet: ${newName} (${newPower}).`, `Filoya yeni cihaz eklendi: ${newName} (${newPower}).`)
      );
      // Reset form fields
      setNewName("");
      setNewDescription("");
      setSuitableInput("Schilder, Aannemer");
      setWeeklyDiscountPercent("");
      setMonthlyDiscountPercent("");
      setNewOneDayPrice("");
      setNewTwoDayPrice("");
      setNewWeekendPrice("");
      setNewWeeklyPrice("");
      setNewExtraDayPrice("");
      setNewMonthlyFlatPrice("");
      setCampaignText("");
      setCampaignDiscountPercent("");
      setCampaignDiscountAmount("");
      setImageUrl("");
      setImageAlt("");
      setAdditionalImages([]);
      setPackageContents("");
      setNewSpecs([]);
      setNewBufferDays(0);
      setMinRentalDays("");
      setNewStockQuantity("1");
      setWeeklyOnly(false);
      setPickupOnly(false);
      setCrossSell([]);
      setSubTab("machines");
    } else {
      setFormError(useAppStore.getState().error || t("Fout bij opslaan.", "Error saving.", "Kaydetme hatası."));
    }
  };

  return (
    <motion.div
      key="add-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel p-6 rounded-3xl space-y-6"
    >
      <div className="border-b border-slate-200 pb-3">
        <h3 className="font-display font-bold text-sm text-slate-900 flex items-center space-x-2">
          <PlusCircle className="h-5 w-5 text-amber-600" />
          <span>{t("Voeg een Nieuwe Hoogwerker toe aan de Vloot", "Add a New Aerial Platform to the Fleet", "Filoya Yeni Bir Sepetli Platform Ekle")}</span>
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5">{t("Na toevoeging is deze machine direct doorzoekbaar en boekbaar op de website.", "Once added, this machine is immediately searchable and bookable on the website.", "Eklendikten sonra bu makine web sitesinde hemen aranabilir ve rezerve edilebilir hale gelir.")}</p>
      </div>

      <form onSubmit={handleSubmitNewMachine} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="space-y-1">
            <div className="flex justify-between items-center h-5">
              <label className="text-xs text-slate-700 block font-bold">{t("Titel / Modelnaam", "Title / Model name", "Başlık / Model Adı")}</label>
            </div>
            <input
              type="text"
              required
              maxLength={200}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("Bijv. Elektrische Schaarlift Pro 140", "e.g., Electric Scissor Lift Pro 140", "örn: Elektrikli Makaslı Platform Pro 140")}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-700 block font-bold">{t("Machine Categorie", "Machine Category", "Makine Kategorisi")}</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white cursor-pointer h-9.5"
            >
              {customCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {(category.listLabel || category.label)} ({category.id})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-700 block font-bold">{t("Werkhoogte (in meters)", "Working Height (in meters)", "Çalışma Yüksekliği (metre cinsinden)")}</label>
            <input
              type="number"
              required
              min="0.1"
              step="any"
              value={newHeight}
              onChange={(e) => setNewHeight(e.target.value)}
              placeholder={t("Bijv. 16", "e.g., 16", "örn: 16")}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-700 block font-bold">{t("Zijwaarts Bereik (in meters, optioneel)", "Horizontal Reach (in meters, optional)", "Yatay Erişim (metre cinsinden, isteğe bağlı)")}</label>
            <input
              type="number"
              min="0"
              step="any"
              value={newReach}
              onChange={(e) => setNewReach(e.target.value)}
              placeholder={t("Bijv. 12", "e.g., 12", "örn: 12")}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-700 block font-bold">{t("Eigen Gewicht (in kg, optioneel)", "Weight (in kg, optional)", "Ağırlık (kg cinsinden, isteğe bağlı)")}</label>
            <input
              type="number"
              min="1"
              step="any"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder={t("Bijv. 3200", "e.g., 3200", "örn: 3200")}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-700 block font-bold">{t("Huurtarief (Euro per Dag)", "Rental Rate (Euro per Day)", "Kiralama Ücreti (Günlük Euro)")}</label>
            <input
              type="number"
              required
              min="0.1"
              step="any"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder={t("Bijv. 150", "e.g., 150", "örn: 150")}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs text-slate-700 block font-bold">{t("Aandrijving", "Power Type", "Güç Tipi")}</label>
            <div className="flex space-x-4">
              {["Elektrisch", "Diesel", "Hybride"].map((power) => (
                <label key={power} className="flex items-center space-x-2 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="newPowerRadio"
                    checked={newPower === power}
                    onChange={() => setNewPower(power as any)}
                    className="accent-amber-500"
                  />
                  <span className="text-slate-700">{power === "Elektrisch" ? t("Elektrisch", "Electric", "Elektrikli") : power === "Diesel" ? t("Diesel", "Diesel", "Dizel") : t("Hybride", "Hybrid", "Hibrit")}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs text-slate-700 block font-bold">{t("Doelgroepen (komma gescheiden)", "Audience (comma separated)", "Hedef Kitle (virgülle ayrılmış)")}</label>
            <input
              type="text"
              value={suitableInput}
              onChange={(e) => setSuitableInput(e.target.value)}
              placeholder={t("Bijv. Schilder, Aannemer, Glazenwasser, Hovenier", "e.g., Painter, Contractor, Window cleaner, Landscaper", "örn: Boyacı, Müteahhit, Cam temizleyici, Peyzajcı")}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs text-slate-700 block font-bold">{t("Omschrijving", "Description", "Açıklama")}</label>
            <textarea
              rows={4}
              maxLength={2000}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder={t("Professionele producttekst: toepassing, ondergrond, binnen/buiten, plus belangrijkste voordeel.", "Professional product text: application, surface, indoor/outdoor, plus main benefit.", "Profesyonel ürün metni: uygulama alanı, zemin, iç/dış mekan ve en önemli avantajı.")}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white resize-none"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs text-slate-700 block font-bold">
              {t("Inbegrepen Pakketinhoud (Klusgids Set - puntkomma gescheiden)", "Included Package Contents (Semicolon separated)", "Dahil Olan Paket İçeriği (Noktalı virgülle ayrılmış)")}
            </label>
            <textarea
              rows={3}
              maxLength={1500}
              value={packageContents}
              onChange={(e) => setPackageContents(e.target.value)}
              placeholder={t(
                "Bijv. 1x Gecertificeerde Elektrische Schaarlift (12m werkhoogte); 2x 20m zware verlengkabels; 1x Luxe comfort-veiligheidsharnas",
                "e.g., 1x Certified Electric Scissor Lift (12m); 2x 20m heavy extension cables; 1x Comfort safety harness",
                "örn: 1x Sertifikalı Elektrikli Makaslı Platform (12m); 2x 20m ağır hizmet uzatma kablosu; 1x Emniyet kemeri"
              )}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white resize-none"
            />
          </div>

          {/* Specs editor */}
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-700 block font-bold">
                {t("Technische specificaties (popup-tabel)", "Technical specs (popup table)", "Teknik özellikler (popup tablosu)")}
              </label>
              <button
                type="button"
                onClick={() => setNewSpecs(prev => [...prev, { label: "", value: "" }])}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border-none flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                {t("Rij toevoegen", "Add row", "Satır ekle")}
              </button>
            </div>
            {newSpecs.length === 0 && (
              <p className="text-[10px] text-slate-400 italic">
                {t("Nog geen specificaties. Klik op 'Rij toevoegen'.", "No specs yet. Click 'Add row'.", "Henüz özellik yok. 'Satır ekle' butonuna tıkla.")}
              </p>
            )}
            <div className="space-y-1.5">
              {newSpecs.map((spec, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={t("Label (bijv. Capaciteit)", "Label (e.g. Capacity)", "Etiket (örn. Kapasite)")}
                    value={spec.label}
                    onChange={e => setNewSpecs(prev => prev.map((s, i) => i === idx ? { ...s, label: e.target.value } : s))}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                  />
                  <input
                    type="text"
                    placeholder={t("Waarde (bijv. 230 kg)", "Value (e.g. 230 kg)", "Değer (örn. 230 kg)")}
                    value={spec.value}
                    onChange={e => setNewSpecs(prev => prev.map((s, i) => i === idx ? { ...s, value: e.target.value } : s))}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setNewSpecs(prev => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 transition-colors cursor-pointer border-none shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 border-t border-slate-100 pt-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-slate-800">{t("Prijzen & kortingen", "Pricing & discounts", "Fiyatlar ve indirimler")}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                {t(
                  "Vaste pakketprijzen gaan vóór kortingspercentages. Laat een veld leeg om de standaard dagprijs te gebruiken.",
                  "Fixed package prices take priority over discount percentages. Leave a field empty to use the standard daily rate.",
                  "Sabit paket fiyatları indirim oranlarından önceliklidir. Standart günlük ücreti kullanmak için bir alanı boş bırakın."
                )}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("1 Dag Actie €", "1 Day Promo €", "1 Gün Kampanya €")}</label>
              <input
                type="number"
                min="0"
                step="any"
                value={newOneDayPrice}
                onChange={(e) => setNewOneDayPrice(e.target.value)}
                placeholder="–"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-400">{t("Bij precies 1 huurdag", "For exactly 1 rental day", "Tam olarak 1 kiralama gününde")}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("2 Dagen (doordeweeks) €", "2 Days (weekdays) €", "2 Gün (hafta içi) €")}</label>
              <input
                type="number"
                min="0"
                step="any"
                value={newTwoDayPrice}
                onChange={(e) => setNewTwoDayPrice(e.target.value)}
                placeholder="–"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-400">{t("Bij 2 doordeweekse dagen", "For 2 weekday days", "2 hafta içi günde")}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("3 Dagen €", "3 Days €", "3 Gün €")}</label>
              <input
                type="number"
                min="0"
                step="any"
                value={newThreeDayPrice}
                onChange={(e) => setNewThreeDayPrice(e.target.value)}
                placeholder="–"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-400">{t("Bij 3 dagen (anders werkweek)", "For 3 days (else work week)", "3 günde (yoksa iş haftası)")}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("4 Dagen €", "4 Days €", "4 Gün €")}</label>
              <input
                type="number"
                min="0"
                step="any"
                value={newFourDayPrice}
                onChange={(e) => setNewFourDayPrice(e.target.value)}
                placeholder="–"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-400">{t("Bij 4 dagen (anders werkweek)", "For 4 days (else work week)", "4 günde (yoksa iş haftası)")}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Weekendpakket €", "Weekend package €", "Hafta sonu paketi €")}</label>
              <input
                type="number"
                min="0"
                step="any"
                value={newWeekendPrice}
                onChange={(e) => setNewWeekendPrice(e.target.value)}
                placeholder="–"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-400">
                {newWeekendRulesEnabled
                  ? t("Bij losse za, zo of za+zo (niet bij vrijdag-start)", "For standalone Sat, Sun or Sat+Sun (not a Friday start)", "Tek Cmt/Paz veya Cmt+Paz için (Cuma başlangıçta geçerli değil)")
                  : t("Vast weekendtarief (za+zo)", "Fixed weekend rate (Sat+Sun)", "Sabit hafta sonu (Cmt+Paz)")}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Werkweek (5 dgn) €", "Work Week (5 days) €", "İş Haftası (5 gün) €")}</label>
              <input
                type="number"
                min="0"
                step="any"
                value={newWeeklyPrice}
                onChange={(e) => setNewWeeklyPrice(e.target.value)}
                placeholder="–"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-400">{t("Bij 5–27 dagen (naar rato)", "For 5–27 days (pro-rata)", "5–27 günde (orantılı)")}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Extra Dag €", "Extra Day €", "Ekstra Gün €")}</label>
              <input
                type="number"
                min="0"
                step="any"
                value={newExtraDayPrice}
                onChange={(e) => setNewExtraDayPrice(e.target.value)}
                placeholder="–"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-400">{t("Per dag boven de werkweek (dag 6–27), tot maandtarief", "Per day beyond the work week (day 6–27), up to monthly rate", "İş haftasının ötesinde günlük (6–27. gün), ay tarifesine kadar")}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("4 Weken €", "4 Weeks €", "4 Hafta €")}</label>
              <input
                type="number"
                min="0"
                step="any"
                value={newMonthlyFlatPrice}
                onChange={(e) => setNewMonthlyFlatPrice(e.target.value)}
                placeholder="–"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-400">{t("Bij 28+ dagen (naar rato)", "For 28+ days (pro-rata)", "28+ günde (orantılı)")}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Zondagblokkade €", "Sunday block €", "Pazar blokajı €")}</label>
              <input
                type="number"
                min="0"
                step="any"
                value={newSundayBlockFee}
                onChange={(e) => setNewSundayBlockFee(e.target.value)}
                placeholder="–"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-400">{t("Huur t/m za → +toeslag (retour ma)", "Rent thru Sat → +surcharge (return Mon)", "Cmt'ye taşarsa → +ücret (iade Pzt)")}</p>
            </div>
            </div>
            <label className="mt-3 flex items-start gap-2.5 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <input
                type="checkbox"
                checked={newWeekendRulesEnabled}
                onChange={(e) => setNewWeekendRulesEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-500 cursor-pointer"
              />
              <span>
                <span className="text-xs font-bold text-slate-800 block">{t("Weekendregels actief", "Weekend rules active", "Hafta sonu kuralları aktif")}</span>
                <span className="text-[10px] text-slate-400 block">{t("Depot za/zo dicht: weekendpakket + automatische zondagblokkade. Uit voor steigers (Altrex).", "Depot closed Sat/Sun: weekend package + automatic Sunday block. Off for scaffolding (Altrex).", "Depo Cmt/Paz kapalı: hafta sonu paketi + otomatik Pazar blokajı. İskele (Altrex) için kapalı.")}</span>
              </span>
            </label>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Weekkorting (%)", "Weekly Discount (%)", "Haftalık İndirim (%)")}</label>
              <input
                type="number"
                min="0"
                max="100"
                value={weeklyDiscountPercent}
                onChange={(e) => setWeeklyDiscountPercent(e.target.value)}
                placeholder={t("Bijv. 8", "e.g., 8", "örn: 8")}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-400">{t("Alleen als geen vaste weekprijs", "Only if no fixed week price", "Yalnızca sabit hafta fiyatı yoksa")}</p>
              {newWeeklyPrice && weeklyDiscountPercent && (
                <p className="text-[10px] text-amber-600 font-semibold">
                  {t("⚠ Vaste weekprijs is ingevuld — dit % wordt genegeerd.", "⚠ Fixed week price is set — this % will be ignored.", "⚠ Sabit hafta fiyatı girilmiş — bu yüzde uygulanmayacak.")}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Maandkorting (%)", "Monthly Discount (%)", "Aylık İndirim (%)")}</label>
              <input
                type="number"
                min="0"
                max="100"
                value={monthlyDiscountPercent}
                onChange={(e) => setMonthlyDiscountPercent(e.target.value)}
                placeholder={t("Bijv. 15", "e.g., 15", "örn: 15")}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-400">{t("Alleen als geen vaste maandprijs", "Only if no fixed month price", "Yalnızca sabit ay fiyatı yoksa")}</p>
              {newMonthlyFlatPrice && monthlyDiscountPercent && (
                <p className="text-[10px] text-amber-600 font-semibold">
                  {t("⚠ Vaste maandprijs is ingevuld — dit % wordt genegeerd.", "⚠ Fixed month price is set — this % will be ignored.", "⚠ Sabit ay fiyatı girilmiş — bu yüzde uygulanmayacak.")}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700 block font-bold">{t("Campagne label", "Campaign Label", "Kampanya Etiketi")}</label>
              <input
                type="text"
                value={campaignText}
                onChange={(e) => setCampaignText(e.target.value)}
                placeholder={t("Bijv. Voorjaarsactie", "e.g., Spring Promotion", "örn: Bahar Kampanyası")}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-700 block font-bold">{t("Campagne %", "Campaign %", "Kampanya %")}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={campaignDiscountPercent}
                  onChange={(e) => setCampaignDiscountPercent(e.target.value)}
                  placeholder="10"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700 block font-bold">{t("Campagne €", "Campaign €", "Kampanya €")}</label>
                <input
                  type="number"
                  min="0"
                  value={campaignDiscountAmount}
                  onChange={(e) => setCampaignDiscountAmount(e.target.value)}
                  placeholder="50"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2 border-t border-slate-100 pt-3">
            <label className="text-xs block font-bold text-slate-700">{t("Machine Afbeelding (Upload of URL)", "Machine Image (Upload or URL)", "Makine Resmi (Yükleme veya URL)")}</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-200/60 shadow-inner">
              
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold block mb-1">{t("Optie A: Lokaal bestand uploaden", "Option A: Upload local file", "Seçenek A: Yerel dosya yükle")}</span>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploading}
                    onChange={handleImageFileChange}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10.5px] file:font-black file:bg-amber-100 file:text-amber-800 file:cursor-pointer hover:file:bg-amber-200 transition-all"
                  />
                  {isUploading && (
                    <div className="absolute right-3 top-1.5 h-4 w-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold block mb-1">{t("Optie B: Plak een externe afbeeldings-URL", "Option B: Paste an external image URL", "Seçenek B: Harici resim URL'si yapıştır")}</span>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…/foto.webp"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                />
              </div>

              {imageUrl && (
                <div className="col-span-1 md:col-span-2 flex items-center space-x-3 bg-white p-2 rounded-xl border border-slate-100 shadow-sm animate-fade-in">
                  <div className="h-10 w-16 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                    <img src={imageUrl} alt={t("Voorbeeld", "Preview", "Önizleme")} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-mono block">{t("Actieve URL:", "Active URL:", "Aktif URL:")}</span>
                    <span className="text-[10px] text-teal-700 font-bold font-mono truncate max-w-[280px] block">{imageUrl}</span>
                  </div>
                </div>
              )}

              <div className="col-span-1 md:col-span-2 space-y-1">
                <label className="text-[10px] text-slate-500 font-bold block">{t("Afbeelding alt-tekst (SEO/toegankelijkheid)", "Image alt text (SEO/accessibility)", "Resim alt metni (SEO/erişilebilirlik)")}</label>
                <input
                  type="text"
                  maxLength={300}
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  placeholder={t("Bijv. Smalle schaarlift in magazijngang (leeg = modelnaam)", "e.g. Narrow scissor lift in a warehouse aisle (empty = model name)", "örn. Dar depo koridorunda makaslı platform (boş = model adı)")}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                />
              </div>

              {/* Additional Images Section */}
              <div className="col-span-1 md:col-span-2 border-t border-slate-200/80 pt-4 mt-2 space-y-3">
                <span className="text-xs text-slate-700 block font-bold">
                  {t("Extra Afbeeldingengalerij (Diavoorstelling)", "Additional Image Gallery (Slideshow)", "Ek Resim Galerisi (Çoklu Slayt)")}
                </span>
                
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={isUploadingAdditional}
                    onChange={handleAdditionalImageFileChange}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10.5px] file:font-black file:bg-indigo-50 file:text-indigo-700 file:cursor-pointer hover:file:bg-indigo-100 transition-all border border-dashed border-slate-300 rounded-xl p-3 bg-white"
                  />
                  {isUploadingAdditional && (
                    <div className="absolute right-6 top-5 h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                {additionalImages.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mt-3 animate-fade-in">
                    {additionalImages.map((url, idx) => (
                      <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group shadow-sm">
                        <img src={url} alt={`Extra ${idx}`} className="w-full h-full object-cover" loading="lazy" />
                        <button
                          type="button"
                          onClick={() => setAdditionalImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-90 hover:opacity-100 transition-opacity shadow cursor-pointer flex items-center justify-center"
                          title={t("Verwijderen", "Delete", "Sil")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Datasheet PDF Section */}
              <div className="col-span-1 md:col-span-2 border-t border-slate-200/80 pt-4 mt-2 space-y-2">
                <span className="text-xs text-slate-700 block font-bold">
                  {t("Technische fiche (PDF, optioneel)", "Technical datasheet (PDF, optional)", "Teknik döküman (PDF, isteğe bağlı)")}
                </span>
                <span className="text-[10px] text-slate-400 italic block">
                  {t("Zichtbaar als 'Datasheet (PDF)'-knop bij de specificaties in de detailpopup.", "Shown as a 'Datasheet (PDF)' button next to the specs in the detail popup.", "Detay popup'ta özelliklerin yanında 'Datasheet (PDF)' butonu olarak gösterilir.")}
                </span>
                {datasheetUrl ? (
                  <div className="flex items-center gap-2 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs">
                    <FileText className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                    <span className="flex-1 truncate text-slate-600">
                      {t("PDF geüpload", "PDF uploaded", "PDF yüklendi")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDatasheetUrl("")}
                      className="p-0.5 text-slate-400 hover:text-red-500 cursor-pointer border-none bg-transparent shrink-0"
                      title={t("PDF wissen", "Clear PDF", "PDF'yi temizle")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="file"
                      accept="application/pdf"
                      disabled={isUploadingDatasheet}
                      onChange={handleDatasheetFileChange}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10.5px] file:font-black file:bg-teal-50 file:text-teal-700 file:cursor-pointer hover:file:bg-teal-100 transition-all border border-dashed border-slate-300 rounded-xl p-3 bg-white"
                    />
                    {isUploadingDatasheet && (
                      <div className="absolute right-6 top-5 h-5 w-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                )}
                <p className="text-[10px] text-slate-400">{t("Max. 8 MB.", "Max. 8 MB.", "Maks. 8 MB.")}</p>
              </div>

            </div>
          </div>

        </div>

        {/* Verhuurmodel: per week + alleen afhalen + accessoires */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-4">
          <p className="text-sm font-bold text-slate-800">{t("Verhuurmodel & accessoires", "Rental model & accessories", "Kiralama modeli ve aksesuarlar")}</p>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-700">{t("Alleen per week verhuren", "Weekly-only rental", "Sadece haftalık kiralama")}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{t("Vaste weekprijs (€/week veld), minimum 1 week. Dag-/maandtarieven vervallen.", "Fixed weekly price (€/week field), minimum 1 week. Daily/monthly tiers are ignored.", "Sabit haftalık fiyat, minimum 1 hafta. Günlük/aylık kademeler devre dışı.")}</p>
            </div>
            <button
              type="button"
              onClick={() => setWeeklyOnly(v => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${weeklyOnly ? 'bg-orange-500' : 'bg-slate-300'}`}
              role="switch"
              aria-checked={weeklyOnly}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${weeklyOnly ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-700">{t("Alleen afhalen", "Pickup only", "Sadece depodan teslim")}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{t("Verberg bezorging en aanhanger — klant kan alleen zelf ophalen in Zoeterwoude.", "Hide delivery and trailer — customer can only pick up in Zoeterwoude.", "Teslimat ve römork gizlenir — sadece depodan teslim alınır.")}</p>
            </div>
            <button
              type="button"
              onClick={() => setPickupOnly(v => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${pickupOnly ? 'bg-orange-500' : 'bg-slate-300'}`}
              role="switch"
              aria-checked={pickupOnly}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${pickupOnly ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-700">{t("Tonen bij Weekaanbiedingen", "Show in Weekly Offers", "Haftalık Fırsatlarda göster")}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{t("Machine verschijnt in de \"Weekaanbiedingen\" sectie op de homepage.", "Machine appears in the \"Weekly Offers\" section on the homepage.", "Makine ana sayfadaki \"Haftalık Fırsatlar\" bölümünde görünür.")}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowInWeeklyOffers(v => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${showInWeeklyOffers ? 'bg-orange-500' : 'bg-slate-300'}`}
              role="switch"
              aria-checked={showInWeeklyOffers}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showInWeeklyOffers ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-700 block font-bold">{t("Minimale huurperiode (dagen)", "Minimum rental (days)", "Minimum kiralama (gün)")}</label>
            <input
              type="number"
              min="1"
              max="365"
              value={minRentalDays}
              onChange={(e) => setMinRentalDays(e.target.value)}
              placeholder={t("Bijv. 7 (1 week)", "e.g. 7 (1 week)", "örn: 7 (1 hafta)")}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-700 block font-bold">{t("Voorraad (aantal beschikbaar)", "Stock (units available)", "Stok (mevcut adet)")}</label>
            <input
              type="number"
              min="1"
              max="999"
              value={newStockQuantity}
              onChange={(e) => setNewStockQuantity(e.target.value)}
              placeholder={t("Bijv. 3 (3 identieke machines)", "e.g. 3 (3 identical machines)", "örn: 3 (3 aynı makine)")}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
            />
            <p className="text-[11px] text-slate-500">{t("Bij meerdere stuks kunnen meerdere klanten dezelfde (overlappende) data boeken, tot de voorraad op is.", "With more than one unit, multiple customers can book the same (overlapping) dates until stock runs out.", "Birden fazla stok varsa, stok bitene kadar farklı müşteriler aynı (çakışan) tarihleri kiralayabilir.")}</p>
            <p className="text-[11px] text-slate-400 italic">
              {t(
                "Gebruik dit alleen voor identieke units (zelfde prijs, foto's, beschrijving). Heeft een unit een andere prijs, foto of conditie? Voeg die dan hieronder apart toe als \"Naam (Unit 2)\" — dat groepeert wél samen op de catalogus, maar blijft los te bewerken.",
                "Only use this for identical units (same price, photos, description). Does one unit need a different price, photo or condition? Add it below separately as \"Name (Unit 2)\" — that still groups together on the catalog, but stays individually editable.",
                "Bunu yalnızca birebir aynı birimler için kullanın (aynı fiyat, fotoğraf, açıklama). Bir birimin fiyatı/fotoğrafı/durumu farklıysa, aşağıya ayrı bir \"İsim (Unit 2)\" olarak ekleyin — katalogda yine gruplanır ama ayrı ayrı düzenlenebilir kalır."
              )}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-700 block font-bold">{t("Optionele accessoires (per week)", "Optional accessories (per week)", "Opsiyonel aksesuarlar (haftalık)")}</label>
              <button
                type="button"
                onClick={() => setCrossSell(prev => [...prev, { id: "", name: "", description: "", pricePerWeek: "", pricePerDay: "", pricePerTwoDay: "" }])}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border-none flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                {t("Accessoire toevoegen", "Add accessory", "Aksesuar ekle")}
              </button>
            </div>
            {crossSell.length === 0 && (
              <p className="text-[10px] text-slate-400 italic">{t("Geen accessoires. Bijv. Uitbreidingsset of Toolbuddy.", "No accessories yet. E.g. extension set or toolbuddy.", "Henüz aksesuar yok. Örn. genişletme seti.")}</p>
            )}
            <div className="space-y-2">
              {crossSell.map((a, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr_64px_64px_64px_auto] gap-2 items-start bg-white border border-slate-200 rounded-xl p-2">
                  <input
                    type="text"
                    placeholder={t("Naam", "Name", "Ad")}
                    value={a.name}
                    onChange={e => setCrossSell(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    placeholder={t("Omschrijving", "Description", "Açıklama")}
                    value={a.description}
                    onChange={e => setCrossSell(prev => prev.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-500"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="€/wk"
                    title={t("Per week (basis)", "Per week (base)", "Haftalık (temel)")}
                    value={a.pricePerWeek}
                    onChange={e => setCrossSell(prev => prev.map((x, i) => i === idx ? { ...x, pricePerWeek: e.target.value } : x))}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-500"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="€/2dg"
                    title={t("Per 2 dagen (optioneel)", "Per 2 days (optional)", "2 günlük (opsiyonel)")}
                    value={a.pricePerTwoDay}
                    onChange={e => setCrossSell(prev => prev.map((x, i) => i === idx ? { ...x, pricePerTwoDay: e.target.value } : x))}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-500"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="€/dag"
                    title={t("Per dag (optioneel)", "Per day (optional)", "Günlük (opsiyonel)")}
                    value={a.pricePerDay}
                    onChange={e => setCrossSell(prev => prev.map((x, i) => i === idx ? { ...x, pricePerDay: e.target.value } : x))}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setCrossSell(prev => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 transition-colors cursor-pointer border-none shrink-0 self-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Onderhoudsbuffer toggle */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-800">{t("Onderhoudsbuffer na verhuur", "Maintenance buffer after rental", "Kiralama sonrası bakım tamponu")}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t("Dag na huurperiode automatisch geblokkeerd voor opladen & reiniging.", "Day after the rental period is automatically blocked for charging & cleaning.", "Kiralama döneminden sonraki gün şarj ve temizlik için otomatik olarak bloke edilir.")}</p>
            </div>
            <button
              type="button"
              onClick={() => setNewBufferDays(newBufferDays > 0 ? 0 : 1)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${newBufferDays > 0 ? 'bg-orange-500' : 'bg-slate-300'}`}
              role="switch"
              aria-checked={newBufferDays > 0}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${newBufferDays > 0 ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 pt-4 border-t border-slate-200">
          {formError && (
            <p className="text-xs font-bold text-rose-600 text-right">{formError}</p>
          )}
          <button
            type="submit"
            disabled={isAdding}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-extrabold text-xs px-6 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md shrink-0 flex items-center space-x-1.5 cursor-pointer border-none"
          >
            {isAdding ? (
              <>
                <div className="h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                <span>{t("Opslaan...", "Saving...", "Kaydediliyor...")}</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-slate-900" />
                <span>{t("Vloot Opslaan", "Save Fleet", "Filoyu Kaydet")}</span>
              </>
            )}
          </button>
        </div>

      </form>
    </motion.div>
  );
}
