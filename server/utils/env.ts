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
  { key: "DATABASE_URL", required: true, defaultValue: "file:./dev.db", description: "Prisma database connection string" },
  { key: "JWT_SECRET", required: false, defaultValue: "dev-only-huurgo-jwt-secret", description: "JWT signing secret (required in production)" },
  { key: "GEMINI_API_KEY", required: false, description: "Google Gemini AI API key" },
  { key: "RESEND_API_KEY", required: false, description: "Resend email API key" },
  { key: "EMAIL_FROM", required: false, defaultValue: "onboarding@resend.dev", description: "Sender email address" },
  { key: "ADMIN_EMAIL", required: false, defaultValue: "info@huurgo.nl", description: "Admin notification email" },
  { key: "PORT", required: false, defaultValue: "3000", description: "Server listening port" }
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

  // Production-specific checks
  if (process.env.NODE_ENV === "production") {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev-only-huurgo-jwt-secret") {
      console.error("❌ [ENV] JWT_SECRET must be set to a strong value in production!");
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error("\n❌ [ENV] Critical environment variables are missing. Server may not function correctly.\n");
  } else {
    console.log("✅ [ENV] Environment validation passed.\n");
  }
}
