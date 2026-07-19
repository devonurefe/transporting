/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Tag, Plus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAppStore } from "../../store/appStore";
import { useAuthStore } from "../../store/authStore";
import { CampaignRule } from "../../types";
import AdminConfirmDialog from "./AdminConfirmDialog";

interface AdminCampaignRulesProps {
  onAddSystemLog: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
  adminLanguage?: string;
}

// Verplaatst uit AdminCustomizer.tsx (Mağaza Ayarları) naar het Tarieven-gebied van
// AdminContent — kortingsregels horen inhoudelijk bij de andere prijs-/tariefinstellingen,
// niet tussen merk-/customizer-content. Gedrag 1-op-1 overgenomen, geen logicawijziging.
export default function AdminCampaignRules({ onAddSystemLog, adminLanguage }: AdminCampaignRulesProps) {
  const campaignRules = useAppStore((state) => state.campaignRules);
  const updateCampaignRules = useAppStore((state) => state.updateCampaignRules);
  const machines = useAppStore((state) => state.machines);
  const customCategories = useAppStore((state) => state.customCategories);
  const adminUser = useAuthStore((state) => state.user);

  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  // Campaign Rule form state
  const [ruleName, setRuleName] = useState("");
  const [ruleScope, setRuleScope] = useState<"global" | "category" | "product" | "role">("global");
  const [ruleScopeValue, setRuleScopeValue] = useState("global");
  const [ruleDiscount, setRuleDiscount] = useState<number>(5);
  const [pendingDeleteRule, setPendingDeleteRule] = useState<{ id: string; name: string } | null>(null);

  const handleToggleRule = async (id: string) => {
    const updated = campaignRules.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r);
    const ok = await updateCampaignRules(updated);
    if (ok) onAddSystemLog("system", adminUser?.name ?? "Admin", t("Campagneregel status bijgewerkt.", "Campaign rule status updated.", "Kampanya kuralı durumu güncellendi."));
  };

  const handleDeleteRule = (id: string, name: string) => {
    setPendingDeleteRule({ id, name });
  };

  const confirmDeleteRule = async () => {
    if (!pendingDeleteRule) return;
    const { id, name } = pendingDeleteRule;
    const updated = campaignRules.filter(r => r.id !== id);
    const ok = await updateCampaignRules(updated);
    if (ok) onAddSystemLog("system", adminUser?.name ?? "Admin", t("Campagneregel verwijderd: ", "Campaign rule deleted: ", "Kampanya kuralı silindi: ") + name);
    setPendingDeleteRule(null);
  };

  const [addRuleError, setAddRuleError] = useState<string>("");

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;
    setAddRuleError("");

    const trimmed = ruleName.trim();
    if (campaignRules.some(r => r.name.toLowerCase() === trimmed.toLowerCase())) {
      setAddRuleError(t(`Campagneregel met naam "${trimmed}" bestaat al.`, `Campaign rule "${trimmed}" already exists.`, `"${trimmed}" adlı kampanya kuralı zaten var.`));
      return;
    }

    const newRule = {
      id: `rule-${Date.now()}`,
      name: trimmed,
      scope: ruleScope,
      scopeValue: ruleScopeValue,
      discountPercent: Number(ruleDiscount),
      isActive: true
    };

    const ok = await updateCampaignRules([...campaignRules, newRule]);
    if (!ok) return;
    onAddSystemLog("system", adminUser?.name ?? "Admin", t("Nieuwe campagneregel toegevoegd: ", "New campaign rule added: ", "Yeni kampanya kuralı eklendi: ") + newRule.name);

    // reset form
    setRuleName("");
    setRuleScope("global");
    setRuleScopeValue("global");
    setRuleDiscount(5);
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

  const [editRuleError, setEditRuleError] = useState<string>("");

  const handleSaveEditRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule || !editName.trim()) return;
    setEditRuleError("");

    const trimmed = editName.trim();
    if (campaignRules.some(r => r.id !== editingRule.id && r.name.toLowerCase() === trimmed.toLowerCase())) {
      setEditRuleError(t(`Naam "${trimmed}" is al in gebruik.`, `Name "${trimmed}" is already in use.`, `"${trimmed}" adı zaten kullanılıyor.`));
      return;
    }

    const updated = campaignRules.map(r =>
      r.id === editingRule.id
        ? { ...r, name: trimmed, scope: editScope, scopeValue: editScopeValue, discountPercent: Number(editDiscount) }
        : r
    );

    const ok = await updateCampaignRules(updated);
    if (!ok) return;
    onAddSystemLog("system", adminUser?.name ?? "Admin", t("Campagneregel gewijzigd: ", "Campaign rule edited: ", "Kampanya kuralı düzenlendi: ") + trimmed);
    setEditingRule(null);
  };

  return (
    <div className="glass-panel p-5.5 rounded-3xl space-y-4">
      <div className="border-b border-slate-200 pb-3">
        <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
          <Tag className="h-4.5 w-4.5 text-amber-600" />
          {t("Slimme Campagne- & Kortingsregels", "Smart Campaign & Discount Rules", "Akıllı Kampanya ve İndirim Kuralları")}
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {t("Automatische kortingsregels bovenop de vaste tarieven — globaal, per categorie, per product of per klantrol.", "Automatic discount rules on top of the flat rates — global, per category, per product, or per customer role.", "Sabit tarifelerin üzerine otomatik indirim kuralları — genel, kategoriye, ürüne veya müşteri rolüne göre.")}
        </p>
      </div>

      {/* Campaign Rules Manager */}
      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
          <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center space-x-1.5">
            <Tag className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{t("Actieve regels", "Active rules", "Aktif kurallar")}</span>
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
          <div className="flex items-center justify-end gap-3 pt-1">
            {addRuleError && (
              <span className="text-[10px] font-bold text-rose-600">{addRuleError}</span>
            )}
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
                  onClick={() => { setEditingRule(null); setEditRuleError(""); }}
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

                {editRuleError && (
                  <p className="text-[10px] font-bold text-rose-600 text-right">{editRuleError}</p>
                )}
                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setEditingRule(null); setEditRuleError(""); }}
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

      <AdminConfirmDialog
        open={!!pendingDeleteRule}
        title={t("Campagneregel verwijderen", "Delete campaign rule", "Kampanya kuralını sil")}
        message={pendingDeleteRule ? t(`Weet u zeker dat u de campagneregel "${pendingDeleteRule.name}" wilt verwijderen?`, `Are you sure you want to delete the campaign rule "${pendingDeleteRule.name}"?`, `Kampanya kuralını "${pendingDeleteRule.name}" silmek istediğinizden emin misiniz?`) : ""}
        confirmLabel={t("Verwijderen", "Delete", "Sil")}
        cancelLabel={t("Annuleren", "Cancel", "İptal")}
        onConfirm={confirmDeleteRule}
        onCancel={() => setPendingDeleteRule(null)}
      />
    </div>
  );
}
