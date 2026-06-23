/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Resizes an image file client-side using HTML5 Canvas.
 * Compresses the resulting image as WebP at 80% quality (JPEG fallback).
 *
 * @param file The uploaded Image File.
 * @param maxWidth Max width bound.
 * @param maxHeight Max height bound.
 * @param quality WebP/JPEG quality (0–1). Defaults to 0.85.
 * @returns A promise resolving to the compressed base64 string.
 */
export function resizeImage(file: File, maxWidth = 1400, maxHeight = 1400, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio bounds
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // White fill so transparent PNGs render on a clean background instead of black.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        // Subtle enhancement: slightly more vibrant/sharp without looking processed.
        ctx.filter = "brightness(1.04) contrast(1.08) saturate(1.06)";
        ctx.drawImage(img, 0, 0, width, height);
        ctx.filter = "none";
        // Prefer WebP at 85% quality (smaller payloads, fewer artefacts); the server upload
        // allowlist + magic-byte check already accept .webp. Browsers that
        // ignore the WebP MIME return PNG/JPEG, so fall back to JPEG.
        const webp = canvas.toDataURL("image/webp", quality);
        const dataUrl = webp.startsWith("data:image/webp")
          ? webp
          : canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Görsel yüklenemedi."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.readAsDataURL(file);
  });
}
