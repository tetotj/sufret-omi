import { afterEach, describe, expect, it, vi } from "vitest";

import { sendWeeklyEmailReport } from "../server/email";

describe("weekly email delivery", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips delivery safely when Resend is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const result = await sendWeeklyEmailReport({
      kitchenName: "مطبخ تجريبي",
      recipientEmail: "mother@example.com",
      grossSales: 100,
      commission: 5,
      netPayout: 95,
      orderCount: 4,
    });

    expect(result).toEqual({ sent: false, provider: "none-configured" });
  });
});
