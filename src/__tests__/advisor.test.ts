/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import { Machine } from "../types";
import {
  scoreMachine,
  matchMachines,
  resolveFlow,
  questionsFor,
  coerceAnswer,
  buildSummary,
  buildAdvisorWhatsAppUrl,
  DEFAULT_ADVISOR_FLOW,
  type AdvisorAnswers,
} from "../utils/advisor";

// Minimal park mirroring real seed categories/tags. Only the fields the scorer
// reads are meaningful; the rest are filled to satisfy the Machine type.
const mk = (p: Partial<Machine>): Machine =>
  ({
    id: p.id ?? "x",
    name: p.name ?? "Machine",
    category: p.category ?? "schaarlift",
    categoryLabel: p.category ?? "Schaarlift",
    height: p.height ?? 10,
    reach: 0,
    weight: 0,
    pricePerDay: 75,
    powerType: "Elektrisch",
    imageUrl: "",
    imageAlt: "",
    description: "",
    suitableFor: p.suitableFor ?? [],
    isActive: p.isActive ?? true,
    ...p,
  }) as Machine;

const PARK: Machine[] = [
  mk({ id: "scissor8", category: "schaarlift", height: 8.2, suitableFor: ["Installateur", "Schilder", "Magazijn"] }),
  mk({ id: "scissor-smal", category: "schaarlift-smal", height: 10, suitableFor: ["Installateur", "Particulier"] }),
  mk({ id: "spin12", category: "spin", height: 12.2, suitableFor: ["Hovenier", "Gevelreiniger"] }),
  mk({ id: "spin17", category: "spin", height: 17.1, suitableFor: ["Hovenier", "Gevelreiniger"] }),
  mk({ id: "ladder18", category: "ladderlift", height: 18, suitableFor: ["Particulier", "Aannemer"] }),
  mk({ id: "ladder21", category: "ladderlift", height: 21, suitableFor: ["Particulier", "Aannemer"] }),
  mk({ id: "kamer", category: "kamersteiger", height: 6, suitableFor: ["Schilder", "Stukadoor"] }),
  mk({ id: "offline", category: "schaarlift", height: 8, isActive: false }),
];

describe("scoreMachine — job family gate", () => {
  it("disqualifies machines outside the chosen job family", () => {
    const a: AdvisorAnswers = { job: "verhuizen" };
    expect(scoreMachine(PARK[0], a)).toBe(-Infinity); // scissor not a verhuislift
    expect(scoreMachine(PARK[4], a)).toBeGreaterThan(0); // ladderlift qualifies
  });
});

describe("matchMachines — hoogte branch", () => {
  it("ranks a smalle-doorgang answer toward the smalle schaarlift", () => {
    const a: AdvisorAnswers = { job: "hoogte", use: "installateur", h: 8, access: "smal" };
    const res = matchMachines(PARK, a);
    expect(res[0].machine.id).toBe("scissor-smal");
  });

  it("routes tuin/zachte grond toward a spin (rupshoogwerker)", () => {
    const a: AdvisorAnswers = { job: "hoogte", use: "hovenier", h: 12, access: "tuin" };
    const res = matchMachines(PARK, a);
    expect(res[0].machine.category).toBe("spin");
  });

  it("never returns machines that cannot reach the requested height", () => {
    const a: AdvisorAnswers = { job: "hoogte", h: 17, access: "tuin" };
    const res = matchMachines(PARK, a);
    // 12m spin cannot reach 17m — the 17m spin must outrank it
    expect(res[0].machine.id).toBe("spin17");
  });

  it("excludes inactive machines", () => {
    const a: AdvisorAnswers = { job: "hoogte", h: 8, access: "binnen" };
    const res = matchMachines(PARK, a);
    expect(res.some((r) => r.machine.id === "offline")).toBe(false);
  });
});

describe("matchMachines — verhuizen branch", () => {
  it("prefers the heavy-load 21m lift for zware meubels", () => {
    const a: AdvisorAnswers = { job: "verhuizen", h: 21, load: "zwaar" };
    const res = matchMachines(PARK, a);
    expect(res[0].machine.id).toBe("ladder21");
  });
});

describe("resolveFlow — admin overrides", () => {
  it("returns defaults when no config is given", () => {
    const flow = resolveFlow(undefined);
    expect(flow.q1.q).toBe(DEFAULT_ADVISOR_FLOW.q1.q);
  });

  it("applies question + option copy overrides without touching values", () => {
    const flow = resolveFlow({
      overrides: { job: { q: "Waarvoor komt u?", options: { hoogte: "Hoog werken" } } },
    });
    expect(flow.q1.q).toBe("Waarvoor komt u?");
    const opt = flow.q1.options.find((o) => o.v === "hoogte");
    expect(opt?.label).toBe("Hoog werken");
    expect(opt?.v).toBe("hoogte"); // stable value untouched
  });

  it("ignores blank overrides and falls back to defaults", () => {
    const flow = resolveFlow({ overrides: { job: { q: "   " } } });
    expect(flow.q1.q).toBe(DEFAULT_ADVISOR_FLOW.q1.q);
  });
});

describe("questionsFor / coerceAnswer / summary", () => {
  it("expands the branch once a job is chosen", () => {
    const flow = resolveFlow();
    expect(questionsFor(flow, {}).length).toBe(1);
    expect(questionsFor(flow, { job: "hoogte" }).length).toBe(1 + flow.branches.hoogte.length);
  });

  it("coerces the height answer to a number", () => {
    expect(coerceAnswer("h", "12")).toBe(12);
    expect(coerceAnswer("job", "hoogte")).toBe("hoogte");
  });

  it("summarises chosen answers and injects them into the WhatsApp url", () => {
    const flow = resolveFlow();
    const a: AdvisorAnswers = { job: "hoogte", use: "hovenier", h: 12, access: "tuin" };
    const summary = buildSummary(flow, a);
    expect(summary).toContain("hovenier");
    const url = buildAdvisorWhatsAppUrl(flow, a, "31611691692");
    expect(url).toContain("wa.me/31611691692");
    expect(decodeURIComponent(url)).toContain("hovenier");
  });
});
