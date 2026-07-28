import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// mollieService.ts reads process.env.MOLLIE_API_KEY once at module load and
// only constructs the Mollie client for a "live_" key, so each case here
// mocks the SDK, resets the module registry, and re-imports with a fresh env
// value to observe whether the client was actually built.
//
// This is the one gate standing between a stray "test_" key left over from
// Mollie onboarding and a live payment surface: Mollie's test-mode checkout
// lets any visitor pick "Paid" themselves with no money moving, and (since the
// unpaid-order auto-release shipped) a "test_" key would also let the release
// cron auto-cancel real bookings the moment a "live_" key replaces it.
describe("mollieService live-key gating", () => {
  const ORIGINAL_KEY = process.env.MOLLIE_API_KEY;
  const createMollieClient = vi.fn(() => ({
    paymentLinks: {
      create: vi.fn().mockResolvedValue({ id: "pl_test", getPaymentUrl: () => "https://mollie.example/pl_test" }),
      update: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue({ paidAt: null })
    }
  }));

  beforeEach(() => {
    vi.resetModules();
    createMollieClient.mockClear();
    vi.doMock("@mollie/api-client", () => ({ createMollieClient }));
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.MOLLIE_API_KEY;
    else process.env.MOLLIE_API_KEY = ORIGINAL_KEY;
    vi.doUnmock("@mollie/api-client");
    vi.resetModules();
  });

  it("never constructs a client with a test_... key — no-op, same as unset", async () => {
    process.env.MOLLIE_API_KEY = "test_abc123";
    const { mollieService } = await import("../../server/services/mollieService");
    const result = await mollieService.createPaymentLink({ id: "HWH-TEST1", totalAmount: 100 });
    expect(result).toBeNull();
    expect(createMollieClient).not.toHaveBeenCalled();
  });

  it("never constructs a client when MOLLIE_API_KEY is unset", async () => {
    delete process.env.MOLLIE_API_KEY;
    const { mollieService } = await import("../../server/services/mollieService");
    await mollieService.createPaymentLink({ id: "HWH-TEST2", totalAmount: 100 });
    expect(createMollieClient).not.toHaveBeenCalled();
  });

  it("constructs the client and creates a real link with a live_... key", async () => {
    process.env.MOLLIE_API_KEY = "live_abc123";
    const { mollieService } = await import("../../server/services/mollieService");
    const result = await mollieService.createPaymentLink({ id: "HWH-TEST3", totalAmount: 100 });
    expect(createMollieClient).toHaveBeenCalledWith({ apiKey: "live_abc123" });
    expect(result).toEqual({ id: "pl_test", checkoutUrl: "https://mollie.example/pl_test" });
  });
});
