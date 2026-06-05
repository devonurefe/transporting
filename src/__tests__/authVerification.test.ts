/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "vitest";
import crypto from "crypto";
import bcrypt from "bcryptjs";

describe("Authentication Security Helpers", () => {
  it("should generate a cryptographically secure 64-character hex verification token", () => {
    const token = crypto.randomBytes(32).toString("hex");
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should verify correct password hashes using bcryptjs", async () => {
    const password = "securePassword123";
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const isMatch = await bcrypt.compare(password, hash);
    const isNotMatch = await bcrypt.compare("wrongPassword", hash);

    expect(isMatch).toBe(true);
    expect(isNotMatch).toBe(false);
  });
});
