import { describe, expect, it } from "vitest";
import { isExpoPushToken } from "../server/marketing-notifications";

describe("marketing push notifications", () => {
  it("accepts Expo push tokens", () => {
    expect(isExpoPushToken("ExponentPushToken[abc123456789]" )).toBe(true);
  });

  it("rejects arbitrary tokens", () => {
    expect(isExpoPushToken("not-a-push-token")).toBe(false);
  });
});
