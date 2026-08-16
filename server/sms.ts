import { ENV } from "./_core/env";

type SmsLanguage = "ar" | "en";

type OrderConfirmationInput = {
  phone: string;
  orderCount: number;
  total: number;
  language: SmsLanguage;
};

function normalizeJordanPhone(phone: string) {
  const normalized = phone.replace(/[\s()-]/g, "");
  if (normalized.startsWith("+")) return normalized;
  if (normalized.startsWith("00962")) return `+${normalized.slice(2)}`;
  if (normalized.startsWith("07") && normalized.length === 10) return `+962${normalized.slice(1)}`;
  return normalized;
}

function buildBody(input: OrderConfirmationInput) {
  const total = input.total.toFixed(2);
  return input.language === "ar"
    ? `سفرة أمي: تم تأكيد ${input.orderCount} طلب. الإجمالي ${total} د.أ. يمكنك متابعة الطلب من التطبيق.`
    : `Sufret Omi: ${input.orderCount} order${input.orderCount === 1 ? "" : "s"} confirmed. Total JOD ${total}. Track it in the app.`;
}

export async function sendOrderConfirmationSms(input: OrderConfirmationInput) {
  const to = normalizeJordanPhone(input.phone);
  if (!to || to.length < 8) return { sent: false, configured: false, reason: "invalid_phone" as const };
  const body = buildBody(input);

  if (ENV.smsProviderUrl && ENV.smsApiKey) {
    const response = await fetch(ENV.smsProviderUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${ENV.smsApiKey}` },
      body: JSON.stringify({ to, from: ENV.smsFromNumber || undefined, body, message: body }),
    });
    if (!response.ok) throw new Error(`SMS provider returned ${response.status}`);
    return { sent: true, configured: true, provider: "rest" as const };
  }

  if (ENV.smsAccountSid && ENV.smsAuthToken && ENV.smsFromNumber) {
    const auth = Buffer.from(`${ENV.smsAccountSid}:${ENV.smsAuthToken}`).toString("base64");
    const form = new URLSearchParams({ To: to, From: ENV.smsFromNumber, Body: body });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ENV.smsAccountSid}/Messages.json`, {
      method: "POST",
      headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!response.ok) throw new Error(`Twilio returned ${response.status}`);
    return { sent: true, configured: true, provider: "twilio" as const };
  }

  return { sent: false, configured: false, reason: "provider_not_configured" as const };
}

export function isJordanPhone(phone: string) {
  const compact = phone.replace(/[\s()-]/g, "");
  const normalized = compact.startsWith("00962") ? `+${compact.slice(2)}` : compact.startsWith("0") ? `+962${compact.slice(1)}` : compact.startsWith("+") ? compact : `+962${compact}`;
  return /^\+9627\d{8}$/.test(normalized);
}
