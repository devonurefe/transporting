/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Resizes an image file client-side using HTML5 Canvas.
 * Compresses the resulting image as WebP at the given quality (JPEG fallback).
 *
 * @param file The uploaded Image File.
 * @param maxWidth Max width bound.
 * @param maxHeight Max height bound.
 * @param quality WebP/JPEG quality (0–1). Defaults to 0.85.
 * @param enhance Apply subtle brightness/contrast/saturation boost. Defaults to true.
 *   Pass false for hero/landscape photos where original colours should be preserved.
 * @returns A promise resolving to the compressed base64 string.
 */
export function resizeImage(
  file: File,
  maxWidth = 1400,
  maxHeight = 1400,
  quality = 0.85,
  enhance = true,
): Promise<string> {
  // Prefer createImageBitmap with EXIF orientation applied, so portrait phone
  // photos don't end up sideways on browsers where drawImage ignores EXIF.
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" })
      .then((bitmap) => {
        const result = drawToDataUrl(bitmap, maxWidth, maxHeight, quality, enhance);
        bitmap.close();
        if (result) return result;
        return resizeImageViaImgElement(file, maxWidth, maxHeight, quality, enhance);
      })
      .catch(() => resizeImageViaImgElement(file, maxWidth, maxHeight, quality, enhance));
  }
  return resizeImageViaImgElement(file, maxWidth, maxHeight, quality, enhance);
}

function resizeImageViaImgElement(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  enhance: boolean,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const result = drawToDataUrl(img, maxWidth, maxHeight, quality, enhance);
        resolve(result ?? (e.target?.result as string));
      };
      img.onerror = () => reject(new Error("Afbeelding kon niet worden geladen."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Bestand kon niet worden gelezen."));
    reader.readAsDataURL(file);
  });
}

// Shared canvas pipeline; returns null when no 2D context is available.
function drawToDataUrl(
  img: HTMLImageElement | ImageBitmap,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  enhance: boolean,
): string | null {
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
  if (!ctx) return null;

  // White fill so transparent PNGs render on a clean background instead of black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  if (enhance) {
    // Subtle boost for machine product photos — slightly more vibrant without looking processed.
    ctx.filter = "brightness(1.04) contrast(1.08) saturate(1.06)";
  }
  ctx.drawImage(img, 0, 0, width, height);
  ctx.filter = "none";
  // Prefer WebP (smaller payloads, fewer artefacts); fall back to JPEG.
  const webp = canvas.toDataURL("image/webp", quality);
  return webp.startsWith("data:image/webp")
    ? webp
    : canvas.toDataURL("image/jpeg", quality);
}
