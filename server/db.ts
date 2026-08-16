import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2/promise";
import { InsertUser, announcements, complaintsDb, complaintImages, favorites, offers, orders, pushTokens, userDocuments, userProfiles, users } from "../drizzle/schema";
import type { ComplaintStatus } from "../lib/complaint-data";
import type { UserAccountStatus } from "../lib/admin-data";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

// Lazily create one shared pool so every request reuses connections instead of opening a new connection.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const connectionLimit = Math.max(2, Math.min(Number(process.env.DB_POOL_SIZE ?? 10), 100));
      _pool = createPool({ uri: process.env.DATABASE_URL, connectionLimit, waitForConnections: true, queueLimit: 0, enableKeepAlive: true });
      _db = drizzle(_pool as never) as ReturnType<typeof drizzle>;
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _pool = null;
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export type LocalAccountRole = "customer" | "mother" | "driver";

/** The auth users table stores the platform role; business roles live in userProfiles. */
export function getLocalDatabaseRole(): "user" {
  return "user";
}

export async function upsertLocalUser(input: { phone: string; name?: string; role: LocalAccountRole }) {
  const normalizedPhone = input.phone.replace(/\D/g, "");
  if (normalizedPhone.length < 7) throw new Error("A valid phone number is required");

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const openId = `local:${normalizedPhone}`;
  const now = new Date();
  const existing = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  const profileId = `local-${normalizedPhone}`;
  const ensureProfile = async (userId: number, status: "active" | "pending_approval") => {
    const existingProfile = await db.select().from(userProfiles).where(eq(userProfiles.id, profileId)).limit(1);
    if (existingProfile[0]) {
      await db.update(userProfiles).set({ name: input.name?.trim() || existingProfile[0].name, phone: input.phone.trim() }).where(eq(userProfiles.id, profileId));
      return existingProfile[0];
    }
    await db.insert(userProfiles).values({
      id: profileId,
      userId,
      name: input.name?.trim() || `Sufret Omi ${normalizedPhone.slice(-4)}`,
      phone: input.phone.trim(),
      role: input.role,
      status,
      region: "Amman",
      details: JSON.stringify({ source: "local_phone" }),
      joinedDate: now.toISOString().slice(0, 10),
    });
    return undefined;
  };

  if (existing[0]) {
    await db.update(users).set({
      name: input.name?.trim() || existing[0].name,
      loginMethod: "local_phone",
      lastSignedIn: now,
    }).where(eq(users.id, existing[0].id));
    await ensureProfile(existing[0].id, existing[0].accountStatus === "active" ? "active" : "pending_approval");
    return { ...existing[0], lastSignedIn: now };
  }

  const accountStatus = input.role === "customer" ? "active" : "pending_approval";
  // The live users table is the platform-auth table and accepts only `user` or `admin`.
  // The customer/mother/driver business role is stored in userProfiles.role.
  const databaseRole = getLocalDatabaseRole();
  await db.insert(users).values({
    openId,
    name: input.name?.trim() || null,
    email: null,
    loginMethod: "local_phone",
    role: databaseRole,
    accountStatus,
    lastSignedIn: now,
  });
  const created = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (created[0]) await ensureProfile(created[0].id, accountStatus);
  return created[0];
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export type AdminUserRecord = {
  id: string;
  userId: number | null;
  name: string;
  phone: string;
  role: "customer" | "mother" | "driver";
  status: UserAccountStatus;
  region: string;
  details?: Record<string, string>;
  rating?: number;
  ordersCount: number;
  joinedDate: string;
  documents: Array<{ label: { ar: string; en: string }; uri: string }>;
};

export type FavoriteEntityType = "meal" | "kitchen";

export async function listFavoriteIds(userId: number, entityType?: FavoriteEntityType): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ entityId: favorites.entityId }).from(favorites).where(entityType ? and(eq(favorites.userId, userId), eq(favorites.entityType, entityType)) : eq(favorites.userId, userId));
  return rows.map((row) => row.entityId);
}

export async function toggleFavorite(userId: number, entityType: FavoriteEntityType, entityId: string): Promise<{ isFavorite: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select({ id: favorites.id }).from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.entityType, entityType), eq(favorites.entityId, entityId))).limit(1);
  if (existing[0]) {
    await db.delete(favorites).where(eq(favorites.id, existing[0].id));
    return { isFavorite: false };
  }
  await db.insert(favorites).values({ userId, entityType, entityId });
  return { isFavorite: true };
}

export async function getFinancialAnalytics(days = 30) {
  const db = await getDb();
  if (!db) return { days, grossSales: 0, platformCommission: 0, kitchenPayouts: 0, orderCount: 0, deliveredOrderCount: 0, daily: [], kitchens: [] };
  const start = new Date(Date.now() - Math.max(1, Math.min(days, 365)) * 24 * 60 * 60 * 1000);
  const [summaryRows, dailyRows, kitchenRows] = await Promise.all([
    db.select({
      grossSales: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
      orderCount: sql<number>`COUNT(*)`,
      deliveredOrderCount: sql<number>`SUM(CASE WHEN ${orders.status} = 'delivered' THEN 1 ELSE 0 END)`,
    }).from(orders).where(gte(orders.createdAt, start)),
    db.select({
      day: sql<string>`DATE(${orders.createdAt})`,
      grossSales: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
      orderCount: sql<number>`COUNT(*)`,
    }).from(orders).where(gte(orders.createdAt, start)).groupBy(sql`DATE(${orders.createdAt})`).orderBy(sql`DATE(${orders.createdAt})`),
    db.select({
      kitchenId: orders.kitchenId,
      grossSales: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
      orderCount: sql<number>`COUNT(*)`,
    }).from(orders).where(gte(orders.createdAt, start)).groupBy(orders.kitchenId).orderBy(desc(sql`SUM(${orders.total})`)),
  ]);
  const grossSales = Number(summaryRows[0]?.grossSales ?? 0);
  const platformCommission = grossSales * 0.05;
  return {
    days,
    grossSales,
    platformCommission,
    kitchenPayouts: grossSales - platformCommission,
    orderCount: Number(summaryRows[0]?.orderCount ?? 0),
    deliveredOrderCount: Number(summaryRows[0]?.deliveredOrderCount ?? 0),
    daily: dailyRows.map((row) => ({ day: row.day, grossSales: Number(row.grossSales ?? 0), orderCount: Number(row.orderCount ?? 0) })),
    kitchens: kitchenRows.map((row) => ({ kitchenId: row.kitchenId, grossSales: Number(row.grossSales ?? 0), platformCommission: Number(row.grossSales ?? 0) * 0.05, orderCount: Number(row.orderCount ?? 0) })),
  };
}

export async function listUserProfiles(): Promise<AdminUserRecord[]> {
  const db = await getDb();
  if (!db) return [];
  const [profiles, documents, authUsers] = await Promise.all([
    db.select().from(userProfiles),
    db.select().from(userDocuments),
    db.select().from(users),
  ]);
  const docsByProfile = new Map<string, AdminUserRecord["documents"]>();
  for (const document of documents) {
    const list = docsByProfile.get(document.userProfileId) ?? [];
    list.push({ label: { ar: document.labelAr, en: document.labelEn }, uri: document.uri });
    docsByProfile.set(document.userProfileId, list);
  }
  const profileRecords = profiles.map((profile) => {
    let details: Record<string, string> | undefined;
    if (profile.details) {
      try { details = JSON.parse(profile.details) as Record<string, string>; } catch { details = undefined; }
    }
    return {
      id: profile.id,
      userId: profile.userId,
      name: profile.name,
      phone: profile.phone,
      role: profile.role,
      status: profile.status,
      region: profile.region,
      details,
      rating: profile.rating ? Number(profile.rating) : undefined,
      ordersCount: profile.ordersCount,
      joinedDate: profile.joinedDate,
      documents: docsByProfile.get(profile.id) ?? [],
    };
  });
  const linkedAuthUserIds = new Set(profiles.map((profile) => profile.userId).filter((value): value is number => typeof value === "number"));
  const authRecords: AdminUserRecord[] = authUsers
    .filter((user) => user.role !== "admin")
    .map((user) => {
      const linkedProfile = profiles.find((profile) => profile.userId === user.id);
      return {
        id: linkedProfile?.id ?? `AUTH-${user.id}`,
        userId: user.id,
        name: linkedProfile?.name ?? user.name ?? "Sufret Omi user",
        phone: linkedProfile?.phone ?? user.email ?? "—",
        role: linkedProfile?.role ?? "customer",
        status: linkedProfile?.status ?? user.accountStatus,
        region: linkedProfile?.region ?? "—",
        details: linkedProfile?.details ? (() => { try { return JSON.parse(linkedProfile.details) as Record<string, string>; } catch { return undefined; } })() : undefined,
        rating: linkedProfile?.rating ? Number(linkedProfile.rating) : undefined,
        ordersCount: linkedProfile?.ordersCount ?? 0,
        joinedDate: linkedProfile?.joinedDate ?? user.createdAt.toISOString().slice(0, 10),
        documents: linkedProfile ? docsByProfile.get(linkedProfile.id) ?? [] : [],
      };
    });
  const unlinkedProfiles = profileRecords.filter((profile) => profile.userId === null || !linkedAuthUserIds.has(profile.userId));
  return [...authRecords, ...unlinkedProfiles];
}

export async function updateUserProfileStatus(id: string, status: UserAccountStatus): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (id.startsWith("AUTH-")) {
    const userId = Number(id.slice("AUTH-".length));
    if (Number.isInteger(userId)) {
      await db.update(users).set({ accountStatus: status }).where(eq(users.id, userId));
      return;
    }
  }
  const profile = await db.select({ userId: userProfiles.userId }).from(userProfiles).where(eq(userProfiles.id, id)).limit(1);
  if (profile[0]?.userId) {
    await db.update(users).set({ accountStatus: status }).where(eq(users.id, profile[0].userId));
  }
  await db.update(userProfiles).set({ status }).where(eq(userProfiles.id, id));
}

export type ComplaintRecord = {
  id: string;
  category: string;
  subject: string;
  description: string;
  customerId?: number;
  orderId?: string;
  status: ComplaintStatus;
  response?: string;
  imageUris: string[];
  createdAt: string;
};

export async function listComplaintRecords(customerId?: number): Promise<ComplaintRecord[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = customerId === undefined
    ? await db.select().from(complaintsDb).orderBy(desc(complaintsDb.createdAt))
    : await db.select().from(complaintsDb).where(eq(complaintsDb.customerId, customerId)).orderBy(desc(complaintsDb.createdAt));
  const images = await db.select().from(complaintImages);
  const imagesByComplaint = new Map<string, string[]>();
  for (const image of images) imagesByComplaint.set(image.complaintId, [...(imagesByComplaint.get(image.complaintId) ?? []), image.uri]);
  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    subject: row.subject,
    description: row.description,
    customerId: row.customerId ?? undefined,
    orderId: row.orderId ?? undefined,
    status: row.status,
    response: row.response ?? undefined,
    imageUris: imagesByComplaint.get(row.id) ?? [],
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createComplaintRecord(input: { id: string; category: string; subject: string; description: string; customerId?: number; orderId?: string; imageUris: string[] }): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(complaintsDb).values({ id: input.id, category: input.category, subject: input.subject, description: input.description, customerId: input.customerId ?? null, orderId: input.orderId ?? null, status: "new" });
  if (input.imageUris.length) await db.insert(complaintImages).values(input.imageUris.map((uri) => ({ complaintId: input.id, uri })));
}

export async function updateComplaintRecord(id: string, status: ComplaintStatus, response?: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(complaintsDb).set({ status, response: response?.trim() || null }).where(eq(complaintsDb.id, id));
}

export type AnnouncementRecord = {
  id: string;
  eyebrowAr: string;
  eyebrowEn: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  ctaAr: string;
  ctaEn: string;
  icon: string;
  target: "meals" | "orders";
  sortOrder: number;
  isActive: boolean;
  startsAt?: string;
  endsAt?: string;
  imageUrl?: string | null;
};

export type OfferRecord = {
  id: string;
  mealId: string;
  badgeAr: string;
  badgeEn: string;
  discountPercent?: number;
  sortOrder: number;
  isActive: boolean;
  startsAt?: string;
  endsAt?: string;
  imageUrl?: string | null;
}

function isPublished(row: { isActive: boolean; startsAt: Date | null; endsAt: Date | null }) {
  const now = Date.now();
  return row.isActive && (!row.startsAt || row.startsAt.getTime() <= now) && (!row.endsAt || row.endsAt.getTime() >= now);
}

const MARKETING_CACHE_TTL_MS = 15_000;
let activeAnnouncementsCache: { expiresAt: number; value: AnnouncementRecord[] } | null = null;
let activeOffersCache: { expiresAt: number; value: OfferRecord[] } | null = null;
function clearMarketingCache() {
  activeAnnouncementsCache = null;
  activeOffersCache = null;
}

function toAnnouncementRecord(row: typeof announcements.$inferSelect): AnnouncementRecord {
  return {
    id: row.id,
    eyebrowAr: row.eyebrowAr,
    eyebrowEn: row.eyebrowEn,
    titleAr: row.titleAr,
    titleEn: row.titleEn,
    bodyAr: row.bodyAr,
    bodyEn: row.bodyEn,
    ctaAr: row.ctaAr,
    ctaEn: row.ctaEn,
    icon: row.icon,
    target: row.target,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    startsAt: row.startsAt?.toISOString(),
    endsAt: row.endsAt?.toISOString(),
    imageUrl: row.imageUrl ?? undefined,
  };
}

function toOfferRecord(row: typeof offers.$inferSelect): OfferRecord {
  return {
    id: row.id,
    mealId: row.mealId,
    badgeAr: row.badgeAr,
    badgeEn: row.badgeEn,
    discountPercent: row.discountPercent === null ? undefined : Number(row.discountPercent),
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    startsAt: row.startsAt?.toISOString(),
    endsAt: row.endsAt?.toISOString(),
    imageUrl: row.imageUrl ?? undefined,
  };
}

export async function listActiveAnnouncements(): Promise<AnnouncementRecord[]> {
  if (activeAnnouncementsCache && activeAnnouncementsCache.expiresAt > Date.now()) return activeAnnouncementsCache.value;
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const rows = await db.select().from(announcements).where(and(eq(announcements.isActive, true), or(isNull(announcements.startsAt), lte(announcements.startsAt, now)), or(isNull(announcements.endsAt), gte(announcements.endsAt, now)))).orderBy(announcements.sortOrder);
  const value = rows.filter(isPublished).map(toAnnouncementRecord);
  activeAnnouncementsCache = { expiresAt: Date.now() + MARKETING_CACHE_TTL_MS, value };
  return value;
}

export async function listAllAnnouncements(): Promise<AnnouncementRecord[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(announcements).orderBy(announcements.sortOrder);
  return rows.map(toAnnouncementRecord);
}

export async function createAnnouncementRecord(input: Omit<AnnouncementRecord, "startsAt" | "endsAt"> & { startsAt?: Date | null; endsAt?: Date | null }): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  clearMarketingCache();
  await db.insert(announcements).values({
    id: input.id,
    eyebrowAr: input.eyebrowAr,
    eyebrowEn: input.eyebrowEn,
    titleAr: input.titleAr,
    titleEn: input.titleEn,
    bodyAr: input.bodyAr,
    bodyEn: input.bodyEn,
    ctaAr: input.ctaAr,
    ctaEn: input.ctaEn,
    icon: input.icon,
    target: input.target,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    imageUrl: input.imageUrl ?? null,
  });
}

export async function updateAnnouncementRecord(id: string, patch: Partial<Omit<AnnouncementRecord, "id" | "startsAt" | "endsAt">> & { startsAt?: Date | null; endsAt?: Date | null }): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  clearMarketingCache();
  await db.update(announcements).set(patch).where(eq(announcements.id, id));
}

export async function deleteAnnouncementRecord(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  clearMarketingCache();
  await db.delete(announcements).where(eq(announcements.id, id));
}

export async function listActiveOffers(): Promise<OfferRecord[]> {
  if (activeOffersCache && activeOffersCache.expiresAt > Date.now()) return activeOffersCache.value;
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const rows = await db.select().from(offers).where(and(eq(offers.isActive, true), or(isNull(offers.startsAt), lte(offers.startsAt, now)), or(isNull(offers.endsAt), gte(offers.endsAt, now)))).orderBy(offers.sortOrder);
  const value = rows.filter(isPublished).map(toOfferRecord);
  activeOffersCache = { expiresAt: Date.now() + MARKETING_CACHE_TTL_MS, value };
  return value;
}

export async function listAllOffers(): Promise<OfferRecord[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(offers).orderBy(offers.sortOrder);
  return rows.map(toOfferRecord);
}

export async function createOfferRecord(input: Omit<OfferRecord, "startsAt" | "endsAt" | "discountPercent"> & { discountPercent?: number | null; startsAt?: Date | null; endsAt?: Date | null }): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  clearMarketingCache();
  await db.insert(offers).values({
    id: input.id,
    mealId: input.mealId,
    badgeAr: input.badgeAr,
    badgeEn: input.badgeEn,
    discountPercent: input.discountPercent === undefined || input.discountPercent === null ? null : String(input.discountPercent),
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    imageUrl: input.imageUrl ?? null,
  });
}

export async function updateOfferRecord(id: string, patch: Partial<Omit<OfferRecord, "id" | "startsAt" | "endsAt" | "discountPercent">> & { discountPercent?: number | null; startsAt?: Date | null; endsAt?: Date | null }): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const { discountPercent, ...rest } = patch;
  const dbPatch = { ...rest, ...(discountPercent !== undefined ? { discountPercent: discountPercent === null ? null : String(discountPercent) } : {}) };
  clearMarketingCache();
  await db.update(offers).set(dbPatch).where(eq(offers.id, id));
}

export async function deleteOfferRecord(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  clearMarketingCache();
  await db.delete(offers).where(eq(offers.id, id));
}

export async function registerPushToken(userId: number, token: string, platform: "ios" | "android" | "web"): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(pushTokens).values({ userId, token, platform, isActive: true, lastSeenAt: new Date() }).onDuplicateKeyUpdate({ set: { userId, platform, isActive: true, lastSeenAt: new Date() } });
}

export async function listActivePushTokens(): Promise<Array<{ token: string }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.isActive, true));
  return rows as Array<{ token: string }>;
}

export async function deactivatePushToken(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(pushTokens).set({ isActive: false }).where(eq(pushTokens.token, token));
}

export type DueMarketingNotification = { kind: "announcement" | "offer"; id: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string };

export async function claimDueMarketingNotifications(): Promise<DueMarketingNotification[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const dueAnnouncements = await db.select().from(announcements).where(and(eq(announcements.isActive, true), isNull(announcements.notificationSentAt), or(isNull(announcements.startsAt), lte(announcements.startsAt, now)), or(isNull(announcements.endsAt), gte(announcements.endsAt, now))));
  const dueOffers = await db.select().from(offers).where(and(eq(offers.isActive, true), isNull(offers.notificationSentAt), or(isNull(offers.startsAt), lte(offers.startsAt, now)), or(isNull(offers.endsAt), gte(offers.endsAt, now))));
  const claimed: DueMarketingNotification[] = [];
  for (const item of dueAnnouncements) {
    const updateResult = await db.update(announcements).set({ notificationSentAt: now }).where(and(eq(announcements.id, item.id), isNull(announcements.notificationSentAt)));
    if ((updateResult as { affectedRows?: number }).affectedRows !== 0) claimed.push({ kind: "announcement", id: item.id, titleAr: item.titleAr, titleEn: item.titleEn, bodyAr: item.bodyAr, bodyEn: item.bodyEn });
  }
  for (const item of dueOffers) {
    const updateResult = await db.update(offers).set({ notificationSentAt: now }).where(and(eq(offers.id, item.id), isNull(offers.notificationSentAt)));
    if ((updateResult as { affectedRows?: number }).affectedRows !== 0) claimed.push({ kind: "offer", id: item.id, titleAr: item.badgeAr, titleEn: item.badgeEn, bodyAr: "عرض جديد من سفرة أمي متاح الآن", bodyEn: "A new Sufret Omi offer is available now" });
  }
  return claimed;
}
