import { describe, expect, it } from "vitest";

import { filterAdminAuditRows, getPushReadiness } from "../lib/admin-security";

describe("admin audit filters and push readiness", () => {
  const rows = [
    { id: 1, adminId: null, action: "Failed admin login", details: '{"device":"ios:iPhone","ip":"10.0.0.***.12"}', createdAt: "2026-08-22T12:00:00.000Z" },
    { id: 2, adminId: 3, action: "Approved kitchen", details: "kitchen review", createdAt: "2026-08-21T12:00:00.000Z" },
  ];

  it("filters audit rows by device, IP, and date", () => {
    expect(filterAdminAuditRows(rows, { device: "iphone" })).toHaveLength(1);
    expect(filterAdminAuditRows(rows, { ip: "10.0.0." })).toHaveLength(1);
    expect(filterAdminAuditRows(rows, { date: "2026-08-21" })).toHaveLength(1);
    expect(filterAdminAuditRows(rows, { dateFrom: "2026-08-21", dateTo: "2026-08-22" })).toHaveLength(2);
    expect(filterAdminAuditRows(rows, { dateFrom: "2026-08-22", dateTo: "2026-08-22" })).toHaveLength(1);
    expect(filterAdminAuditRows(rows, { device: "android" })).toHaveLength(0);
  });

  it("requires permission and EAS project ID for native readiness", () => {
    expect(getPushReadiness("ios", "granted", "eas-project").ready).toBe(true);
    expect(getPushReadiness("ios", "denied", "eas-project").ready).toBe(false);
    expect(getPushReadiness("android", "granted", "").message).toBe("project_id_required");
    expect(getPushReadiness("web", "unsupported").ready).toBe(false);
  });
});
