import { describe, expect, it, afterEach } from "vitest";

import { isAllowedCorsOrigin } from "../server/_core/cors";

afterEach(() => {
  delete process.env.CORS_ALLOWED_ORIGINS;
});

describe("CORS origin policy", () => {
  it("accepts the public application and trusted preview origins", () => {
    expect(isAllowedCorsOrigin("https://sufretapp-ed9iastw.manus.space")).toBe(true);
    expect(isAllowedCorsOrigin("https://8081-example123.manus.computer")).toBe(true);
  });

  it("rejects arbitrary origins by default", () => {
    expect(isAllowedCorsOrigin("https://evil.example")).toBe(false);
  });

  it("uses an explicit allowlist when configured", () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://production.example, https://admin.example";
    expect(isAllowedCorsOrigin("https://production.example")).toBe(true);
    expect(isAllowedCorsOrigin("https://sufretapp-ed9iastw.manus.space")).toBe(false);
  });
});
