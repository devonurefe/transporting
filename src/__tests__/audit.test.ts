/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit-tests voor de audittrail-helpers: rij-opbouw (actor-resolutie, meta-cap)
 * en paginatie-clamping van het audit-endpoint. Geen database nodig.
 */
import { describe, it, expect } from "vitest";

process.env.JWT_SECRET ||= "unit-test-secret";

const { buildAuditRow } = await import("../../server/utils/audit.js");
const { clampPagination } = await import("../../server/routes/adminAudit.js");

describe("buildAuditRow", () => {
  const admin = { id: "adm-1", email: "admin@huurgo.nl", role: "admin" };

  it("neemt de actor van req.user over", () => {
    const row = buildAuditRow(admin, "1.2.3.4", { action: "order.status", entity: "Order", entityId: "HWH-1", meta: { from: "a", to: "b" } });
    expect(row).toMatchObject({
      actorId: "adm-1",
      actorEmail: "admin@huurgo.nl",
      actorRole: "admin",
      action: "order.status",
      entity: "Order",
      entityId: "HWH-1",
      ip: "1.2.3.4",
    });
    expect(row.meta).toEqual({ from: "a", to: "b" });
  });

  it("valt terug op 'anonymous' zonder user en zonder actor-override", () => {
    const row = buildAuditRow(undefined, undefined, { action: "login.failed" });
    expect(row.actorRole).toBe("anonymous");
    expect(row.actorId).toBeNull();
    expect(row.ip).toBeNull();
  });

  it("laat een actor-override winnen van req.user (mislukte login op bekend account)", () => {
    const row = buildAuditRow(undefined, "5.6.7.8", {
      action: "login.failed",
      actor: { id: "adm-1", email: "admin@huurgo.nl", role: "admin" },
    });
    expect(row.actorId).toBe("adm-1");
    expect(row.actorRole).toBe("admin");
  });

  it("kapt te grote meta af tot { truncated: true } (nooit base64-bodies in de log)", () => {
    const big = { blob: "x".repeat(5000) };
    const row = buildAuditRow(admin, undefined, { action: "machine.updated", meta: big });
    expect(row.meta).toEqual({ truncated: true });
  });

  it("laat kleine meta ongemoeid en ondefinieerde meta undefined", () => {
    expect(buildAuditRow(admin, undefined, { action: "x", meta: { a: 1 } }).meta).toEqual({ a: 1 });
    expect(buildAuditRow(admin, undefined, { action: "x" }).meta).toBeUndefined();
  });
});

describe("clampPagination", () => {
  it("gebruikt defaults page=1 limit=50", () => {
    expect(clampPagination(undefined, undefined)).toEqual({ page: 1, limit: 50 });
  });
  it("klemt limit op max 100 en min 1", () => {
    expect(clampPagination("2", "500")).toEqual({ page: 2, limit: 100 });
    expect(clampPagination("0", "-5")).toEqual({ page: 1, limit: 1 });
  });
  it("negeert onzin-invoer", () => {
    expect(clampPagination("abc", "xyz")).toEqual({ page: 1, limit: 50 });
  });
});
