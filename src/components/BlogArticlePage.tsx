/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, CalendarDays, BookOpen, Wrench, Share2, Check, MessageCircle } from "lucide-react";
import { useAppStore, type BlogPost } from "../store/appStore";
import { useSeo, SEO_BASE_URL } from "../utils/seo";

/** Words-per-minute estimate for the reading-time label. */
const WPM = 200;

type Block =
  | { kind: "h2"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] };

// Parse the lightweight Markdown body (## headings, blank-line paragraphs,
// `- ` bullets). Kept intentionally minimal — see prisma/blogSeed.ts for the format.
function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => { if (para.length) { blocks.push({ kind: "p", text: para.join(" ") }); para = []; } };
  const flushList = () => { if (list.length) { blocks.push({ kind: "ul", items: [...list] }); list = []; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    if (line.startsWith("## ")) { flushPara(); flushList(); blocks.push({ kind: "h2", text: line.slice(3).trim() }); continue; }
    if (line.startsWith("- ")) { flushPara(); list.push(line.slice(2).trim()); continue; }
    flushList();
    para.push(line);
  }
  flushPara(); flushList();
  return blocks;
}

// Render **bold** spans; everything else is plain text.
function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    return m
      ? <strong key={i} className="font-bold text-slate-900">{m[1]}</strong>
      : <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function MarkdownBody({ content }: { content: string }) {
  const blocks = useMemo(() => parseBlocks(content), [content]);
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        if (b.kind === "h2") {
          return <h2 key={i} className="text-lg sm:text-xl font-extrabold text-slate-900 pt-4">{b.text}</h2>;
        }
        if (b.kind === "ul") {
          return (
            <ul key={i} className="space-y-2 pl-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2.5 text-sm sm:text-[15px] text-slate-600 leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                  <span>{renderInline(it)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={i} className="text-sm sm:text-[15px] text-slate-600 leading-relaxed">{renderInline(b.text)}</p>;
      })}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

interface BlogArticlePageProps {
  setActiveTab: (tab: string) => void;
}

export default function BlogArticlePage({ setActiveTab }: BlogArticlePageProps) {
  const { slug } = useParams<{ slug: string }>();
  const blogPosts = useAppStore((s) => s.blogPosts);
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  // Prefer a post already in the store; otherwise fetch it directly by slug so
  // deep links (and admin draft previews) resolve without loading the full list.
  useEffect(() => {
    let active = true;
    setCopied(false);
    const inStore = blogPosts.find((p) => p.slug === slug);
    if (inStore) {
      setPost(inStore);
      setNotFound(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const isAdminMode = localStorage.getItem("hwh_admin_mode") === "true";
    const token = isAdminMode ? localStorage.getItem("hwh_admin_token") : localStorage.getItem("hwh_token");
    fetch(`/api/blog-posts/${encodeURIComponent(slug || "")}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: BlogPost | null) => {
        if (!active) return;
        if (d && d.id) { setPost(d); setNotFound(false); }
        else setNotFound(true);
      })
      .catch(() => { if (active) setNotFound(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, blogPosts]);

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  const readMinutes = useMemo(() => {
    if (!post) return 1;
    const words = post.content.trim().split(/\s+/).length;
    return Math.max(1, Math.round(words / WPM));
  }, [post]);

  useSeo(
    post
      ? {
          title: `${post.title} | huurgo`,
          description: post.excerpt,
          path: `/kenniscentrum/${post.slug}`,
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title.slice(0, 110),
            description: post.excerpt,
            articleSection: post.category,
            inLanguage: "nl-NL",
            datePublished: post.createdAt,
            dateModified: post.updatedAt,
            mainEntityOfPage: { "@type": "WebPage", "@id": `${SEO_BASE_URL}/kenniscentrum/${post.slug}` },
            author: { "@type": "Organization", name: "huurgo — MB Hoogwerkers B.V.", url: SEO_BASE_URL },
            publisher: { "@type": "Organization", name: "huurgo — MB Hoogwerkers B.V.", url: SEO_BASE_URL },
            url: `${SEO_BASE_URL}/kenniscentrum/${post.slug}`,
          },
        }
      : { title: "Kenniscentrum | huurgo", path: "/kenniscentrum" }
  );

  const shareUrl = post ? `${SEO_BASE_URL}/kenniscentrum/${post.slug}` : SEO_BASE_URL;
  const isGuide = post?.type === "handleiding";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the WhatsApp button still works */ }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-slate-300 border-t-orange-500" />
        <p className="text-sm text-slate-400 mt-4">Artikel laden…</p>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-lg font-black text-slate-900">Artikel niet gevonden</h1>
        <p className="text-sm text-slate-500">Dit artikel bestaat niet of is niet meer beschikbaar.</p>
        <Link
          to="/kenniscentrum"
          onClick={(e) => { e.preventDefault(); setActiveTab("kenniscentrum"); }}
          className="inline-block bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors no-underline"
        >
          Naar het kenniscentrum
        </Link>
      </div>
    );
  }

  const otherPosts = blogPosts.filter((p) => p.slug !== post.slug && p.published).slice(0, 3);

  return (
    <article className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      {/* Breadcrumb */}
      <nav aria-label="Kruimelpad" className="mb-5">
        <Link
          to="/kenniscentrum"
          onClick={(e) => { e.preventDefault(); setActiveTab("kenniscentrum"); }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors no-underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Kenniscentrum
        </Link>
      </nav>

      {/* Header */}
      <header className="space-y-4 mb-8 pb-8 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${isGuide ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-600"}`}>
            {isGuide ? <Wrench className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
            {isGuide ? "Handleiding" : "Artikel"}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{post.category}</span>
          {!post.published && (
            <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">Concept (niet gepubliceerd)</span>
          )}
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 leading-tight">{post.title}</h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">{post.excerpt}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(post.updatedAt)}</span>
          <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {readMinutes} min lezen</span>
        </div>

        {/* Share — send the guide/article to a customer */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all"
          >
            {copied ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Gekopieerd</> : <><Share2 className="h-3.5 w-3.5" /> Kopieer link</>}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${post.title} — ${shareUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white text-xs font-bold transition-all no-underline"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Deel via WhatsApp
          </a>
        </div>
      </header>

      {/* Body */}
      <MarkdownBody content={post.content} />

      {/* CTA to catalog */}
      <div className="mt-10 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-5 sm:p-6">
        <h2 className="text-base sm:text-lg font-extrabold text-slate-900">Direct een hoogwerker huren?</h2>
        <p className="text-sm text-slate-600 mt-1 mb-4 leading-relaxed">
          Bekijk ons complete aanbod en reserveer online — zonder borg, snel geleverd in heel Zuid-Holland.
        </p>
        <Link
          to="/catalog"
          onClick={(e) => { e.preventDefault(); setActiveTab("catalog"); }}
          className="cta-shine inline-flex items-center gap-1.5 py-2.5 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-all no-underline"
        >
          Bekijk alle hoogwerkers <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Other posts */}
      {otherPosts.length > 0 && (
        <section className="mt-12 pt-8 border-t border-slate-200">
          <h2 className="text-sm font-bold text-slate-700 mb-4">Meer uit het kenniscentrum</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {otherPosts.map((p) => (
              <Link
                key={p.slug}
                to={`/kenniscentrum/${p.slug}`}
                onClick={(e) => { e.preventDefault(); setActiveTab(`kenniscentrum/${p.slug}`); }}
                className="group block rounded-2xl border border-slate-200 bg-white p-4 hover:border-orange-200 hover:shadow-md transition-all no-underline"
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{p.category}</span>
                <p className="text-sm font-bold text-slate-900 leading-snug mt-1 group-hover:text-orange-600 transition-colors line-clamp-3">{p.title}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
