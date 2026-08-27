import { z } from "zod";

import { COOKIE_NAME } from "../shared/const.js";
import { createAnnouncementRecord, createComplaintRecord, createMealRecord, createOfferRecord, createOrderActionRequest, createOrderMessage, decideKitchenDescription, decideMealApproval, deleteAnnouncementRecord, recordFailedAdminLogin, deleteOfferRecord, generateWeeklyKitchenReports, getFinancialAnalytics, getKitchenDescription, getLatestDriverLocation, listActiveAnnouncements, listActiveOffers, listAllAnnouncements, listAllOffers, listAuditLogs, listComplaintRecords, listFavoriteIds, listOrderActionRequests, listOrderMessages, listPendingKitchenDescriptions, listPendingMealApprovals, listUserProfiles, recordAuditLog, recordDriverLocation, registerPushToken, toggleFavorite, updateAnnouncementRecord, updateComplaintRecord, updateKitchenDescription, updateOfferRecord, submitVerificationProfile, updateUserProfileStatus, upsertLocalUser, createLocalAuthChallenge, consumeLocalAuthChallenge, getLocalUserByPhone, hashLocalPassword, setLocalPassword, verifyLocalPassword, assertPasswordAttemptAllowed, recordPasswordFailure, clearPasswordFailures } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { storagePut } from "./storage";
import { systemRouter } from "./_core/systemRouter";
import { sendOrderConfirmationSms, sendOtpSms } from "./sms";
import { ensureWeeklyReportHeartbeatJob } from "./reports-scheduled";
import { ENV } from "./_core/env";
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
const kitchenIdSchema = z.object({ kitchenId: z.string().trim().min(1).max(64) });
const kitchenDescriptionInput = kitchenIdSchema.extend({
  descriptionAr: z.string().trim().max(500),
  descriptionEn: z.string().trim().max(500),
  showDescription: z.boolean(),
});
const kitchenDescriptionDecisionInput = kitchenIdSchema.extend({ status: z.enum(["pending", "approved", "rejected"]) });
const mealApprovalDecisionInput = z.object({ mealId: z.string().trim().min(1).max(64), status: z.enum(["pending", "approved", "rejected"]) });
const createMealInput = z.object({
  kitchenId: z.string().trim().min(1).max(64),
  nameAr: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  descriptionAr: z.string().trim().max(500),
  descriptionEn: z.string().trim().max(500),
  category: z.enum(["mansaf", "maqluba", "mahshi", "bakery", "moona", "desserts", "dairy", "cheese"]),
  price: z.string().trim().min(1).max(16),
  prepMinutes: z.number().int().min(1).max(300),
  dailyLimit: z.number().int().min(1).max(200),
  image: z.string().min(1),
});
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
    requestOtp: publicProcedure
      .input(z.object({ phone: z.string().min(7).max(32), purpose: z.enum(["sign_in", "sign_up", "password_reset"]), language: z.enum(["ar", "en"]) }))
      .mutation(async ({ input }) => {
        if (input.purpose === "sign_up" && await getLocalUserByPhone(input.phone)) throw new Error("ACCOUNT_ALREADY_EXISTS");
        const challenge = await createLocalAuthChallenge(input);
        const delivery = await sendOtpSms({ phone: input.phone, code: challenge.code, language: input.language });
        if (!delivery.configured && ENV.isProduction) throw new Error("OTP_PROVIDER_NOT_CONFIGURED");
        return {
          success: true as const,
          challengeId: challenge.challengeId,
          expiresAt: challenge.expiresAt.toISOString(),
          delivery: delivery.sent ? "sms" as const : "development" as const,
          debugCode: !ENV.isProduction && !delivery.sent ? challenge.code : undefined,
        };
      }),
    localSignIn: publicProcedure
      .input(z.object({ phone: z.string().min(7).max(32), name: z.string().max(120).optional(), role: z.enum(["customer", "mother", "driver"]), mode: z.enum(["sign_in", "sign_up"]), password: z.string().min(8).max(128), otp: z.string().regex(/^\d{6}$/), challengeId: z.string().min(1).max(64) }))
      .mutation(async ({ input }) => {
        const existing = await getLocalUserByPhone(input.phone);
        if (input.mode === "sign_up" && existing) throw new Error("ACCOUNT_ALREADY_EXISTS");
        if (input.mode === "sign_in" && !existing) throw new Error("ACCOUNT_NOT_FOUND");
        if (input.mode === "sign_in") {
          assertPasswordAttemptAllowed(input.phone);
          if (!verifyLocalPassword(input.password, existing?.passwordHash)) {
            recordPasswordFailure(input.phone);
            throw new Error(existing?.passwordHash ? "PASSWORD_INVALID" : "PASSWORD_NOT_SET");
          }
          clearPasswordFailures(input.phone);
        }
        await consumeLocalAuthChallenge({ phone: input.phone, purpose: input.mode, challengeId: input.challengeId, code: input.otp });
        const user = await upsertLocalUser({ ...input, passwordHash: input.mode === "sign_up" ? hashLocalPassword(input.password) : undefined, phoneVerifiedAt: new Date() });
        return { success: true as const, userId: user?.id ?? null, accountStatus: user?.accountStatus ?? "active", businessRole: user?.businessRole ?? input.role, isNewUser: input.mode === "sign_up" };
      }),
    resetPassword: publicProcedure
      .input(z.object({ phone: z.string().min(7).max(32), challengeId: z.string().min(1).max(64), otp: z.string().regex(/^\d{6}$/), newPassword: z.string().min(8).max(128) }))
      .mutation(async ({ input }) => {
        await consumeLocalAuthChallenge({ phone: input.phone, purpose: "password_reset", challengeId: input.challengeId, code: input.otp });
        await setLocalPassword(input.phone, hashLocalPassword(input.newPassword));
        return { success: true as const };
      }),
    changePassword: publicProcedure
      .input(z.object({ phone: z.string().min(7).max(32), currentPassword: z.string().min(1).max(128), newPassword: z.string().min(8).max(128) }))
      .mutation(async ({ input }) => {
        assertPasswordAttemptAllowed(input.phone);
        const user = await getLocalUserByPhone(input.phone);
        if (!user) throw new Error("ACCOUNT_NOT_FOUND");
        if (input.currentPassword === input.newPassword || !verifyLocalPassword(input.currentPassword, user.passwordHash)) {
          recordPasswordFailure(input.phone);
          throw new Error("PASSWORD_INVALID");
        }
        clearPasswordFailures(input.phone);
        await setLocalPassword(input.phone, hashLocalPassword(input.newPassword));
        return { success: true as const };
      }),
    submitVerification: publicProcedure
      .input(z.object({
        role: z.enum(["mother", "driver"]),
        fullName: z.string().trim().min(2).max(160),
        phone: z.string().trim().min(7).max(32),
        address: z.string().trim().min(2).max(500),
        region: z.string().trim().min(1).max(64),
        foodTypes: z.array(z.string().max(64)).max(20).optional(),
        mealSize: z.string().max(32).nullable().optional(),
        deliveryCapacity: z.string().max(32).nullable().optional(),
        vehicleType: z.string().max(32).nullable().optional(),
        cargoCapacity: z.string().max(32).nullable().optional(),
        hasPets: z.enum(["yes", "no", "unknown"]).optional(),
        allergyPrecautions: z.string().max(1000).optional(),
        termsAccepted: z.boolean().refine((value) => value, { message: "Terms must be accepted" }),
        documents: z.array(z.object({ type: z.string().min(1).max(64), labelAr: z.string().min(1).max(240), labelEn: z.string().min(1).max(240), uri: z.string().trim().min(1).max(2_000_000) })).min(1).max(10),
      }))
      .mutation(({ input }) => submitVerificationProfile(input)),
    recordAdminLoginFailure: publicProcedure
      .input(z.object({ reason: z.enum(["invalid_code", "locked"]), language: z.enum(["ar", "en"]), device: z.string().max(160).optional() }))
      .mutation(({ ctx, input }) => {
        const forwarded = ctx.req.headers["x-forwarded-for"];
        const ip = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : ctx.req.socket.remoteAddress;
        return recordFailedAdminLogin(input.reason, input.language, { device: input.device, ip });
      }),
  }),
  admin: router({
    listUsers: adminProcedure.query(() => listUserProfiles()),
    updateUserStatus: adminProcedure
      .input(z.object({ userId: z.string().min(1), status: userStatusSchema }))
      .mutation(async ({ ctx, input }) => {
        await updateUserProfileStatus(input.userId, input.status);
        await recordAuditLog(ctx.user.id, `Updated user ${input.userId} status`, JSON.stringify({ status: input.status }));
        return { success: true as const };
      }),
    listPendingKitchenDescriptions: adminProcedure.query(() => listPendingKitchenDescriptions()),
    decideKitchenDescription: adminProcedure.input(kitchenDescriptionDecisionInput).mutation(({ input }) => decideKitchenDescription(input.kitchenId, input.status)),
    listPendingMealApprovals: adminProcedure.query(() => listPendingMealApprovals()),
    decideMealApproval: adminProcedure.input(mealApprovalDecisionInput).mutation(async ({ input }) => {
      const res = await decideMealApproval(input.mealId, input.status);
      await recordAuditLog(null, `Decided meal ${input.mealId} approval: ${input.status}`);
      return res;
    }),
    listAuditLogs: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(500).optional() }).optional()).query(({ input }) => listAuditLogs(input?.limit ?? 100)),

    financialAnalytics: adminProcedure
      .input(z.object({ days: z.number().int().min(1).max(365).optional() }).optional())
      .query(({ input }) => getFinancialAnalytics(input?.days ?? 30)),
    weeklyReport: adminProcedure.query(() => generateWeeklyKitchenReports()),
    ensureWeeklyReportSchedule: adminProcedure.mutation(() => ensureWeeklyReportHeartbeatJob()),
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
  kitchens: router({
    profile: publicProcedure.input(kitchenIdSchema).query(({ input }) => getKitchenDescription(input.kitchenId)),
    updateDescription: protectedProcedure.input(kitchenDescriptionInput).mutation(({ ctx, input }) => updateKitchenDescription(ctx.user.id, input.kitchenId, { descriptionAr: input.descriptionAr, descriptionEn: input.descriptionEn, showDescription: input.showDescription })),
    createMeal: protectedProcedure.input(createMealInput).mutation(async ({ ctx, input }) => {
      let imageUrl = input.image;
      if (input.image.startsWith("data:")) {
        const decoded = decodeImageDataUrl(input.image);
        const uploaded = await storagePut(`meals/${ctx.user.id}-${Date.now()}`, decoded.data, decoded.contentType);
        imageUrl = uploaded.url;
      }
      return createMealRecord(ctx.user.id, { ...input, image: imageUrl });
    }),
  }),
  favorites: router({
    mine: protectedProcedure.query(async ({ ctx }) => ({ mealIds: await listFavoriteIds(ctx.user.id, "meal"), kitchenIds: await listFavoriteIds(ctx.user.id, "kitchen") })),
    toggle: protectedProcedure.input(favoriteSchema).mutation(({ ctx, input }) => toggleFavorite(ctx.user.id, input.entityType, input.entityId)),
  }),
  notifications: router({
    registerPushToken: protectedProcedure.input(pushTokenSchema).mutation(({ ctx, input }) => { if (input.platform !== "web" && !isExpoPushToken(input.token)) throw new Error("Invalid Expo push token"); return registerPushToken(ctx.user.id, input.token, input.platform); }),
    sendOrderConfirmationSms: protectedProcedure.input(orderSmsSchema).mutation(({ input }) => sendOrderConfirmationSms(input)),
          notifyDriverOrderAssigned: adminProcedure.input(z.object({ driverUserId: z.number().int().positive(), orderId: z.string().min(1).max(64), kitchenNameAr: z.string().min(1).max(240), kitchenNameEn: z.string().min(1).max(240), language: z.enum(["ar", "en"]) })).mutation(({ input }) => sendPushNotificationToUser(input.driverUserId, { title: input.language === "ar" ? "طلب توصيل جديد" : "New delivery order", body: input.language === "ar" ? `تم تعيين الطلب ${input.orderId} من ${input.kitchenNameAr} لك` : `Order ${input.orderId} from ${input.kitchenNameEn} was assigned to you`, data: { type: "driver_order_assigned", orderId: input.orderId } })),
      sendTestPush: adminProcedure.input(z.object({ language: z.enum(["ar", "en"]) })).mutation(({ ctx, input }) => sendPushNotificationToUser(ctx.user.id, { title: input.language === "ar" ? "إشعار تجريبي" : "Test notification", body: input.language === "ar" ? "إشعارات Push جاهزة لهذا الحساب." : "Push notifications are ready for this account.", data: { type: "admin_test_push" } })),

  }),
  chat: router({
    list: protectedProcedure.input(z.object({ orderId: z.string().min(1).max(64) })).query(({ ctx, input }) => listOrderMessages(input.orderId, ctx.user.id)),
    send: protectedProcedure.input(z.object({ orderId: z.string().min(1).max(64), senderRole: z.enum(["customer", "mother", "driver"]), senderName: z.string().min(1).max(160), body: z.string().trim().min(1).max(500) })).mutation(({ ctx, input }) => createOrderMessage({ ...input, senderId: ctx.user.id })),
  }),
  driverLocation: router({
    update: protectedProcedure.input(z.object({ orderId: z.string().min(1).max(64), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().min(0).max(10000).optional() })).mutation(({ ctx, input }) => recordDriverLocation({ ...input, driverId: ctx.user.id })),
    latest: protectedProcedure.input(z.object({ orderId: z.string().min(1).max(64) })).query(({ ctx, input }) => getLatestDriverLocation(input.orderId, ctx.user.id)),
  }),
  orderActions: router({
    list: protectedProcedure.input(z.object({ orderId: z.string().min(1).max(64) })).query(({ ctx, input }) => listOrderActionRequests(input.orderId, ctx.user.id)),
    create: protectedProcedure.input(z.object({ orderId: z.string().min(1).max(64), action: z.enum(["cancellation_requested", "replacement_requested"]), note: z.string().trim().max(240).optional() })).mutation(({ ctx, input }) => createOrderActionRequest({ ...input, customerId: ctx.user.id })),
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
