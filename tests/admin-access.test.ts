import { describe, expect, it } from "vitest";

import { isLocalAdminPreviewAllowed } from "../lib/admin-access";

describe("local admin preview access", () => {
  it("allows the preview-only path outside production", () => {
    expect(isLocalAdminPreviewAllowed("development")).toBe(true);
    expect(isLocalAdminPreviewAllowed("test")).toBe(true);
  });

  it("blocks the preview-only path in production", () => {
    expect(isLocalAdminPreviewAllowed("production")).toBe(false);
  });
});
