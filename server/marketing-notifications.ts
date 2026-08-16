import { deactivatePushToken, listActivePushTokens, listActivePushTokensForUser } from "./db";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;
const MAX_CONCURRENT_CHUNKS = 4;

export type PushNotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

type ExpoTicket = {
  status: "ok" | "error";
  details?: { error?: string };
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function sendChunk(tokenChunk: Array<{ token: string }>, notification: PushNotificationPayload) {
  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(tokenChunk.map(({ token }) => ({ to: token, title: notification.title, body: notification.body, data: notification.data, sound: "default" }))),
  });
  if (!response.ok) throw new Error(`Expo push request failed with ${response.status}`);
  const result = await response.json() as { data?: ExpoTicket[] };
  let accepted = 0;
  let deactivated = 0;
  for (let index = 0; index < tokenChunk.length; index += 1) {
    const ticket = result.data?.[index];
    if (ticket?.status === "ok") accepted += 1;
    if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
      await deactivatePushToken(tokenChunk[index].token);
      deactivated += 1;
    }
  }
  return { attempted: tokenChunk.length, accepted, deactivated };
}

async function sendToTokens(tokens: Array<{ token: string }>, notification: PushNotificationPayload): Promise<{ attempted: number; accepted: number; deactivated: number }> {
  if (tokens.length === 0) return { attempted: 0, accepted: 0, deactivated: 0 };
  let accepted = 0;
  let deactivated = 0;
  const tokenChunks = chunk(tokens, CHUNK_SIZE);
  for (let index = 0; index < tokenChunks.length; index += MAX_CONCURRENT_CHUNKS) {
    const results = await Promise.all(tokenChunks.slice(index, index + MAX_CONCURRENT_CHUNKS).map((tokenChunk) => sendChunk(tokenChunk, notification)));
    for (const result of results) {
      accepted += result.accepted;
      deactivated += result.deactivated;
    }
  }
  return { attempted: tokens.length, accepted, deactivated };
}

export async function sendPushNotificationToUser(userId: number, notification: PushNotificationPayload): Promise<{ attempted: number; accepted: number; deactivated: number }> {
  return sendToTokens(await listActivePushTokensForUser(userId), notification);
}

export async function sendMarketingNotification(notification: PushNotificationPayload): Promise<{ attempted: number; accepted: number; deactivated: number }> {
  const tokens = await listActivePushTokens();
  return sendToTokens(tokens, notification);
}

export function isExpoPushToken(token: string): boolean {
  return /^(?:Exponent|Expo)PushToken\[[^\]]+\]$/.test(token.trim());
}
