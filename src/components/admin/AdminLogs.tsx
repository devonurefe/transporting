/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from "react";
import { Terminal, RefreshCw, Search } from "lucide-react";
import { motion } from "motion/react";
import { useAuthStore } from "../../store/authStore";

interface AuditLogRow {
  id: string;
  actorEmail: string | null;
  actorRole: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

interface AdminLogsProps {
  adminLanguage?: string;
}

type LogGroup = "" | "auth" | "orders" | "machines" | "customers" | "settings";

const PAGE_SIZE = 50;

// action → kleurgroep voor de terminal-badge (zelfde stijl als het oude paneel)
function actionColor(action: string): string {
  if (action.startsWith("login.success")) return "text-blue-400 bg-blue-500/10 border border-blue-500/15";
  if (action.startsWith("login.")) return "text-rose-400 bg-rose-500/10 border border-rose-500/15";
  if (action.startsWith("password.")) return "text-amber-400 bg-amber-500/10 border border-amber-500/15";
  if (action.startsWith("order.")) return "text-teal-400 bg-teal-500/10 border border-teal-500/15";
  if (action.startsWith("machine.") || action.startsWith("blockeddate.")) return "text-indigo-400 bg-indigo-500/10 border border-indigo-500/15";
  if (action.startsWith("admin.")) return "text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/15";
  if (action.startsWith("customer.")) return "text-violet-400 bg-violet-500/10 border border-violet-500/15";
  return "text-emerald-400 bg-emerald-500/10 border border-emerald-500/15";
}

// Nederlandse omschrijving per action, opgebouwd uit action + entity + meta.
function describeLog(log: AuditLogRow): string {
  const meta = log.meta || {};
  const id = log.entityId ? ` ${log.entityId}` : "";
  switch (log.action) {
    case "login.success": return "Succesvol ingelogd";
    case "login.failed": return meta.reason === "inactive" ? "Inlogpoging op gedeactiveerd account" : "Mislukte inlogpoging (verkeerd wachtwoord)";
    case "login.locked": return "Account 15 minuten vergrendeld na te veel mislukte pogingen";
    case "login.2fa_failed": return "Mislukte 2FA-verificatie";
    case "password.changed": return "Wachtwoord gewijzigd";
    case "password.reset_requested": return "Wachtwoordreset aangevraagd";
    case "password.reset_completed": return "Wachtwoordreset voltooid";
    case "order.status": return `Bestelling${id}: status ${meta.from ?? "?"} → ${meta.to ?? "?"}`;
    case "order.payment": return `Bestelling${id}: betaalstatus → ${meta.to ?? "?"}`;
    case "order.updated": return `Bestelling${id} bewerkt${Array.isArray(meta.fields) ? ` (${(meta.fields as string[]).length} velden)` : ""}`;
    case "order.created_manual": return `Bestelling${id} handmatig aangemaakt${meta.total ? ` (${meta.total} €)` : ""}`;
    case "customer.updated": return `Klant${id} bijgewerkt${Array.isArray(meta.fields) ? ` (${(meta.fields as string[]).length} velden)` : ""}`;
    case "customer.blocked": return `Klant${id} geblokkeerd`;
    case "customer.unblocked": return `Klant${id} gedeblokkeerd`;
    case "customer.deleted": return `Klant${id} verwijderd${meta.email ? ` (${meta.email})` : ""}`;
    case "machine.created": return `Machine aangemaakt${meta.name ? `: ${meta.name}` : id}`;
    case "machine.updated": return `Machine${id} bijgewerkt${Array.isArray(meta.fields) ? ` (${(meta.fields as string[]).length} velden)` : ""}`;
    case "machine.deleted": return `Machine${id} verwijderd`;
    case "blockeddate.created": return `Datum geblokkeerd (machine${id}${meta.date ? `, ${meta.date}` : ""})`;
    case "blockeddate.deleted": return `Datum gedeblokkeerd (machine${id}${meta.date ? `, ${meta.date}` : ""})`;
    case "siteconfig.updated": return "Site-instellingen bijgewerkt";
    case "campaignrules.updated": return "Campagneregels bijgewerkt";
    case "categories.updated": return "Categorieën bijgewerkt";
    case "advisorconfig.updated": return "Adviestool-configuratie bijgewerkt";
    case "blog.created": return `Kenniscentrum-artikel aangemaakt${meta.slug ? `: ${meta.slug}` : ""}`;
    case "blog.updated": return `Kenniscentrum-artikel${id} bijgewerkt`;
    case "blog.deleted": return `Kenniscentrum-artikel${id} verwijderd`;
    case "admin.created": return "Nieuwe beheerder aangemaakt";
    case "admin.disabled": return `Beheerder${id} gedeactiveerd`;
    case "admin.enabled": return `Beheerder${id} geactiveerd`;
    case "admin.password_reset": return `Wachtwoord van beheerder${id} gereset`;
    case "admin.2fa_reset": return `2FA van beheerder${id} gereset`;
    case "2fa.enabled": return "Tweestapsverificatie ingeschakeld";
    case "2fa.disabled": return "Tweestapsverificatie uitgeschakeld";
    default: return log.action + (log.entity ? ` (${log.entity}${id})` : "");
  }
}

export default function AdminLogs({ adminLanguage }: AdminLogsProps) {
  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  const { token } = useAuthStore();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [group, setGroup] = useState<LogGroup>("");
  const [query, setQuery] = useState("");
  // Only updated on submit (button/Enter) — group-switch, refresh and
  // "Meer laden" must all filter on this, never on unsubmitted keystrokes
  // still sitting in the search box.
  const [appliedQuery, setAppliedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (targetPage: number, targetGroup: LogGroup, targetQuery: string, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(targetPage), limit: String(PAGE_SIZE) });
      if (targetGroup) params.set("group", targetGroup);
      if (targetQuery.trim()) params.set("q", targetQuery.trim());
      const res = await fetch(`/api/admin/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setLogs((prev) => (append ? [...prev, ...data.logs] : data.logs));
      setTotalCount(data.totalCount);
      setPage(targetPage);
    } catch {
      setError(t("Logboek ophalen mislukt.", "Failed to load audit log.", "Denetim günlüğü yüklenemedi."));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, adminLanguage]);

  useEffect(() => {
    fetchLogs(1, group, appliedQuery, false);
    // query wordt via de zoekknop/Enter toegepast, niet per toetsaanslag
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, token, appliedQuery]);

  const groups: { id: LogGroup; label: string }[] = [
    { id: "", label: t("Alles", "All", "Tümü") },
    { id: "auth", label: t("Inloggen & beveiliging", "Login & security", "Giriş ve güvenlik") },
    { id: "orders", label: t("Bestellingen", "Orders", "Siparişler") },
    { id: "machines", label: t("Machines & agenda", "Machines & calendar", "Makineler ve takvim") },
    { id: "customers", label: t("Klanten", "Customers", "Müşteriler") },
    { id: "settings", label: t("Instellingen & content", "Settings & content", "Ayarlar ve içerik") },
  ];

  const hasMore = logs.length < totalCount;

  return (
    <motion.div
      key="logs-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 animate-fade-in"
    >
      <div className="glass-panel p-5.5 rounded-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2">
            <Terminal className="h-4 w-4 text-amber-600" />
            <h3 className="font-display font-bold text-sm text-slate-900">
              {t("Audittrail (beveiligings- & beheeracties)", "Audit trail (security & admin actions)", "Denetim kaydı (güvenlik ve yönetim işlemleri)")}
            </h3>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
              {totalCount}
            </span>
          </div>
          <button
            onClick={() => fetchLogs(1, group, appliedQuery, false)}
            disabled={loading}
            className="text-[10px] font-extrabold text-slate-600 hover:text-indigo-600 flex items-center space-x-1 border border-slate-200 bg-slate-50 hover:bg-indigo-50 py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            <span>{t("Vernieuwen", "Refresh", "Yenile")}</span>
          </button>
        </div>

        {/* Filterchips + e-mail zoeken */}
        <div className="flex flex-wrap items-center gap-2">
          {groups.map((g) => (
            <button
              key={g.id || "all"}
              onClick={() => setGroup(g.id)}
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                group === g.id
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {g.label}
            </button>
          ))}
          <form
            onSubmit={(e) => { e.preventDefault(); setAppliedQuery(query); }}
            className="flex items-center gap-1.5 ml-auto"
          >
            <div className="relative">
              <Search className="h-3 w-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Zoek op e-mail...", "Search by email...", "E-posta ile ara...")}
                className="text-[11px] pl-6 pr-2 py-1.5 rounded-lg border border-slate-200 bg-white w-40 sm:w-48 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <button
              type="submit"
              className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {t("Zoek", "Search", "Ara")}
            </button>
          </form>
        </div>

        {/* Terminal feed */}
        <div className="bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-950 space-y-3 font-mono text-xs max-h-[420px] sm:max-h-[560px] overflow-y-auto scrollbar-thin">
          {error ? (
            <div className="py-12 text-center text-rose-400">{error}</div>
          ) : logs.length === 0 && !loading ? (
            <div className="py-12 text-center text-slate-500">
              {t("Nog geen loggebeurtenissen geregistreerd.", "No log events recorded yet.", "Henüz kayıtlı günlük olayı yok.")}
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="p-2.5 rounded-xl bg-white/2 hover:bg-white/4 border border-white/3 transition-colors flex items-start space-x-2">
                <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider shrink-0 mt-0.5 ${actionColor(log.action)}`}>
                  {log.action}
                </span>
                <div className="flex-1 space-y-1">
                  <div className="text-slate-200 font-medium leading-relaxed">
                    <span className="text-indigo-300 font-bold mr-1">{log.actorEmail || t("systeem", "system", "sistem")}:</span>
                    {describeLog(log)}
                  </div>
                  <div className="text-[9.5px] text-slate-500 flex items-center justify-between font-mono pt-0.5">
                    <span>
                      {new Date(log.createdAt).toLocaleDateString("nl-NL")}{" "}
                      {new Date(log.createdAt).toLocaleTimeString("nl-NL")}
                    </span>
                    {log.ip && <span>IP: {log.ip}</span>}
                  </div>
                </div>
              </div>
            ))
          )}
          {hasMore && !error && (
            <button
              onClick={() => fetchLogs(page + 1, group, appliedQuery, true)}
              disabled={loading}
              className="w-full py-2 text-[10px] font-bold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading
                ? t("Laden...", "Loading...", "Yükleniyor...")
                : t("Meer laden", "Load more", "Daha fazla yükle")}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
