// Shared validator for admin-supplied base64 image data: URLs — used by every
// endpoint that accepts an imageUrl/heroImageUrl/galleryImages-style field
// directly (not just through POST /api/upload, which already enforces this at
// upload time). An admin can set these fields directly via PUT/POST on
// machines, site-config, etc., bypassing the upload endpoint entirely, so the
// same checks must be re-applied here — otherwise a data:image/svg+xml URL
// (can carry a <script>, i.e. stored XSS when a browser renders it directly)
// or an oversized/malformed blob would sail straight into the database.
//
// Mirrors server/routes/api.ts's ALLOWED_EXTENSIONS/MAGIC_BYTES for
// POST /api/upload — keep both in sync.
const IMAGE_MAGIC_BYTES: Record<string, (buf: Buffer) => boolean> = {
  "image/jpeg": (buf) => buf[0] === 0xff && buf[1] === 0xd8,
  "image/png": (buf) => buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47,
  "image/webp": (buf) => buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP",
  "image/gif": (buf) => buf.toString("ascii", 0, 3) === "GIF",
};

// Returns the validated data: URL unchanged, or "" when it's not a genuine,
// correctly-typed image within maxBytes (SVG included in the rejection — it's
// deliberately not in IMAGE_MAGIC_BYTES).
export function sanitizeImageDataUrl(url: string, maxBytes: number): string {
  const match = url.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
  const magicCheck = match ? IMAGE_MAGIC_BYTES[match[1].toLowerCase()] : undefined;
  if (!match || !magicCheck) return "";
  const base64Content = url.slice(match[0].length);
  const byteLength = Math.ceil(base64Content.length * 0.75);
  if (byteLength > maxBytes) return "";
  const header = Buffer.from(base64Content.slice(0, 24), "base64");
  if (header.length < 12 || !magicCheck(header)) return "";
  return url;
}
