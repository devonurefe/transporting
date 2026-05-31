/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { PlusCircle, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useAppStore } from "../../store/appStore";

interface AdminAddMachineProps {
  key?: string;
  setSubTab: (tab: "dashboard" | "orders" | "machines" | "calendar" | "add" | "logs" | "customizer") => void;
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
  const [newCategory, setNewCategory] = useState("schaarlift");
  const [newHeight, setNewHeight] = useState("16");
  const [newReach, setNewReach] = useState("12");
  const [newWeight, setNewWeight] = useState("3200");
  const [newPrice, setNewPrice] = useState("150");
  const [newPower, setNewPower] = useState<"Elektrisch" | "Diesel" | "Hybride">("Elektrisch");
  const [newDescription, setNewDescription] = useState("");
  const [suitableInput, setSuitableInput] = useState("Schilder, Aannemer");
  const [weeklyDiscountPercent, setWeeklyDiscountPercent] = useState("");
  const [monthlyDiscountPercent, setMonthlyDiscountPercent] = useState("");
  const [campaignText, setCampaignText] = useState("");
  const [campaignDiscountPercent, setCampaignDiscountPercent] = useState("");
  const [campaignDiscountAmount, setCampaignDiscountAmount] = useState("");
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [packageContents, setPackageContents] = useState("");

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      try {
        const token = localStorage.getItem("hwh_token");
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            fileName: file.name,
            base64Data: base64
          })
        });

        if (res.ok) {
          const data = await res.json();
          setImageUrl(data.url);
          onAddSystemLog("fleet", "Beheerder", t("Afbeelding lokaal geüpload: ", "Image uploaded locally: ", "Resim yerel olarak yüklendi: ") + file.name);
        } else {
          alert(t("Uploaden mislukt.", "Upload failed.", "Yükleme başarısız."));
        }
      } catch (err) {
        console.error(err);
        alert(t("Fout bij uploaden afbeelding.", "Error uploading image.", "Resim yükleme hatası."));
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAIAutofill = async () => {
    if (!newName.trim()) return;

    setIsAutofilling(true);
    try {
      const token = localStorage.getItem("hwh_token");
      const res = await fetch("/api/gemini/autofill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ machineName: newName })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.category) setNewCategory(data.category);
        if (data.height !== undefined) setNewHeight(String(data.height));
        if (data.reach !== undefined) setNewReach(String(data.reach));
        if (data.weight !== undefined) setNewWeight(String(data.weight));
        if (data.pricePerDay !== undefined) setNewPrice(String(data.pricePerDay));
        if (data.powerType) setNewPower(data.powerType);
        if (data.description) setNewDescription(data.description);
        if (data.packageContents) setPackageContents(data.packageContents);
        if (data.suitableFor && Array.isArray(data.suitableFor)) {
          setSuitableInput(data.suitableFor.join(", "));
        }
        if (data.imageUrl) setImageUrl(data.imageUrl);

        onAddSystemLog(
          "fleet",
          "Onur (Bedrijfseigenaar)",
          t(
            `AI Autofill succesvol toegepast voor model: "${newName}".`,
            `AI Autofill successfully applied for model: "${newName}".`,
            `AI Otomatik Doldurma şu model için başarıyla uygulandı: "${newName}".`
          )
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(t(
          "AI Autofill mislukt: " + (errData.error || "Onbekende fout"),
          "AI Autofill failed: " + (errData.error || "Unknown error"),
          "AI Otomatik Doldurma başarısız: " + (errData.error || "Bilinmeyen hata")
        ));
      }
    } catch (err: any) {
      console.error(err);
      alert(t(
        "Fout tijdens verbinding met Gemini AI.",
        "Error connecting to Gemini AI.",
        "Gemini AI ile bağlantı hatası."
      ));
    } finally {
      setIsAutofilling(false);
    }
  };

  const handleSubmitNewMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newHeight || !newPrice) {
      alert(t("Naam, Hoogte en Prijs per dag zijn verplicht.", "Name, Height, and Price per day are required.", "Ad, Yükseklik ve Günlük Ücret zorunludur."));
      return;
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
      powerType: newPower,
      imageUrl: imageUrl.trim() || undefined,
      description: newDescription,
      suitableFor: parsedSuitable.length > 0 ? parsedSuitable : ["Algemeen"],
      weeklyDiscountPercent: weeklyDiscountPercent ? Number(weeklyDiscountPercent) : undefined,
      monthlyDiscountPercent: monthlyDiscountPercent ? Number(monthlyDiscountPercent) : undefined,
      campaignText: campaignText.trim() || undefined,
      campaignDiscountPercent: campaignDiscountPercent ? Number(campaignDiscountPercent) : undefined,
      campaignDiscountAmount: campaignDiscountAmount ? Number(campaignDiscountAmount) : undefined,
      packageContents: packageContents.trim() || undefined
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
      setCampaignText("");
      setCampaignDiscountPercent("");
      setCampaignDiscountAmount("");
      setImageUrl("");
      setPackageContents("");
      setSubTab("machines");
    } else {
      alert(t("Fout bij opslaan.", "Error saving.", "Kaydetme hatası."));
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <div className="space-y-1">
            <div className="flex justify-between items-center h-5">
              <label className="text-xs text-slate-700 block font-bold">{t("Titel / Modelnaam", "Title / Model name", "Başlık / Model Adı")}</label>
              {newName.trim() && (
                <button
                  type="button"
                  onClick={handleAIAutofill}
                  disabled={isAutofilling}
                  className="text-[10px] text-amber-800 bg-amber-100 hover:bg-amber-200 active:scale-95 disabled:opacity-50 px-2 py-0.5 rounded-lg font-bold flex items-center space-x-1 transition-all cursor-pointer border border-amber-300 shadow-xs"
                >
                  {isAutofilling ? (
                    <>
                      <div className="h-3 w-3 border-2 border-amber-800 border-t-transparent rounded-full animate-spin mr-1" />
                      <span>{t("AI Laden...", "AI Loading...", "AI Yükleniyor...")}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-0.5 text-amber-700 animate-pulse" />
                      <span>{t("Gemini AI ile Doldur", "Fill with Gemini AI", "Gemini AI ile Doldur")}</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <input
              type="text"
              required
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
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder={t("Bijv. 150", "e.g., 150", "örn: 150")}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
            />
          </div>

          <div className="space-y-1 col-span-2">
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

          <div className="space-y-1 col-span-2">
            <label className="text-xs text-slate-700 block font-bold">{t("Doelgroepen (komma gescheiden)", "Audience (comma separated)", "Hedef Kitle (virgülle ayrılmış)")}</label>
            <input
              type="text"
              value={suitableInput}
              onChange={(e) => setSuitableInput(e.target.value)}
              placeholder={t("Bijv. Schilder, Aannemer, Glazenwasser, Hovenier", "e.g., Painter, Contractor, Window cleaner, Landscaper", "örn: Boyacı, Müteahhit, Cam temizleyici, Peyzajcı")}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
            />
          </div>

          <div className="space-y-1 col-span-2">
            <label className="text-xs text-slate-700 block font-bold">{t("Omschrijving", "Description", "Açıklama")}</label>
            <textarea
              rows={4}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder={t("Professionele producttekst: toepassing, ondergrond, binnen/buiten, plus belangrijkste voordeel.", "Professional product text: application, surface, indoor/outdoor, plus main benefit.", "Profesyonel ürün metni: uygulama alanı, zemin, iç/dış mekan ve en önemli avantajı.")}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white resize-none"
            />
          </div>

          <div className="space-y-1 col-span-2">
            <label className="text-xs text-slate-700 block font-bold">
              {t("Inbegrepen Pakketinhoud (Klusgids Set - puntkomma gescheiden)", "Included Package Contents (Semicolon separated)", "Dahil Olan Paket İçeriği (Noktalı virgülle ayrılmış)")}
            </label>
            <textarea
              rows={3}
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

          <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
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

          <div className="space-y-2 col-span-2 border-t border-slate-100 pt-3">
            <label className="text-xs block font-bold text-slate-700">{t("Machine Afbeelding (Upload of URL)", "Machine Image (Upload or URL)", "Makine Resmi (Yükleme veya URL)")}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-200/60 shadow-inner">
              
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
                <span className="text-[10px] text-slate-500 font-bold block mb-1">{t("Optie B: Plak een Unsplash/Gereed URL", "Option B: Paste an Unsplash/Ready URL", "Seçenek B: Unsplash/Hazır URL yapıştır")}</span>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                />
              </div>

              {imageUrl && (
                <div className="col-span-1 sm:col-span-2 flex items-center space-x-3 bg-white p-2 rounded-xl border border-slate-100 shadow-sm animate-fade-in">
                  <div className="h-10 w-16 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                    <img src={imageUrl} alt={t("Voorbeeld", "Preview", "Önizleme")} className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-mono block">{t("Actieve URL:", "Active URL:", "Aktif URL:")}</span>
                    <span className="text-[10px] text-teal-700 font-bold font-mono truncate max-w-[280px] block">{imageUrl}</span>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

        <div className="flex justify-end pt-4 border-t border-slate-200">
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
