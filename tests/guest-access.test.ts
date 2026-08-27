import { describe, expect, it } from "vitest";

import { normalizeSessionAuth } from "../lib/auth-session";

describe("authenticated-only session policy", () => {
  it("invalidates a persisted guest session", () => {
    expect(normalizeSessionAuth({ isAuthenticated: true, isGuest: true })).toEqual({
      isAuthenticated: false,
      isGuest: false,
    });
  });

  it("keeps a regular authenticated session", () => {
    expect(normalizeSessionAuth({ isAuthenticated: true, isGuest: false })).toEqual({
      isAuthenticated: true,
      isGuest: false,
    });
  });
});
