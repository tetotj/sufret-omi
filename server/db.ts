import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, complaintsDb, complaintImages, userDocuments, userProfiles, users } from "../drizzle/schema";
import type { ComplaintStatus } from "../lib/complaint-data";
import type { UserAccountStatus } from "../lib/admin-data";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
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
        role: linkedProfile?.role ?? (user.role === "mother" ? "mother" : "customer"),
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
