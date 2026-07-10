/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Wrench, ArrowRight, GraduationCap } from "lucide-react";
import { useAppStore, type BlogPost } from "../store/appStore";
import { useSeo, SEO_BASE_URL } from "../utils/seo";

interface KenniscentrumSectionProps {
  setActiveTab: (tab: string) => void;
}

function PostCard({ post, setActiveTab }: { post: BlogPost; setActiveTab: (t: string) => void }) {
  const isGuide = post.type === "handleiding";
  return (
    <Link
      to={`/kenniscentrum/${post.slug}`}
      onClick={(e) => { e.preventDefault(); setActiveTab(`kenniscentrum/${post.slug}`); }}
      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 hover:border-orange-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 no-underline"
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${isGuide ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-600"}`}>
          {isGuide ? <Wrench className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
          {isGuide ? "Handleiding" : "Artikel"}
        </span>
        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{post.category}</span>
        {!post.published && (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">Concept</span>
        )}
      </div>
      <h2 className="text-base font-extrabold text-slate-900 leading-snug group-hover:text-orange-600 transition-colors">{post.title}</h2>
      <p className="text-[13px] text-slate-500 leading-relaxed mt-2 line-clamp-3 flex-1">{post.excerpt}</p>
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 mt-4">
        Lees meer <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </Link>
  );
}

export default function KenniscentrumSection({ setActiveTab }: KenniscentrumSectionProps) {
  const blogPosts = useAppStore((s) => s.blogPosts);
  const fetchBlogPosts = useAppStore((s) => s.fetchBlogPosts);

  useEffect(() => { fetchBlogPosts(); }, [fetchBlogPosts]);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  useSeo({
    title: "Kenniscentrum — Tips, gidsen & handleidingen | huurgo",
    description:
      "Alles over hoogwerkers huren: keuzehulp, kosten, veilig werken op hoogte en praktische handleidingen. Deskundige tips van huurgo (MB Hoogwerkers).",
    path: "/kenniscentrum",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Kenniscentrum — huurgo",
      description:
        "Tips, keuzehulp en handleidingen over hoogwerkers huren, veilig werken op hoogte en de juiste machine kiezen.",
      url: `${SEO_BASE_URL}/kenniscentrum`,
      inLanguage: "nl-NL",
      isPartOf: { "@type": "WebSite", name: "huurgo", url: SEO_BASE_URL },
    },
  });

  const { guides, articles } = useMemo(() => {
    const guides = blogPosts.filter((p) => p.type === "handleiding");
    const articles = blogPosts.filter((p) => p.type !== "handleiding");
    return { guides, articles };
  }, [blogPosts]);

  const isEmpty = blogPosts.length === 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
      {/* Hero */}
      <header className="space-y-3 mb-8">
        <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-500">
          <GraduationCap className="h-4 w-4" /> Kenniscentrum
        </p>
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 leading-tight">
          Tips, gidsen &amp; handleidingen
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
          Praktische kennis over hoogwerkers huren: welke machine past bij uw klus, wat het kost,
          hoe u veilig op hoogte werkt en meer. Geschreven door het team van huurgo (MB Hoogwerkers).
        </p>
      </header>

      {isEmpty && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">Er zijn nog geen artikelen gepubliceerd. Kom binnenkort terug.</p>
        </div>
      )}

      {/* Guides first — they're the shareable "how it works" content */}
      {guides.length > 0 && (
        <section className="mb-10">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500 mb-4">
            <Wrench className="h-4 w-4 text-emerald-500" /> Handleidingen &amp; uitleg
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((p) => <PostCard key={p.slug} post={p} setActiveTab={setActiveTab} />)}
          </div>
        </section>
      )}

      {/* Articles */}
      {articles.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500 mb-4">
            <BookOpen className="h-4 w-4 text-orange-500" /> Artikelen &amp; keuzehulp
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((p) => <PostCard key={p.slug} post={p} setActiveTab={setActiveTab} />)}
          </div>
        </section>
      )}
    </div>
  );
}
