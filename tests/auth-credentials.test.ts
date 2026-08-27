import { describe, expect, it } from "vitest";

import { hashLocalPassword, verifyLocalPassword } from "../server/db";

describe("local auth credentials", () => {
  it("hashes and verifies a password without storing the original value", () => {
    const password = "SufretOmi!2026";
    const encoded = hashLocalPassword(password);

    expect(encoded).toMatch(/^scrypt\$/);
    expect(encoded).not.toContain(password);
    expect(verifyLocalPassword(password, encoded)).toBe(true);
    expect(verifyLocalPassword("wrong-password", encoded)).toBe(false);
  });

  it("rejects malformed or missing hashes", () => {
    expect(verifyLocalPassword("anything", null)).toBe(false);
    expect(verifyLocalPassword("anything", "not-a-valid-hash")).toBe(false);
  });
});
