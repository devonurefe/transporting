/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Reads a File as a base64 data: URL, unmodified — used for non-image uploads
// (e.g. the machine datasheet PDF) where no client-side resize/compression applies.
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error("Bestand kon niet worden gelezen."));
    reader.readAsDataURL(file);
  });
}
