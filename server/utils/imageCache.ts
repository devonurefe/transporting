/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Bounded LRU cache for already-resized image bytes.
 *
 * The image proxies in server.ts previously re-read a ~500 KB base64 column out
 * of Postgres and re-ran a sharp resize on *every* request. A catalog page holds
 * ~20 machine photos and the service worker revalidates all of them on each
 * reload, so a single refresh meant ~20 concurrent decode+resize jobs competing
 * for the one Node thread and the bounded Prisma pool. Requests that lost that
 * race were slow enough to fail, and sw.js turns a failed image request into the
 * placeholder — surfacing as "the photos vanish until I reload again".
 *
 * Cache keys embed the row's updatedAt timestamp, so replacing a photo yields a
 * new key instead of needing explicit invalidation; superseded entries age out
 * through the LRU bound.
 */

export type CachedImage = { buf: Buffer; contentType: string };

export class ResizedImageCache {
  private readonly entries = new Map<string, CachedImage>();

  constructor(private readonly maxEntries: number) {}

  get(key: string): CachedImage | null {
    const hit = this.entries.get(key);
    if (!hit) return null;
    // Re-insert so this key counts as most-recently-used: Map iterates in
    // insertion order, which is what makes the eviction below an LRU.
    this.entries.delete(key);
    this.entries.set(key, hit);
    return hit;
  }

  set(key: string, value: CachedImage): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, value);
  }

  get size(): number {
    return this.entries.size;
  }
}
