import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2/promise";
import { InsertUser, adminAuditLogs, announcements, complaintsDb, complaintImages, driverLocations, favorites, kitchens, meals, offers, orderActionRequests, orderMessages, orders, pushTokens, userDocuments, userProfiles, users } from "../drizzle/schema";
import type { ComplaintStatus } from "../lib/complaint-data";
import type { UserAccountStatus } from "../lib/admin-data";
import { ENV } from "./_core/env";
import { sendPushNotificationToUser } from "./marketing-notifications";
import { shouldNotifyFailedAdminLogin } from "../lib/admin-audit";

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
  const ensureProfile = async (userId: number, requestedStatus: "active" | "pending_approval") => {
    const existingProfile = await db.select().from(userProfiles).where(eq(userProfiles.id, profileId)).limit(1);
    if (existingProfile[0]) {
      const nextStatus = existingProfile[0].role === input.role ? existingProfile[0].status : requestedStatus;
      await db.update(userProfiles).set({ name: input.name?.trim() || existingProfile[0].name, phone: input.phone.trim(), role: input.role, status: nextStatus }).where(eq(userProfiles.id, profileId));
      return { ...existingProfile[0], role: input.role, status: nextStatus };
    }
    const profile = {
      id: profileId,
      userId,
      name: input.name?.trim() || `Sufret Omi ${normalizedPhone.slice(-4)}`,
      phone: input.phone.trim(),
      role: input.role,
      status: requestedStatus,
      region: "Amman",
      details: JSON.stringify({ source: "local_phone" }),
      joinedDate: now.toISOString().slice(0, 10),
    } as const;
    await db.insert(userProfiles).values(profile);
    return profile;
  };

  if (existing[0]) {
    await db.update(users).set({
      name: input.name?.trim() || existing[0].name,
      loginMethod: "local_phone",
      lastSignedIn: now,
    }).where(eq(users.id, existing[0].id));
    const existingProfile = await db.select().from(userProfiles).where(eq(userProfiles.id, profileId)).limit(1);
    const requestedStatus = input.role === "customer" ? "active" : existingProfile[0]?.role === input.role ? (existingProfile[0].status === "active" ? "active" : "pending_approval") : "pending_approval";
    const profile = await ensureProfile(existing[0].id, requestedStatus);
    return { ...existing[0], lastSignedIn: now, accountStatus: profile?.status === "active" ? "active" : "pending_approval", businessRole: profile?.role ?? input.role };
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
  const profile = created[0] ? await ensureProfile(created[0].id, accountStatus) : undefined;
  return created[0] ? { ...created[0], accountStatus: profile?.status === "active" ? "active" : "pending_approval", businessRole: profile?.role ?? input.role } : created[0];
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

export type KitchenDescriptionApprovalStatus = "pending" | "approved" | "rejected";

export type KitchenDescriptionRecord = {
  kitchenId: string;
  descriptionAr: string;
  descriptionEn: string;
  showDescription: boolean;
  descriptionApprovalStatus: KitchenDescriptionApprovalStatus;
};

export type PendingKitchenDescription = KitchenDescriptionRecord & {
  kitchenNameAr: string;
  kitchenNameEn: string;
  motherNameAr: string;
  motherNameEn: string;
};

export type MealApprovalStatus = "pending" | "approved" | "rejected";

export type PendingMealApproval = {
  mealId: string;
  kitchenId: string;
  nameAr: string;
  nameEn: string;
  category: string;
  price: string;
  approvalStatus: MealApprovalStatus;
};

export async function getKitchenDescription(kitchenId: string): Promise<KitchenDescriptionRecord | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ kitchenId: kitchens.id, descriptionAr: kitchens.descriptionAr, descriptionEn: kitchens.descriptionEn, showDescription: kitchens.showDescription, descriptionApprovalStatus: kitchens.descriptionApprovalStatus }).from(kitchens).where(eq(kitchens.id, kitchenId)).limit(1);
  return rows[0] ?? null;
}

export async function updateKitchenDescription(userId: number, kitchenId: string, input: { descriptionAr: string; descriptionEn: string; showDescription: boolean }): Promise<KitchenDescriptionRecord> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const owner = await db.select({ userId: kitchens.userId }).from(kitchens).where(eq(kitchens.id, kitchenId)).limit(1);
  if (!owner[0] || owner[0].userId !== userId) throw new Error("Kitchen description access denied");
  const descriptionAr = input.descriptionAr.trim();
  const descriptionEn = input.descriptionEn.trim();
  const descriptionApprovalStatus: KitchenDescriptionApprovalStatus = input.showDescription ? "pending" : "approved";
  await db.update(kitchens).set({ descriptionAr, descriptionEn, showDescription: input.showDescription && descriptionApprovalStatus === "approved", descriptionApprovalStatus }).where(and(eq(kitchens.id, kitchenId), eq(kitchens.userId, userId)));
  return { kitchenId, descriptionAr, descriptionEn, showDescription: input.showDescription && descriptionApprovalStatus === "approved", descriptionApprovalStatus };
}

export async function listPendingKitchenDescriptions(): Promise<PendingKitchenDescription[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select({ kitchenId: kitchens.id, descriptionAr: kitchens.descriptionAr, descriptionEn: kitchens.descriptionEn, showDescription: kitchens.showDescription, descriptionApprovalStatus: kitchens.descriptionApprovalStatus, kitchenNameAr: kitchens.nameAr, kitchenNameEn: kitchens.nameEn, motherNameAr: kitchens.motherNameAr, motherNameEn: kitchens.motherNameEn }).from(kitchens).where(eq(kitchens.descriptionApprovalStatus, "pending"));
}

export async function decideKitchenDescription(kitchenId: string, status: KitchenDescriptionApprovalStatus): Promise<KitchenDescriptionRecord> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const showDescription = status === "approved";
  await db.update(kitchens).set({ descriptionApprovalStatus: status, showDescription }).where(eq(kitchens.id, kitchenId));
  const updated = await getKitchenDescription(kitchenId);
  if (!updated) throw new Error("Kitchen description not found");
  return updated;
}

export async function listPendingMealApprovals(): Promise<PendingMealApproval[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select({ mealId: meals.id, kitchenId: meals.kitchenId, nameAr: meals.nameAr, nameEn: meals.nameEn, category: meals.category, price: meals.price, approvalStatus: meals.approvalStatus }).from(meals).where(eq(meals.approvalStatus, "pending"));
}

export type CreateMealInput = {
  kitchenId: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  category: "mansaf" | "maqluba" | "mahshi" | "bakery" | "moona" | "desserts" | "dairy" | "cheese";
  price: string;
  prepMinutes: number;
  dailyLimit: number;
  image: string;
};

export async function createMealRecord(userId: number, input: CreateMealInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const owner = await db.select({ id: kitchens.id, userId: kitchens.userId }).from(kitchens).where(eq(kitchens.id, input.kitchenId)).limit(1);
  if (!owner[0] || owner[0].userId !== userId) throw new Error("Kitchen access denied");
  const mealId = `meal-${Date.now()}`;
  await db.insert(meals).values({
    id: mealId,
    kitchenId: input.kitchenId,
    nameAr: input.nameAr,
    nameEn: input.nameEn,
    descriptionAr: input.descriptionAr,
    descriptionEn: input.descriptionEn,
    category: input.category,
    price: input.price,
    prepMinutes: input.prepMinutes,
    dailyLimit: input.dailyLimit,
    available: false,
    approvalStatus: "pending",
    image: input.image,
  });
  return { mealId, status: "pending" as const };
}

export async function decideMealApproval(mealId: string, status: MealApprovalStatus): Promise<PendingMealApproval | null> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(meals).set({ approvalStatus: status, available: status === "approved" }).where(eq(meals.id, mealId));
  const updated = await db.select({ mealId: meals.id, kitchenId: meals.kitchenId, nameAr: meals.nameAr, nameEn: meals.nameEn, category: meals.category, price: meals.price, approvalStatus: meals.approvalStatus }).from(meals).where(eq(meals.id, mealId)).limit(1);
  const row = updated[0];
  if (row) {
    const kitchenOwner = await db.select({ userId: kitchens.userId, nameAr: kitchens.nameAr, nameEn: kitchens.nameEn }).from(kitchens).leftJoin(users, eq(kitchens.userId, users.id)).where(eq(kitchens.id, row.kitchenId)).limit(1);
    if (kitchenOwner[0]?.userId) {
      await sendPushNotificationToUser(kitchenOwner[0].userId, {
        title: status === "approved" ? "تم اعتماد طبختك ونشرها!" : "تحديث بخصوص طبختك",
        body: status === "approved" ? `تم اعتماد ونشر ${row.nameAr} في سفرة أمي` : `نأسف، لم يتم اعتماد ${row.nameAr}. يجدر مراجعة الشروط.`,
        data: { type: "meal_approval", mealId, status },
      }).catch(() => undefined);
    }
  }
  return row ?? null;
}

async function getOrderParticipant(orderId: string, userId: number) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ customerId: orders.customerId, driverId: orders.driverId, kitchenUserId: kitchens.userId }).from(orders).leftJoin(kitchens, eq(orders.kitchenId, kitchens.id)).where(eq(orders.id, orderId)).limit(1);
  const order = rows[0];
  return Boolean(order && (order.customerId === userId || order.driverId === userId || order.kitchenUserId === userId));
}

export async function listOrderMessages(orderId: string, userId: number) {
  if (!(await getOrderParticipant(orderId, userId))) throw new Error("Order chat access denied");
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderMessages).where(eq(orderMessages.orderId, orderId)).orderBy(orderMessages.createdAt);
}

export async function recordDriverLocation(input: { orderId: string; driverId: number; latitude: number; longitude: number; accuracy?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const assigned = await db.select({ driverId: orders.driverId, status: orders.status }).from(orders).where(eq(orders.id, input.orderId)).limit(1);
  const order = assigned[0];
  if (!order || order.driverId !== input.driverId) throw new Error("Driver location access denied");
  if (order.status === "delivered") return { stored: false, reason: "order-complete" as const };
  await db.insert(driverLocations).values({ orderId: input.orderId, driverId: input.driverId, latitude: input.latitude.toFixed(7), longitude: input.longitude.toFixed(7), accuracy: typeof input.accuracy === "number" ? input.accuracy.toFixed(2) : null });
  return { stored: true };
}

export async function getLatestDriverLocation(orderId: string, userId: number) {
  if (!(await getOrderParticipant(orderId, userId))) throw new Error("Order location access denied");
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(driverLocations).where(eq(driverLocations.orderId, orderId)).orderBy(desc(driverLocations.capturedAt)).limit(1);
  const latest = rows[0];
  if (!latest) return null;
  return { latitude: Number(latest.latitude), longitude: Number(latest.longitude), accuracy: latest.accuracy === null ? undefined : Number(latest.accuracy), capturedAt: latest.capturedAt.toISOString() };
}

export type PersistedOrderStatus = "received" | "preparing" | "ready" | "on_the_way" | "delivered";
export type OrderActionRequestType = "cancellation_requested" | "replacement_requested";

export function canRequestOrderAction(status: PersistedOrderStatus, action: OrderActionRequestType) {
  return action === "cancellation_requested" ? status === "received" || status === "preparing" : status === "on_the_way" || status === "delivered";
}

export async function createOrderActionRequest(input: { orderId: string; customerId: number; action: OrderActionRequestType; note?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select({ customerId: orders.customerId, status: orders.status }).from(orders).where(eq(orders.id, input.orderId)).limit(1);
  const order = rows[0];
  if (!order || order.customerId !== input.customerId) throw new Error("Order action access denied");
  if (!canRequestOrderAction(order.status, input.action)) throw new Error("This order action is not available at the current status");
  const pending = await db
    .select({ id: orderActionRequests.id })
    .from(orderActionRequests)
    .where(and(
      eq(orderActionRequests.orderId, input.orderId),
      eq(orderActionRequests.customerId, input.customerId),
      eq(orderActionRequests.action, input.action),
      eq(orderActionRequests.status, "pending"),
    ))
    .limit(1);
  if (pending[0]) return { id: pending[0].id, duplicate: true };
  const result = await db.insert(orderActionRequests).values({ orderId: input.orderId, customerId: input.customerId, action: input.action, note: input.note?.trim() || null });
  return { id: Number((result as unknown as { insertId: number }).insertId), duplicate: false };
}

export async function listOrderActionRequests(orderId: string, customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderActionRequests).where(and(eq(orderActionRequests.orderId, orderId), eq(orderActionRequests.customerId, customerId))).orderBy(desc(orderActionRequests.createdAt));
}

export function normalizeOrderMessageBody(value: string) {
  const body = value.trim();
  if (!body) throw new Error("Message body is required");
  if (body.length > 500) throw new Error("Message body is too long");
  return body;
}

export async function createOrderMessage(input: { orderId: string; senderId: number; senderRole: "customer" | "mother" | "driver"; senderName: string; body: string }) {
  const body = normalizeOrderMessageBody(input.body);
  if (!(await getOrderParticipant(input.orderId, input.senderId))) throw new Error("Order chat access denied");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(orderMessages).values({ ...input, body });
  const insertId = Number((result as unknown as { insertId?: number }).insertId ?? 0);
  return { id: insertId, ...input, body, createdAt: new Date() };
}

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

export async function listActivePushTokensForUser(userId: number): Promise<Array<{ token: string }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ token: pushTokens.token }).from(pushTokens).where(and(eq(pushTokens.userId, userId), eq(pushTokens.isActive, true)));
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

export async function generateWeeklyKitchenReports() {
  const analytics = await getFinancialAnalytics(7);
  return {
    generatedAt: new Date().toISOString(),
    periodDays: 7,
    grossSales: analytics.grossSales,
    platformCommission: analytics.platformCommission,
    kitchenPayouts: analytics.kitchenPayouts,
    orderCount: analytics.orderCount,
    deliveredOrderCount: analytics.deliveredOrderCount,
    kitchens: analytics.kitchens,
  };
}

export async function listWeeklyReportRecipients() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ kitchenId: kitchens.id, kitchenName: kitchens.nameAr, email: users.email }).from(kitchens).leftJoin(users, eq(kitchens.userId, users.id));
  return rows.filter((row): row is { kitchenId: string; kitchenName: string; email: string } => Boolean(row.email));
}

let lastFailedAdminLoginAlertAt = 0;

export async function recordFailedAdminLogin(reason: "invalid_code" | "locked", language: "ar" | "en"): Promise<void> {
  await recordAuditLog(null, "Failed admin login", JSON.stringify({ reason, source: "admin_login" }));
  const now = Date.now();
  if (!shouldNotifyFailedAdminLogin(lastFailedAdminLoginAlertAt, now)) return;
  lastFailedAdminLoginAlertAt = now;
  const db = await getDb();
  if (!db) return;
  const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.accountStatus, "active")));
  await Promise.all(admins.map((admin) => sendPushNotificationToUser(admin.id, {
    title: language === "ar" ? "محاولة دخول فاشلة للوحة الإدارة" : "Failed admin login attempt",
    body: language === "ar" ? "تم رصد محاولة دخول غير ناجحة. لا يتم حفظ الرمز السري." : "An unsuccessful sign-in was detected. No secret code was stored.",
    data: { type: "admin_login_failure", reason },
  })));
}

export async function recordAuditLog(adminId: number | null, action: string, details?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(adminAuditLogs).values({ adminId: adminId ?? null, action, details: details?.trim() || null });
  } catch (err) {
    console.warn("[AuditLog] Failed to record:", err);
  }
}

export async function listAuditLogs(limit = 100): Promise<Array<{ id: number; adminId: number | null; action: string; details: string | null; createdAt: string }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(limit);
  return rows.map((r) => ({ id: r.id, adminId: r.adminId, action: r.action, details: r.details, createdAt: r.createdAt.toISOString() }));
}
