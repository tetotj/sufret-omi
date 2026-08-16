import { mysqlTable, int, varchar, text, timestamp, mysqlEnum, decimal, boolean, index, uniqueIndex } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  // Platform auth role: business roles are stored in userProfiles.role.
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  accountStatus: mysqlEnum("accountStatus", ["active", "pending_approval", "suspended", "rejected"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => ({
  accountStatusIdx: index("users_account_status_idx").on(table.accountStatus),
  lastSignedInIdx: index("users_last_signed_in_idx").on(table.lastSignedIn),
}));

export const kitchens = mysqlTable("kitchens", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  nameAr: text("nameAr").notNull(),
  nameEn: text("nameEn").notNull(),
  motherNameAr: text("motherNameAr").notNull(),
  motherNameEn: text("motherNameEn").notNull(),
  region: mysqlEnum("region", ["amman", "irbid", "zarqa", "salt", "madaba"]).notNull(),
  neighborhoodAr: text("neighborhoodAr").notNull(),
  neighborhoodEn: text("neighborhoodEn").notNull(),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("5.00").notNull(),
  reviewCount: int("reviewCount").default(0).notNull(),
  isOpen: boolean("isOpen").default(true).notNull(),
  image: text("image").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("kitchens_user_idx").on(table.userId),
  regionOpenIdx: index("kitchens_region_open_idx").on(table.region, table.isOpen),
}));

export const meals = mysqlTable("meals", {
  id: varchar("id", { length: 64 }).primaryKey(),
  kitchenId: varchar("kitchenId", { length: 64 }).notNull(),
  nameAr: text("nameAr").notNull(),
  nameEn: text("nameEn").notNull(),
  descriptionAr: text("descriptionAr").notNull(),
  descriptionEn: text("descriptionEn").notNull(),
  category: mysqlEnum("category", ["mansaf", "maqluba", "mahshi", "bakery", "moona"]).notNull(),
  price: decimal("price", { precision: 6, scale: 2 }).notNull(),
  prepMinutes: int("prepMinutes").notNull(),
  dailyLimit: int("dailyLimit").notNull(),
  available: boolean("available").default(true).notNull(),
  image: text("image").notNull(),
}, (table) => ({
  kitchenAvailableIdx: index("meals_kitchen_available_idx").on(table.kitchenId, table.available),
  categoryPriceIdx: index("meals_category_price_idx").on(table.category, table.price),
}));

export const orders = mysqlTable("orders", {
  id: varchar("id", { length: 64 }).primaryKey(),
  customerId: int("customerId").notNull(),
  kitchenId: varchar("kitchenId", { length: 64 }).notNull(),
  total: decimal("total", { precision: 8, scale: 2 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cod", "cliq", "wallet"]).notNull(),
  schedule: mysqlEnum("schedule", ["now", "scheduled"]).notNull(),
  status: mysqlEnum("status", ["received", "preparing", "ready", "on_the_way", "delivered"]).default("received").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  customerStatusIdx: index("orders_customer_status_idx").on(table.customerId, table.status),
  kitchenStatusIdx: index("orders_kitchen_status_idx").on(table.kitchenId, table.status),
  createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
}));

export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  orderId: varchar("orderId", { length: 64 }).notNull(),
  customerId: int("customerId").notNull(),
  kitchenId: varchar("kitchenId", { length: 64 }).notNull(),
  rating: int("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orderIdx: index("reviews_order_idx").on(table.orderId),
  kitchenCreatedIdx: index("reviews_kitchen_created_idx").on(table.kitchenId, table.createdAt),
}));

export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  kitchenId: varchar("kitchenId", { length: 64 }).notNull(),
  amount: decimal("amount", { precision: 8, scale: 2 }).notNull(),
  method: varchar("method", { length: 32 }).default("CliQ").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed"]).default("completed").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  kitchenStatusIdx: index("transactions_kitchen_status_idx").on(table.kitchenId, table.status),
  createdAtIdx: index("transactions_created_at_idx").on(table.createdAt),
}));

export const userProfiles = mysqlTable("userProfiles", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId"),
  name: text("name").notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  role: mysqlEnum("role", ["customer", "mother", "driver"]).notNull(),
  status: mysqlEnum("status", ["active", "pending_approval", "suspended", "rejected"]).default("pending_approval").notNull(),
  region: varchar("region", { length: 64 }).notNull(),
  details: text("details"), // JSON string of kitchen/vehicle/allergy info
  rating: decimal("rating", { precision: 3, scale: 2 }),
  ordersCount: int("ordersCount").default(0).notNull(),
  joinedDate: varchar("joinedDate", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userRoleIdx: index("profiles_user_role_idx").on(table.userId, table.role),
  statusRegionIdx: index("profiles_status_region_idx").on(table.status, table.region),
}));

export const userDocuments = mysqlTable("userDocuments", {
  id: int("id").autoincrement().primaryKey(),
  userProfileId: varchar("userProfileId", { length: 64 }).notNull(),
  labelAr: text("labelAr").notNull(),
  labelEn: text("labelEn").notNull(),
  uri: text("uri").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  profileIdx: index("documents_profile_idx").on(table.userProfileId),
}));

export const complaintsDb = mysqlTable("complaintsDb", {
  id: varchar("id", { length: 64 }).primaryKey(),
  category: varchar("category", { length: 64 }).notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  customerId: int("customerId"),
  orderId: varchar("orderId", { length: 64 }),
  status: mysqlEnum("status", ["new", "in_review", "resolved", "closed"]).default("new").notNull(),
  response: text("response"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  customerStatusIdx: index("complaints_customer_status_idx").on(table.customerId, table.status),
  orderIdx: index("complaints_order_idx").on(table.orderId),
  createdAtIdx: index("complaints_created_at_idx").on(table.createdAt),
}));

export const complaintImages = mysqlTable("complaintImages", {
  id: int("id").autoincrement().primaryKey(),
  complaintId: varchar("complaintId", { length: 64 }).notNull(),
  uri: text("uri").notNull(),
}, (table) => ({
  complaintIdx: index("complaint_images_complaint_idx").on(table.complaintId),
}));

export const announcements = mysqlTable("announcements", {
  id: varchar("id", { length: 64 }).primaryKey(),
  eyebrowAr: text("eyebrowAr").notNull(),
  eyebrowEn: text("eyebrowEn").notNull(),
  titleAr: text("titleAr").notNull(),
  titleEn: text("titleEn").notNull(),
  bodyAr: text("bodyAr").notNull(),
  bodyEn: text("bodyEn").notNull(),
  ctaAr: text("ctaAr").notNull(),
  ctaEn: text("ctaEn").notNull(),
  icon: varchar("icon", { length: 64 }).default("campaign").notNull(),
  target: mysqlEnum("target", ["meals", "orders"]).default("meals").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  startsAt: timestamp("startsAt"),
  endsAt: timestamp("endsAt"),
  imageUrl: text("imageUrl"),
  notificationSentAt: timestamp("notificationSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  activeOrderIdx: index("announcements_active_order_idx").on(table.isActive, table.sortOrder),
  scheduleIdx: index("announcements_schedule_idx").on(table.startsAt, table.endsAt),
}));

export const offers = mysqlTable("offers", {
  id: varchar("id", { length: 64 }).primaryKey(),
  mealId: varchar("mealId", { length: 64 }).notNull(),
  badgeAr: text("badgeAr").notNull(),
  badgeEn: text("badgeEn").notNull(),
  discountPercent: decimal("discountPercent", { precision: 5, scale: 2 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  startsAt: timestamp("startsAt"),
  endsAt: timestamp("endsAt"),
  imageUrl: text("imageUrl"),
  notificationSentAt: timestamp("notificationSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  activeOrderIdx: index("offers_active_order_idx").on(table.isActive, table.sortOrder),
  scheduleIdx: index("offers_schedule_idx").on(table.startsAt, table.endsAt),
  mealIdx: index("offers_meal_idx").on(table.mealId),
}));

export const pushTokens = mysqlTable("pushTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 512 }).notNull(),
  platform: mysqlEnum("platform", ["ios", "android", "web"]).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tokenUnique: uniqueIndex("push_tokens_token_unique").on(table.token),
  userActiveIdx: index("push_tokens_user_active_idx").on(table.userId, table.isActive),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Kitchen = typeof kitchens.$inferSelect;
export type Meal = typeof meals.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type UserProfileDb = typeof userProfiles.$inferSelect;
export type UserDocumentDb = typeof userDocuments.$inferSelect;
export type ComplaintDb = typeof complaintsDb.$inferSelect;
export type ComplaintImageDb = typeof complaintImages.$inferSelect;
export type AnnouncementDb = typeof announcements.$inferSelect;
export type OfferDb = typeof offers.$inferSelect;
export type PushTokenDb = typeof pushTokens.$inferSelect;
