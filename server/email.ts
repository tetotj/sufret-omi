export type WeeklyEmailReportInput = {
  kitchenName: string;
  recipientEmail: string;
  grossSales: number;
  commission: number;
  netPayout: number;
  orderCount: number;
};

export async function sendWeeklyEmailReport(input: WeeklyEmailReportInput): Promise<{ sent: boolean; provider: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL ?? "reports@sufretomi.jo";

  if (!apiKey) {
    console.info(`[Email] Skipping weekly email report for ${input.kitchenName} (${input.recipientEmail}): Email provider API key is not configured.`);
    return { sent: false, provider: "none-configured" };
  }

  try {
    // Example integration structure for Resend or SMTP REST API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: `Sufret Omi <${senderEmail}>`,
        to: [input.recipientEmail],
        subject: `تقرير سفرة أمي الأسبوعي - ${input.kitchenName}`,
        html: `
          <div style="font-family: Arial, sans-serif; direction: rtl; padding: 24px; color: #082E34;">
            <h2 style="color: #00AFC4;">تقرير الأداء الأسبوعي - سفرة أمي</h2>
            <p>مرحباً بكِ ${input.kitchenName}، إليكِ ملخص أداء مطبخك خلال الأسبوع الماضي:</p>
            <ul>
              <li>عدد الطلبات المكتملة: <strong>${input.orderCount}</strong></li>
              <li>إجمالي المبيعات: <strong>${input.grossSales.toFixed(2)} د.أ</strong></li>
              <li>عمولة المنصة (5%): <strong>${input.commission.toFixed(2)} د.أ</strong></li>
              <li>صافي المستحق لتحويله عبر CliQ: <strong>${input.netPayout.toFixed(2)} د.أ</strong></li>
            </ul>
            <p>شكراً لجهودك وتقديم ألذ الأطعمة البيتية الأردنية!</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Email] Failed to send weekly report email:", errorText);
      return { sent: false, provider: "resend-error" };
    }

    return { sent: true, provider: "resend" };
  } catch (error) {
    console.error("[Email] Error sending weekly email report:", error);
    return { sent: false, provider: "error" };
  }
}
