// Beveiligingscontroles die iemand moet zíen, niet alleen die iemand uitvoert.
//
// De check op het standaardwachtwoord bestond al, maar schreef bij een treffer
// alleen een console.error bij het opstarten. Op een onbemande VPS leest niemand
// die log: de ernstigste vondst die het systeem over zichzelf kan doen — het
// admin-account staat open met een wachtwoord dat in de seed staat en dus
// publiek is — verdween in stdout. Daarom hier gecentraliseerd, zodat zowel het
// opstartpad (dat mailt) als het adminpaneel (dat een banner toont) hetzelfde
// antwoord gebruiken en het nooit uit elkaar kan lopen.

import bcrypt from "bcryptjs";
import { prisma } from "../../prisma/client.js";

// Het wachtwoord waarmee prisma/seed.ts het eerste admin-account aanmaakt.
// Staat in de repo, dus wie het kent kan inloggen zolang het niet gewijzigd is.
const SEEDED_ADMIN_EMAIL = "admin@huurgo.nl";
const SEEDED_ADMIN_PASSWORD = "admin123";

export interface SecurityStatus {
  /** Het geseede admin-account bestaat nog én gebruikt nog het seed-wachtwoord. */
  defaultAdminPassword: boolean;
  /** Het e-mailadres in kwestie, puur om in de melding te kunnen noemen. */
  defaultAdminEmail: string | null;
}

/**
 * Eén bcrypt-vergelijking tegen het geseede account. Bewust niet élk
 * admin-account: bcrypt op 12 rondes kost ~200 ms per vergelijking, en het
 * risico dat we hier afdekken is specifiek dát het meegeleverde wachtwoord uit
 * de repo nog werkt — niet dat iemand zelf een zwak wachtwoord koos (daar is de
 * PASSWORD_POLICY voor).
 *
 * Faalt nooit hard: een DB-storing mag het adminpaneel niet blokkeren, dus bij
 * een fout melden we "niets gevonden" en loggen we de oorzaak.
 */
export async function getSecurityStatus(): Promise<SecurityStatus> {
  try {
    const admin = await prisma.admin.findUnique({
      where: { email: SEEDED_ADMIN_EMAIL },
      select: { passwordHash: true, isActive: true }
    });
    if (!admin || admin.isActive === false) {
      return { defaultAdminPassword: false, defaultAdminEmail: null };
    }
    const stillDefault = await bcrypt.compare(SEEDED_ADMIN_PASSWORD, admin.passwordHash);
    return {
      defaultAdminPassword: stillDefault,
      defaultAdminEmail: stillDefault ? SEEDED_ADMIN_EMAIL : null
    };
  } catch (err) {
    console.warn("[Security] Kon de wachtwoordcontrole niet uitvoeren:", err instanceof Error ? err.message : err);
    return { defaultAdminPassword: false, defaultAdminEmail: null };
  }
}
