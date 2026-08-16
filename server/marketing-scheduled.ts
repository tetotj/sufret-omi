import type { Request, Response } from "express";
import { claimDueMarketingNotifications } from "./db";
import { sendMarketingNotification } from "./marketing-notifications";
import { sdk } from "./_core/sdk";

export async function handleMarketingScheduled(req: Request, res: Response) {
  const startedAt = Date.now();
  let user;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    return res.status(403).json({ error: "cron-only" });
  }
  if (!user.isCron) return res.status(403).json({ error: "cron-only" });

  try {
    const dueItems = await claimDueMarketingNotifications();
    const results = [];
    for (const item of dueItems) {
      const result = await sendMarketingNotification({
        title: item.titleEn,
        body: item.bodyEn,
        data: { type: item.kind, id: item.id, url: "/(tabs)" },
      });
      results.push({ id: item.id, kind: item.kind, ...result });
    }
    return res.json({ ok: true, processed: results.length, results, durationMs: Date.now() - startedAt });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      context: { url: req.originalUrl, taskUid: user.taskUid ?? null },
    });
  }
}
