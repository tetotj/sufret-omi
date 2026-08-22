import { describe, expect, it } from "vitest";

import { buildAuditCsv, shouldNotifyFailedAdminLogin } from "../lib/admin-audit";

describe("admin security helpers", () => {
  it("builds UTF-8 CSV with Arabic headers and escaped values", () => {
    const csv = buildAuditCsv([
      { id: 7, adminId: 3, action: "تحديث الحالة", details: "اسم \"المستخدم\"", createdAt: "2026-08-22T10:00:00.000Z" },
    ], "ar");
    expect(csv.startsWith("\uFEFF")) .toBe(true);
    expect(csv).toContain("المعرّف,المشرف,الإجراء,التفاصيل,التاريخ".replaceAll(",", "\",\""));
    expect(csv).toContain("اسم \"\"المستخدم\"\"");
  });

  it("allows the first failed-login alert and throttles repeated alerts", () => {
    expect(shouldNotifyFailedAdminLogin(0, 1000)).toBe(true);
    expect(shouldNotifyFailedAdminLogin(1000, 1000 + 60_000)).toBe(false);
    expect(shouldNotifyFailedAdminLogin(1000, 1000 + 5 * 60_000)).toBe(true);
  });
});
