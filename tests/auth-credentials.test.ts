import { describe, expect, it } from "vitest";

import { assertPasswordAttemptAllowed, clearPasswordFailures, hashLocalPassword, recordPasswordFailure, verifyLocalPassword } from "../server/db";

describe("local auth credentials", () => {
  it("hashes and verifies a password without storing the original value", () => {
    const password = "SufretOmi!2026";
    const encoded = hashLocalPassword(password);

    expect(encoded).toMatch(/^scrypt\$/);
    expect(encoded).not.toContain(password);
    expect(verifyLocalPassword(password, encoded)).toBe(true);
    expect(verifyLocalPassword("wrong-password", encoded)).toBe(false);
  });

  it("limits repeated password failures and can clear the window", () => {
    const phone = `079${Date.now().toString().slice(-7)}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assertPasswordAttemptAllowed(phone);
      recordPasswordFailure(phone);
    }
    expect(() => assertPasswordAttemptAllowed(phone)).toThrow("PASSWORD_RATE_LIMIT");
    clearPasswordFailures(phone);
    expect(() => assertPasswordAttemptAllowed(phone)).not.toThrow();
    clearPasswordFailures(phone);
  });

  it("rejects malformed or missing hashes", () => {
    expect(verifyLocalPassword("anything", null)).toBe(false);
    expect(verifyLocalPassword("anything", "not-a-valid-hash")).toBe(false);
  });
});
