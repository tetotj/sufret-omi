import { z } from "zod";

import { COOKIE_NAME } from "../shared/const.js";
import { createAnnouncementRecord, createComplaintRecord, createOfferRecord, createOrderMessage, deleteAnnouncementRecord, deleteOfferRecord, generateWeeklyKitchenReports, getFinancialAnalytics, listActiveAnnouncements, listActiveOffers, listAllAnnouncements, listAllOffers, listComplaintRecords, listFavoriteIds, listOrderMessages, listUserProfiles, registerPushToken, toggleFavorite, updateAnnouncementRecord, updateComplaintRecord, updateOfferRecord, updateUserProfileStatus, upsertLocalUser } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { storagePut } from "./storage";
import { systemRouter } from "./_core/systemRouter";
import { sendOrderConfirmationSms } from "./sms";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { isExpoPushToken, sendPushNotificationToUser } from "./marketing-notifications";

const userStatusSchema = z.enum(["active", "pending_approval", "suspended", "rejected"]);
const complaintStatusSchema = z.enum(["new", "in_review", "resolved", "closed"]);
const complaintImageSchema = z.string().regex(/^data:image\/(png|jpeg|jpg|webp);base64,/, "Complaint images must be data URLs");
const marketingImageSchema = z.string().regex(/^data:image\/(png|jpeg|jpg|webp);base64,/, "Marketing images must be data URLs");
const pushTokenSchema = z.object({ token: z.string().min(20).max(512), platform: z.enum(["ios", "android", "web"]) });
const favoriteSchema = z.object({ entityType: z.enum(["meal", "kitchen"]), entityId: z.string().min(1).max(64) });
const orderSmsSchema = z.object({ phone: z.string().min(8).max(32), orderCount: z.number().int().min(1).max(50), total: z.number().finite().nonnegative(), language: z.enum(["ar", "en"]) });
const marketingDateSchema = z.string().nullable().optional();
const announcementInput = z.object({
  id: z.string().min(1).max(64),
  eyebrowAr: z.string().min(1).max(240),
  eyebrowEn: z.string().min(1).max(240),
  titleAr: z.string().min(1).max(240),
  titleEn: z.string().min(1).max(240),
  bodyAr: z.string().min(1).max(1000),
  bodyEn: z.string().min(1).max(1000),
  ctaAr: z.string().min(1).max(120),
  ctaEn: z.string().min(1).max(120),
  icon: z.string().min(1).max(64),
  target: z.enum(["meals", "orders"]),
  sortOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
  startsAt: marketingDateSchema,
  endsAt: marketingDateSchema,
  imageUrl: z.string().url().nullable().optional(),
});
const offerInput = z.object({
  id: z.string().min(1).max(64),
  mealId: z.string().min(1).max(64),
  badgeAr: z.string().min(1).max(240),
  badgeEn: z.string().min(1).max(240),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
  startsAt: marketingDateSchema,
  endsAt: marketingDateSchema,
  imageUrl: z.string().url().nullable().optional(),
});

function parseMarketingDate(value?: string | null) {
  return value ? new Date(value) : null;
}

function decodeImageDataUrl(value: string): { data: Buffer; contentType: string } {
  const match = value.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
  if (!match) throw new Error("Invalid complaint image payload");
  return { contentType: match[1], data: Buffer.from(match[2], "base64") };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    localSignIn: publicProcedure
      .input(z.object({ phone: z.string().min(7).max(32), name: z.string().max(120).optional(), role: z.enum(["customer", "mother", "driver"]) }))
      .mutation(async ({ input }) => {
        const user = await upsertLocalUser(input);
        return { success: true as const, userId: user?.id ?? null, accountStatus: user?.accountStatus ?? "active" };
      }),
  }),
  admin: router({
    listUsers: adminProcedure.query(() => listUserProfiles()),
    updateUserStatus: adminProcedure
      .input(z.object({ userId: z.string().min(1), status: userStatusSchema }))
      .mutation(({ input }) => updateUserProfileStatus(input.userId, input.status)),
    financialAnalytics: adminProcedure
      .input(z.object({ days: z.number().int().min(1).max(365).optional() }).optional())
      .query(({ input }) => getFinancialAnalytics(input?.days ?? 30)),
    weeklyReport: adminProcedure.query(() => generateWeeklyKitchenReports()),
    listComplaints: adminProcedure.query(() => listComplaintRecords()),
    updateComplaint: adminProcedure
      .input(z.object({ complaintId: z.string().min(1), status: complaintStatusSchema, response: z.string().max(2000).optional() }))
      .mutation(({ input }) => updateComplaintRecord(input.complaintId, input.status, input.response)),
    listAnnouncements: adminProcedure.query(() => listAllAnnouncements()),
    createAnnouncement: adminProcedure.input(announcementInput).mutation(({ input }) => createAnnouncementRecord({ ...input, startsAt: parseMarketingDate(input.startsAt), endsAt: parseMarketingDate(input.endsAt) })),
    updateAnnouncement: adminProcedure.input(announcementInput.partial().extend({ id: z.string().min(1).max(64) })).mutation(({ input }) => {
      const { id, startsAt, endsAt, ...patch } = input;
      return updateAnnouncementRecord(id, { ...patch, ...(startsAt !== undefined ? { startsAt: parseMarketingDate(startsAt) } : {}), ...(endsAt !== undefined ? { endsAt: parseMarketingDate(endsAt) } : {}) });
    }),
    deleteAnnouncement: adminProcedure.input(z.object({ id: z.string().min(1).max(64) })).mutation(({ input }) => deleteAnnouncementRecord(input.id)),
    uploadAnnouncementImage: adminProcedure.input(z.object({ id: z.string().min(1).max(64), image: marketingImageSchema })).mutation(async ({ input }) => { const decoded = decodeImageDataUrl(input.image); const uploaded = await storagePut(`marketing/announcements/${input.id}`, decoded.data, decoded.contentType); await updateAnnouncementRecord(input.id, { imageUrl: uploaded.url }); return { url: uploaded.url }; }),
    listOffers: adminProcedure.query(() => listAllOffers()),
    createOffer: adminProcedure.input(offerInput).mutation(({ input }) => createOfferRecord({ ...input, startsAt: parseMarketingDate(input.startsAt), endsAt: parseMarketingDate(input.endsAt) })),
    updateOffer: adminProcedure.input(offerInput.partial().extend({ id: z.string().min(1).max(64) })).mutation(({ input }) => {
      const { id, startsAt, endsAt, ...patch } = input;
      return updateOfferRecord(id, { ...patch, ...(startsAt !== undefined ? { startsAt: parseMarketingDate(startsAt) } : {}), ...(endsAt !== undefined ? { endsAt: parseMarketingDate(endsAt) } : {}) });
    }),
    deleteOffer: adminProcedure.input(z.object({ id: z.string().min(1).max(64) })).mutation(({ input }) => deleteOfferRecord(input.id)),
    uploadOfferImage: adminProcedure.input(z.object({ id: z.string().min(1).max(64), image: marketingImageSchema })).mutation(async ({ input }) => { const decoded = decodeImageDataUrl(input.image); const uploaded = await storagePut(`marketing/offers/${input.id}`, decoded.data, decoded.contentType); await updateOfferRecord(input.id, { imageUrl: uploaded.url }); return { url: uploaded.url }; }),
  }),
  marketing: router({
    announcements: publicProcedure.query(() => listActiveAnnouncements()),
    offers: publicProcedure.query(() => listActiveOffers()),
  }),
  favorites: router({
    mine: protectedProcedure.query(async ({ ctx }) => ({ mealIds: await listFavoriteIds(ctx.user.id, "meal"), kitchenIds: await listFavoriteIds(ctx.user.id, "kitchen") })),
    toggle: protectedProcedure.input(favoriteSchema).mutation(({ ctx, input }) => toggleFavorite(ctx.user.id, input.entityType, input.entityId)),
  }),
  notifications: router({
    registerPushToken: protectedProcedure.input(pushTokenSchema).mutation(({ ctx, input }) => { if (input.platform !== "web" && !isExpoPushToken(input.token)) throw new Error("Invalid Expo push token"); return registerPushToken(ctx.user.id, input.token, input.platform); }),
    sendOrderConfirmationSms: protectedProcedure.input(orderSmsSchema).mutation(({ input }) => sendOrderConfirmationSms(input)),
    notifyDriverOrderAssigned: adminProcedure.input(z.object({ driverUserId: z.number().int().positive(), orderId: z.string().min(1).max(64), kitchenNameAr: z.string().min(1).max(240), kitchenNameEn: z.string().min(1).max(240), language: z.enum(["ar", "en"]) })).mutation(({ input }) => sendPushNotificationToUser(input.driverUserId, { title: input.language === "ar" ? "طلب توصيل جديد" : "New delivery order", body: input.language === "ar" ? `تم تعيين الطلب ${input.orderId} من ${input.kitchenNameAr} لك` : `Order ${input.orderId} from ${input.kitchenNameEn} was assigned to you`, data: { type: "driver_order_assigned", orderId: input.orderId } })),
  }),
  chat: router({
    list: protectedProcedure.input(z.object({ orderId: z.string().min(1).max(64) })).query(({ ctx, input }) => listOrderMessages(input.orderId, ctx.user.id)),
    send: protectedProcedure.input(z.object({ orderId: z.string().min(1).max(64), senderRole: z.enum(["customer", "mother", "driver"]), senderName: z.string().min(1).max(160), body: z.string().trim().min(1).max(500) })).mutation(({ ctx, input }) => createOrderMessage({ ...input, senderId: ctx.user.id })),
  }),
  complaints: router({
    mine: protectedProcedure.query(({ ctx }) => listComplaintRecords(ctx.user.id)),
    create: publicProcedure
      .input(z.object({
        id: z.string().min(1).max(64),
        category: z.string().min(1).max(64),
        subject: z.string().min(1).max(240),
        description: z.string().min(1).max(5000),
        orderId: z.string().max(64).optional(),
        images: z.array(complaintImageSchema).max(4),
      }))
      .mutation(async ({ ctx, input }) => {
        const imageUris = await Promise.all(input.images.map(async (image, index) => {
          const decoded = decodeImageDataUrl(image);
          const uploaded = await storagePut(`complaints/${ctx.user?.id ?? "guest"}/${input.id}-${index}`, decoded.data, decoded.contentType);
          return uploaded.url;
        }));
        await createComplaintRecord({ ...input, imageUris, customerId: ctx.user?.id });
        return { id: input.id, imageUris };
      }),
  }),
});

export type AppRouter = typeof appRouter;
