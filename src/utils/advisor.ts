/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Deterministic product-finder ("Adviestool") engine.
//
// The customer answers a few questions; we filter and rank the EXISTING park
// on stable machine fields (category, suitableFor, height). There is no LLM:
// the tool can never invent a machine, costs nothing per session and shares no
// data with an external service.
//
// The flow branches on the first question (what the customer is going to do).
// Question TEXTS and option LABELS are admin-editable (see AdvisorConfig), but
// the matching VALUES (`key` / option `v`) are fixed in code so an admin can
// never break the scoring by editing copy.

import { Machine } from "../types";

export type JobKey = "hoogte" | "verhuizen" | "klus";

export interface AdvisorOption {
  v: string; // stable value used by scoring — NOT admin-editable
  label: string; // display copy — admin-editable via overrides
  sub?: string; // optional helper line under the label
  icon: string; // emoji marker
}

export interface AdvisorQuestion {
  id: string; // unique per question instance — the override lookup key
  key: string; // answer key used by scoring (may repeat across branches, e.g. "h")
  q: string; // question copy — admin-editable via overrides
  cols: 1 | 2; // chip grid columns
  options: AdvisorOption[];
}

export interface AdvisorFlow {
  q1: AdvisorQuestion; // shared first question (job)
  branches: Record<JobKey, AdvisorQuestion[]>; // follow-up questions per job
  waFallback: string; // WhatsApp template; "{samenvatting}" is replaced
}

export interface AdvisorAnswers {
  job?: JobKey;
  use?: string;
  h?: number;
  access?: string;
  load?: string;
}

// Admin overrides, persisted as siteConfig.advisorConfig. Only copy + the
// on/off toggle + the WhatsApp text can be changed; structure stays in code.
export interface AdvisorConfig {
  enabled?: boolean;
  waFallback?: string;
  overrides?: Record<string, { q?: string; options?: Record<string, string> }>;
}

// ── The default flow (Dutch) ────────────────────────────────────────────────

export const DEFAULT_ADVISOR_FLOW: AdvisorFlow = {
  q1: {
    id: "job",
    key: "job",
    q: "Wat gaat u doen?",
    cols: 1,
    options: [
      { v: "hoogte", label: "Op hoogte werken", sub: "schaar-, mast- of spinhoogwerker", icon: "🏗️" },
      { v: "verhuizen", label: "Spullen of meubels omhoog", sub: "verhuislift / ladderlift", icon: "📦" },
      { v: "klus", label: "Steiger of kleine klus", sub: "kamersteiger, low-level", icon: "🪜" },
    ],
  },
  branches: {
    hoogte: [
      {
        id: "hoogte_use",
        key: "use",
        q: "Wat voor werk doet u vooral?",
        cols: 2,
        options: [
          { v: "schilder", label: "Schilder / stukadoor", icon: "🖌️" },
          { v: "installateur", label: "Installatie / montage", icon: "🔧" },
          { v: "hovenier", label: "Hovenier / gevel", icon: "🌳" },
          { v: "glazenwasser", label: "Glazenwassen", icon: "🪟" },
          { v: "particulier", label: "Klus thuis", icon: "🏠" },
          { v: "magazijn", label: "Magazijn / bedrijf", icon: "📦" },
        ],
      },
      {
        id: "hoogte_h",
        key: "h",
        q: "Hoe hoog moet u komen?",
        cols: 2,
        options: [
          { v: "4", label: "tot 4 meter", icon: "📏" },
          { v: "8", label: "4 – 8 meter", icon: "📏" },
          { v: "12", label: "8 – 12 meter", icon: "📏" },
          { v: "17", label: "12 meter of meer", icon: "📏" },
        ],
      },
      {
        id: "hoogte_access",
        key: "access",
        q: "Waar staat de machine straks?",
        cols: 1,
        options: [
          { v: "binnen", label: "Binnen op een gladde vloer", sub: "standaard schaar-/mastlift", icon: "🏢" },
          { v: "smal", label: "Door een smalle doorgang (<1 m)", sub: "smalle machine nodig", icon: "🚪" },
          { v: "tuin", label: "In de tuin / op zachte grond", sub: "rupshoogwerker (spin)", icon: "🌱" },
        ],
      },
    ],
    verhuizen: [
      {
        id: "verhuizen_h",
        key: "h",
        q: "Tot welke hoogte / verdieping?",
        cols: 1,
        options: [
          { v: "18", label: "Tot ± 2e-4e verdieping", sub: "tot 18 meter", icon: "🏠" },
          { v: "21", label: "Hoger / zwaar transport", sub: "tot 21 meter, heavy-load", icon: "🏢" },
        ],
      },
      {
        id: "verhuizen_load",
        key: "load",
        q: "Wat verhuist u vooral?",
        cols: 1,
        options: [
          { v: "licht", label: "Dozen en lichte spullen", icon: "📦" },
          { v: "zwaar", label: "Zware meubels / witgoed", sub: "heavy-load lift", icon: "🛋️" },
        ],
      },
    ],
    klus: [
      {
        id: "klus_h",
        key: "h",
        q: "Hoe hoog moet u werken?",
        cols: 1,
        options: [
          { v: "3", label: "tot ± 3 meter", sub: "low-level / Toolbuddy", icon: "📏" },
          { v: "6", label: "3 – 6 meter", sub: "kamersteiger", icon: "📏" },
        ],
      },
    ],
  },
  waFallback:
    "Hoi HuurGo 🦾 Via de keuzehulp: {samenvatting}. Ik kwam er niet helemaal uit — welke machine adviseert u? 🦾",
};

// ── Matching ────────────────────────────────────────────────────────────────

// Machine categories that belong to each job family. A machine outside the
// chosen family is disqualified entirely.
const JOB_CATEGORIES: Record<JobKey, string[]> = {
  hoogte: ["schaarlift", "schaarlift-6m", "schaarlift-smal", "mastlift", "spin", "ecolift", "aanhanger"],
  verhuizen: ["ladderlift"],
  klus: ["kamersteiger", "klussensets"],
};

// A "use" option maps to one or more lowercase suitableFor tags. Grouped so a
// single chip covers related professions (schilder ↔ stukadoor/restauratie).
const USE_TAGS: Record<string, string[]> = {
  schilder: ["schilder", "stukadoor", "restauratie"],
  installateur: ["installateur"],
  hovenier: ["hovenier", "gevelreiniger"],
  glazenwasser: ["glazenwasser"],
  particulier: ["particulier", "aannemer"],
  magazijn: ["magazijn", "aannemer"],
};

/**
 * Scores one machine against the given answers. A machine outside the chosen
 * job family returns -Infinity (disqualified); otherwise a higher score is a
 * better match. Callers filter on score > 0.
 */
export function scoreMachine(m: Machine, a: AdvisorAnswers): number {
  if (a.job) {
    const cats = JOB_CATEGORIES[a.job];
    if (!cats.includes(m.category)) return -Infinity;
  }
  let s = 3; // base for being in the right family

  if (a.use) {
    const wanted = USE_TAGS[a.use] || [a.use];
    const tags = (m.suitableFor || []).map((x) => x.toLowerCase());
    if (tags.some((t) => wanted.includes(t))) s += 3;
  }

  if (a.h != null && !Number.isNaN(a.h)) {
    if (m.height >= a.h - 1 && m.height <= a.h + 5) s += 2; // reaches, no big overkill
    else if (m.height >= a.h - 1) s += 1; // reaches but taller than needed
    else s -= 3; // cannot reach the requested height
  }

  if (a.access) {
    if (a.access === "smal") s += m.category.includes("smal") ? 3 : m.category === "spin" ? 1 : -1;
    else if (a.access === "tuin") s += m.category === "spin" ? 3 : -2;
    else if (a.access === "binnen") s += m.category === "spin" ? -1 : 1;
  }

  if (a.load) {
    if (a.load === "zwaar") s += m.height >= 20 ? 2 : -1;
    else s += m.height < 20 ? 1 : 0;
  }

  return s;
}

export interface AdvisorMatch {
  machine: Machine;
  score: number;
}

/** Ranks the active park for the given answers, best match first. */
export function matchMachines(machines: Machine[], a: AdvisorAnswers): AdvisorMatch[] {
  return machines
    .filter((m) => m.isActive !== false)
    .map((m) => ({ machine: m, score: scoreMachine(m, a) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score);
}

// ── Overrides + helpers ─────────────────────────────────────────────────────

/** Every question instance, flattened — used by the admin copy editor. */
export const ADVISOR_QUESTIONS: AdvisorQuestion[] = [
  DEFAULT_ADVISOR_FLOW.q1,
  ...DEFAULT_ADVISOR_FLOW.branches.hoogte,
  ...DEFAULT_ADVISOR_FLOW.branches.verhuizen,
  ...DEFAULT_ADVISOR_FLOW.branches.klus,
];

/** Applies admin copy-overrides on top of one default question. */
function applyOverride(q: AdvisorQuestion, cfg?: AdvisorConfig): AdvisorQuestion {
  const ov = cfg?.overrides?.[q.id];
  if (!ov) return q;
  return {
    ...q,
    q: typeof ov.q === "string" && ov.q.trim() ? ov.q : q.q,
    options: q.options.map((o) => {
      const lbl = ov.options?.[o.v];
      return typeof lbl === "string" && lbl.trim() ? { ...o, label: lbl } : o;
    }),
  };
}

/** Returns the effective flow: defaults with any admin copy-overrides applied. */
export function resolveFlow(cfg?: AdvisorConfig): AdvisorFlow {
  return {
    q1: applyOverride(DEFAULT_ADVISOR_FLOW.q1, cfg),
    branches: {
      hoogte: DEFAULT_ADVISOR_FLOW.branches.hoogte.map((q) => applyOverride(q, cfg)),
      verhuizen: DEFAULT_ADVISOR_FLOW.branches.verhuizen.map((q) => applyOverride(q, cfg)),
      klus: DEFAULT_ADVISOR_FLOW.branches.klus.map((q) => applyOverride(q, cfg)),
    },
    waFallback:
      typeof cfg?.waFallback === "string" && cfg.waFallback.trim()
        ? cfg.waFallback
        : DEFAULT_ADVISOR_FLOW.waFallback,
  };
}

/** The full ordered question list for the currently chosen job. */
export function questionsFor(flow: AdvisorFlow, answers: AdvisorAnswers): AdvisorQuestion[] {
  return answers.job ? [flow.q1, ...flow.branches[answers.job]] : [flow.q1];
}

/** Coerces a raw answer value to the type scoring expects (numbers for `h`). */
export function coerceAnswer(key: string, v: string): string | number {
  return key === "h" ? Number(v) : v;
}

/**
 * Human-readable summary of the chosen answers, using the (possibly overridden)
 * option labels. Fed into the WhatsApp fallback message.
 */
export function buildSummary(flow: AdvisorFlow, answers: AdvisorAnswers): string {
  const parts: string[] = [];
  for (const q of questionsFor(flow, answers)) {
    const raw = (answers as Record<string, unknown>)[q.key];
    if (raw == null) continue;
    const opt = q.options.find((o) => o.v === String(raw));
    if (opt) parts.push(opt.label.toLowerCase());
  }
  return parts.join(", ");
}

/** Builds the WhatsApp fallback URL with the answers summarised into the text. */
export function buildAdvisorWhatsAppUrl(flow: AdvisorFlow, answers: AdvisorAnswers, whatsappNumber: string): string {
  const message = flow.waFallback.replace("{samenvatting}", buildSummary(flow, answers) || "geen voorkeur opgegeven");
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}
