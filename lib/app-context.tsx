import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { type Complaint, type ComplaintStatus, type NewComplaint } from "@/lib/complaint-data";
import { sampleManagedUsers, type ManagedUser, type UserAccountStatus } from "@/lib/admin-data";
import {
  CartItem,
  CategoryId,
  canCarryLoad,
  getRequiredLoadCapacity,
  getOrderPricing,
  getMultiOrderPricing,
  Language,
  Meal,
  Kitchen,
  meals,
  Order,
  RegionId,
  Role,
  getKitchen,
  getLocalized,
  getRegion,
  primaryKitchen,
  sampleDriverOrder,
  sampleIncomingOrder,
  totalCart,
  unitCount,
} from "@/lib/food-data";
import {
  createDriverVerification,
  createMotherVerification,
  isDriverVerificationReady,
  isMotherVerificationReady,
  type ApprovalStatus,
  type DriverVerificationProfile,
  type MotherVerificationProfile,
  type VerificationDocumentType,
} from "@/lib/verification-data";
import { createDefaultWeeklySchedule, getWeekdayFromDate, isDayClosed, normalizeWeeklySchedule, type WeekdayId, type WeeklySchedule } from "@/lib/schedule-data";

const STORAGE_KEY = "sufret-omi-session-v1";
const DEFAULT_DROPOFF = { latitude: 31.951, longitude: 35.884 };

const fallbackDrivers: Array<NonNullable<Order["driver"]>> = [
  { name: { ar: "محمد العبدالله", en: "Mohammad Al-Abdallah" }, phone: "0791234567", vehicle: { ar: "دراجة نارية سوداء", en: "Black motorcycle" }, plate: "32-9184", vehicleType: "motorcycle", cargoCapacity: "small" },
  { name: { ar: "ليث الزعبي", en: "Laith Al-Zoubi" }, phone: "0792345678", vehicle: { ar: "سيارة بيضاء", en: "White sedan" }, plate: "41-5621", vehicleType: "car", cargoCapacity: "medium" },
  { name: { ar: "أحمد الخطيب", en: "Ahmad Al-Khatib" }, phone: "0793456789", vehicle: { ar: "فان توصيل", en: "Delivery van" }, plate: "55-7730", vehicleType: "van", cargoCapacity: "large" },
];

function normalizeOrder(value: Partial<Order> | null | undefined, fallback: Order | null): Order | null {
  if (value === null) return null;
  if (!value) return fallback;
  const kitchen = value.kitchen ?? fallback?.kitchen ?? primaryKitchen;
  const pickupRegion = getRegion(kitchen.region);
  const items = Array.isArray(value.items) ? value.items : fallback?.items ?? [];
  const pricing = getOrderPricing(totalCart(items), 1.25);
  const hasCommissionBreakdown = typeof value.commission === "number" || typeof fallback?.commission === "number";
  return {
    id: value.id ?? fallback?.id ?? "SO-2408",
    kitchen,
    items,
    total: hasCommissionBreakdown ? (typeof value.total === "number" ? value.total : fallback?.total ?? pricing.grandTotal) : pricing.grandTotal,
    commission: typeof value.commission === "number" ? value.commission : fallback?.commission ?? pricing.commission,
    deliveryFee: typeof value.deliveryFee === "number" ? value.deliveryFee : fallback?.deliveryFee ?? pricing.deliveryFee,
    specialRequests: typeof value.specialRequests === "string" ? value.specialRequests : fallback?.specialRequests ?? "",
    restaurantRating: typeof value.restaurantRating === "number" ? value.restaurantRating : fallback?.restaurantRating,
    restaurantReview: typeof value.restaurantReview === "string" ? value.restaurantReview : fallback?.restaurantReview ?? "",
    paymentMethod: value.paymentMethod ?? fallback?.paymentMethod ?? "cod",
    schedule: value.schedule ?? fallback?.schedule ?? "now",
    status: value.status ?? fallback?.status ?? "received",
    eta: value.eta ?? fallback?.eta ?? { ar: "خلال ٤٥ دقيقة", en: "Within 45 minutes" },
    pickupCoordinates: value.pickupCoordinates ?? fallback?.pickupCoordinates ?? { latitude: pickupRegion.latitude, longitude: pickupRegion.longitude },
    dropoffCoordinates: value.dropoffCoordinates ?? fallback?.dropoffCoordinates ?? DEFAULT_DROPOFF,
    driverCoordinates: value.driverCoordinates ?? fallback?.driverCoordinates ?? { latitude: 31.978, longitude: 35.897 },
    pickupAddress: value.pickupAddress ?? fallback?.pickupAddress ?? { ar: `${getLocalized(kitchen.name, "ar")}، ${getLocalized(kitchen.neighborhood, "ar")}`, en: `${getLocalized(kitchen.name, "en")}, ${getLocalized(kitchen.neighborhood, "en")}` },
    dropoffAddress: value.dropoffAddress ?? fallback?.dropoffAddress ?? { ar: "عبدون، شارع الأمير هاشم", en: "Abdoun, Prince Hashem St." },
    driverRating: typeof value.driverRating === "number" ? value.driverRating : fallback?.driverRating ?? 4.9,
    requiredCapacity: value.requiredCapacity ?? fallback?.requiredCapacity ?? getRequiredLoadCapacity(Array.isArray(value.items) ? value.items : fallback?.items ?? []),
    driver: value.driver ?? fallback?.driver,
  };
}

function normalizeMotherVerification(value: Partial<MotherVerificationProfile> | undefined, fallback: MotherVerificationProfile): MotherVerificationProfile {
  return { ...fallback, ...value, documents: Array.isArray(value?.documents) && value.documents.length ? value.documents : fallback.documents, foodTypes: Array.isArray(value?.foodTypes) ? value.foodTypes : fallback.foodTypes };
}

function normalizeDriverVerification(value: Partial<DriverVerificationProfile> | undefined, fallback: DriverVerificationProfile): DriverVerificationProfile {
  return { ...fallback, ...value, documents: Array.isArray(value?.documents) && value.documents.length ? value.documents : fallback.documents };
}

type AppState = {
  isAuthenticated: boolean;
  isGuest: boolean;
  customerPhone: string;
  language: Language;
  role: Role;
  selectedRegion: RegionId;
  selectedCategory: CategoryId | "all";
  selectedKitchenId: string;
  cart: CartItem[];
  cartSpecialRequests: string;
  complaints: Complaint[];
  activeOrder: Order | null;
  activeOrders: Order[];
  orderHistory: Order[];
  weeklySchedule: WeeklySchedule;
  kitchenOpen: boolean;
  incomingOrder: Order | null;
  incomingOrders: Order[];
  toast: string | null;
  lastPayout: number | null;
  driverAvailable: boolean;
  driverOrder: Order | null;
  driverOrders: Order[];
  motherVerification: MotherVerificationProfile;
  driverVerification: DriverVerificationProfile;
  managedUsers: ManagedUser[];
  adminAuthenticated: boolean;
};

type AppContextValue = AppState & {
  signIn: (role: Role, guest?: boolean, phone?: string) => void;
  signOut: () => void;
  setLanguage: (language: Language) => void;
  setRole: (role: Role) => void;
  setSelectedRegion: (region: RegionId) => void;
  setSelectedCategory: (category: CategoryId | "all") => void;
  setSelectedKitchenId: (kitchenId: string) => void;
  setCartSpecialRequests: (value: string) => void;
  addComplaint: (input: NewComplaint) => void;
  updateComplaintStatus: (id: string, status: ComplaintStatus, response?: string) => void;
  addToCart: (meal: Meal, specialRequests?: string) => void;
  updateQuantity: (mealId: string, nextQuantity: number, specialRequests?: string) => void;
  clearCart: () => void;
  placeOrder: (paymentMethod: Order["paymentMethod"], schedule: Order["schedule"], specialRequests?: string) => boolean;
  reorder: (order: Order) => void;
  selectActiveOrder: (orderId: string) => void;
  rateOrder: (rating: number, review?: string) => void;
  advanceOrder: (orderId?: string) => void;
  toggleKitchen: () => void;
  toggleClosedDay: (day: WeekdayId) => void;
  toggleMealScheduleDay: (mealId: string, day: WeekdayId) => void;
  selectIncomingOrder: (orderId: string) => void;
  acceptIncomingOrder: (orderId?: string) => void;
  rejectIncomingOrder: (orderId?: string) => void;
  requestPayout: (amount: number) => void;
  setDriverAvailable: (available: boolean) => void;
  selectDriverOrder: (orderId: string) => void;
  advanceDriverOrder: (orderId?: string) => void;
  updateMotherVerification: (patch: Partial<MotherVerificationProfile>) => void;
  updateDriverVerification: (patch: Partial<DriverVerificationProfile>) => void;
  attachVerificationDocument: (role: Extract<Role, "mother" | "driver">, documentType: VerificationDocumentType, uri: string) => void;
  submitVerification: (role: Extract<Role, "mother" | "driver">) => void;
  setVerificationApproval: (role: Extract<Role, "mother" | "driver">, status: Extract<ApprovalStatus, "approved" | "rejected">) => void;
  canAccessRoleDashboard: (role: Role) => boolean;
  adminSignIn: (code: string) => boolean;
  adminSignOut: () => void;
  updateUserStatus: (userId: string, status: UserAccountStatus) => void;
  showToast: (message: string) => void;
  dismissToast: () => void;
  cartTotal: number;
  cartCount: number;
  selectedKitchen: Kitchen;
  isKitchenAvailable: boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

const initialState: AppState = {
  isAuthenticated: false,
  isGuest: false,
  customerPhone: "",
  language: "ar",
  role: "customer",
  selectedRegion: "amman",
  selectedCategory: "all",
  selectedKitchenId: primaryKitchen.id,
  cart: [],
  cartSpecialRequests: "",
  complaints: [],
  activeOrder: null,
  activeOrders: [],
  orderHistory: [],
  weeklySchedule: createDefaultWeeklySchedule(meals),
  kitchenOpen: true,
  incomingOrder: sampleIncomingOrder,
  incomingOrders: [sampleIncomingOrder],
  toast: null,
  lastPayout: null,
  driverAvailable: true,
  driverOrder: sampleDriverOrder,
  driverOrders: [sampleDriverOrder],
  motherVerification: createMotherVerification("amman"),
  driverVerification: createDriverVerification("amman"),
  managedUsers: sampleManagedUsers,
  adminAuthenticated: false,
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved) as Partial<AppState>;
        setState((current) => ({
          ...current,
          ...parsed,
          isGuest: parsed.isGuest === true,
          customerPhone: typeof parsed.customerPhone === "string" ? parsed.customerPhone : current.customerPhone,
          cartSpecialRequests: typeof parsed.cartSpecialRequests === "string" ? parsed.cartSpecialRequests : current.cartSpecialRequests,
          complaints: Array.isArray(parsed.complaints) ? parsed.complaints : current.complaints,
          activeOrder: parsed.activeOrder === undefined ? current.activeOrder : normalizeOrder(parsed.activeOrder as Partial<Order> | null, current.activeOrder),
          activeOrders: Array.isArray(parsed.activeOrders) ? parsed.activeOrders.map((order) => normalizeOrder(order, null)).filter((order): order is Order => Boolean(order)) : parsed.activeOrder ? [normalizeOrder(parsed.activeOrder as Partial<Order>, current.activeOrder)].filter((order): order is Order => Boolean(order)) : current.activeOrders,
          orderHistory: Array.isArray(parsed.orderHistory) ? parsed.orderHistory.map((order) => normalizeOrder(order, null)).filter((order): order is Order => Boolean(order)) : current.orderHistory,
          weeklySchedule: normalizeWeeklySchedule(parsed.weeklySchedule, meals),
          incomingOrder: parsed.incomingOrder === undefined ? current.incomingOrder : normalizeOrder(parsed.incomingOrder as Partial<Order> | null, current.incomingOrder),
          incomingOrders: Array.isArray(parsed.incomingOrders) ? parsed.incomingOrders.map((order) => normalizeOrder(order, null)).filter((order): order is Order => Boolean(order)) : parsed.incomingOrder ? [normalizeOrder(parsed.incomingOrder as Partial<Order>, current.incomingOrder)].filter((order): order is Order => Boolean(order)) : current.incomingOrders,
          driverOrder: parsed.driverOrder === undefined ? current.driverOrder : normalizeOrder(parsed.driverOrder as Partial<Order> | null, current.driverOrder),
          driverOrders: Array.isArray(parsed.driverOrders) ? parsed.driverOrders.map((order) => normalizeOrder(order, null)).filter((order): order is Order => Boolean(order)) : parsed.driverOrder ? [normalizeOrder(parsed.driverOrder as Partial<Order>, current.driverOrder)].filter((order): order is Order => Boolean(order)) : current.driverOrders,
          motherVerification: normalizeMotherVerification(parsed.motherVerification, current.motherVerification),
          driverVerification: normalizeDriverVerification(parsed.driverVerification, current.driverVerification),
          managedUsers: Array.isArray(parsed.managedUsers) ? parsed.managedUsers : current.managedUsers,
          adminAuthenticated: parsed.adminAuthenticated === true,
          toast: null,
        }));
      } catch {
        // Ignore invalid local state and use safe defaults.
      }
    });
  }, []);

  useEffect(() => {
    const { toast: _toast, ...persisted } = state;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)).catch(() => undefined);
  }, [state]);

  const value = useMemo<AppContextValue>(() => {
    const showToast = (message: string) => {
      setState((current) => ({ ...current, toast: message }));
      setTimeout(() => setState((current) => ({ ...current, toast: null })), 2600);
    };
    const canAccessRoleDashboard = (requestedRole: Role) => requestedRole === "customer" || (requestedRole === "mother" ? state.motherVerification.approvalStatus === "approved" : state.driverVerification.approvalStatus === "approved");
    const isKitchenAvailable = state.kitchenOpen && !isDayClosed(state.weeklySchedule, getWeekdayFromDate());
    const adminSignIn = (code: string) => {
      if (code.trim() === "9988" || code.trim() === "admin123") {
        setState((current) => ({ ...current, adminAuthenticated: true }));
        showToast(state.language === "ar" ? "أهلاً بك في لوحة الإدارة العليا" : "Welcome to the supervisor command center");
        return true;
      }
      showToast(state.language === "ar" ? "رمز المشرف غير صحيح (جربي 9988)" : "Incorrect supervisor code (try 9988)");
      return false;
    };
    const adminSignOut = () => setState((current) => ({ ...current, adminAuthenticated: false }));
    const updateUserStatus = (userId: string, status: UserAccountStatus) => {
      setState((current) => ({
        ...current,
        managedUsers: current.managedUsers.map((user) => user.id === userId ? { ...user, status } : user),
      }));
      showToast(state.language === "ar" ? "تم تحديث حالة المستخدم بنجاح" : "User status updated successfully");
    };

    return {
      ...state,
      selectedKitchen: getKitchen(state.selectedKitchenId),
      isKitchenAvailable,
      signIn: (role, guest = false, phone = "") => setState((current) => ({ ...current, isAuthenticated: true, isGuest: guest, customerPhone: phone.trim() || current.customerPhone, role })),
      signOut: () => setState((current) => ({ ...current, isAuthenticated: false, isGuest: false, customerPhone: "", cart: [], cartSpecialRequests: "", activeOrder: null, activeOrders: [] })),
      cartTotal: totalCart(state.cart),
      cartCount: unitCount(state.cart),
      setLanguage: (language) => setState((current) => ({ ...current, language })),
      setRole: (role) => setState((current) => ({ ...current, role })),
      setSelectedRegion: (selectedRegion) => setState((current) => ({ ...current, selectedRegion })),
      setSelectedCategory: (selectedCategory) => setState((current) => ({ ...current, selectedCategory })),
      setSelectedKitchenId: (selectedKitchenId) => setState((current) => ({ ...current, selectedKitchenId })),
      setCartSpecialRequests: (cartSpecialRequests) => setState((current) => ({ ...current, cartSpecialRequests })),
      addComplaint: (input) => setState((current) => ({ ...current, complaints: [{ ...input, id: `CMP-${Date.now().toString().slice(-6)}`, status: "new", createdAt: new Date().toISOString() }, ...current.complaints] })),
      updateComplaintStatus: (id, status, response = "") => setState((current) => ({ ...current, complaints: current.complaints.map((complaint) => complaint.id === id ? { ...complaint, status, response: response.trim() || complaint.response } : complaint) })),
      addToCart: (meal, specialRequests = "") => {
        if (state.isGuest) {
          setState((current) => ({ ...current, isAuthenticated: false, isGuest: false, cart: [], cartSpecialRequests: "" }));
          return;
        }
        setState((current) => {
          const normalizedRequests = specialRequests.trim();
          const existing = current.cart.find((item) => item.meal.id === meal.id && (item.specialRequests ?? "") === normalizedRequests);
          const cart = existing ? current.cart.map((item) => item.meal.id === meal.id && (item.specialRequests ?? "") === normalizedRequests ? { ...item, quantity: item.quantity + 1 } : item) : [...current.cart, { meal, quantity: 1, specialRequests: normalizedRequests }];
          return { ...current, cart };
        });
        showToast(state.language === "ar" ? `انضافت للسفرة · ${unitCount(state.cart) + 1} وجبة` : `Added to your table · ${unitCount(state.cart) + 1} meals`);
      },
      updateQuantity: (mealId, nextQuantity, specialRequests = "") => setState((current) => ({ ...current, cart: nextQuantity <= 0 ? current.cart.filter((item) => !(item.meal.id === mealId && (item.specialRequests ?? "") === specialRequests)) : current.cart.map((item) => item.meal.id === mealId && (item.specialRequests ?? "") === specialRequests ? { ...item, quantity: nextQuantity } : item) })),
      reorder: (order) => {
        if (state.isGuest) {
          showToast(state.language === "ar" ? "سجّلي الدخول لإعادة الطلب" : "Sign in to reorder");
          return;
        }
        setState((current) => {
          const cart = [...current.cart];
          for (const orderItem of order.items) {
            const normalizedRequests = orderItem.specialRequests ?? "";
            const existingIndex = cart.findIndex((item) => item.meal.id === orderItem.meal.id && (item.specialRequests ?? "") === normalizedRequests);
            if (existingIndex >= 0) cart[existingIndex] = { ...cart[existingIndex], quantity: cart[existingIndex].quantity + orderItem.quantity };
            else cart.push({ ...orderItem });
          }
          return { ...current, cart, cartSpecialRequests: order.specialRequests ?? "", selectedKitchenId: order.kitchen.id };
        });
        showToast(state.language === "ar" ? "رجّعنا طلبك للسلة مع كل التخصيصات" : "Your order and customizations are back in the cart");
      },
      selectActiveOrder: (orderId) => setState((current) => ({ ...current, activeOrder: current.activeOrders.find((order) => order.id === orderId) ?? current.orderHistory.find((order) => order.id === orderId) ?? current.activeOrder })),
      clearCart: () => setState((current) => ({ ...current, cart: [], cartSpecialRequests: "" })),
      toggleClosedDay: (day) => setState((current) => ({ ...current, weeklySchedule: { ...current.weeklySchedule, closedDays: current.weeklySchedule.closedDays.includes(day) ? current.weeklySchedule.closedDays.filter((item) => item !== day) : [...current.weeklySchedule.closedDays, day] } })),
      toggleMealScheduleDay: (mealId, day) => setState((current) => {
        const currentDays = current.weeklySchedule.mealDays[mealId] ?? [];
        const mealDays = { ...current.weeklySchedule.mealDays, [mealId]: currentDays.includes(day) ? currentDays.filter((item) => item !== day) : [...currentDays, day] };
        return { ...current, weeklySchedule: { ...current.weeklySchedule, mealDays } };
      }),
      placeOrder: (paymentMethod, schedule, specialRequests = "") => {
        if (!state.cart.length) {
          showToast(state.language === "ar" ? "السلة فارغة. أضيفي وجبة أولاً." : "Your cart is empty. Add a meal first.");
          return false;
        }
        if (!isKitchenAvailable) {
          showToast(state.language === "ar" ? "المطبخ مغلق اليوم. اختاري يوماً آخر للطلب." : "This kitchen is closed today. Please choose another day.");
          return false;
        }
        setState((current) => {
          const multiPricing = getMultiOrderPricing(current.cart, 1.25);
          const batchId = `SO-${Math.floor(1000 + Math.random() * 8999)}`;
          const generalRequest = specialRequests.trim() || current.cartSpecialRequests.trim();
          const verifiedDriver = current.driverVerification.fullName.trim() && current.driverVerification.phone.trim() ? { name: { ar: current.driverVerification.fullName.trim(), en: current.driverVerification.fullName.trim() }, phone: current.driverVerification.phone.trim(), vehicle: { ar: current.driverVerification.vehicleType ? current.driverVerification.vehicleType : "مركبة التوصيل", en: current.driverVerification.vehicleType ? current.driverVerification.vehicleType : "Delivery vehicle" }, plate: "—", vehicleType: current.driverVerification.vehicleType ?? "car", cargoCapacity: current.driverVerification.cargoCapacity ?? "medium" } : null;
          const nextOrders = multiPricing.groups.map((group, index): Order => {
            const kitchen = getKitchen(group.kitchenId);
            const kitchenRegion = getRegion(kitchen.region);
            const requiredCapacity = getRequiredLoadCapacity(group.items);
            const driver = verifiedDriver && canCarryLoad(verifiedDriver.cargoCapacity, requiredCapacity) ? verifiedDriver : fallbackDrivers.find((candidate) => canCarryLoad(candidate.cargoCapacity, requiredCapacity)) ?? fallbackDrivers[fallbackDrivers.length - 1];
            const cartInstructions = group.items.filter((item) => item.specialRequests?.trim()).map((item) => `${item.meal.name.ar}: ${item.specialRequests?.trim()}`).join(" · ");
            const mergedSpecialRequests = [cartInstructions, generalRequest].filter(Boolean).join(" · ");
            return {
              id: `${batchId}-${index + 1}`,
              kitchen,
              items: group.items,
              total: group.pricing.grandTotal,
              commission: group.pricing.commission,
              deliveryFee: group.pricing.deliveryFee,
              specialRequests: mergedSpecialRequests,
              paymentMethod,
              schedule,
              status: "received",
              eta: schedule === "scheduled" ? { ar: "الجمعة، ١:٣٠ م", en: "Friday, 1:30 PM" } : { ar: `خلال ${Math.max(...group.items.map((item) => item.meal.prepMinutes), 30)} دقيقة`, en: `Within ${Math.max(...group.items.map((item) => item.meal.prepMinutes), 30)} minutes` },
              pickupCoordinates: { latitude: kitchenRegion.latitude, longitude: kitchenRegion.longitude },
              dropoffCoordinates: DEFAULT_DROPOFF,
              driverCoordinates: { latitude: kitchenRegion.latitude + 0.012, longitude: kitchenRegion.longitude + 0.008 },
              pickupAddress: { ar: `${getLocalized(kitchen.name, "ar")}، ${getLocalized(kitchen.neighborhood, "ar")}`, en: `${getLocalized(kitchen.name, "en")}, ${getLocalized(kitchen.neighborhood, "en")}` },
              dropoffAddress: { ar: "عبدون، شارع الأمير هاشم", en: "Abdoun, Prince Hashem St." },
              driverRating: 4.9,
              requiredCapacity,
              driver,
            };
          });
          return { ...current, activeOrder: nextOrders[0] ?? null, activeOrders: nextOrders, incomingOrder: nextOrders[0] ?? null, incomingOrders: nextOrders, driverOrder: nextOrders[0] ?? null, driverOrders: nextOrders, orderHistory: [...nextOrders, ...current.orderHistory].slice(0, 30), cart: [], cartSpecialRequests: "" };
        });
        return true;
      },
      rateOrder: (rating, review = "") => setState((current) => {
        if (!current.activeOrder) return current;
        const updatedOrder = { ...current.activeOrder, restaurantRating: Math.max(1, Math.min(5, Math.round(rating))), restaurantReview: review.trim() };
        return { ...current, activeOrder: updatedOrder, activeOrders: current.activeOrders.map((order) => order.id === updatedOrder.id ? updatedOrder : order), orderHistory: current.orderHistory.map((order) => order.id === updatedOrder.id ? updatedOrder : order) };
      }),
      advanceOrder: (orderId) => {
        const nextStatus: Record<NonNullable<Order>["status"], NonNullable<Order>["status"]> = { received: "preparing", preparing: "ready", ready: "on_the_way", on_the_way: "delivered", delivered: "delivered" };
        setState((current) => {
          const targetId = orderId ?? current.activeOrder?.id;
          const target = current.activeOrders.find((order) => order.id === targetId) ?? current.activeOrder;
          if (!target) return current;
          const updatedOrder = { ...target, status: nextStatus[target.status] };
          return { ...current, activeOrder: current.activeOrder?.id === updatedOrder.id ? updatedOrder : current.activeOrder, activeOrders: current.activeOrders.map((order) => order.id === updatedOrder.id ? updatedOrder : order), orderHistory: current.orderHistory.map((order) => order.id === updatedOrder.id ? updatedOrder : order) };
        });
      },
      toggleKitchen: () => {
        setState((current) => ({ ...current, kitchenOpen: !current.kitchenOpen }));
        showToast(state.kitchenOpen ? "تم إغلاق المطبخ" : "المطبخ مفتوح الآن");
      },
      selectIncomingOrder: (orderId) => setState((current) => ({ ...current, incomingOrder: current.incomingOrders.find((order) => order.id === orderId) ?? current.incomingOrder })),
      acceptIncomingOrder: (orderId) => {
        const targetId = orderId ?? state.incomingOrder?.id;
        setState((current) => {
          const incomingOrders = current.incomingOrders.map((order) => order.id === targetId ? { ...order, status: "preparing" as const } : order);
          const incomingOrder = incomingOrders.find((order) => order.id === targetId) ?? current.incomingOrder;
          return { ...current, incomingOrder, incomingOrders };
        });
        showToast(state.language === "ar" ? "تم قبول الطلب" : "Order accepted");
      },
      rejectIncomingOrder: (orderId) => {
        const targetId = orderId ?? state.incomingOrder?.id;
        setState((current) => {
          const incomingOrders = current.incomingOrders.filter((order) => order.id !== targetId);
          return { ...current, incomingOrders, incomingOrder: incomingOrders[0] ?? null };
        });
        showToast(state.language === "ar" ? "تم رفض الطلب" : "Order declined");
      },
      requestPayout: (amount) => {
        setState((current) => ({ ...current, lastPayout: amount }));
        showToast(state.language === "ar" ? "طلب التحويل عبر CliQ قيد المعالجة" : "CliQ payout request is processing");
      },
      setDriverAvailable: (driverAvailable) => setState((current) => ({ ...current, driverAvailable })),
      selectDriverOrder: (orderId) => setState((current) => ({ ...current, driverOrder: current.driverOrders.find((order) => order.id === orderId) ?? current.driverOrder })),
      advanceDriverOrder: (orderId) => {
        const nextStatus: Record<NonNullable<Order>["status"], NonNullable<Order>["status"]> = { received: "preparing", preparing: "ready", ready: "on_the_way", on_the_way: "delivered", delivered: "delivered" };
        const targetId = orderId ?? state.driverOrder?.id;
        const target = state.driverOrders.find((order) => order.id === targetId) ?? state.driverOrder;
        if (target && !canCarryLoad(state.driverVerification.cargoCapacity ?? target.driver?.cargoCapacity ?? "medium", target.requiredCapacity ?? "medium")) {
          showToast(state.language === "ar" ? "هذه الحمولة أكبر من سعة مركبتك" : "This order is larger than your vehicle capacity");
          return;
        }
        setState((current) => {
          const currentTarget = current.driverOrders.find((order) => order.id === targetId) ?? current.driverOrder;
          if (!currentTarget) return current;
          const updatedOrder = { ...currentTarget, status: nextStatus[currentTarget.status] };
          const driverOrders = current.driverOrders.map((order) => order.id === updatedOrder.id ? updatedOrder : order);
          return { ...current, driverOrder: updatedOrder, driverOrders, activeOrders: current.activeOrders.map((order) => order.id === updatedOrder.id ? updatedOrder : order), orderHistory: current.orderHistory.map((order) => order.id === updatedOrder.id ? updatedOrder : order) };
        });
      },
      updateMotherVerification: (patch) => setState((current) => ({ ...current, motherVerification: { ...current.motherVerification, ...patch, approvalStatus: current.motherVerification.approvalStatus === "approved" ? "approved" : patch.approvalStatus ?? "draft" } })),
      updateDriverVerification: (patch) => setState((current) => ({ ...current, driverVerification: { ...current.driverVerification, ...patch, approvalStatus: current.driverVerification.approvalStatus === "approved" ? "approved" : patch.approvalStatus ?? "draft" } })),
      attachVerificationDocument: (role, documentType, uri) => setState((current) => {
        const update = (documents: MotherVerificationProfile["documents"]) => documents.map((document) => document.type === documentType ? { ...document, uri, uploadedAt: new Date().toISOString() } : document);
        if (role === "mother") return { ...current, motherVerification: { ...current.motherVerification, documents: update(current.motherVerification.documents), approvalStatus: current.motherVerification.approvalStatus === "approved" ? "approved" : "draft" } };
        return { ...current, driverVerification: { ...current.driverVerification, documents: update(current.driverVerification.documents), approvalStatus: current.driverVerification.approvalStatus === "approved" ? "approved" : "draft" } };
      }),
      submitVerification: (role) => setState((current) => {
        const ready = role === "mother" ? isMotherVerificationReady(current.motherVerification) : isDriverVerificationReady(current.driverVerification);
        if (!ready) {
          showToast(current.language === "ar" ? "كمّلي كل البيانات والوثائق المطلوبة أولاً" : "Complete all required details and documents first");
          return role === "mother" ? { ...current, motherVerification: { ...current.motherVerification, approvalStatus: "draft" } } : { ...current, driverVerification: { ...current.driverVerification, approvalStatus: "draft" } };
        }
        showToast(current.language === "ar" ? "تم إرسال الملف لفريق الإشراف" : "Profile sent to the supervisor team");
        return role === "mother" ? { ...current, motherVerification: { ...current.motherVerification, approvalStatus: "pending" } } : { ...current, driverVerification: { ...current.driverVerification, approvalStatus: "pending" } };
      }),
      setVerificationApproval: (role, status) => {
        setState((current) => role === "mother" ? { ...current, motherVerification: { ...current.motherVerification, approvalStatus: status } } : { ...current, driverVerification: { ...current.driverVerification, approvalStatus: status } });
        showToast(status === "approved" ? (state.language === "ar" ? "تم اعتماد الملف وفتح اللوحة" : "Profile approved and dashboard unlocked") : (state.language === "ar" ? "تم طلب تعديلات على الملف" : "Changes requested on the profile"));
      },
      canAccessRoleDashboard,
      adminSignIn,
      adminSignOut,
      updateUserStatus,
      showToast,
      dismissToast: () => setState((current) => ({ ...current, toast: null })),
    };
  }, [state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
