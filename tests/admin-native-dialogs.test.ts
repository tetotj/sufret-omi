import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const adminSource = readFileSync(resolve(process.cwd(), "app/admin.tsx"), "utf8");

// Ignore the React Native API itself when checking for browser-only globals.
const withoutNativeAlert = adminSource.replaceAll("Alert.alert", "");

describe("admin native dialog compatibility", () => {
  it("uses React Native Alert instead of browser confirm or alert globals", () => {
    expect(adminSource).toContain("import { Alert,");
    expect(adminSource).toContain("Alert.alert(");
    expect(withoutNativeAlert).not.toMatch(/\bconfirm\s*\(/);
    expect(withoutNativeAlert).not.toMatch(/\balert\s*\(/);
  });

  it("keeps destructive suspension confirmation separate from cancellation", () => {
    expect(adminSource).toContain('style: "destructive"');
    expect(adminSource).toContain('style: "cancel"');
  });
});

export {};
