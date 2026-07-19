/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { ShieldCheck, ShieldOff, UserPlus, Users, KeyRound, QrCode, RotateCcw, Ban, CheckCircle2, Lock } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import AdminConfirmDialog from "./AdminConfirmDialog";
// AdminToastHost wordt al één keer gemount in AdminSection
import { showAdminToast } from "./AdminToast";

interface AdminRow {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface AdminUsersProps {
  adminLanguage?: string;
}

export default function AdminUsers({ adminLanguage }: AdminUsersProps) {
  const t = (nl: string, en: string, tr: string) => {
    if (adminLanguage === "tr") return tr;
    if (adminLanguage === "en") return en;
    return nl;
  };

  const { token, user } = useAuthStore();
  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  // ── Beheerderslijst ────────────────────────────────────────────────────────
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAdmins(data.admins);
    } catch {
      showAdminToast(t("Beheerders ophalen mislukt.", "Failed to load admins.", "Yöneticiler yüklenemedi."), "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const me = admins.find((a) => a.id === user?.id);

  // Generieke POST-actie op /api/admin/users/:id/*
  const postAction = async (id: string, action: string, body?: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/users/${id}/${action}`, {
        method: "POST",
        headers: authHeaders,
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await res.json();
      if (!res.ok) {
        showAdminToast(data.error || t("Actie mislukt.", "Action failed.", "İşlem başarısız."), "error");
        return false;
      }
      await fetchAdmins();
      return true;
    } catch {
      showAdminToast(t("Actie mislukt.", "Action failed.", "İşlem başarısız."), "error");
      return false;
    }
  };

  // ── Nieuwe beheerder ───────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ email: newEmail.trim(), name: newName.trim(), password: newPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        showAdminToast(data.error || t("Aanmaken mislukt.", "Create failed.", "Oluşturma başarısız."), "error");
        return;
      }
      showAdminToast(t("Beheerder aangemaakt.", "Admin created.", "Yönetici oluşturuldu."), "success");
      setShowCreate(false);
      setNewEmail(""); setNewName(""); setNewPassword("");
      fetchAdmins();
    } catch {
      showAdminToast(t("Aanmaken mislukt.", "Create failed.", "Oluşturma başarısız."), "error");
    }
  };

  // ── Bevestigingsdialogen & wachtwoordreset ────────────────────────────────
  const [confirmAction, setConfirmAction] = useState<{ id: string; kind: "disable" | "reset-2fa" } | null>(null);
  const [resetPwFor, setResetPwFor] = useState<AdminRow | null>(null);
  const [resetPwValue, setResetPwValue] = useState("");

  // ── Mijn beveiliging: eigen wachtwoord wijzigen ───────────────────────────
  // Verplaatst uit AdminCustomizer.tsx (Mağaza Ayarları) — hoort inhoudelijk bij
  // accountbeveiliging (naast 2FA hieronder), niet tussen merk-/customizer-content.
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwRepeat, setPwRepeat] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);
    if (pwNew.length < 10 || !/[a-zA-Z]/.test(pwNew) || !/[0-9]/.test(pwNew)) {
      setPwMessage({ ok: false, text: t("Nieuw wachtwoord moet minimaal 10 tekens bevatten, met minstens 1 letter en 1 cijfer.", "New password must be at least 10 characters, with at least 1 letter and 1 digit.", "Yeni şifre en az 10 karakter, en az 1 harf ve 1 rakam içermeli.") });
      return;
    }
    if (pwNew !== pwRepeat) {
      setPwMessage({ ok: false, text: t("Wachtwoorden komen niet overeen.", "Passwords do not match.", "Şifreler eşleşmiyor.") });
      return;
    }
    setPwBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew })
      });
      const data = await res.json();
      if (res.ok) {
        setPwMessage({ ok: true, text: t("Wachtwoord succesvol gewijzigd.", "Password changed successfully.", "Şifre başarıyla değiştirildi.") });
        setPwCurrent(""); setPwNew(""); setPwRepeat("");
      } else {
        setPwMessage({ ok: false, text: data.error || t("Wachtwoord wijzigen mislukt.", "Password change failed.", "Şifre değiştirilemedi.") });
      }
    } catch {
      setPwMessage({ ok: false, text: t("Netwerkfout. Probeer opnieuw.", "Network error. Try again.", "Ağ hatası. Tekrar deneyin.") });
    } finally {
      setPwBusy(false);
    }
  };

  // ── Mijn beveiliging: 2FA setup/disable ───────────────────────────────────
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const start2faSetup = async () => {
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST", headers: authHeaders });
      const data = await res.json();
      if (!res.ok) { showAdminToast(data.error || "Setup mislukt", "error"); return; }
      setQrDataUrl(data.qrDataUrl);
      setSetupCode("");
    } catch {
      showAdminToast(t("Setup mislukt.", "Setup failed.", "Kurulum başarısız."), "error");
    }
  };

  const confirm2faSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/auth/2fa/enable", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ code: setupCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) { showAdminToast(data.error || "Code onjuist", "error"); return; }
      showAdminToast(t("Tweestapsverificatie ingeschakeld!", "Two-factor authentication enabled!", "İki adımlı doğrulama etkinleştirildi!"), "success");
      setQrDataUrl(null);
      setSetupCode("");
      fetchAdmins();
    } catch {
      showAdminToast(t("Inschakelen mislukt.", "Enable failed.", "Etkinleştirme başarısız."), "error");
    }
  };

  const handle2faDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ password: disablePassword, code: disableCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) { showAdminToast(data.error || "Uitschakelen mislukt", "error"); return; }
      // Sessie is server-side ingetrokken (tokenVersion-bump) → opnieuw inloggen
      showAdminToast(t("2FA uitgeschakeld. Log opnieuw in.", "2FA disabled. Log in again.", "2FA kapatıldı. Tekrar giriş yapın."), "success");
      setTimeout(() => useAuthStore.getState().logout(), 1200);
    } catch {
      showAdminToast(t("Uitschakelen mislukt.", "Disable failed.", "Kapatma başarısız."), "error");
    }
  };

  const fmtDate = (iso: string | null) =>
    iso ? `${new Date(iso).toLocaleDateString("nl-NL")} ${new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}` : "—";

  const inputCls = "w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none transition-colors";
  const labelCls = "text-[10px] font-bold text-slate-500 uppercase tracking-wider";

  return (
    <motion.div
      key="users-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 animate-fade-in"
    >
      {/* ── Mijn beveiliging ─────────────────────────────────────────────── */}
      <div className="glass-panel p-5.5 rounded-3xl space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <h3 className="font-display font-bold text-sm text-slate-900">
            {t("Mijn beveiliging", "My security", "Güvenliğim")}
          </h3>
        </div>

        {/* Wachtwoord wijzigen */}
        <form onSubmit={handleChangePassword} className="space-y-3 pb-4 mb-1 border-b border-slate-200">
          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-slate-400" />
            {t("Wachtwoord wijzigen", "Change password", "Şifre değiştir")}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>{t("Huidig wachtwoord", "Current password", "Mevcut şifre")}</label>
              <input type="password" required autoComplete="current-password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>{t("Nieuw wachtwoord (min. 10, letter + cijfer)", "New password (min. 10, letter + digit)", "Yeni şifre (min. 10, harf + rakam)")}</label>
              <input type="password" required minLength={10} autoComplete="new-password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>{t("Herhaal nieuw wachtwoord", "Repeat new password", "Yeni şifreyi tekrarla")}</label>
              <input type="password" required autoComplete="new-password" value={pwRepeat} onChange={(e) => setPwRepeat(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            {pwMessage ? (
              <span className={`text-xs font-bold ${pwMessage.ok ? "text-emerald-600" : "text-rose-600"}`}>{pwMessage.text}</span>
            ) : <span />}
            <button
              type="submit"
              disabled={pwBusy}
              className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 px-4 py-2.5 rounded-xl transition-colors cursor-pointer border-none"
            >
              {pwBusy && <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {t("Wachtwoord opslaan", "Save password", "Şifreyi kaydet")}
            </button>
          </div>
        </form>

        {me?.twoFactorEnabled ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 w-fit">
              <CheckCircle2 className="h-4 w-4" />
              {t("Tweestapsverificatie is actief op uw account.", "Two-factor authentication is active on your account.", "Hesabınızda iki adımlı doğrulama etkin.")}
            </div>
            {!disableOpen ? (
              <button
                onClick={() => setDisableOpen(true)}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-2 rounded-xl transition-colors cursor-pointer"
              >
                {t("2FA uitschakelen...", "Disable 2FA...", "2FA'yı kapat...")}
              </button>
            ) : (
              <form onSubmit={handle2faDisable} className="space-y-2.5 max-w-sm p-4 bg-rose-50/60 border border-rose-200 rounded-2xl">
                <p className="text-[11px] text-rose-700 font-medium">
                  {t("Bevestig met uw wachtwoord én een actuele code.", "Confirm with your password and a current code.", "Şifreniz ve güncel bir kodla onaylayın.")}
                </p>
                <div className="space-y-1">
                  <label className={labelCls}>{t("Wachtwoord", "Password", "Şifre")}</label>
                  <input type="password" required value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>{t("6-cijferige code", "6-digit code", "6 haneli kod")}</label>
                  <input type="text" inputMode="numeric" maxLength={6} required value={disableCode} onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))} className={inputCls} />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-3 py-2 rounded-xl transition-colors cursor-pointer border-none">
                    <ShieldOff className="h-3 w-3 inline mr-1" />
                    {t("Uitschakelen", "Disable", "Kapat")}
                  </button>
                  <button type="button" onClick={() => setDisableOpen(false)} className="text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors cursor-pointer border-none">
                    {t("Annuleren", "Cancel", "İptal")}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : qrDataUrl ? (
          <div className="space-y-3 max-w-md">
            <p className="text-xs text-slate-600 leading-relaxed">
              {t(
                "Scan de QR-code met een authenticator-app (Google Authenticator, 1Password, Microsoft Authenticator) en voer daarna de 6-cijferige code in.",
                "Scan the QR code with an authenticator app (Google Authenticator, 1Password, Microsoft Authenticator), then enter the 6-digit code.",
                "QR kodu bir doğrulayıcı uygulamayla (Google Authenticator, 1Password, Microsoft Authenticator) tarayın, ardından 6 haneli kodu girin."
              )}
            </p>
            <img src={qrDataUrl} alt="2FA QR-code" className="h-48 w-48 rounded-2xl border border-slate-200 bg-white p-2" />
            <form onSubmit={confirm2faSetup} className="flex items-end gap-2">
              <div className="space-y-1">
                <label className={labelCls}>{t("Bevestigingscode", "Confirmation code", "Onay kodu")}</label>
                <input
                  type="text" inputMode="numeric" maxLength={6} required
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ""))}
                  className={`${inputCls} w-36 font-mono tracking-[0.3em] text-center`}
                  placeholder="123456"
                />
              </div>
              <button type="submit" className="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 rounded-xl transition-colors cursor-pointer border-none">
                {t("Activeren", "Activate", "Etkinleştir")}
              </button>
              <button type="button" onClick={() => setQrDataUrl(null)} className="text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2.5 rounded-xl transition-colors cursor-pointer border-none">
                {t("Annuleren", "Cancel", "İptal")}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 max-w-lg leading-relaxed">
              {t(
                "Beveilig uw beheerdersaccount met tweestapsverificatie (TOTP). Na activatie vraagt de login naast uw wachtwoord ook een 6-cijferige code uit uw authenticator-app.",
                "Secure your admin account with two-factor authentication (TOTP). After activation, login requires a 6-digit code from your authenticator app in addition to your password.",
                "Yönetici hesabınızı iki adımlı doğrulamayla (TOTP) koruyun. Etkinleştirince giriş, şifrenizin yanında doğrulayıcı uygulamadan 6 haneli kod da ister."
              )}
            </p>
            <button
              onClick={start2faSetup}
              className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-xl transition-colors cursor-pointer border-none"
            >
              <QrCode className="h-4 w-4" />
              {t("2FA instellen", "Set up 2FA", "2FA kur")}
            </button>
          </div>
        )}
      </div>

      {/* ── Beheerders ───────────────────────────────────────────────────── */}
      <div className="glass-panel p-5.5 rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-amber-600" />
            <h3 className="font-display font-bold text-sm text-slate-900">
              {t("Beheerders", "Administrators", "Yöneticiler")}
            </h3>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
              {admins.length}
            </span>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 px-3 py-2 rounded-xl transition-colors cursor-pointer border-none"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {t("Nieuwe beheerder", "New admin", "Yeni yönetici")}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl items-end">
            <div className="space-y-1">
              <label className={labelCls}>E-mail</label>
              <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>{t("Naam", "Name", "İsim")}</label>
              <input type="text" required minLength={2} value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>{t("Wachtwoord (min. 10, letter + cijfer)", "Password (min. 10, letter + digit)", "Şifre (en az 10, harf + rakam)")}</label>
              <div className="flex gap-2">
                <input type="password" required minLength={10} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} />
                <button type="submit" className="shrink-0 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 rounded-xl transition-colors cursor-pointer border-none">
                  {t("Aanmaken", "Create", "Oluştur")}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="space-y-2.5">
          {loading && admins.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">{t("Laden...", "Loading...", "Yükleniyor...")}</div>
          ) : (
            admins.map((a) => (
              <div key={a.id} className={`p-4 rounded-2xl border ${a.isActive ? "bg-white border-slate-200" : "bg-slate-50 border-slate-200 opacity-70"} flex flex-col sm:flex-row sm:items-center gap-3`}>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-900">{a.name}</span>
                    {a.id === user?.id && (
                      <span className="text-[9px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-1.5 py-0.5">{t("U", "You", "Siz")}</span>
                    )}
                    {!a.isActive && (
                      <span className="text-[9px] font-black uppercase text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-1.5 py-0.5">{t("Gedeactiveerd", "Disabled", "Devre dışı")}</span>
                    )}
                    {a.twoFactorEnabled && (
                      <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                        <ShieldCheck className="h-2.5 w-2.5" /> 2FA
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">{a.email}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {t("Laatste login", "Last login", "Son giriş")}: {fmtDate(a.lastLoginAt)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => { setResetPwFor(a); setResetPwValue(""); }}
                    className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-indigo-700 bg-slate-50 hover:bg-indigo-50 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <KeyRound className="h-3 w-3" />
                    {t("Wachtwoord", "Password", "Şifre")}
                  </button>
                  {a.twoFactorEnabled && a.id !== user?.id && (
                    <button
                      onClick={() => setConfirmAction({ id: a.id, kind: "reset-2fa" })}
                      className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-amber-700 bg-slate-50 hover:bg-amber-50 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      {t("2FA reset", "Reset 2FA", "2FA sıfırla")}
                    </button>
                  )}
                  {a.id !== user?.id && (
                    a.isActive ? (
                      <button
                        onClick={() => setConfirmAction({ id: a.id, kind: "disable" })}
                        className="flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Ban className="h-3 w-3" />
                        {t("Deactiveren", "Disable", "Devre dışı bırak")}
                      </button>
                    ) : (
                      <button
                        onClick={() => postAction(a.id, "enable")}
                        className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {t("Activeren", "Enable", "Etkinleştir")}
                      </button>
                    )
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Wachtwoordreset-formulier (mini-modal) */}
      {resetPwFor && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setResetPwFor(null)} />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await postAction(resetPwFor.id, "reset-password", { newPassword: resetPwValue });
              if (ok) {
                showAdminToast(t("Wachtwoord gereset.", "Password reset.", "Şifre sıfırlandı."), "success");
                setResetPwFor(null);
              }
            }}
            className="relative w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-3"
          >
            <h3 className="text-sm font-extrabold text-slate-900">
              {t("Nieuw wachtwoord voor", "New password for", "Yeni şifre:")} {resetPwFor.name}
            </h3>
            <p className="text-[11px] text-slate-500">
              {t("Lopende sessies van deze beheerder worden direct beëindigd.", "This admin's active sessions will be terminated immediately.", "Bu yöneticinin aktif oturumları hemen sonlandırılır.")}
            </p>
            <input
              type="password" required minLength={10} autoFocus
              value={resetPwValue}
              onChange={(e) => setResetPwValue(e.target.value)}
              placeholder={t("Min. 10 tekens, letter + cijfer", "Min. 10 chars, letter + digit", "En az 10 karakter, harf + rakam")}
              className={inputCls}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setResetPwFor(null)} className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition-colors cursor-pointer border-none">
                {t("Annuleren", "Cancel", "İptal")}
              </button>
              <button type="submit" className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-xl transition-colors cursor-pointer border-none">
                {t("Resetten", "Reset", "Sıfırla")}
              </button>
            </div>
          </form>
        </div>
      )}

      <AdminConfirmDialog
        open={confirmAction !== null}
        title={confirmAction?.kind === "disable"
          ? t("Beheerder deactiveren?", "Disable admin?", "Yönetici devre dışı bırakılsın mı?")
          : t("2FA resetten?", "Reset 2FA?", "2FA sıfırlansın mı?")}
        message={confirmAction?.kind === "disable"
          ? t("De beheerder kan niet meer inloggen en lopende sessies worden direct beëindigd.", "The admin can no longer log in and active sessions end immediately.", "Yönetici artık giriş yapamaz ve aktif oturumları hemen sonlanır.")
          : t("Tweestapsverificatie wordt uitgeschakeld zodat deze beheerder opnieuw kan koppelen (bijv. na verlies van telefoon).", "Two-factor authentication is disabled so this admin can re-enroll (e.g. after losing a phone).", "İki adımlı doğrulama kapatılır, yönetici yeniden kurabilir (örn. telefon kaybında).")}
        confirmLabel={t("Bevestigen", "Confirm", "Onayla")}
        cancelLabel={t("Annuleren", "Cancel", "İptal")}
        onConfirm={async () => {
          if (!confirmAction) return;
          const ok = await postAction(confirmAction.id, confirmAction.kind === "disable" ? "disable" : "reset-2fa");
          if (ok) showAdminToast(t("Uitgevoerd.", "Done.", "Tamamlandı."), "success");
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </motion.div>
  );
}
