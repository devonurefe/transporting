/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles, ChevronLeft, ChevronRight, MessageCircle, RotateCcw } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { useModalA11y } from "../hooks/useModalA11y";
import { euroCompact } from "../utils/format";
import {
  resolveFlow,
  questionsFor,
  matchMachines,
  coerceAnswer,
  buildAdvisorWhatsAppUrl,
  type AdvisorAnswers,
} from "../utils/advisor";

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER ?? "31611848899";

interface AdviesModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The "Adviestool" wizard: a deterministic, branching product finder. Reads the
 * live park + admin copy-overrides from the store, filters/ranks on machine
 * fields, and ends with clickable machine cards or a WhatsApp fallback.
 */
export default function AdviesModal({ open, onClose }: AdviesModalProps) {
  const navigate = useNavigate();
  const machines = useAppStore((s) => s.machines);
  const advisorConfig = useAppStore((s) => (s.siteConfig as { advisorConfig?: unknown }).advisorConfig);

  const flow = useMemo(() => resolveFlow(advisorConfig as never), [advisorConfig]);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AdvisorAnswers>({});

  const dialogRef = useModalA11y<HTMLDivElement>(open, onClose);

  const reset = () => {
    setStep(0);
    setAnswers({});
  };

  const questions = questionsFor(flow, answers);
  const totalSteps = answers.job ? 1 + flow.branches[answers.job].length : 3;
  const isResults = step >= questions.length;

  const matches = useMemo(() => matchMachines(machines, answers), [machines, answers]);
  const remaining = step === 0 ? machines.filter((m) => m.isActive !== false).length : matches.length;

  const pick = (key: string, v: string) => {
    setAnswers((prev) => ({ ...prev, [key]: coerceAnswer(key, v) }));
    setStep((s) => s + 1);
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const goToMachine = (id: string) => {
    onClose();
    navigate(`/hoogwerker/${encodeURIComponent(id)}`);
  };

  const current = !isResults ? questions[step] : null;
  const top = matches.slice(0, 3);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Keuzehulp"
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-full"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <span className="grid place-items-center h-9 w-9 rounded-xl bg-indigo-600 text-white shrink-0">
                <Sparkles className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 leading-tight">HuurGo Keuzehulp</p>
                <p className="text-xs text-slate-500">Wij denken met u mee</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Sluiten"
                className="ml-auto grid place-items-center h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Progress */}
            <div className="flex gap-1.5 px-5 pt-4">
              {Array.from({ length: totalSteps + 1 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i < step ? "bg-orange-500" : i === step ? "bg-orange-500/40" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>

            {/* Body */}
            <div className="px-5 py-4 overflow-y-auto">
              {current ? (
                <>
                  <p className="text-xs font-semibold text-slate-400 tracking-wide">
                    Vraag {step + 1} van {totalSteps}
                  </p>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5 mb-4 text-balance">{current.q}</h2>
                  <div className={`grid gap-2.5 ${current.cols === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                    {current.options.map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => pick(current.key, o.v)}
                        className="text-left flex items-center gap-2.5 rounded-xl border-2 border-slate-200 bg-slate-50 hover:border-orange-400 hover:bg-orange-50 px-3.5 py-3 transition-colors cursor-pointer"
                      >
                        <span className="text-lg shrink-0" aria-hidden="true">{o.icon}</span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-800">{o.label}</span>
                          {o.sub && <span className="block text-xs text-slate-500">{o.sub}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : top.length > 0 ? (
                <>
                  <p className="text-xs font-semibold text-emerald-600 tracking-wide">
                    ✓ Klaar — {top.length} {top.length === 1 ? "machine past" : "machines passen"} bij u
                  </p>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5 mb-4">Dit raden wij aan</h2>
                  <div className="flex flex-col gap-2.5">
                    {top.map((x, i) => (
                      <button
                        key={x.machine.id}
                        type="button"
                        onClick={() => goToMachine(x.machine.id)}
                        className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 hover:border-orange-400 px-3 py-2.5 transition-colors cursor-pointer text-left"
                      >
                        <img
                          src={x.machine.imageUrl || x.machine.additionalImages?.[0] || "/placeholder-machine.webp"}
                          alt={x.machine.imageAlt || `${x.machine.name} huren`}
                          className="h-14 w-14 rounded-xl object-cover bg-slate-100 shrink-0"
                          onError={(e) => { e.currentTarget.src = "/placeholder-machine.webp"; }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-slate-800 truncate">{x.machine.name}</span>
                          <span className="block text-xs text-slate-500">
                            {x.machine.height} m · {x.machine.categoryLabel || x.machine.category}
                          </span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block text-sm font-bold text-orange-600">
                            {euroCompact(x.machine.pricePerDay)}/dag
                          </span>
                          {i === 0 && (
                            <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              beste match
                            </span>
                          )}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <h2 className="text-lg font-bold text-slate-900 mb-3">Geen kant-en-klare match</h2>
                  <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/60 p-4">
                    <p className="text-sm text-slate-700 mb-3">
                      Voor uw combinatie hebben we maatwerk. Onze verhuuradviseur denkt graag even met u mee — uw
                      antwoorden sturen we automatisch mee.
                    </p>
                    <a
                      href={buildAdvisorWhatsAppUrl(flow, answers, WHATSAPP_NUMBER)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-[#25d366] hover:brightness-105 text-emerald-950 font-bold text-sm px-5 py-2.5 rounded-xl transition-all cursor-pointer"
                    >
                      <MessageCircle className="h-4 w-4" /> Vraag het via WhatsApp
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {!isResults ? (
              <div className="flex items-center px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
                <span>
                  Past nu bij <b className="text-orange-600 tabular-nums">{remaining}</b>{" "}
                  {remaining === 1 ? "machine" : "machines"} in ons park
                </span>
                {step > 0 && (
                  <button
                    type="button"
                    onClick={back}
                    className="ml-auto inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> terug
                  </button>
                )}
              </div>
            ) : (
              <div className="flex gap-2 px-5 py-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-sm py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Opnieuw
                </button>
                <button
                  type="button"
                  onClick={() => { onClose(); navigate("/catalog"); }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Naar de catalogus
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
