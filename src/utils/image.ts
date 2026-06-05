/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Resizes an image file client-side using HTML5 Canvas.
 * Compresses the resulting image as JPEG with 80% quality.
 * 
 * @param file The uploaded Image File.
 * @param maxWidth Max width bound.
 * @param maxHeight Max height bound.
 * @returns A promise resolving to the compressed base64 string.
 */
export function resizeImage(file: File, maxWidth = 1200, maxHeight = 1200): Promise<string> {
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

        ctx.drawImage(img, 0, 0, width, height);
        // Compress as JPEG at 80% quality
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Görsel yüklenemedi."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.readAsDataURL(file);
  });
}
