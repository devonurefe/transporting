/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Wrench, ShieldAlert, CheckCircle2, Plus } from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { euro, formatDateNL } from "../../utils/format";
import AdminConfirmDialog from "./AdminConfirmDialog";
import { showAdminToast } from "./AdminToast";

interface AdminMaintenanceProps {
  adminLanguage?: string;
}

type Tab = "maintenance" | "damage";

export default function AdminMaintenance({ adminLanguage }: AdminMaintenanceProps) {
  const t = (nl: string, en: string, tr: string) =>
    adminLanguage === "tr" ? tr : adminLanguage === "en" ? en : nl;

  const machines = useAppStore((s) => s.machines);
  const maintenanceEvents = useAppStore((s) => s.maintenanceEvents);
  const damageReports = useAppStore((s) => s.damageReports);
  const fetchMaintenanceEvents = useAppStore((s) => s.fetchMaintenanceEvents);
  const fetchDamageReports = useAppStore((s) => s.fetchDamageReports);
  const addMaintenanceEvent = useAppStore((s) => s.addMaintenanceEvent);
  const resolveMaintenanceEvent = useAppStore((s) => s.resolveMaintenanceEvent);
  const addDamageReport = useAppStore((s) => s.addDamageReport);
  const resolveDamageReport = useAppStore((s) => s.resolveDamageReport);

  useEffect(() => {
    fetchMaintenanceEvents();
    fetchDamageReports();
  }, [fetchMaintenanceEvents, fetchDamageReports]);

  const [tab, setTab] = useState<Tab>("maintenance");
  const [showForm, setShowForm] = useState(false);
  const [formMachineId, setFormMachineId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCost, setFormCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState<{ kind: Tab; id: string; machineName: string } | null>(null);

  const getBaseName = (name: string) => name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "").trim();
  const machineOptions = [...machines]
    .sort((a, b) => getBaseName(a.name).localeCompare(getBaseName(b.name)))
    .map(m => ({ id: m.id, label: `${m.name}${m.isRetired ? ` (${t("hizmet dışı", "retired", "retired")})` : ""}` }));

  const resetForm = () => {
    setShowForm(false);
    setFormMachineId("");
    setFormDescription("");
    setFormCost("");
  };

  const submitForm = async () => {
    if (!formMachineId || !formDescription.trim()) {
      showAdminToast(t("Machine en omschrijving zijn verplicht.", "Machine and description are required.", "Makine ve açıklama zorunludur."), "error");
      return;
    }
    setSaving(true);
    const cost = formCost ? Number(formCost) : undefined;
    const ok = tab === "maintenance"
      ? await addMaintenanceEvent({ machineId: formMachineId, description: formDescription.trim(), cost })
      : await addDamageReport({ machineId: formMachineId, description: formDescription.trim(), repairCost: cost });
    setSaving(false);
    if (ok) {
      showAdminToast(
        tab === "maintenance"
          ? t("Onderhoud geregistreerd — machine is nu geblokkeerd.", "Maintenance logged — machine is now blocked.", "Bakım kaydedildi — makine artık bloke.")
          : t("Schademelding geregistreerd — machine is nu geblokkeerd.", "Damage logged — machine is now blocked.", "Hasar kaydedildi — makine artık bloke."),
        "success"
      );
      resetForm();
    } else {
      showAdminToast(useAppStore.getState().error || t("Opslaan mislukt.", "Save failed.", "Kaydetme başarısız."), "error");
    }
  };

  const handleResolve = async () => {
    if (!confirmResolve) return;
    const ok = confirmResolve.kind === "maintenance"
      ? await resolveMaintenanceEvent(confirmResolve.id)
      : await resolveDamageReport(confirmResolve.id);
    if (ok) {
      showAdminToast(t("Afgerond gemarkeerd.", "Marked resolved.", "Çözüldü olarak işaretlendi."), "success");
    } else {
      showAdminToast(useAppStore.getState().error || t("Bijwerken mislukt.", "Update failed.", "Güncelleme başarısız."), "error");
    }
    setConfirmResolve(null);
  };

  const openMaintenance = maintenanceEvents.filter(e => !e.completedDate);
  const resolvedMaintenance = maintenanceEvents.filter(e => e.completedDate);
  const openDamage = damageReports.filter(d => !d.resolvedAt);
  const resolvedDamage = damageReports.filter(d => d.resolvedAt);

  const cardCls = "bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2";

  return (
    <motion.div key="maintenance-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => { setTab("maintenance"); resetForm(); }}
            className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer border ${tab === "maintenance" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            <Wrench className="h-3.5 w-3.5" /> {t("Onderhoud", "Maintenance", "Bakım")}
            {openMaintenance.length > 0 && <span className="ml-1 bg-white/20 rounded-full px-1.5 text-[10px]">{openMaintenance.length}</span>}
          </button>
          <button
            onClick={() => { setTab("damage"); resetForm(); }}
            className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer border ${tab === "damage" ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            <ShieldAlert className="h-3.5 w-3.5" /> {t("Schademeldingen", "Damage reports", "Hasar bildirimleri")}
            {openDamage.length > 0 && <span className="ml-1 bg-white/20 rounded-full px-1.5 text-[10px]">{openDamage.length}</span>}
          </button>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white cursor-pointer transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> {tab === "maintenance" ? t("Onderhoud registreren", "Log maintenance", "Bakım kaydet") : t("Schade registreren", "Log damage", "Hasar kaydet")}
        </button>
      </div>

      {showForm && (
        <div className={cardCls}>
          <select value={formMachineId} onChange={(e) => setFormMachineId(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg p-2.5">
            <option value="">{t("Kies een machine...", "Select a machine...", "Bir makine seçin...")}</option>
            {machineOptions.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder={t("Omschrijving...", "Description...", "Açıklama...")}
            rows={3}
            maxLength={2000}
            className="w-full text-xs border border-slate-200 rounded-lg p-2.5"
          />
          <input
            type="number"
            min={0}
            value={formCost}
            onChange={(e) => setFormCost(e.target.value)}
            placeholder={tab === "maintenance" ? t("Kosten (optioneel)", "Cost (optional)", "Maliyet (opsiyonel)") : t("Herstelbedrag (optioneel)", "Repair cost (optional)", "Onarım bedeli (opsiyonel)")}
            className="w-full text-xs border border-slate-200 rounded-lg p-2.5"
          />
          <div className="flex gap-2 pt-1">
            <button onClick={resetForm} className="flex-1 py-2 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold bg-white cursor-pointer">
              {t("Annuleren", "Cancel", "İptal")}
            </button>
            <button
              onClick={submitForm}
              disabled={saving}
              className={`flex-1 py-2 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-60 ${tab === "maintenance" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-orange-600 hover:bg-orange-700"}`}
            >
              {saving ? "…" : t("Opslaan", "Save", "Kaydet")}
            </button>
          </div>
        </div>
      )}

      {tab === "maintenance" ? (
        <div className="space-y-4">
          <div>
            <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">{t("Open — machine geblokkeerd", "Open — machine blocked", "Açık — makine bloke")}</h4>
            {openMaintenance.length === 0 ? (
              <p className="text-xs text-slate-400">{t("Geen openstaand onderhoud.", "No open maintenance.", "Açık bakım yok.")}</p>
            ) : (
              <div className="space-y-2">
                {openMaintenance.map(e => (
                  <div key={e.id} className={cardCls + " flex items-start justify-between gap-3"}>
                    <div>
                      <p className="text-xs font-black text-slate-800">{getBaseName(e.machineName)}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{e.description}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{formatDateNL(e.scheduledDate)}{e.cost != null ? ` · ${euro(e.cost)}` : ""}</p>
                    </div>
                    <button
                      onClick={() => setConfirmResolve({ kind: "maintenance", id: e.id, machineName: getBaseName(e.machineName) })}
                      className="shrink-0 flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> {t("Afgerond", "Done", "Tamam")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {resolvedMaintenance.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">{t("Afgerond", "Resolved", "Çözüldü")}</h4>
              <div className="space-y-1.5">
                {resolvedMaintenance.slice(0, 20).map(e => (
                  <div key={e.id} className="text-xs text-slate-500 border-b border-slate-100 pb-1.5">
                    {getBaseName(e.machineName)} — {e.description} <span className="text-slate-400">({formatDateNL(e.completedDate!)})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">{t("Open — machine geblokkeerd", "Open — machine blocked", "Açık — makine bloke")}</h4>
            {openDamage.length === 0 ? (
              <p className="text-xs text-slate-400">{t("Geen openstaande schademeldingen.", "No open damage reports.", "Açık hasar bildirimi yok.")}</p>
            ) : (
              <div className="space-y-2">
                {openDamage.map(d => (
                  <div key={d.id} className={cardCls}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-slate-800">{getBaseName(d.machineName)}{d.orderId ? <span className="text-slate-400 font-normal"> · {d.orderId}</span> : null}</p>
                        <p className="text-xs text-slate-600 mt-0.5">{d.description}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{formatDateNL(d.reportedAt)}{d.repairCost != null ? ` · ${euro(d.repairCost)}` : ""}</p>
                      </div>
                      <button
                        onClick={() => setConfirmResolve({ kind: "damage", id: d.id, machineName: getBaseName(d.machineName) })}
                        className="shrink-0 flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> {t("Hersteld", "Repaired", "Onarıldı")}
                      </button>
                    </div>
                    {d.photos && d.photos.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {d.photos.map((p, i) => <img key={i} src={p} alt="" className="h-14 w-14 object-cover rounded-lg border border-slate-200" />)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {resolvedDamage.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">{t("Afgerond", "Resolved", "Çözüldü")}</h4>
              <div className="space-y-1.5">
                {resolvedDamage.slice(0, 20).map(d => (
                  <div key={d.id} className="text-xs text-slate-500 border-b border-slate-100 pb-1.5">
                    {getBaseName(d.machineName)} — {d.description} <span className="text-slate-400">({formatDateNL(d.resolvedAt!)})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AdminConfirmDialog
        open={!!confirmResolve}
        title={t("Markeer als afgerond", "Mark as resolved", "Çözüldü olarak işaretle")}
        message={confirmResolve ? t(
          `Weet u zeker dat "${confirmResolve.machineName}" weer beschikbaar mag zijn voor verhuur?`,
          `Confirm "${confirmResolve.machineName}" is ready to be available for rental again?`,
          `"${confirmResolve.machineName}" tekrar kiralanabilir olsun mu?`
        ) : ""}
        confirmLabel={t("Bevestigen", "Confirm", "Onayla")}
        cancelLabel={t("Annuleren", "Cancel", "İptal")}
        onConfirm={handleResolve}
        onCancel={() => setConfirmResolve(null)}
        danger={false}
      />
    </motion.div>
  );
}
