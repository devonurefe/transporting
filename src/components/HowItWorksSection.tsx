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
        "Vind de juiste hoogwerker in het assortiment, of laat de Adviestool meedenken.",
        "Find the right lift in the assortment, or let the advice tool help you choose.",
        "Katalogdan doğru platformu bulun veya tavsiye aracını kullanın."
      ),
    },
    {
      Icon: CalendarDays,
      title: t("Kies uw datum", "Pick your dates", "Tarihinizi seçin"),
      body: t(
        "Bekijk de live beschikbaarheid en reserveer direct online — zonder borg.",
        "Check live availability and book directly online — no deposit required.",
        "Canlı müsaitliği görün ve depozitosuz hemen online rezervasyon yapın."
      ),
    },
    {
      Icon: Truck,
      title: t("Bezorging of afhalen", "Delivery or pickup", "Teslimat veya teslim alma"),
      body: t(
        "Wij bezorgen in heel Nederland, of haal zelf gratis op in Zoeterwoude.",
        "We deliver across the Netherlands, or pick up for free in Zoeterwoude.",
        "Tüm Hollanda'ya teslimat yapıyoruz veya Zoeterwoude'dan ücretsiz alın."
      ),
    },
    {
      Icon: HardHat,
      title: t("Aan de slag", "Get to work", "İşe koyulun"),
      body: t(
        "De machine wordt bedrijfsklaar geleverd, zodat u meteen kunt beginnen.",
        "The machine arrives ready for use, so you can start right away.",
        "Makine kullanıma hazır teslim edilir, hemen başlayabilirsiniz."
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map(({ Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="relative bg-white border border-slate-200 shadow-sm rounded-2xl p-5 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <span className="font-display font-black text-2xl text-slate-200 select-none leading-none" aria-hidden="true">
                  {i + 1}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <p className="text-[13px] text-slate-500 leading-relaxed">{body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
