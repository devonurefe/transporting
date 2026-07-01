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
  ChevronDown,
  X,
  Send,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useLanguageStore } from "../../store/languageStore";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  profile: string | null;
  marketingConsent: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  _count: { orders: number };
}

interface AdminCustomersProps {
  adminLanguage: "nl" | "en" | "tr";
}

const TEMPLATE_EMAILS = [
  {
    id: "welcome",
    label: { nl: "Welkomstmail", en: "Welcome email", tr: "Hoş geldiniz maili" },
    subject: "Welkom bij MB Hoogwerkers – uw account is actief",
    body: "Beste {naam},\n\nBedankt voor uw registratie bij HuurGo van MB Hoogwerkers B.V.\n\nU kunt nu eenvoudig hoogwerkers, schaarhoogwerkers en spinnen reserveren via huurgo.nl.\n\nHeeft u vragen? Bel ons op +31 6 11 84 88 99 of stuur een bericht via WhatsApp.\n\nMet vriendelijke groet,\nMB Hoogwerkers B.V. 🦾",
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

export default function AdminCustomers({ adminLanguage }: AdminCustomersProps) {
  const { token } = useAuthStore();
  const { tAdmin } = useLanguageStore();

  const t = (nl: string, en: string, tr: string) =>
    adminLanguage === "en" ? en : adminLanguage === "tr" ? tr : nl;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        const res = await fetch("/api/auth/customers", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Ophalen mislukt");
        const data = await res.json();
        setCustomers(data.customers);
      } catch {
        setError(t("Klanten ophalen mislukt.", "Failed to load customers.", "Müşteriler yüklenemedi."));
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

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
      ["Naam", "E-mail", "Telefoon", "Bedrijf", "Profiel", "Bestellingen", "Marketing", "Geverifieerd", "Aangemeld op"],
      ...filtered.map((c) => [
        c.name,
        c.email,
        c.phone || "",
        c.companyName || "",
        c.profile || "",
        String(c._count.orders),
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

  // Simulate send (opens mailto for now; replace with real bulk API if Resend supports it)
  const handleSendEmail = async () => {
    setSendingEmail(true);
    const targets = customers.filter((c) => {
      if (sendOnlyMarketing && !c.marketingConsent) return false;
      if (selectedIds.size > 0 && !selectedIds.has(c.id)) return false;
      return true;
    });
    // For now, open a mailto with BCC (real implementation would call a backend bulk-send endpoint)
    const emails = targets.map((c) => c.email).join(";");
    const mailtoUrl = `mailto:?bcc=${encodeURIComponent(emails)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody.replace("{naam}", "klant"))}`;
    window.location.href = mailtoUrl;
    setEmailSentCount(targets.length);
    setSendingEmail(false);
  };

  const marketingCount = customers.filter((c) => c.marketingConsent).length;

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

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto_auto] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider">
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={toggleAll}
            className="h-3.5 w-3.5 accent-amber-500 cursor-pointer"
          />
          <span>{t("Naam / Bedrijf", "Name / Company", "İsim / Şirket")}</span>
          <span>{t("E-mail", "Email", "E-posta")}</span>
          <span className="text-center">{t("Bestellingen", "Orders", "Siparişler")}</span>
          <span className="text-center">{t("Marketing", "Marketing", "Pazarlama")}</span>
          <span className="text-center">{t("Verified", "Verified", "Doğrulandı")}</span>
          <span>{t("Aangemeld", "Registered", "Kayıt tarihi")}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400 font-semibold">
            {t("Geen klanten gevonden.", "No customers found.", "Müşteri bulunamadı.")}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((c) => (
              <div
                key={c.id}
                className={`grid grid-cols-[auto_1fr_1fr_auto_auto_auto_auto] gap-2 items-center px-4 py-3 text-xs transition-colors ${
                  selectedIds.has(c.id) ? "bg-amber-50/60" : "hover:bg-slate-50/80"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(c.id)}
                  onChange={() => toggleOne(c.id)}
                  className="h-3.5 w-3.5 accent-amber-500 cursor-pointer"
                />
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">{c.name}</p>
                  <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                    {c.companyName ? (
                      <>
                        <Building2 className="h-2.5 w-2.5 shrink-0" />
                        {c.companyName}
                      </>
                    ) : (
                      <span className="text-slate-300">{c.profile}</span>
                    )}
                  </p>
                </div>
                <div className="min-w-0">
                  <a
                    href={`mailto:${c.email}`}
                    className="text-slate-600 hover:text-orange-600 truncate flex items-center gap-1 transition-colors"
                  >
                    <Mail className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                    <span className="truncate">{c.email}</span>
                  </a>
                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1 mt-0.5 transition-colors"
                    >
                      <Phone className="h-2.5 w-2.5 shrink-0" />
                      {c.phone}
                    </a>
                  )}
                </div>
                <span className="text-center font-mono font-bold text-slate-700 text-[11px]">
                  {c._count.orders}
                </span>
                <span className="flex justify-center">
                  {c.marketingConsent ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-slate-300" />
                  )}
                </span>
                <span className="flex justify-center">
                  {c.isEmailVerified ? (
                    <CheckCircle className="h-4 w-4 text-teal-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-amber-400" />
                  )}
                </span>
                <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                  {new Date(c.createdAt).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

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
                  {t(`E-mailclient geopend voor ${emailSentCount} ontvangers.`, `Email client opened for ${emailSentCount} recipients.`, `${emailSentCount} alıcı için e-posta istemcisi açıldı.`)}
                </p>
                <p className="text-xs text-slate-500">{t("Verstuur de e-mail vanuit uw e-mailclient.", "Send the email from your email client.", "E-postayı e-posta istemcinizden gönderin.")}</p>
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
                    {sendOnlyMarketing
                      ? t(`${marketingCount} ontvangers`, `${marketingCount} recipients`, `${marketingCount} alıcı`)
                      : t(`${selectedIds.size > 0 ? selectedIds.size : customers.length} ontvangers`, `${selectedIds.size > 0 ? selectedIds.size : customers.length} recipients`, `${selectedIds.size > 0 ? selectedIds.size : customers.length} alıcı`)
                    }
                    {selectedIds.size > 0 && !sendOnlyMarketing && ` ${t("(gefilterd op selectie)", "(filtered by selection)", "(seçime göre filtrelendi)")}`}
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
                    ? t("Bezig...", "Sending...", "Gönderiliyor...")
                    : t("E-mail versturen via client", "Open in email client", "E-posta istemcisinde aç")}
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  {t("Opent uw standaard e-mailclient met BCC-lijst.", "Opens your default email client with BCC list.", "Varsayılan e-posta istemcinizi BCC listesiyle açar.")}
                </p>
              </>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
