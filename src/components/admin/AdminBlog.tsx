/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  BookOpen, Wrench, Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink, ArrowLeft, Save, X,
} from "lucide-react";
import { useAppStore, type BlogPost } from "../../store/appStore";
import AdminConfirmDialog from "./AdminConfirmDialog";
import { showAdminToast } from "./AdminToast";

interface AdminBlogProps {
  adminLanguage: "nl" | "en" | "tr";
  onAddSystemLog?: (type: "login" | "logout" | "signup" | "booking" | "fleet" | "status" | "system", user: string, description: string) => void;
}

interface Draft {
  id?: string;
  type: "artikel" | "handleiding";
  title: string;
  category: string;
  excerpt: string;
  content: string;
  published: boolean;
  slug?: string;
}

const emptyDraft: Draft = {
  type: "artikel",
  title: "",
  category: "",
  excerpt: "",
  content: "",
  published: false,
};

const CONTENT_HINT =
  "Opmaak: '## Kop' voor een tussenkop, lege regel tussen alinea's, '- ' voor opsommingen, **vet** voor nadruk.";

export default function AdminBlog({ adminLanguage, onAddSystemLog }: AdminBlogProps) {
  const t = (nl: string, en: string, tr: string) =>
    adminLanguage === "tr" ? tr : adminLanguage === "en" ? en : nl;

  const blogPosts = useAppStore((s) => s.blogPosts);
  const fetchBlogPosts = useAppStore((s) => s.fetchBlogPosts);
  const addBlogPost = useAppStore((s) => s.addBlogPost);
  const updateBlogPost = useAppStore((s) => s.updateBlogPost);
  const deleteBlogPost = useAppStore((s) => s.deleteBlogPost);
  const togglePublished = useAppStore((s) => s.toggleBlogPostPublished);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<BlogPost | null>(null);

  useEffect(() => { fetchBlogPosts(); }, [fetchBlogPosts]);

  const startNew = () => setDraft({ ...emptyDraft });
  const startEdit = (p: BlogPost) => setDraft({
    id: p.id, type: p.type, title: p.title, category: p.category,
    excerpt: p.excerpt, content: p.content, published: p.published, slug: p.slug,
  });

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.title.trim()) { showAdminToast(t("Titel is verplicht.", "Title is required.", "Başlık zorunlu."), "error"); return; }
    if (!draft.content.trim()) { showAdminToast(t("Inhoud is verplicht.", "Content is required.", "İçerik zorunlu."), "error"); return; }
    setSaving(true);
    const payload = {
      type: draft.type,
      title: draft.title.trim(),
      category: draft.category.trim(),
      excerpt: draft.excerpt.trim(),
      content: draft.content,
      published: draft.published,
      ...(draft.id && draft.slug ? { slug: draft.slug } : {}),
    };
    const ok = draft.id
      ? await updateBlogPost(draft.id, payload)
      : await addBlogPost(payload);
    setSaving(false);
    if (ok) {
      showAdminToast(draft.id ? t("Artikel bijgewerkt.", "Article updated.", "Yazı güncellendi.") : t("Artikel toegevoegd.", "Article added.", "Yazı eklendi."), "success");
      onAddSystemLog?.("system", "huurgo Admin", `Kenniscentrum: "${draft.title.trim()}" ${draft.id ? "bijgewerkt" : "toegevoegd"}`);
      setDraft(null);
    } else {
      showAdminToast(useAppStore.getState().error || t("Opslaan mislukt.", "Save failed.", "Kaydetme başarısız."), "error");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const ok = await deleteBlogPost(confirmDelete.id);
    if (ok) {
      showAdminToast(t("Artikel verwijderd.", "Article deleted.", "Yazı silindi."), "success");
      onAddSystemLog?.("system", "huurgo Admin", `Kenniscentrum: "${confirmDelete.title}" verwijderd`);
    } else {
      showAdminToast(useAppStore.getState().error || t("Verwijderen mislukt.", "Delete failed.", "Silme başarısız."), "error");
    }
    setConfirmDelete(null);
  };

  const handleToggle = async (p: BlogPost) => {
    const ok = await togglePublished(p.id);
    if (ok) {
      showAdminToast(
        p.published
          ? t("Artikel offline gehaald.", "Article unpublished.", "Yazı yayından kaldırıldı.")
          : t("Artikel gepubliceerd.", "Article published.", "Yazı yayınlandı."),
        "success"
      );
    }
  };

  // ── FORM VIEW ──────────────────────────────────────────────────────────────
  if (draft) {
    const inputCls = "w-full bg-white border border-slate-200 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors";
    return (
      <motion.div
        key="blog-form"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-2xl p-5 sm:p-6 space-y-5"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <button onClick={() => setDraft(null)} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors bg-transparent border-none cursor-pointer">
            <ArrowLeft className="h-4 w-4" /> {t("Terug", "Back", "Geri")}
          </button>
          <h2 className="text-sm font-extrabold text-slate-900">
            {draft.id ? t("Artikel bewerken", "Edit article", "Yazıyı düzenle") : t("Nieuw artikel", "New article", "Yeni yazı")}
          </h2>
        </div>

        {/* Type + category */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t("Type", "Type", "Tür")}</label>
            <div className="flex gap-2">
              {([["artikel", t("Artikel", "Article", "Yazı"), BookOpen], ["handleiding", t("Handleiding", "Guide", "Kılavuz"), Wrench]] as const).map(([val, label, Icon]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDraft({ ...draft, type: val })}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    draft.type === val ? "bg-amber-500 border-amber-500 text-slate-950" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t("Categorie (label)", "Category (label)", "Kategori (etiket)")}</label>
            <input
              className={inputCls}
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder={draft.type === "handleiding" ? "Handleiding" : "Keuzehulp, Kosten, …"}
              maxLength={60}
            />
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t("Titel", "Title", "Başlık")}</label>
          <input
            className={inputCls}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder={t("Bijv. Welke hoogwerker heb ik nodig?", "e.g. Which lift do I need?", "Örn. Hangi platformu seçmeliyim?")}
            maxLength={200}
          />
        </div>

        {/* Slug (edit only) */}
        {draft.id && (
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              {t("URL (slug)", "URL (slug)", "URL (slug)")}
            </label>
            <input
              className={inputCls + " font-mono text-xs"}
              value={draft.slug || ""}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              placeholder="welke-hoogwerker-huren"
            />
            <p className="text-[11px] text-slate-400 mt-1">/kenniscentrum/{draft.slug || "…"}</p>
          </div>
        )}

        {/* Excerpt */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
            {t("Samenvatting (meta-omschrijving)", "Excerpt (meta description)", "Özet (meta açıklama)")}
          </label>
          <textarea
            className={inputCls + " resize-y"}
            rows={2}
            value={draft.excerpt}
            onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
            placeholder={t("Korte samenvatting voor Google en de kaartweergave (≤ 160 tekens).", "Short summary for Google & the card (≤ 160 chars).", "Google ve kart için kısa özet (≤ 160 karakter).")}
            maxLength={300}
          />
          <p className="text-[11px] text-slate-400 mt-1">{draft.excerpt.length}/160 {t("aanbevolen", "recommended", "önerilen")}</p>
        </div>

        {/* Content */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t("Inhoud", "Content", "İçerik")}</label>
          <textarea
            className={inputCls + " resize-y font-mono text-[13px] leading-relaxed"}
            rows={16}
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            placeholder={"## Tussenkop\n\nEen alinea tekst met **nadruk**.\n\n- Punt één\n- Punt twee"}
          />
          <p className="text-[11px] text-slate-400 mt-1">{CONTENT_HINT}</p>
        </div>

        {/* Publish toggle + actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
              className="h-4 w-4 accent-amber-500 cursor-pointer"
            />
            <span className="text-sm font-bold text-slate-700">
              {draft.published ? t("Gepubliceerd (zichtbaar)", "Published (visible)", "Yayında (görünür)") : t("Concept (verborgen)", "Draft (hidden)", "Taslak (gizli)")}
            </span>
          </label>
          <div className="flex gap-2">
            <button onClick={() => setDraft(null)} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition-colors cursor-pointer border-none">
              <X className="h-3.5 w-3.5" /> {t("Annuleren", "Cancel", "İptal")}
            </button>
            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 text-xs font-black text-slate-950 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 px-5 py-2.5 rounded-xl transition-colors cursor-pointer border-none">
              <Save className="h-3.5 w-3.5" /> {saving ? t("Opslaan…", "Saving…", "Kaydediliyor…") : t("Opslaan", "Save", "Kaydet")}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  return (
    <motion.div key="blog-list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">{t("Kenniscentrum", "Knowledge base", "Bilgi merkezi")}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {t("Artikelen en handleidingen voor SEO en om te delen met klanten.", "Articles and guides for SEO and to share with customers.", "SEO ve müşterilerle paylaşmak için yazı ve kılavuzlar.")}
          </p>
        </div>
        <button onClick={startNew} className="inline-flex items-center gap-1.5 text-xs font-black text-slate-950 bg-amber-500 hover:bg-amber-600 px-4 py-2.5 rounded-xl transition-colors cursor-pointer border-none shrink-0">
          <Plus className="h-4 w-4" /> {t("Nieuw", "New", "Yeni")}
        </button>
      </div>

      {blogPosts.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-500">{t("Nog geen artikelen. Klik op 'Nieuw' om te beginnen.", "No articles yet. Click 'New' to start.", "Henüz yazı yok. Başlamak için 'Yeni'ye tıklayın.")}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {blogPosts.map((p) => {
            const isGuide = p.type === "handleiding";
            return (
              <div key={p.id} className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${isGuide ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-600"}`}>
                      {isGuide ? <Wrench className="h-2.5 w-2.5" /> : <BookOpen className="h-2.5 w-2.5" />}
                      {isGuide ? t("Handleiding", "Guide", "Kılavuz") : t("Artikel", "Article", "Yazı")}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{p.category}</span>
                    {p.published
                      ? <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">{t("Live", "Live", "Yayında")}</span>
                      : <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{t("Concept", "Draft", "Taslak")}</span>}
                  </div>
                  <p className="text-sm font-bold text-slate-900 truncate">{p.title}</p>
                  <p className="text-[11px] text-slate-400 font-mono truncate">/kenniscentrum/{p.slug}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={`/kenniscentrum/${p.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t("Bekijken", "Preview", "Önizleme")}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={() => handleToggle(p)}
                    title={p.published ? t("Offline halen", "Unpublish", "Yayından kaldır") : t("Publiceren", "Publish", "Yayınla")}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer border-none"
                  >
                    {p.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => startEdit(p)}
                    title={t("Bewerken", "Edit", "Düzenle")}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border-none"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(p)}
                    title={t("Verwijderen", "Delete", "Sil")}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer border-none"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AdminConfirmDialog
        open={!!confirmDelete}
        title={t("Artikel verwijderen", "Delete article", "Yazıyı sil")}
        message={t(`Weet u zeker dat u "${confirmDelete?.title}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`, `Delete "${confirmDelete?.title}"? This cannot be undone.`, `"${confirmDelete?.title}" silinsin mi? Bu geri alınamaz.`)}
        confirmLabel={t("Verwijderen", "Delete", "Sil")}
        cancelLabel={t("Annuleren", "Cancel", "İptal")}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </motion.div>
  );
}
