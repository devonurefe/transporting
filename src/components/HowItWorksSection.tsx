/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Search, CalendarDays, Truck, HardHat } from "lucide-react";
import { motion } from "motion/react";
import { useLanguageStore } from "../store/languageStore";

/**
 * "Hoe werkt huren?" — vier genummerde stappen die het hele huurproces in één
 * oogopslag uitleggen (machine kiezen → datum → bezorging → aan de slag).
 */
export default function HowItWorksSection() {
  const t = useLanguageStore((state) => state.t);

  const STEPS = [
    {
      Icon: Search,
      title: t("Kies een machine", "Choose a machine", "Bir makine seçin"),
      body: t(
        "Vind de juiste hoogwerker in het assortiment.",
        "Find the right lift in the assortment.",
        "Katalogdan doğru platformu bulun."
      ),
    },
    {
      Icon: CalendarDays,
      title: t("Kies uw datum", "Pick your dates", "Tarihinizi seçin"),
      body: t(
        "Live beschikbaarheid bekijken en direct boeken — zonder borg.",
        "Check live availability and book directly — no deposit.",
        "Canlı müsaitliği görün, depozitosuz hemen ayırtın."
      ),
    },
    {
      Icon: Truck,
      title: t("Bezorging of afhalen", "Delivery or pickup", "Teslimat veya teslim alma"),
      body: t(
        "Wij bezorgen in heel NL, of gratis afhalen in Zoeterwoude.",
        "We deliver across the Netherlands, or pick up for free.",
        "Tüm Hollanda'ya teslimat veya ücretsiz teslim alma."
      ),
    },
    {
      Icon: HardHat,
      title: t("Aan de slag", "Get to work", "İşe koyulun"),
      body: t(
        "Bedrijfsklaar geleverd — u kunt meteen beginnen.",
        "Delivered ready to use — start right away.",
        "Kullanıma hazır teslim, hemen başlayın."
      ),
    },
  ];

  return (
    <div className="bg-white px-4 sm:px-6 py-12">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.35 }}
          className="text-center mb-8"
        >
          <h2 className="font-display font-black text-lg sm:text-xl text-slate-900 leading-tight">
            {t("Hoe werkt huren?", "How does renting work?", "Kiralama nasıl çalışır?")}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {t("In vier stappen aan het werk op hoogte", "Up and working at height in four steps", "Dört adımda yüksekte çalışmaya başlayın")}
          </p>
        </motion.div>

        {/* 2x2 on mobile/tablet (deliberate — see earlier redesign); 4-across
            from lg: so the squares shrink into the wider row instead of
            staying just as large but now with acres of empty white space
            around each one, which is what a 672px-capped 2x2 grid looked like
            stretched across a wide desktop viewport. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-md sm:max-w-2xl lg:max-w-5xl mx-auto">
          {STEPS.map(({ Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="relative aspect-square bg-white border border-slate-200 shadow-sm rounded-2xl p-3.5 sm:p-5 flex flex-col items-center justify-center text-center gap-1.5 sm:gap-2"
            >
              <span className="absolute top-2.5 right-3 font-display font-black text-xl sm:text-2xl text-slate-200 select-none leading-none" aria-hidden="true">
                {i + 1}
              </span>
              <span className="inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">{title}</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 leading-snug line-clamp-2">{body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
