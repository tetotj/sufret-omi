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

export function buildAuditHtml(rows: AuditCsvRow[], language: "ar" | "en"): string {
  const escapeHtml = (value: string | number | null) => String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] ?? char));
  const title = language === "ar" ? "سجل التدقيق الإداري - سفرة أمي" : "Sufret Omi - Administrative Audit Log";
  const headers = language === "ar" ? ["المعرّف", "المشرف", "الإجراء", "التفاصيل", "التاريخ"] : ["ID", "Admin ID", "Action", "Details", "Timestamp"];
  const body = rows.map((row) => `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.adminId)}</td><td>${escapeHtml(row.action)}</td><td>${escapeHtml(row.details)}</td><td>${escapeHtml(row.createdAt)}</td></tr>`).join("");
  return `<!doctype html><html dir="${language === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#082E34}h1{color:#00AFC4}table{width:100%;border-collapse:collapse}th,td{border:1px solid #B8E6E8;padding:8px;text-align:${language === "ar" ? "right" : "left"};font-size:12px}th{background:#E8FBFC}</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(new Date().toLocaleString())}</p><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${body || `<tr><td colspan="5">${language === "ar" ? "لا توجد أحداث" : "No events"}</td></tr>`}</tbody></table></body></html>`;
}
