/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  MapPin,
  Clock,
  ShieldCheck,
  Truck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Phone,
} from "lucide-react";
import { Machine } from "../types";
import { useAppStore } from "../store/appStore";
import { euroCompact } from "../utils/format";
import { withImageWidth } from "../utils/image";
import { getCityBySlug, SERVICE_CITIES } from "../data/serviceCities";
import { useSeo, SEO_BASE_URL } from "../utils/seo";

interface CityLandingPageProps {
  onSelectMachineForBooking: (machine: Machine) => void;
}

/**
 * Local-SEO landing page per city (/hoogwerker-huren/:stad). Server injects the
 * per-city <title>/OG + LocalBusiness/Service JSON-LD; this renders the visible
 * content so both Google and visitors get a real, unique page per service area.
 */
export default function CityLandingPage({ onSelectMachineForBooking }: CityLandingPageProps) {
  const { stad } = useParams<{ stad: string }>();
  const navigate = useNavigate();
  const machines = useAppStore((s) => s.machines);
  const city = stad ? getCityBySlug(stad) : undefined;

  useSeo(
    city
      ? {
          title: `Hoogwerker huren in ${city.name} | huurgo`,
          description: city.intro,
          path: `/hoogwerker-huren/${city.slug}`,
          jsonLd: {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Service",
                serviceType: "Hoogwerker verhuur",
                name: `Hoogwerker huren in ${city.name}`,
                description: city.intro,
                url: `${SEO_BASE_URL}/hoogwerker-huren/${city.slug}`,
                areaServed: [city.name, ...city.nearby].map((n) => ({ "@type": "City", name: n })),
                provider: {
                  "@type": "LocalBusiness",
                  name: "huurgo — MB Hoogwerkers B.V.",
                  url: SEO_BASE_URL,
                  image: `${SEO_BASE_URL}/og-image.jpg`,
                  address: {
                    "@type": "PostalAddress",
                    addressLocality: "Zoeterwoude",
                    addressRegion: "Zuid-Holland",
                    addressCountry: "NL",
                  },
                  areaServed: "Zuid-Holland",
                },
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: SEO_BASE_URL },
                  { "@type": "ListItem", position: 2, name: "Catalogus", item: `${SEO_BASE_URL}/catalog` },
                  { "@type": "ListItem", position: 3, name: city.name, item: `${SEO_BASE_URL}/hoogwerker-huren/${city.slug}` },
                ],
              },
            ],
          },
        }
      : { title: "Plaats niet gevonden | huurgo", path: "/hoogwerker-huren" }
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [city]);

  // A few representative, cheapest active models to showcase as quick links.
  const popular = useMemo(() => {
    return machines
      .filter((m) => m.isActive !== false && m.category !== "klussensets")
      .filter((m) => !/\(Unit\s+\d+\)/i.test(m.name))
      .sort((a, b) => a.pricePerDay - b.pricePerDay)
      .slice(0, 4);
  }, [machines]);

  if (!city) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-lg font-black text-slate-900">Plaats niet gevonden</h1>
        <p className="text-sm text-slate-500">Wij bezorgen in heel Zuid-Holland. Bekijk hieronder ons werkgebied.</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {SERVICE_CITIES.map((c) => (
            <Link key={c.slug} to={`/hoogwerker-huren/${c.slug}`} className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full transition-colors">
              {c.name}
            </Link>
          ))}
        </div>
        <Link to="/catalog" className="inline-block bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors">
          Naar het assortiment
        </Link>
      </div>
    );
  }

  const goCatalog = () => navigate("/catalog");

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
      {/* Breadcrumb */}
      <nav aria-label="Kruimelpad" className="mb-4">
        <Link to="/catalog" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Alle hoogwerkers
        </Link>
      </nav>

      {/* Hero */}
      <header className="space-y-3 mb-8">
        <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-500">
          <MapPin className="h-3.5 w-3.5" /> Werkgebied · {city.name}
        </p>
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 leading-tight">
          Hoogwerker huren in {city.name}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-3xl">{city.intro}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={goCatalog}
            className="cta-shine inline-flex items-center gap-1.5 py-2.5 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-sm font-bold transition-all shadow-sm"
          >
            Bekijk beschikbaarheid <ArrowRight className="h-4 w-4" />
          </button>
          <a
            href="tel:+31611848899"
            className="inline-flex items-center gap-1.5 py-2.5 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-all"
          >
            <Phone className="h-4 w-4 text-emerald-500" /> Bel voor advies
          </a>
        </div>
      </header>

      {/* Trust strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {[
          { icon: Truck, title: "Snelle bezorging", text: `± ${city.driveMinutes} min vanaf ons depot in Zoeterwoude` },
          { icon: ShieldCheck, title: "Zonder borg", text: "Direct online geregeld, geen aanbetaling" },
          { icon: Clock, title: "Dezelfde of volgende dag", text: "Vaak nog dezelfde werkdag te leveren" },
        ].map((b) => (
          <div key={b.title} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-start gap-3">
            <span className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <b.icon className="h-4.5 w-4.5 text-slate-600" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight">{b.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">{b.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Body copy */}
      <section className="max-w-3xl mb-10">
        <h2 className="text-base font-extrabold text-slate-900 mb-2">Verhuur op maat in {city.name}</h2>
        <p className="text-sm text-slate-600 leading-relaxed">{city.body}</p>
      </section>

      {/* Popular machines */}
      {popular.length > 0 && (
        <section className="mb-10">
          <h2 className="text-base font-extrabold text-slate-900 mb-3">Populaire hoogwerkers voor {city.name}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {popular.map((m) => (
              <div key={m.id} className="group rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col transition-all duration-300 hover:border-orange-200 hover:shadow-lg hover:-translate-y-1">
                <Link to={`/hoogwerker/${m.id}`} className="block aspect-[4/3] bg-slate-50 overflow-hidden">
                  <img
                    src={withImageWidth(m.imageUrl, 640) || m.additionalImages?.[0] || "/placeholder-machine.webp"}
                    alt={m.imageAlt || `${m.name} huren in ${city.name}`}
                    className="h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.currentTarget.src = "/placeholder-machine.webp"; }}
                  />
                </Link>
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <Link to={`/hoogwerker/${m.id}`} className="text-xs font-bold text-slate-900 leading-tight line-clamp-2 hover:text-orange-600 transition-colors">
                    {m.name.replace(/\s*\(Unit\s+\d+\)\s*$/i, "")}
                  </Link>
                  <p className="text-[11px] text-slate-500 mt-auto"><span className="font-bold text-slate-800">{euroCompact(m.pricePerDay)}</span>/dag</p>
                  <button
                    onClick={() => onSelectMachineForBooking(m)}
                    className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold transition-colors"
                  >
                    Reserveren
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Nearby areas (internal context) */}
      <section className="mb-10">
        <h2 className="text-base font-extrabold text-slate-900 mb-2">Ook actief rondom {city.name}</h2>
        <p className="text-sm text-slate-600 mb-3">Wij bezorgen vanuit Zoeterwoude ook in deze plaatsen in de buurt:</p>
        <div className="flex flex-wrap gap-2">
          {city.nearby.map((n) => (
            <span key={n} className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {n}
            </span>
          ))}
        </div>
      </section>

      {/* Other cities — internal linking */}
      <section className="border-t border-slate-200 pt-6">
        <h2 className="text-sm font-bold text-slate-700 mb-3">Hoogwerker huren in andere plaatsen</h2>
        <div className="flex flex-wrap gap-2">
          {SERVICE_CITIES.filter((c) => c.slug !== city.slug).map((c) => (
            <Link
              key={c.slug}
              to={`/hoogwerker-huren/${c.slug}`}
              className="text-xs font-semibold text-slate-500 hover:text-orange-600 bg-slate-50 hover:bg-orange-50 px-3 py-1.5 rounded-full transition-colors"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
