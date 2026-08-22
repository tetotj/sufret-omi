export type AuditCsvRow = {
  id: number;
  adminId: number | null;
  action: string;
  details: string | null;
  createdAt: string;
};

export function buildAuditCsv(rows: AuditCsvRow[], language: "ar" | "en"): string {
  const escapeCsv = (value: string | number | null) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = language === "ar" ? ["المعرّف", "المشرف", "الإجراء", "التفاصيل", "التاريخ"] : ["ID", "Admin ID", "Action", "Details", "Timestamp"];
  const values = rows.map((row) => [row.id, row.adminId, row.action, row.details, row.createdAt]);
  return "\uFEFF" + [header, ...values].map((row) => row.map((cell) => escapeCsv(cell)).join(",")).join("\n");
}

export function shouldNotifyFailedAdminLogin(lastAlertAt: number, now: number, windowMs = 5 * 60 * 1000): boolean {
  return lastAlertAt <= 0 || now - lastAlertAt >= windowMs;
}
