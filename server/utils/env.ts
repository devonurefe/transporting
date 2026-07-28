/**
 * Environment variable validation utility.
 * Called at server startup to verify all required and optional env vars.
 */

interface EnvCheck {
  key: string;
  required: boolean;
  defaultValue?: string;
  description: string;
}

const ENV_CHECKS: EnvCheck[] = [
  { key: "DATABASE_URL", required: true, description: "Prisma database connection string (postgresql://...)" },
  { key: "JWT_SECRET", required: false, description: "JWT signing secret (required in production)" },
  { key: "RESEND_API_KEY", required: false, description: "Resend email API key" },
  { key: "EMAIL_FROM", required: false, defaultValue: "onboarding@resend.dev", description: "Sender email address" },
  { key: "REPLY_TO", required: false, defaultValue: "info@huurgo.nl", description: "Reply-to for customer mail (MX-forwarded mailbox)" },
  { key: "ADMIN_EMAIL", required: false, description: "Admin notification email" },
  { key: "PORT", required: false, defaultValue: "3000", description: "Server listening port" },
  { key: "REMINDER_SECRET", required: false, description: "Secret for the cron reminder endpoint (disabled if unset)" },
  { key: "CALENDAR_FEED_TOKEN", required: false, description: "Secret gating the read-only iCal feed (disabled if unset)" },
  { key: "MOLLIE_API_KEY", required: false, description: "Mollie live_... API key for automatic payment links — falls back to manual placeholder link if unset OR if it's a test_... key" }
];

export function validateEnvironment(): void {
  console.log("\n🔍 [ENV] Validating environment variables...");
  let hasErrors = false;

  for (const check of ENV_CHECKS) {
    const value = process.env[check.key];

    if (!value || value === "") {
      if (check.required && !check.defaultValue) {
        console.error(`❌ [ENV] MISSING REQUIRED: ${check.key} — ${check.description}`);
        hasErrors = true;
      } else if (check.defaultValue) {
        // Apply default silently
        process.env[check.key] = check.defaultValue;
      } else {
        console.warn(`⚠️  [ENV] OPTIONAL NOT SET: ${check.key} — ${check.description}`);
      }
    }
  }

  // mollieService.ts only activates on a "live_" key — this is deliberately loud
  // (not a silent fallback) because during Mollie onboarding it's easy to leave
  // a "test_" key configured after the merchant account is otherwise live-ready,
  // and the symptom (customers never getting a real payment link) would
  // otherwise be silent.
  if (process.env.MOLLIE_API_KEY && !process.env.MOLLIE_API_KEY.startsWith("live_")) {
    console.warn(
      "⚠️  [ENV] MOLLIE_API_KEY is set to a test_... key — automatic payment links stay OFF " +
      "(same as unset) until a live_... key is configured. This is deliberate: a test key would let " +
      "any visitor self-approve their own payment. Update MOLLIE_API_KEY once the Mollie account is verified."
    );
  }

  // Production-specific checks
  if (process.env.NODE_ENV === "production") {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev-only-huurgo-jwt-secret") {
      console.error("❌ [ENV] JWT_SECRET must be set to a strong value in production!");
      hasErrors = true;
    }
  }

  if (hasErrors) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[ENV] Critical environment variables are missing. Cannot start in production.");
    }
    console.error("\n❌ [ENV] Critical environment variables are missing. Server may not function correctly.\n");
  } else {
    console.log("✅ [ENV] Environment validation passed.\n");
  }
}
