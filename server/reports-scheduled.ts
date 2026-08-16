import type { Request, Response } from "express";

import { generateWeeklyKitchenReports, listWeeklyReportRecipients } from "./db";
import { sendWeeklyEmailReport } from "./email";
import { sdk } from "./_core/sdk";

export async function handleWeeklyReportScheduled(req: Request, res: Response) {
  const startedAt = Date.now();
  let user;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    return res.status(403).json({ error: "cron-only" });
  }
  if (!user.isCron) return res.status(403).json({ error: "cron-only" });

  try {
    const report = await generateWeeklyKitchenReports();
    const emailEnabled = process.env.WEEKLY_REPORT_EMAILS_ENABLED === "true";
    const recipients = emailEnabled ? await listWeeklyReportRecipients() : [];
    const emailResults = emailEnabled ? await Promise.all(recipients.map((recipient) => {
      const kitchen = report.kitchens.find((item) => item.kitchenId === recipient.kitchenId);
      return sendWeeklyEmailReport({
        kitchenName: recipient.kitchenName,
        recipientEmail: recipient.email,
        grossSales: kitchen?.grossSales ?? 0,
        commission: (kitchen?.grossSales ?? 0) * 0.05,
        netPayout: (kitchen?.grossSales ?? 0) * 0.95,
        orderCount: kitchen?.orderCount ?? 0,
      });
    })) : [];
    return res.json({
      ok: true,
      report,
      delivery: emailEnabled ? "admin-download-and-email" : "admin-download",
      email: { enabled: emailEnabled, recipients: recipients.length, sent: emailResults.filter((result) => result.sent).length },
      durationMs: Date.now() - startedAt,
      taskUid: user.taskUid ?? null,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      context: { url: req.originalUrl, taskUid: user.taskUid ?? null },
    });
  }
}
