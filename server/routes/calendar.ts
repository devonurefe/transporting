import { Router, Response, Request } from "express";
import crypto from "crypto";
import { prisma } from "../../prisma/client.js";
import { requireAdmin, AuthenticatedRequest } from "../middleware/auth.js";

export const calendarRouter = Router();

// Read-only iCal (.ics) feed of the fleet agenda. Subscribers (Google Calendar,
// iPhone Calendar) poll this URL and see blocked dates + active bookings on their
// own device. One-way: system -> subscriber. Refresh is not instant — calendar
// apps poll on their own schedule (Google up to ~24h, iOS configurable).
//
// Security: the feed contains customer names, so it is gated by a secret in the
// URL path (calendar apps cannot send Authorization headers). Set CALENDAR_FEED_TOKEN
// to enable; if unset the feed is disabled.

function escapeICalText(s: string): string {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Fold lines to <=75 octets per RFC 5545 (continuation lines start with a space).
function foldLine(line: string): string {
  if (line.length <= 73) return line;
  const out: string[] = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length > 72) {
    out.push(" " + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  if (rest.length) out.push(" " + rest);
  return out.join("\r\n");
}

function toICalDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function addDaysUTC(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

function toICalStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function tokenMatches(provided: string, secret: string): boolean {
  const a = crypto.createHash("sha256").update(String(provided || "")).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// GET /api/calendar/:token/huurgo.ics — the subscribe feed
calendarRouter.get("/:token/huurgo.ics", async (req: Request, res: Response) => {
  const secret = process.env.CALENDAR_FEED_TOKEN;
  if (!secret) {
    return res.status(503).type("text/plain").send("Agenda-feed niet geconfigureerd (stel CALENDAR_FEED_TOKEN in).");
  }
  if (!tokenMatches(String(req.params.token || ""), secret)) {
    return res.status(404).type("text/plain").send("Not found");
  }

  try {
    const [orders, blocked, machines] = await Promise.all([
      prisma.order.findMany({ where: { status: { not: "Geannuleerd" } } }),
      prisma.blockedDate.findMany(),
      prisma.machine.findMany({ select: { id: true, name: true } }),
    ]);
    const nameOf = (id: string) => machines.find(m => m.id === id)?.name || id;
    const stamp = toICalStamp(new Date());

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//HuurGo//Vlootagenda//NL",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:huurgo Vlootagenda",
      "X-WR-TIMEZONE:Europe/Amsterdam",
      "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
      "X-PUBLISHED-TTL:PT1H",
    ];

    for (const o of orders) {
      // All-day events: DTEND is exclusive, so add one day to the inclusive endDate.
      const summary = `${nameOf(o.machineId)} — ${o.customerName} (${o.status})`;
      // Keep PII minimal: no phone number in the feed — if the token ever leaks,
      // exposure is limited to name + address. Phone lives in the admin panel.
      const desc = [
        `Order: ${o.id}`,
        `Status: ${o.status}`,
        o.deliveryType === "self_pickup" ? "Zelf afhalen" : (o.deliveryAddress || "Bezorging"),
      ].filter(Boolean).join("\n");
      lines.push(
        "BEGIN:VEVENT",
        `UID:order-${o.id}@huurgo`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${toICalDate(o.startDate)}`,
        `DTEND;VALUE=DATE:${toICalDate(addDaysUTC(o.endDate, 1))}`,
        `SUMMARY:${escapeICalText(summary)}`,
        `DESCRIPTION:${escapeICalText(desc)}`,
        "END:VEVENT",
      );
    }

    for (const b of blocked) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:block-${b.id}@huurgo`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${toICalDate(b.date)}`,
        `DTEND;VALUE=DATE:${toICalDate(addDaysUTC(b.date, 1))}`,
        `SUMMARY:${escapeICalText(`🔒 Geblokkeerd — ${nameOf(b.machineId)}`)}`,
        `DESCRIPTION:${escapeICalText(b.reason || "")}`,
        "END:VEVENT",
      );
    }

    lines.push("END:VCALENDAR");
    const body = lines.map(foldLine).join("\r\n") + "\r\n";
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="huurgo.ics"');
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(body);
  } catch (err) {
    console.error("Calendar feed error:", err);
    res.status(500).type("text/plain").send("Agenda-feed fout");
  }
});

// GET /api/calendar/subscribe-url — admin-only; the panel uses this to show the
// full subscribe URL (which embeds the secret token) with a copy button.
calendarRouter.get("/subscribe-url", requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const token = process.env.CALENDAR_FEED_TOKEN;
  if (!token) return res.json({ enabled: false });
  const base = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  res.json({ enabled: true, url: `${base}/api/calendar/${encodeURIComponent(token)}/huurgo.ics` });
});
