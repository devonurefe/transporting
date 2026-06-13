/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Plus, Trash2, Wrench, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAppStore } from "../../store/appStore";
import { useAuthStore } from "../../store/authStore";
import { resizeImage } from "../../utils/image";
import { Machine } from "../../types";

interface AdminMachinesProps {
  key?: string;
  setSubTab: (tab: "dashboard" | "orders" | "machines" | "calendar" | "add" | "logs" | "customizer") => void;
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  adminLanguage?: string;
}

export default function AdminMachines({ setSubTab, onAddSystemLog, adminLanguage }: AdminMachinesProps) {
  const machines = useAppStore((state) => state.machines);
  const customCategories = useAppStore((state) => state.customCategories);
  const deleteMachine = useAppStore((state) => state.deleteMachine);
  const updateMachine = useAppStore((state) => state.updateMachine);
  const adminUser = useAuthStore((state) => state.user);

  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  // Edit Machine state parameters
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete confirmation modal — admin must type the machine name to confirm
  const [deleteTarget, setDeleteTarget] = useState<Machine | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleteConfirmText.trim() !== deleteTarget.name) return;
    setIsDeleting(true);
    const success = await deleteMachine(deleteTarget.id);
    setIsDeleting(false);
    if (success) {
      onAddSystemLog("fleet", adminUser?.name ?? "Admin", `Hoogwerker permanent verwijderd: ${deleteTarget.name}`);
      setDeleteTarget(null);
      setDeleteConfirmText("");
    } else {
      alert(t("Fout bij het verwijderen.", "Error deleting machine.", "Silme sırasında bir hata oluştu."));
    }
  };

  // Form parameters
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<any>("schaarlift");
  const [editHeight, setEditHeight] = useState("");
  const [editReach, setEditReach] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editOneDayPrice, setEditOneDayPrice] = useState("");
  const [editPower, setEditPower] = useState<any>("Elektrisch");
  const [editDescription, setEditDescription] = useState("");
  const [editSuitable, setEditSuitable] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editWeeklyDiscountPercent, setEditWeeklyDiscountPercent] = useState("");
  const [editMonthlyDiscountPercent, setEditMonthlyDiscountPercent] = useState("");
  const [editWeekendPrice, setEditWeekendPrice] = useState("");
  const [editTwoDayPrice, setEditTwoDayPrice] = useState("");
  const [editWeeklyPrice, setEditWeeklyPrice] = useState("");
  const [editMonthlyFlatPrice, setEditMonthlyFlatPrice] = useState("");
  const [editCampaignText, setEditCampaignText] = useState("");
  const [editCampaignDiscountPercent, setEditCampaignDiscountPercent] = useState("");
  const [editCampaignDiscountAmount, setEditCampaignDiscountAmount] = useState("");
  const [isUploadingEditImage, setIsUploadingEditImage] = useState(false);
  const [editAdditionalImages, setEditAdditionalImages] = useState<string[]>([]);
  const [isUploadingEditAdditional, setIsUploadingEditAdditional] = useState(false);
  const [editPackageContents, setEditPackageContents] = useState("");
  const [editSpecs, setEditSpecs] = useState<{ label: string; value: string }[]>([]);

  const handleEditAdditionalImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingEditAdditional(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64 = await resizeImage(file);
        const token = localStorage.getItem("hwh_admin_token") || localStorage.getItem("hwh_token");
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ fileName: file.name, base64Data: base64 })
        });
        if (res.ok) {
          const data = await res.json();
          setEditAdditionalImages((prev) => [...prev, data.url]);
          onAddSystemLog("fleet", "Beheerder", t("Extra afbeelding toegevoegd: ", "Extra image added: ", "Ek resim eklendi: ") + file.name);
        } else {
          alert(t("Uploaden mislukt voor: ", "Upload failed for: ", "Yükleme başarısız: ") + file.name);
        }
      } catch (err) {
        console.error(err);
        alert(t("Fout bij uploaden afbeelding.", "Error uploading image.", "Resim yükleme hatası."));
      }
    }
    setIsUploadingEditAdditional(false);
  };

  const handleStartEdit = (m: Machine) => {
    setEditingMachine(m);
    setEditName(m.name);
    setEditCategory(m.category);
    setEditHeight(String(m.height));
    setEditReach(String(m.reach || 0));
    setEditWeight(String(m.weight || 1500));
    setEditPrice(String(m.pricePerDay));
    setEditOneDayPrice(m.oneDayPrice ? String(m.oneDayPrice) : "");
    setEditPower(m.powerType || "Elektrisch");
    setEditDescription(m.description || "");
    setEditSuitable(Array.isArray(m.suitableFor) ? m.suitableFor.join(", ") : String(m.suitableFor || ""));
    setEditImageUrl(m.imageUrl || "");
    setEditWeeklyDiscountPercent(m.weeklyDiscountPercent ? String(m.weeklyDiscountPercent) : "");
    setEditMonthlyDiscountPercent(m.monthlyDiscountPercent ? String(m.monthlyDiscountPercent) : "");
    setEditWeekendPrice(m.weekendPrice ? String(m.weekendPrice) : "");
    setEditTwoDayPrice(m.twoDayPrice ? String(m.twoDayPrice) : "");
    setEditWeeklyPrice(m.weeklyPrice ? String(m.weeklyPrice) : "");
    setEditMonthlyFlatPrice(m.monthlyPrice ? String(m.monthlyPrice) : "");
    setEditCampaignText(m.campaignText || "");
    setEditCampaignDiscountPercent(m.campaignDiscountPercent ? String(m.campaignDiscountPercent) : "");
    setEditCampaignDiscountAmount(m.campaignDiscountAmount ? String(m.campaignDiscountAmount) : "");
    setEditAdditionalImages(m.additionalImages || []);
    setEditPackageContents(m.packageContents || "");
    setEditSpecs(Array.isArray((m as any).specs) ? (m as any).specs : []);
  };

  const handleEditImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingEditImage(true);
    try {
      const base64 = await resizeImage(file);
      const token = localStorage.getItem("hwh_admin_token") || localStorage.getItem("hwh_token");
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ fileName: file.name, base64Data: base64 })
      });
      if (res.ok) {
        const data = await res.json();
        setEditImageUrl(data.url);
        onAddSystemLog("fleet", "Beheerder", t("Machine-afbeelding vervangen: ", "Machine image replaced: ", "Makine resmi değiştirildi: ") + file.name);
      } else {
        alert(t("Uploaden mislukt.", "Upload failed.", "Yükleme başarısız."));
      }
    } catch (err) {
      console.error(err);
      alert(t("Fout bij uploaden afbeelding.", "Error uploading image.", "Resim yükleme hatası."));
    } finally {
      setIsUploadingEditImage(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMachine) return;
    if (!editName.trim() || !editHeight || !editPrice) {
      alert(t("Naam, Hoogte en Prijs per dag zijn verplicht.", "Name, Height, and Price per day are required.", "Ad, Yükseklik ve Günlük Ücret zorunludur."));
      return;
    }

    const numHeight = Number(editHeight);
    const numReach = Number(editReach || 0);
    const numWeight = Number(editWeight || 1500);
    const numPrice = Number(editPrice);

    if (isNaN(numHeight) || numHeight <= 0) {
      alert(t("Werkhoogte moet een positief getal groter dan 0 zijn.", "Working height must be a positive number greater than 0.", "Çalışma yüksekliği 0'dan büyük pozitif bir sayı olmalıdır."));
      return;
    }
    if (isNaN(numReach) || numReach < 0) {
      alert(t("Zijwaarts bereik moet 0 of groter zijn.", "Horizontal reach must be 0 or greater.", "Yatay erişim 0 veya daha büyük olmalıdır."));
      return;
    }
    if (isNaN(numWeight) || numWeight <= 0) {
      alert(t("Gewicht moet een positief getal groter dan 0 zijn.", "Weight must be a positive number greater than 0.", "Ağırlık 0'dan büyük pozitif bir sayı olmalıdır."));
      return;
    }
    if (isNaN(numPrice) || numPrice <= 0) {
      alert(t("Huurtarief moet een positief getal groter dan 0 zijn.", "Rental rate must be a positive number greater than 0.", "Kiralama ücreti 0'dan büyük pozitif bir sayı olmalıdır."));
      return;
    }

    if (editWeeklyDiscountPercent) {
      const numWeekly = Number(editWeeklyDiscountPercent);
      if (isNaN(numWeekly) || numWeekly < 0 || numWeekly > 100) {
        alert(t("Weekkorting moet tussen 0% en 100% liggen.", "Weekly discount must be between 0% and 100%.", "Haftalık indirim %0 ile %100 arasında olmalıdır."));
        return;
      }
    }
    if (editMonthlyDiscountPercent) {
      const numMonthly = Number(editMonthlyDiscountPercent);
      if (isNaN(numMonthly) || numMonthly < 0 || numMonthly > 100) {
        alert(t("Maandkorting moet tussen 0% en 100% liggen.", "Monthly discount must be between 0% and 100%.", "Aylık indirim %0 ile %100 arasında olmalıdır."));
        return;
      }
    }
    if (editCampaignDiscountPercent) {
      const numCampPercent = Number(editCampaignDiscountPercent);
      if (isNaN(numCampPercent) || numCampPercent < 0 || numCampPercent > 100) {
        alert(t("Campagne kortingspercentage moet tussen 0% en 100% liggen.", "Campaign discount percentage must be between 0% and 100%.", "Kampanya indirim oranı %0 ile %100 arasında olmalıdır."));
        return;
      }
    }
    if (editCampaignDiscountAmount) {
      const numCampAmt = Number(editCampaignDiscountAmount);
      if (isNaN(numCampAmt) || numCampAmt < 0) {
        alert(t("Campagne kortingsbedrag moet 0 of groter zijn.", "Campaign discount amount must be 0 or greater.", "Kampanya indirim tutarı 0 veya daha büyük olmalıdır."));
        return;
      }
    }

    setIsUpdating(true);
    const parsedSuitable = editSuitable.split(",").map(s => s.trim()).filter(s => s.length > 0);

    const success = await updateMachine(editingMachine.id, {
      name: editName,
      category: editCategory,
      height: Number(editHeight),
      reach: Number(editReach),
      weight: Number(editWeight),
      pricePerDay: Number(editPrice),
      oneDayPrice: editOneDayPrice ? Number(editOneDayPrice) : undefined,
      powerType: editPower,
      imageUrl: editImageUrl,
      description: editDescription,
      suitableFor: parsedSuitable,
      weeklyDiscountPercent: editWeeklyDiscountPercent ? Number(editWeeklyDiscountPercent) : undefined,
      monthlyDiscountPercent: editMonthlyDiscountPercent ? Number(editMonthlyDiscountPercent) : undefined,
      weekendPrice: editWeekendPrice ? Number(editWeekendPrice) : undefined,
      twoDayPrice: editTwoDayPrice ? Number(editTwoDayPrice) : undefined,
      weeklyPrice: editWeeklyPrice ? Number(editWeeklyPrice) : undefined,
      monthlyPrice: editMonthlyFlatPrice ? Number(editMonthlyFlatPrice) : undefined,
      campaignText: editCampaignText.trim() || undefined,
      campaignDiscountPercent: editCampaignDiscountPercent ? Number(editCampaignDiscountPercent) : undefined,
      campaignDiscountAmount: editCampaignDiscountAmount ? Number(editCampaignDiscountAmount) : undefined,
      packageContents: editPackageContents.trim() || undefined,
      additionalImages: editAdditionalImages,
      specs: editSpecs.filter(s => s.label.trim() && s.value.trim()).length > 0
        ? editSpecs.filter(s => s.label.trim() && s.value.trim())
        : undefined,
    });

    setIsUpdating(false);
    if (success) {
      onAddSystemLog(
        "fleet", 
        "Onur (Bedrijfseigenaar)", 
        t(`Hoogwerker succesvol bijgewerkt: ${editName} (${editPower}).`, `Aerial platform successfully updated: ${editName} (${editPower}).`, `Sepetli platform başarıyla güncellendi: ${editName} (${editPower}).`)
      );
      setEditingMachine(null);
      alert(t("Machine succesvol bijgewerkt!", "Machine successfully updated!", "Makine başarıyla güncellendi!"));
    } else {
      alert(t("Fout bij het bijwerken.", "Error updating.", "Güncelleme sırasında hata oluştu."));
    }
  };

  return (
    <motion.div
      key="mach-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="glass-panel p-6 rounded-3xl space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-display font-bold text-sm text-slate-900">{t("Actuele Machine Pool", "Current Machine Pool", "Mevcut Makine Havuzu")}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{t("Overzicht van geverifieerde units beschikbaar op het netwerk.", "Overview of verified units available on the network.", "Ağda kullanılabilir olan doğrulanmış tüm sepetli platformların listesi.")}</p>
          </div>
          <button
            onClick={() => setSubTab("add")}
            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold px-3.5 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center space-x-1 cursor-pointer border-none"
          >
            <Plus className="h-4 w-4" />
            <span>{t("Toevoegen", "Add", "Ekle")}</span>
          </button>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-2.5 font-bold">{t("Machine", "Machine", "Makine")}</th>
                <th className="pb-2.5 font-bold">{t("Onderdeel", "Category", "Kategori")}</th>
                <th className="pb-2.5 font-bold">{t("Werkhoogte", "Working Height", "Çalışma Yüksekliği")}</th>
                <th className="pb-2.5 font-bold">{t("ZijwBereik", "Horizontal Reach", "Yatay Erişim")}</th>
                <th className="pb-2.5 font-bold">{t("Gewicht", "Weight", "Ağırlık")}</th>
                <th className="pb-2.5 font-bold">{t("Aandrijving", "Power Type", "Güç Tipi")}</th>
                <th className="pb-2.5 font-bold">{t("Totaalprijs/dag", "Price per Day", "Günlük Ücret")}</th>
                <th className="pb-2.5 font-bold text-right pr-4">{t("Acties", "Actions", "İşlemler")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {machines.map((m) => {
                return (
                   <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 font-bold text-slate-800 flex items-center space-x-2.5">
                      <div className="h-11 w-16 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-slate-100">
                        <img
                          src={m.imageUrl || (m.additionalImages as string[])?.[0] || "/placeholder-machine.webp"}
                          alt=""
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const fallback = (m.additionalImages as string[])?.[0];
                            if (fallback && e.currentTarget.src !== fallback) {
                              e.currentTarget.src = fallback;
                            } else {
                              e.currentTarget.src = "/placeholder-machine.webp";
                            }
                          }}
                        />
                      </div>
                      <span>{m.name}</span>
                    </td>
                    <td className="py-3 uppercase font-mono text-[9px] text-slate-500 font-extrabold">{m.category}</td>
                    <td className="py-3 text-slate-700 font-mono">{m.height} m</td>
                    <td className="py-3 text-slate-700 font-mono">{m.reach || "--"} m</td>
                    <td className="py-3 text-slate-700 font-mono">{m.weight || "--"} kg</td>
                    <td className="py-3 text-slate-700">{m.powerType ? (m.powerType === "Elektrisch" ? t("Elektrisch", "Electric", "Elektrikli") : m.powerType === "Diesel" ? t("Diesel", "Diesel", "Dizel") : t("Hybride", "Hybrid", "Hibrit")) : t("Elektrisch", "Electric", "Elektrikli")}</td>
                    <td className="py-3 font-mono text-teal-600 font-bold">€ {m.pricePerDay}</td>
                    <td className="py-3 text-right pr-4">
                      <div className="flex items-center justify-end space-x-1.5 ml-auto">
                        <button
                          onClick={() => handleStartEdit(m)}
                          className="text-indigo-600 hover:text-indigo-800 font-bold text-xs bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer border-none shadow-sm flex items-center justify-center space-x-1"
                        >
                          <Wrench className="h-3 w-3 shrink-0" />
                          <span>{t("Aanpassen", "Modify", "Düzenle")}</span>
                        </button>

                        <button
                          onClick={() => {
                            setDeleteConfirmText("");
                            setDeleteTarget(m);
                          }}
                          className="text-rose-600 hover:text-rose-800 font-bold text-xs bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer border-none shadow-sm flex items-center justify-center space-x-1"
                        >
                          <Trash2 className="h-3 w-3 shrink-0" />
                          <span>{t("Verwijderen", "Delete", "Sil")}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Machine Specs Modal */}
      <AnimatePresence>
        {editingMachine && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingMachine(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className="w-full h-full sm:h-auto sm:max-h-[90vh] max-w-2xl bg-white border-none sm:border sm:border-slate-200 rounded-none sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl relative overflow-hidden z-50 flex flex-col"
            >
              {/* Premium Top stripe */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" />

              {/* Close & Header */}
              <div className="flex justify-between items-start mb-5 shrink-0">
                <div>
                  <span className="text-[10px] text-amber-600 font-mono uppercase tracking-widest block font-bold">
                    {t("Vloot Mutatie Center", "Fleet Mutation Center", "Filo Değişiklik Merkezi")}
                  </span>
                  <h3 className="font-display text-sm font-black text-slate-900 tracking-tight">
                    {t("Machine Specificaties Aanpassen: ", "Modify Machine Specifications: ", "Makine Özelliklerini Düzenle: ")} {editingMachine.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMachine(null)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border-none"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Edit form contents */}
              <form onSubmit={handleSaveEdit} className="flex-1 flex flex-col overflow-hidden min-h-0">
                
                {/* Scrollable Fields Wrapper */}
                <div className="flex-grow overflow-y-auto pr-1.5 space-y-4 scrollbar-thin pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700 block font-bold">{t("Titel / Modelnaam", "Title / Model name", "Başlık / Model Adı")}</label>
                      <input
                        type="text"
                        required
                        maxLength={200}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-700 block font-bold">{t("Machine Categorie", "Machine Category", "Makine Kategorisi")}</label>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as any)}
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
                      <label className="text-xs text-slate-700 block font-bold">{t("Werkhoogte (m)", "Working Height (m)", "Çalışma Yüksekliği (m)")}</label>
                      <input
                        type="number"
                        required
                        min="0.1"
                        step="any"
                        value={editHeight}
                        onChange={(e) => setEditHeight(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-700 block font-bold">{t("Zijwaarts Bereik (m)", "Horizontal Reach (m)", "Yatay Erişim (m)")}</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editReach}
                        onChange={(e) => setEditReach(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-700 block font-bold">{t("Eigen Gewicht (kg)", "Weight (kg)", "Ağırlık (kg)")}</label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={editWeight}
                        onChange={(e) => setEditWeight(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-700 block font-bold">{t("Huurtarief (€/dag)", "Rental Rate (€/day)", "Kiralama Ücreti (€/gün)")}</label>
                      <input
                        type="number"
                        required
                        min="0.1"
                        step="any"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs text-slate-700 block font-bold">{t("Aandrijving", "Power Type", "Güç Tipi")}</label>
                      <div className="flex flex-wrap gap-3 sm:gap-4">
                        {["Elektrisch", "Diesel", "Hybride"].map((power) => (
                          <label key={power} className="flex items-center space-x-2 cursor-pointer text-xs">
                            <input
                              type="radio"
                              name="editPowerRadio"
                              checked={editPower === power}
                              onChange={() => setEditPower(power as any)}
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
                        value={editSuitable}
                        onChange={(e) => setEditSuitable(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs text-slate-700 block font-bold">{t("Afbeelding", "Image", "Resim")}</label>
                      <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="h-20 w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
                          <img
                            src={editImageUrl || "/placeholder-machine.webp"}
                            alt={t("Voorbeeld", "Preview", "Önizleme")}
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.src = "/placeholder-machine.webp";
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="relative">
                            <input
                              type="text"
                              value={editImageUrl}
                              onChange={(e) => setEditImageUrl(e.target.value)}
                              placeholder="/placeholder-machine.webp"
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 pr-8 text-xs text-slate-800 outline-none focus:border-amber-500 font-mono"
                            />
                            {editImageUrl && (
                              <button
                                type="button"
                                onClick={() => setEditImageUrl("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-red-500 cursor-pointer border-none bg-transparent"
                                title="URL wissen"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="relative">
                            <input
                              type="file"
                              accept="image/*"
                              disabled={isUploadingEditImage}
                              onChange={handleEditImageFileChange}
                              className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10.5px] file:font-black file:bg-amber-100 file:text-amber-800 file:cursor-pointer hover:file:bg-amber-200 transition-all"
                            />
                            {isUploadingEditImage && (
                              <div className="absolute right-3 top-1.5 h-4 w-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Aanbevolen: liggende foto (4:3 of 16:9), min. 800×600 px, JPG/WebP, max 3 MB. Wordt automatisch verkleind.</p>
                        </div>
                      </div>

                      {/* Additional Images Section */}
                      <div className="border-t border-slate-200/80 pt-4 space-y-3 mt-3">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-slate-700 block font-bold">
                            {t("Ek Resim Galerisi (Çoklu Slayt Gösterisi)", "Additional Image Gallery (Slideshow)", "Ek Resim Galerisi (Çoklu Slayt)")}
                          </span>
                          <span className="text-[10px] text-slate-400 italic">
                            {t("Zichtbaar in detailpopup (niet op kaart)", "Visible in detail popup (not on card)", "Detay popup'ta görünür (kartta değil)")}
                          </span>
                        </div>
                        
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={isUploadingEditAdditional}
                            onChange={handleEditAdditionalImageFileChange}
                            className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10.5px] file:font-black file:bg-indigo-50 file:text-indigo-700 file:cursor-pointer hover:file:bg-indigo-100 transition-all border border-dashed border-slate-350 rounded-xl p-3 bg-white"
                          />
                          {isUploadingEditAdditional && (
                            <div className="absolute right-6 top-5 h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                          )}
                        </div>

                        {editAdditionalImages.length > 0 && (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-3 animate-fade-in">
                            {editAdditionalImages.map((url, idx) => (
                              <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-105 group shadow-sm">
                                <img src={url} alt={`Extra ${idx}`} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => setEditAdditionalImages(prev => prev.filter((_, i) => i !== idx))}
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
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs text-slate-700 block font-bold">{t("Omschrijving", "Description", "Açıklama")}</label>
                      <textarea
                        rows={4}
                        maxLength={2000}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
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
                        value={editPackageContents}
                        onChange={(e) => setEditPackageContents(e.target.value)}
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
                          onClick={() => setEditSpecs(prev => [...prev, { label: "", value: "" }])}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border-none flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          {t("Rij toevoegen", "Add row", "Satır ekle")}
                        </button>
                      </div>
                      {editSpecs.length === 0 && (
                        <p className="text-[10px] text-slate-400 italic">
                          {t("Nog geen specificaties. Klik op 'Rij toevoegen'.", "No specs yet. Click 'Add row'.", "Henüz özellik yok. 'Satır ekle' butonuna tıkla.")}
                        </p>
                      )}
                      <div className="space-y-1.5">
                        {editSpecs.map((spec, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder={t("Label (bijv. Capaciteit)", "Label (e.g. Capacity)", "Etiket (örn. Kapasite)")}
                              value={spec.label}
                              onChange={e => setEditSpecs(prev => prev.map((s, i) => i === idx ? { ...s, label: e.target.value } : s))}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                            />
                            <input
                              type="text"
                              placeholder={t("Waarde (bijv. 230 kg)", "Value (e.g. 230 kg)", "Değer (örn. 230 kg)")}
                              value={spec.value}
                              onChange={e => setEditSpecs(prev => prev.map((s, i) => i === idx ? { ...s, value: e.target.value } : s))}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => setEditSpecs(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 transition-colors cursor-pointer border-none shrink-0"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-3">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700 block font-bold">{t("1 Dag Actie €", "1 Day Promo €", "1 Gün Kampanya €")}</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={editOneDayPrice}
                          onChange={(e) => setEditOneDayPrice(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700 block font-bold">{t("2 Dagen (doordeweeks) €", "2 Days (weekdays) €", "2 Gün (hafta içi) €")}</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={editTwoDayPrice}
                          onChange={(e) => setEditTwoDayPrice(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-slate-700 block font-bold">{t("Weekend (2-3 dgn) €", "Weekend (2-3 days) €", "Hafta Sonu (2-3 gün) €")}</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={editWeekendPrice}
                          onChange={(e) => setEditWeekendPrice(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-slate-700 block font-bold">{t("Werkweek (5 dgn) €", "Work Week (5 days) €", "İş Haftası (5 gün) €")}</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={editWeeklyPrice}
                          onChange={(e) => setEditWeeklyPrice(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-slate-700 block font-bold">{t("4 Weken €", "4 Weeks €", "4 Hafta €")}</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={editMonthlyFlatPrice}
                          onChange={(e) => setEditMonthlyFlatPrice(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-slate-700 block font-bold">{t("Weekkorting (%)", "Weekly Discount (%)", "Haftalık İndirim (%)")}</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editWeeklyDiscountPercent}
                          onChange={(e) => setEditWeeklyDiscountPercent(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-slate-700 block font-bold">{t("Maandkorting (%)", "Monthly Discount (%)", "Aylık İndirim (%)")}</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editMonthlyDiscountPercent}
                          onChange={(e) => setEditMonthlyDiscountPercent(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-slate-700 block font-bold">{t("Campagne label", "Campaign Label", "Kampanya Etiketi")}</label>
                        <input
                          type="text"
                          value={editCampaignText}
                          onChange={(e) => setEditCampaignText(e.target.value)}
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
                            value={editCampaignDiscountPercent}
                            onChange={(e) => setEditCampaignDiscountPercent(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-700 block font-bold">{t("Campagne €", "Campaign €", "Kampanya €")}</label>
                          <input
                            type="number"
                            min="0"
                            value={editCampaignDiscountAmount}
                            onChange={(e) => setEditCampaignDiscountAmount(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Persistent Sticky Action Buttons Footer */}
                <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingMachine(null)}
                    className="px-4 py-2.5 hover:bg-slate-100 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer border-none"
                  >
                    {t("Sluiten", "Close", "Kapat")}
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md flex items-center space-x-1.5 cursor-pointer border-none"
                  >
                    {isUpdating ? (
                      <>
                        <span className="h-3 w-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin mr-1" />
                        <span>{t("Bijwerken...", "Updating...", "Güncelleniyor...")}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 text-slate-950" />
                        <span>{t("Bijwerken", "Update", "Güncelle")}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal — type-to-confirm guards against accidental deletes */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => setDeleteTarget(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="h-9 w-9 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                  <Trash2 className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {t("Machine permanent verwijderen", "Permanently delete machine", "Makineyi kalıcı olarak sil")}
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                {t(
                  "Dit kan niet ongedaan worden gemaakt. Typ de naam van de machine om te bevestigen:",
                  "This cannot be undone. Type the machine name to confirm:",
                  "Bu işlem geri alınamaz. Onaylamak için makinenin adını yazın:"
                )}
              </p>
              <p className="text-xs font-mono font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3 select-all">
                {deleteTarget.name}
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={t("Naam van de machine", "Machine name", "Makine adı")}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 mb-4 focus:outline-none focus:ring-2 focus:ring-rose-400"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition-colors cursor-pointer border-none"
                >
                  {t("Annuleren", "Cancel", "İptal")}
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteConfirmText.trim() !== deleteTarget.name || isDeleting}
                  className="text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-xl transition-colors cursor-pointer border-none flex items-center gap-1.5"
                >
                  {isDeleting && <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {t("Definitief verwijderen", "Delete permanently", "Kalıcı olarak sil")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
