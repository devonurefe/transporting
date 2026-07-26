import { describe, it, expect } from "vitest";
import { ResizedImageCache } from "../../server/utils/imageCache";

const img = (label: string) => ({ buf: Buffer.from(label), contentType: "image/webp" });

describe("ResizedImageCache", () => {
  it("returns a stored entry", () => {
    const cache = new ResizedImageCache(3);
    cache.set("a", img("a"));
    expect(cache.get("a")?.buf.toString()).toBe("a");
  });

  it("returns null for an unknown key", () => {
    const cache = new ResizedImageCache(3);
    expect(cache.get("nope")).toBeNull();
  });

  it("never grows past its bound", () => {
    const cache = new ResizedImageCache(3);
    for (let i = 0; i < 10; i++) cache.set(`k${i}`, img(`k${i}`));
    expect(cache.size).toBe(3);
  });

  it("evicts the least-recently-used entry first", () => {
    const cache = new ResizedImageCache(3);
    cache.set("a", img("a"));
    cache.set("b", img("b"));
    cache.set("c", img("c"));

    // Touching "a" must make "b" the coldest entry.
    cache.get("a");
    cache.set("d", img("d"));

    expect(cache.get("b")).toBeNull();
    expect(cache.get("a")?.buf.toString()).toBe("a");
    expect(cache.get("c")?.buf.toString()).toBe("c");
    expect(cache.get("d")?.buf.toString()).toBe("d");
  });

  it("overwrites in place without growing the cache", () => {
    const cache = new ResizedImageCache(2);
    cache.set("a", img("old"));
    cache.set("a", img("new"));

    expect(cache.size).toBe(1);
    expect(cache.get("a")?.buf.toString()).toBe("new");
  });

  it("keeps a re-written key from being evicted as if it were stale", () => {
    const cache = new ResizedImageCache(2);
    cache.set("a", img("a"));
    cache.set("b", img("b"));
    // Rewriting "a" should also refresh its recency, making "b" the coldest.
    cache.set("a", img("a2"));
    cache.set("c", img("c"));

    expect(cache.get("b")).toBeNull();
    expect(cache.get("a")?.buf.toString()).toBe("a2");
  });
});
