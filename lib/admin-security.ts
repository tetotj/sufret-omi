export type AdminAuditFilter = {
  device?: string;
  ip?: string;
  date?: string;
};

export type AdminAuditRow = {
  id: number;
  adminId: number | null;
  action: string;
  details: string | null;
  createdAt: string;
};

export function filterAdminAuditRows(rows: AdminAuditRow[], filter: AdminAuditFilter): AdminAuditRow[] {
  const device = filter.device?.trim().toLowerCase();
  const ip = filter.ip?.trim().toLowerCase();
  const date = filter.date?.trim();
  return rows.filter((row) => {
    if (date && !row.createdAt.startsWith(date)) return false;
    const details = (row.details ?? "").toLowerCase();
    if (device && !details.includes(device)) return false;
    if (ip && !details.includes(ip)) return false;
    return true;
  });
}

export type PushReadiness = {
  platform: "ios" | "android" | "web";
  permission: "granted" | "denied" | "undetermined" | "unsupported";
  projectIdConfigured: boolean;
  ready: boolean;
  message: string;
};

export function getPushReadiness(platform: "ios" | "android" | "web", permission: string, projectId?: string | null): PushReadiness {
  const normalized = permission === "granted" || permission === "denied" || permission === "undetermined" ? permission : "unsupported";
  const projectIdConfigured = Boolean(projectId?.trim());
  const ready = normalized === "granted" && (platform === "web" || projectIdConfigured);
  const message = ready ? "ready" : normalized !== "granted" ? "permission_required" : "project_id_required";
  return { platform, permission: normalized, projectIdConfigured, ready, message };
}
