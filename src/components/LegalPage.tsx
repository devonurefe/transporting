/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import MarkdownBody from "./MarkdownBody";
import { useAppStore } from "../store/appStore";
import { DEFAULT_PRIVACY_POLICY, DEFAULT_TERMS_CONDITIONS } from "../data/legalContent";

// Code-fallback per slug (zelfde `?? codeDefault`-patroon als de rest van de
// admin-manageable content). Zolang de admin niets opslaat, tonen /privacy en
// /voorwaarden deze standaardtekst i.p.v. het "volgt binnenkort"-blok.
const DEFAULT_CONTENT: Record<LegalPageProps["slug"], string> = {
  privacy: DEFAULT_PRIVACY_POLICY,
  voorwaarden: DEFAULT_TERMS_CONDITIONS,
};

// Beheerd via AdminContent → Juridisch (POST /api/site-config); geserveerd
// buiten de site-config-payload om via GET /api/pages/:slug (zie
// server/routes/siteConfig.ts) zodat de first-visit JSON klein blijft.
interface LegalPageProps {
  slug: "privacy" | "voorwaarden";
  title: string;
}

export default function LegalPage({ slug, title }: LegalPageProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const contactEmail = useAppStore((state) => state.siteConfig.contactEmail) || "info@mbhoogwerkers.com";

  useEffect(() => {
    let active = true;
    setLoading(true);
    document.title = `${title} | huurgo`;
    window.scrollTo(0, 0);
    fetch(`/api/pages/${slug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (active) setContent(data?.content || ""); })
      .catch(() => { if (active) setContent(""); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, title]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <header className="text-center mb-8 space-y-2">
        <span className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-slate-100 mb-1">
          <FileText className="h-5 w-5 text-orange-500" />
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{title}</h1>
      </header>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Laden...</div>
      ) : (content || DEFAULT_CONTENT[slug]) ? (
        <MarkdownBody content={content || DEFAULT_CONTENT[slug]} />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center space-y-2">
          <p className="text-sm text-slate-600">Inhoud volgt binnenkort.</p>
          <p className="text-xs text-slate-400">
            Vragen? Neem contact op via{" "}
            <a href={`mailto:${contactEmail}`} className="text-orange-600 font-semibold hover:underline">
              {contactEmail}
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
