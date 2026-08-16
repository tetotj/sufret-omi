import { describe, expect, it } from "vitest";
import { normalizeOrderMessageBody } from "../server/db";

describe("order chat message validation", () => {
  it("trims valid messages", () => {
    expect(normalizeOrderMessageBody("  أين وصل الطلب؟  ")).toBe("أين وصل الطلب؟");
  });

  it("rejects empty messages", () => {
    expect(() => normalizeOrderMessageBody("   ")).toThrow("Message body is required");
  });

  it("rejects messages longer than 500 characters", () => {
    expect(() => normalizeOrderMessageBody("x".repeat(501))).toThrow("Message body is too long");
  });
});
