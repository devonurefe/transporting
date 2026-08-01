import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import {
  Users,
  Search,
  Download,
  Mail,
  Phone,
  Building2,
  CheckCircle,
  XCircle,
  Megaphone,
  X,
  Send,
  MessageCircle,
  Pencil,
  Ban,
  Trash2,
  ClipboardList,
  Loader2,
} from "lucide-react";

import { useAuthStore } from "../../store/authStore";
import { useLanguageStore } from "../../store/languageStore";
import { showAdminToast } from "./AdminToast";
import AdminConfirmDialog from "./AdminConfirmDialog";
import { euro } from "../../utils/format";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  profile: string | null;
  marketingConsent: boolean;
  isEmailVerified: boolean;
  lockedUntil?: string | null;
  createdAt: string;
  _count: { orders: number };
  // Som van totalAmount over alle niet-geannuleerde orders — zelfde uitsluiting
  // als de omzet-KPI op het dashboard, zodat de cijfers niet uiteenlopen.
  lifetimeValue: number;
}

// A customer is considered "blocked" when lockedUntil is set far in the future
// (the admin block action sets 2999). Short lockouts from failed logins expire.
function isBlocked(c: { lockedUntil?: string | null }): boolean {
  return !!c.lockedUntil && new Date(c.lockedUntil).getTime() > Date.now() + 365 * 24 * 3600 * 1000;
}

interface AdminCustomersProps {
  adminLanguage: "nl" | "en" | "tr";
  onViewOrder?: (orderId: string) => void;
}

// Small hover tooltip for the icon-only action buttons in the desktop table —
// they already had a native `title` attribute, but that browser tooltip is
// slow to appear and inconsistently styled, so it read as "unclear what these
// icons do." Same visual pattern as the chart tooltips in AdminDashboard.tsx.
function IconActionButton({ title, onClick, disabled, className, children }: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        title={title}
        disabled={disabled}
        onClick={onClick}
        className={`h-6 w-6 flex items-center justify-center rounded-md transition-colors cursor-pointer disabled:opacity-50 ${className}`}
      >
        {children}
      </button>
      <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 bg-slate-900 text-white text-[10px] font-semibold px-2 py-1 rounded-md pointer-events-none whitespace-nowrap z-30 shadow-lg">
        {title}
      </span>
    </span>
  );
}

const TEMPLATE_EMAILS = [
  {
    id: "welcome",
    label: { nl: "Welkomstmail", en: "Welcome email", tr: "Hoş geldiniz maili" },
    subject: "Welkom bij MB Hoogwerkers – uw account is actief",
    body: "Beste {naam},\n\nBedankt voor uw registratie bij HuurGo van MB Hoogwerkers B.V.\n\nU kunt nu eenvoudig hoogwerkers, schaarhoogwerkers en spinnen reserveren via huurgo.nl.\n\nHeeft u vragen? Bel ons op +31 6 11 69 16 92 of stuur een bericht via WhatsApp.\n\nMet vriendelijke groet,\nMB Hoogwerkers B.V. 🦾",
  },
  {
    id: "promo",
    label: { nl: "Aanbieding / Campagne", en: "Promo / Campaign", tr: "Kampanya maili" },
    subject: "Exclusieve aanbieding voor u – bespaar tot 40%",
    body: "Beste {naam},\n\nAls gewaardeerde klant willen wij u als eerste op de hoogte stellen van onze nieuwste aanbieding:\n\n🎉 Tot 40% korting op weekverhuur van onze hoogwerkers!\n\nReserveer nu via huurgo.nl en profiteer van scherpe tarieven.\n\nAanbod geldig t/m [datum]. Vol = vol!\n\nMet vriendelijke groet,\nMB Hoogwerkers B.V. 🦾",
  },
  {
    id: "reminder",
    label: { nl: "Herinneringsmail", en: "Re-engagement", tr: "Hatırlatma maili" },
    subject: "We missen u! Bekijk onze beschikbare machines",
    body: "Beste {naam},\n\nU heeft al een tijdje niet gereserveerd. Onze vloot staat voor u klaar!\n\nBekijk het volledige aanbod op huurgo.nl en boek eenvoudig online.\n\nHeeft u een specifieke machine nodig? Neem contact met ons op via WhatsApp.\n\nMet vriendelijke groet,\nMB Hoogwerkers B.V. 🦾",
  },
];

export default function AdminCustomers({ adminLanguage, onViewOrder }: AdminCustomersProps) {
  const { token } = useAuthStore();
  const { tAdmin } = useLanguageStore();

  const t = (nl: string, en: string, tr: string) =>
    adminLanguage === "en" ? en : adminLanguage === "tr" ? tr : nl;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMarketing, setFilterMarketing] = useState<"all" | "yes" | "no">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [emailModal, setEmailModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATE_EMAILS[0]);
  const [emailSubject, setEmailSubject] = useState(TEMPLATE_EMAILS[0].subject);
  const [emailBody, setEmailBody] = useState(TEMPLATE_EMAILS[0].body);
  const [sendOnlyMarketing, setSendOnlyMarketing] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSentCount, setEmailSentCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/customers?page=1&limit=50", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Ophalen mislukt");
        const data = await res.json();
        setCustomers(data.customers);
        setPage(data.page ?? 1);
        setTotalPages(data.totalPages ?? 1);
        setTotalCount(data.totalCount ?? data.customers.length);
      } catch {
        setError(t("Klanten ophalen mislukt.", "Failed to load customers.", "Müşteriler yüklenemedi."));
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const loadMoreCustomers = async () => {
    if (page >= totalPages || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(`/api/auth/customers?page=${nextPage}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Ophalen mislukt");
      const data = await res.json();
      setCustomers((prev) => [...prev, ...data.customers]);
      setPage(data.page ?? nextPage);
    } catch {
      showAdminToast(t("Meer klanten laden mislukt.", "Failed to load more customers.", "Daha fazla müşteri yüklenemedi."), "error");
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Customer management (Faz 2) ──────────────────────────────────────────
  const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ordersFor, setOrdersFor] = useState<Customer | null>(null);
  const [ordersList, setOrdersList] = useState<any[] | null>(null);

  const applyCustomer = (updated: Customer) =>
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));

  const saveEdit = async (patch: Record<string, unknown>) => {
    if (!editCustomer) return;
    setBusyId(editCustomer.id);
    try {
      const res = await fetch(`/api/auth/customers/${editCustomer.id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(patch) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.customer) {
        applyCustomer(data.customer);
        showAdminToast(t("Klant bijgewerkt.", "Customer updated.", "Müşteri güncellendi."), "success");
        setEditCustomer(null);
      } else {
        showAdminToast(data?.error || t("Bijwerken mislukt.", "Update failed.", "Güncelleme başarısız."), "error");
      }
    } finally { setBusyId(null); }
  };

  const toggleBlock = async (c: Customer) => {
    const block = !isBlocked(c);
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/auth/customers/${c.id}/block`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ blocked: block }) });
      if (res.ok) {
        applyCustomer({ ...c, lockedUntil: block ? "2999-12-31T00:00:00.000Z" : null });
        showAdminToast(block ? t("Klant geblokkeerd.", "Customer blocked.", "Müşteri engellendi.") : t("Blokkade opgeheven.", "Customer unblocked.", "Engel kaldırıldı."), "success");
      } else {
        const d = await res.json().catch(() => ({}));
        showAdminToast(d?.error || t("Actie mislukt.", "Action failed.", "İşlem başarısız."), "error");
      }
    } finally { setBusyId(null); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const c = deleteTarget;
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/auth/customers/${c.id}`, { method: "DELETE", headers: authHeaders() });
      if (res.ok) {
        setCustomers((prev) => prev.filter((x) => x.id !== c.id));
        setTotalCount((n) => Math.max(0, n - 1));
        showAdminToast(t("Klant verwijderd.", "Customer deleted.", "Müşteri silindi."), "success");
      } else {
        const d = await res.json().catch(() => ({}));
        showAdminToast(d?.error || t("Verwijderen mislukt.", "Delete failed.", "Silme başarısız."), "error");
      }
    } finally { setBusyId(null); setDeleteTarget(null); }
  };

  const openOrders = async (c: Customer) => {
    setOrdersFor(c);
    setOrdersList(null);
    try {
      const res = await fetch(`/api/auth/customers/${c.id}/orders`, { headers: { Authorization: `Bearer ${token}` } });
      setOrdersList(res.ok ? await res.json() : []);
    } catch { setOrdersList([]); }
  };

  const filtered = useMemo(() => {
    let list = customers;
    if (filterMarketing === "yes") list = list.filter((c) => c.marketingConsent);
    if (filterMarketing === "no") list = list.filter((c) => !c.marketingConsent);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.companyName || "").toLowerCase().includes(q) ||
          (c.profile || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [customers, searchQuery, filterMarketing]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((c) => next.add(c.id));
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // CSV export
  const exportCSV = () => {
    const rows = [
      ["Naam", "E-mail", "Telefoon", "Bedrijf", "Profiel", "Bestellingen", "Levenslange waarde", "Marketing", "Geverifieerd", "Aangemeld op"],
      ...filtered.map((c) => [
        c.name,
        c.email,
        c.phone || "",
        c.companyName || "",
        c.profile || "",
        String(c._count.orders),
        c.lifetimeValue.toFixed(2),
        c.marketingConsent ? "Ja" : "Nee",
        c.isEmailVerified ? "Ja" : "Nee",
        new Date(c.createdAt).toLocaleDateString("nl-NL"),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `klanten-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openEmailModal = () => {
    setSelectedTemplate(TEMPLATE_EMAILS[0]);
    setEmailSubject(TEMPLATE_EMAILS[0].subject);
    setEmailBody(TEMPLATE_EMAILS[0].body);
    setSendOnlyMarketing(true);
    setEmailSentCount(null);
    setEmailModal(true);
  };

  const applyTemplate = (tpl: typeof TEMPLATE_EMAILS[0]) => {
    setSelectedTemplate(tpl);
    setEmailSubject(tpl.subject);
    setEmailBody(tpl.body);
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const customerIds = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
      const res = await fetch("/api/auth/campaigns/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ customerIds, subject: emailSubject, body: emailBody, sendOnlyMarketing }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Versturen mislukt");
      setEmailSentCount(data.sent ?? 0);
    } catch (err: any) {
      showAdminToast(err.message || "Campagne versturen mislukt", "error");
    } finally {
      setSendingEmail(false);
    }
  };

  const buildCustomerWaUrl = (phone: string, name: string): string => {
    const digits = phone.replace(/\D/g, "");
    const formatted = digits.startsWith("0") ? `31${digits.slice(1)}` : digits;
    const msg = encodeURIComponent(`Hallo ${name}! 🦾 Dit is een bericht van MB Hoogwerkers B.V. (huurgo.nl). Hoe kunnen wij u helpen?`);
    return `https://wa.me/${formatted}?text=${msg}`;
  };

  const marketingCount = customers.filter((c) => c.marketingConsent).length;
  // Backend ANDs customerIds with marketingConsent (server/routes/auth.ts campaigns/email),
  // so when both a selection and "alleen marketing-opt-ins" are active, the real
  // recipient count is their intersection — not the sitewide marketing count.
  const selectedMarketingCount = customers.filter((c) => selectedIds.has(c.id) && c.marketingConsent).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-700 text-sm font-semibold">
        {error}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-500" />
            {t("Klantenbeheer", "Customer Management", "Müşteri Yönetimi")}
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {customers.length} {t("geregistreerde klanten", "registered customers", "kayıtlı müşteri")}
            {" · "}
            <span className="text-emerald-600 font-semibold">{marketingCount} {t("marketing-opt-in", "marketing opt-in", "pazarlama onayı")}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={openEmailModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition-colors cursor-pointer border-none shadow-sm"
          >
            <Megaphone className="h-3.5 w-3.5" />
            {t("Campagne sturen", "Send campaign", "Kampanya gönder")}
          </button>
          <button
            type="button"
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            {t("Exporteer CSV", "Export CSV", "CSV İndir")}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("Zoek op naam, e-mail, bedrijf...", "Search by name, email, company...", "İsim, e-posta, şirket ara...")}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-amber-400 shadow-sm text-slate-700 placeholder-slate-400"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-1 py-1 shadow-sm">
          {(["all", "yes", "no"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilterMarketing(f)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border-none ${
                filterMarketing === f
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {f === "all"
                ? t("Alle", "All", "Tümü")
                : f === "yes"
                ? t("Marketing ✓", "Marketing ✓", "Pazarlama ✓")
                : t("Geen marketing", "No marketing", "Pazarlama yok")}
            </button>
          ))}
        </div>
      </div>

      {/* Selected count bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
          <span className="text-xs font-bold text-amber-800">
            {selectedIds.size} {t("geselecteerd", "selected", "seçildi")}
          </span>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-[10px] text-amber-700 hover:text-amber-900 font-semibold cursor-pointer border-none bg-transparent"
          >
            {t("Deselecteer alles", "Deselect all", "Tümünü kaldır")}
          </button>
        </div>
      )}

      {/* Customer list — cards on mobile, table on desktop */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center text-sm text-slate-400 font-semibold">
          {t("Geen klanten gevonden.", "No customers found.", "Müşteri bulunamadı.")}
        </div>
      ) : (
        <>
          {/* ── Mobile card view (hidden on md+) ── */}
          <div className="md:hidden space-y-2.5">
            {filtered.map((c) => {
              const initials = c.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div
                  key={c.id}
                  className={`bg-white rounded-2xl border shadow-sm transition-all ${selectedIds.has(c.id) ? "border-amber-300 bg-amber-50/30" : "border-slate-200"}`}
                >
                  <div className="flex items-start gap-3 p-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleOne(c.id)}
                      className="h-3.5 w-3.5 accent-amber-500 cursor-pointer mt-1 shrink-0"
                    />
                    {/* Avatar */}
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-amber-700">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Name + date */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-slate-800 text-sm leading-tight">{c.name}</p>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0 mt-0.5">
                          {new Date(c.createdAt).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                        </span>
                      </div>
                      {/* Company / profile */}
                      {c.companyName ? (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="h-2.5 w-2.5 shrink-0" /> {c.companyName}
                        </p>
                      ) : c.profile ? (
                        <p className="text-[11px] text-slate-400 mt-0.5">{c.profile}</p>
                      ) : null}
                      {/* Email + phone */}
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1 mt-1.5 text-[11px] text-slate-500 hover:text-orange-600 transition-colors no-underline">
                        <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{c.email}</span>
                      </a>
                      {c.phone && (
                        <div className="flex items-center gap-2 mt-1">
                          <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 transition-colors no-underline">
                            <Phone className="h-3 w-3 shrink-0" /> {c.phone}
                          </a>
                          <a
                            href={buildCustomerWaUrl(c.phone, c.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="WhatsApp"
                            className="flex items-center justify-center h-5 w-5 rounded-full bg-[#25D366] hover:bg-[#1da851] transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MessageCircle className="h-3 w-3 text-white" />
                          </a>
                        </div>
                      )}
                      {/* Badges */}
                      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${c._count.orders > 0 ? "bg-slate-100 text-slate-600" : "bg-slate-50 text-slate-400"}`}>
                          {c._count.orders} {c._count.orders === 1 ? "bestelling" : "bestellingen"}
                        </span>
                        {c.lifetimeValue > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 font-mono">
                            {euro(c.lifetimeValue)}
                          </span>
                        )}
                        {c.marketingConsent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                            <CheckCircle className="h-3 w-3" /> Marketing
                          </span>
                        )}
                        {c.isEmailVerified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700">
                            <CheckCircle className="h-3 w-3" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">
                            <XCircle className="h-3 w-3" /> Niet geverifieerd
                          </span>
                        )}
                        {isBlocked(c) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700">
                            <Ban className="h-3 w-3" /> {t("Geblokkeerd", "Blocked", "Engelli")}
                          </span>
                        )}
                      </div>
                      {/* Management actions */}
                      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                        <button type="button" onClick={() => setEditCustomer(c)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"><Pencil className="h-3 w-3" /> {t("Bewerk", "Edit", "Düzenle")}</button>
                        <button type="button" onClick={() => openOrders(c)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer"><ClipboardList className="h-3 w-3" /> {t("Orders", "Orders", "Siparişler")}</button>
                        <button type="button" disabled={busyId === c.id} onClick={() => toggleBlock(c)} className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 ${isBlocked(c) ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700" : "bg-amber-50 hover:bg-amber-100 text-amber-700"}`}><Ban className="h-3 w-3" /> {isBlocked(c) ? t("Deblokkeer", "Unblock", "Aç") : t("Blokkeer", "Block", "Engelle")}</button>
                        <button type="button" disabled={busyId === c.id} onClick={() => setDeleteTarget(c)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer disabled:opacity-50"><Trash2 className="h-3 w-3" /> {t("Verwijder", "Delete", "Sil")}</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Desktop table view (hidden below md) ── */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[auto_auto_1fr_1fr_auto_auto_auto_auto_auto_auto] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAll}
                className="h-3.5 w-3.5 accent-amber-500 cursor-pointer"
              />
              <span />
              <span>{t("Naam / Bedrijf", "Name / Company", "İsim / Şirket")}</span>
              <span>{t("E-mail", "Email", "E-posta")}</span>
              <span className="text-center">{t("Orders", "Orders", "Siparişler")}</span>
              <span className="text-right">{t("Waarde", "Value", "Değer")}</span>
              <span className="text-center">Mktg</span>
              <span className="text-center">✓</span>
              <span>{t("Datum", "Date", "Tarih")}</span>
              <span className="text-center">{t("Acties", "Actions", "İşlem")}</span>
            </div>
            <div className="divide-y divide-slate-50">
              {filtered.map((c) => {
                const initials = c.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
                return (
                  <div
                    key={c.id}
                    className={`grid grid-cols-[auto_auto_1fr_1fr_auto_auto_auto_auto_auto_auto] gap-2 items-center px-4 py-3 text-xs transition-colors ${selectedIds.has(c.id) ? "bg-amber-50/60" : isBlocked(c) ? "bg-rose-50/40" : "hover:bg-slate-50/80"}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleOne(c.id)}
                      className="h-3.5 w-3.5 accent-amber-500 cursor-pointer"
                    />
                    {/* Avatar */}
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-black text-amber-700">{initials}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{c.name}</p>
                      <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        {c.companyName ? <><Building2 className="h-2.5 w-2.5 shrink-0" />{c.companyName}</> : <span className="text-slate-300">{c.profile}</span>}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <a href={`mailto:${c.email}`} className="text-slate-600 hover:text-orange-600 truncate flex items-center gap-1 transition-colors">
                        <Mail className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                        <span className="truncate">{c.email}</span>
                      </a>
                      {c.phone && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <a href={`tel:${c.phone}`} className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors">
                            <Phone className="h-2.5 w-2.5 shrink-0" />{c.phone}
                          </a>
                          <a href={buildCustomerWaUrl(c.phone, c.name)} target="_blank" rel="noopener noreferrer" title="WhatsApp klant" className="flex items-center justify-center h-4 w-4 rounded-full bg-[#25D366] hover:bg-[#1da851] transition-colors shrink-0" onClick={(e) => e.stopPropagation()}>
                            <MessageCircle className="h-2.5 w-2.5 text-white" />
                          </a>
                        </div>
                      )}
                    </div>
                    <span className="text-center font-mono font-bold text-slate-700 text-[11px]">{c._count.orders}</span>
                    <span className="text-right font-mono font-bold text-teal-600 text-[11px]">{c.lifetimeValue > 0 ? euro(c.lifetimeValue) : "—"}</span>
                    <span className="flex justify-center">
                      {c.marketingConsent ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-slate-300" />}
                    </span>
                    <span className="flex justify-center">
                      {c.isEmailVerified ? <CheckCircle className="h-4 w-4 text-teal-500" /> : <XCircle className="h-4 w-4 text-amber-400" />}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                    </span>
                    <span className="flex items-center justify-center gap-1">
                      <IconActionButton title={t("Bewerk", "Edit", "Düzenle")} onClick={() => setEditCustomer(c)} className="bg-slate-100 hover:bg-slate-200 text-slate-600"><Pencil className="h-3 w-3" /></IconActionButton>
                      <IconActionButton title={t("Orders bekijken", "View orders", "Siparişler")} onClick={() => openOrders(c)} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600"><ClipboardList className="h-3 w-3" /></IconActionButton>
                      <IconActionButton title={isBlocked(c) ? t("Deblokkeer", "Unblock", "Aç") : t("Blokkeer", "Block", "Engelle")} disabled={busyId === c.id} onClick={() => toggleBlock(c)} className={isBlocked(c) ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-600" : "bg-amber-50 hover:bg-amber-100 text-amber-600"}><Ban className="h-3 w-3" /></IconActionButton>
                      <IconActionButton title={t("Verwijder", "Delete", "Sil")} disabled={busyId === c.id} onClick={() => setDeleteTarget(c)} className="bg-rose-50 hover:bg-rose-100 text-rose-600"><Trash2 className="h-3 w-3" /></IconActionButton>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {page < totalPages && (
            <div className="flex justify-center pt-3">
              <button
                onClick={loadMoreCustomers}
                disabled={loadingMore}
                className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition-colors cursor-pointer border-none disabled:opacity-50"
              >
                {loadingMore
                  ? t("Laden...", "Loading...", "Yükleniyor...")
                  : t(`Meer laden (${customers.length} van ${totalCount})`, `Load more (${customers.length} of ${totalCount})`, `Daha fazla yükle (${totalCount} müşteriden ${customers.length})`)}
              </button>
            </div>
          )}
        </>
      )}

      {/* Email Campaign Modal */}
      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Megaphone className="h-4.5 w-4.5 text-amber-500" />
                {t("Campagne e-mail", "Campaign email", "Kampanya e-postası")}
              </h3>
              <button
                type="button"
                onClick={() => { setEmailModal(false); setEmailSentCount(null); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer border-none bg-transparent text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {emailSentCount !== null ? (
              <div className="text-center py-8 space-y-3">
                <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
                <p className="font-bold text-slate-800">
                  {t(`Campagne verstuurd naar ${emailSentCount} ontvanger(s).`, `Campaign sent to ${emailSentCount} recipient(s).`, `Kampanya ${emailSentCount} alıcıya gönderildi.`)}
                </p>
                <p className="text-xs text-slate-500">{t("E-mails zijn direct verstuurd via Resend.", "Emails were sent directly via Resend.", "E-postalar Resend üzerinden gönderildi.")}</p>
              </div>
            ) : (
              <>
                {/* Template picker */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t("Sjabloon", "Template", "Şablon")}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {TEMPLATE_EMAILS.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className={`px-2 py-2 rounded-xl text-[10px] font-bold text-center transition-all cursor-pointer border ${
                          selectedTemplate.id === tpl.id
                            ? "bg-amber-500 text-slate-950 border-amber-400"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-amber-300"
                        }`}
                      >
                        {tpl.label[adminLanguage]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audience */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t("Doelgroep", "Audience", "Hedef kitle")}</label>
                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <input
                      type="checkbox"
                      id="mktOnly"
                      checked={sendOnlyMarketing}
                      onChange={(e) => setSendOnlyMarketing(e.target.checked)}
                      className="h-4 w-4 accent-amber-500 cursor-pointer"
                    />
                    <label htmlFor="mktOnly" className="text-xs text-slate-700 font-semibold cursor-pointer">
                      {t(
                        `Alleen marketing-opt-ins (${marketingCount} klanten)`,
                        `Only marketing opt-ins (${marketingCount} customers)`,
                        `Yalnızca pazarlama onayı verenler (${marketingCount} müşteri)`
                      )}
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {sendOnlyMarketing && selectedIds.size > 0
                      ? t(`${selectedMarketingCount} ontvangers`, `${selectedMarketingCount} recipients`, `${selectedMarketingCount} alıcı`)
                      : sendOnlyMarketing
                      ? t(`${marketingCount} ontvangers`, `${marketingCount} recipients`, `${marketingCount} alıcı`)
                      : t(`${selectedIds.size > 0 ? selectedIds.size : customers.length} ontvangers`, `${selectedIds.size > 0 ? selectedIds.size : customers.length} recipients`, `${selectedIds.size > 0 ? selectedIds.size : customers.length} alıcı`)
                    }
                    {selectedIds.size > 0 && ` ${t("(gefilterd op selectie)", "(filtered by selection)", "(seçime göre filtrelendi)")}`}
                  </p>
                </div>

                {/* Subject */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t("Onderwerp", "Subject", "Konu")}</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-amber-400 shadow-sm"
                  />
                </div>

                {/* Body */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {t("Bericht", "Message", "Mesaj")}{" "}
                    <span className="normal-case font-normal text-slate-400">({t("{naam} wordt automatisch ingevuld", "{naam} is auto-filled", "{naam} otomatik doldurulur")})</span>
                  </label>
                  <textarea
                    rows={7}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-amber-400 shadow-sm resize-none font-mono"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md cursor-pointer border-none flex items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  {sendingEmail
                    ? t("Bezig met versturen...", "Sending...", "Gönderiliyor...")
                    : t("Campagne versturen via Resend", "Send campaign via Resend", "Resend ile kampanya gönder")}
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  {t("E-mails worden direct verstuurd via Resend (gepersonaliseerd per ontvanger).", "Emails are sent directly via Resend (personalised per recipient).", "E-postalar Resend üzerinden doğrudan gönderilir.")}
                </p>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Edit customer modal */}
      {editCustomer && (
        <CustomerEditModal
          key={editCustomer.id}
          customer={editCustomer}
          busy={busyId === editCustomer.id}
          onCancel={() => setEditCustomer(null)}
          onSave={saveEdit}
          t={t}
        />
      )}

      {/* Delete (GDPR) confirm */}
      <AdminConfirmDialog
        open={!!deleteTarget}
        title={t("Klant verwijderen", "Delete customer", "Müşteriyi sil")}
        message={t(
          `Weet u zeker dat u ${deleteTarget?.name ?? ""} permanent wilt verwijderen? Het account wordt gewist; bestaande bestellingen blijven bewaard (wettelijke bewaarplicht) maar worden losgekoppeld.`,
          `Permanently delete ${deleteTarget?.name ?? ""}? The account is erased; existing orders are kept (legal retention) but detached.`,
          `${deleteTarget?.name ?? ""} kalıcı olarak silinsin mi? Hesap silinir; mevcut siparişler saklanır ama bağlantısı kaldırılır.`
        )}
        confirmLabel={t("Verwijderen", "Delete", "Sil")}
        cancelLabel={t("Annuleren", "Cancel", "İptal")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Order history drill-down */}
      {ordersFor && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setOrdersFor(null)} />
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">{t("Bestellingen van", "Orders of", "Siparişleri")} {ordersFor.name}</h3>
                {ordersFor.lifetimeValue > 0 && (
                  <p className="text-[11px] text-teal-600 font-mono font-bold mt-0.5">
                    {t("Levenslange waarde", "Lifetime value", "Toplam değer")}: {euro(ordersFor.lifetimeValue)}
                  </p>
                )}
              </div>
              <button onClick={() => setOrdersFor(null)} className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-2">
              {ordersList === null ? (
                <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : ordersList.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-10">{t("Nog geen bestellingen.", "No orders yet.", "Henüz sipariş yok.")}</p>
              ) : (
                ordersList.map((o) => (
                  <div key={o.id} className="border border-slate-100 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      {onViewOrder ? (
                        <button
                          type="button"
                          onClick={() => { onViewOrder(o.id); setOrdersFor(null); }}
                          title={t("Ga naar deze bestelling in Orders", "Go to this order in Orders", "Bu siparişe Siparişler'de git")}
                          className="font-mono text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline decoration-dotted underline-offset-2 cursor-pointer bg-transparent border-none p-0"
                        >
                          {o.id}
                        </button>
                      ) : (
                        <p className="font-mono text-[11px] font-bold text-slate-700">{o.id}</p>
                      )}
                      <p className="text-[11px] text-slate-500 truncate">{o.machineName}</p>
                      <p className="text-[10px] text-slate-400">{o.startDate} → {o.endDate} · {o.status}</p>
                    </div>
                    <span className="font-mono text-xs font-bold text-teal-600 shrink-0">{euro(o.totalAmount)}</span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

// Inline edit form for a customer's profile fields (Faz 2).
function CustomerEditModal({ customer, busy, onCancel, onSave, t }: {
  customer: Customer;
  busy: boolean;
  onCancel: () => void;
  onSave: (patch: Record<string, unknown>) => void;
  t: (nl: string, en: string, tr: string) => string;
}) {
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [companyName, setCompanyName] = useState(customer.companyName ?? "");
  const [profile, setProfile] = useState(customer.profile ?? "");
  const inputCls = "w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500";
  const labelCls = "text-[11px] text-slate-600 block font-bold mb-1";
  const submit = () => {
    const patch: Record<string, unknown> = {};
    if (name.trim() !== customer.name) patch.name = name.trim();
    if (email.trim().toLowerCase() !== customer.email.toLowerCase()) patch.email = email.trim();
    if (phone.trim() !== (customer.phone ?? "")) patch.phone = phone.trim();
    if (companyName.trim() !== (customer.companyName ?? "")) patch.companyName = companyName.trim();
    if (profile !== (customer.profile ?? "")) patch.profile = profile;
    if (Object.keys(patch).length === 0) { onCancel(); return; }
    onSave(patch);
  };
  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onCancel} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl">
        <div className="border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900">{t("Klant bewerken", "Edit customer", "Müşteriyi düzenle")}</h3>
          <button onClick={onCancel} className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div><label className={labelCls}>{t("Naam", "Name", "Ad")}</label><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className={labelCls}>E-mail</label><input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>{t("Telefoon", "Phone", "Telefon")}</label><input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><label className={labelCls}>{t("Bedrijf", "Company", "Şirket")}</label><input className={inputCls} value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></div>
          </div>
          <div><label className={labelCls}>{t("Profiel", "Profile", "Profil")}</label><input className={inputCls} value={profile} onChange={(e) => setProfile(e.target.value)} /></div>
        </div>
        <div className="border-t border-slate-100 px-5 py-3 flex gap-2" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <button onClick={onCancel} className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer">{t("Annuleren", "Cancel", "İptal")}</button>
          <button onClick={submit} disabled={busy} className="flex-1 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("Opslaan", "Save", "Kaydet")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
