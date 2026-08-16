import type { Request, Response } from "express";

import { generateWeeklyKitchenReports } from "./db";
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
    return res.json({
      ok: true,
      report,
      delivery: "admin-download",
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
