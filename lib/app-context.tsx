import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  CartItem,
  CategoryId,
  canCarryLoad,
  getRequiredLoadCapacity,
  Language,
  Meal,
  Kitchen,
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

const STORAGE_KEY = "sufret-omi-session-v1";
const DEFAULT_DROPOFF = { latitude: 31.951, longitude: 35.884 };

function normalizeOrder(value: Partial<Order> | null | undefined, fallback: Order | null): Order | null {
  if (value === null) return null;
  if (!value) return fallback;
  const kitchen = value.kitchen ?? fallback?.kitchen ?? primaryKitchen;
  const pickupRegion = getRegion(kitchen.region);
  return {
    id: value.id ?? fallback?.id ?? "SO-2408",
    kitchen,
    items: Array.isArray(value.items) ? value.items : fallback?.items ?? [],
    total: typeof value.total === "number" ? value.total : fallback?.total ?? 0,
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
  language: Language;
  role: Role;
  selectedRegion: RegionId;
  selectedCategory: CategoryId | "all";
  selectedKitchenId: string;
  cart: CartItem[];
  activeOrder: Order | null;
  kitchenOpen: boolean;
  incomingOrder: Order | null;
  toast: string | null;
  lastPayout: number | null;
  driverAvailable: boolean;
  driverOrder: Order | null;
  motherVerification: MotherVerificationProfile;
  driverVerification: DriverVerificationProfile;
};

type AppContextValue = AppState & {
  signIn: (role: Role, guest?: boolean) => void;
  signOut: () => void;
  setLanguage: (language: Language) => void;
  setRole: (role: Role) => void;
  setSelectedRegion: (region: RegionId) => void;
  setSelectedCategory: (category: CategoryId | "all") => void;
  setSelectedKitchenId: (kitchenId: string) => void;
  addToCart: (meal: Meal) => void;
  updateQuantity: (mealId: string, nextQuantity: number) => void;
  clearCart: () => void;
  placeOrder: (paymentMethod: Order["paymentMethod"], schedule: Order["schedule"]) => void;
  advanceOrder: () => void;
  toggleKitchen: () => void;
  acceptIncomingOrder: () => void;
  rejectIncomingOrder: () => void;
  requestPayout: (amount: number) => void;
  setDriverAvailable: (available: boolean) => void;
  advanceDriverOrder: () => void;
  updateMotherVerification: (patch: Partial<MotherVerificationProfile>) => void;
  updateDriverVerification: (patch: Partial<DriverVerificationProfile>) => void;
  attachVerificationDocument: (role: Extract<Role, "mother" | "driver">, documentType: VerificationDocumentType, uri: string) => void;
  submitVerification: (role: Extract<Role, "mother" | "driver">) => void;
  setVerificationApproval: (role: Extract<Role, "mother" | "driver">, status: Extract<ApprovalStatus, "approved" | "rejected">) => void;
  canAccessRoleDashboard: (role: Role) => boolean;
  showToast: (message: string) => void;
  dismissToast: () => void;
  cartTotal: number;
  cartCount: number;
  selectedKitchen: Kitchen;
};

const AppContext = createContext<AppContextValue | null>(null);

const initialState: AppState = {
  isAuthenticated: false,
  isGuest: false,
  language: "ar",
  role: "customer",
  selectedRegion: "amman",
  selectedCategory: "all",
  selectedKitchenId: primaryKitchen.id,
  cart: [],
  activeOrder: null,
  kitchenOpen: true,
  incomingOrder: sampleIncomingOrder,
  toast: null,
  lastPayout: null,
  driverAvailable: true,
  driverOrder: sampleDriverOrder,
  motherVerification: createMotherVerification("amman"),
  driverVerification: createDriverVerification("amman"),
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
          activeOrder: parsed.activeOrder === undefined ? current.activeOrder : normalizeOrder(parsed.activeOrder as Partial<Order> | null, current.activeOrder),
          incomingOrder: parsed.incomingOrder === undefined ? current.incomingOrder : normalizeOrder(parsed.incomingOrder as Partial<Order> | null, current.incomingOrder),
          driverOrder: parsed.driverOrder === undefined ? current.driverOrder : normalizeOrder(parsed.driverOrder as Partial<Order> | null, current.driverOrder),
          motherVerification: normalizeMotherVerification(parsed.motherVerification, current.motherVerification),
          driverVerification: normalizeDriverVerification(parsed.driverVerification, current.driverVerification),
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

    return {
      ...state,
      selectedKitchen: getKitchen(state.selectedKitchenId),
      signIn: (role, guest = false) => setState((current) => ({ ...current, isAuthenticated: true, isGuest: guest, role })),
      signOut: () => setState((current) => ({ ...current, isAuthenticated: false, isGuest: false, cart: [], activeOrder: null })),
      cartTotal: totalCart(state.cart),
      cartCount: unitCount(state.cart),
      setLanguage: (language) => setState((current) => ({ ...current, language })),
      setRole: (role) => setState((current) => ({ ...current, role })),
      setSelectedRegion: (selectedRegion) => setState((current) => ({ ...current, selectedRegion })),
      setSelectedCategory: (selectedCategory) => setState((current) => ({ ...current, selectedCategory })),
      setSelectedKitchenId: (selectedKitchenId) => setState((current) => ({ ...current, selectedKitchenId })),
      addToCart: (meal) => {
        if (state.isGuest) {
          setState((current) => ({ ...current, isAuthenticated: false, isGuest: false, cart: [] }));
          return;
        }
        setState((current) => {
          const existing = current.cart.find((item) => item.meal.id === meal.id);
          const cart = existing ? current.cart.map((item) => item.meal.id === meal.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current.cart, { meal, quantity: 1 }];
          return { ...current, cart };
        });
        showToast(state.language === "ar" ? `انضافت للسفرة · ${unitCount(state.cart) + 1} وجبة` : `Added to your table · ${unitCount(state.cart) + 1} meals`);
      },
      updateQuantity: (mealId, nextQuantity) => setState((current) => ({ ...current, cart: nextQuantity <= 0 ? current.cart.filter((item) => item.meal.id !== mealId) : current.cart.map((item) => item.meal.id === mealId ? { ...item, quantity: nextQuantity } : item) })),
      clearCart: () => setState((current) => ({ ...current, cart: [] })),
      placeOrder: (paymentMethod, schedule) => setState((current) => ({
        ...current,
        activeOrder: {
          id: `SO-${Math.floor(1000 + Math.random() * 8999)}`,
          kitchen: getKitchen(current.selectedKitchenId),
          items: current.cart,
          total: totalCart(current.cart) + 1.25,
          paymentMethod,
          schedule,
          status: "received",
          eta: schedule === "scheduled" ? { ar: "الجمعة، ١:٣٠ م", en: "Friday, 1:30 PM" } : { ar: "خلال ٤٥ دقيقة", en: "Within 45 minutes" },
          pickupCoordinates: { latitude: 31.963, longitude: 35.91 },
          dropoffCoordinates: { latitude: 31.951, longitude: 35.884 },
          driverCoordinates: { latitude: 31.978, longitude: 35.897 },
          pickupAddress: { ar: "مطبخ أم أحمد، خلدا، عمّان", en: "Umm Ahmad's Kitchen, Khalda, Amman" },
          dropoffAddress: { ar: "عبدون، شارع الأمير هاشم", en: "Abdoun, Prince Hashem St." },
          driverRating: 4.9,
          requiredCapacity: getRequiredLoadCapacity(current.cart),
          driver: { name: { ar: "محمد العبدالله", en: "Mohammad Al-Abdallah" }, phone: "0791234567", vehicle: { ar: "دراجة نارية سوداء", en: "Black motorcycle" }, plate: "32-9184", vehicleType: current.driverVerification.vehicleType ?? "motorcycle", cargoCapacity: current.driverVerification.cargoCapacity ?? "medium" },
        },
        cart: [],
      })),
      advanceOrder: () => {
        const nextStatus: Record<NonNullable<Order>["status"], NonNullable<Order>["status"]> = { received: "preparing", preparing: "ready", ready: "on_the_way", on_the_way: "delivered", delivered: "delivered" };
        setState((current) => current.activeOrder ? { ...current, activeOrder: { ...current.activeOrder, status: nextStatus[current.activeOrder.status] } } : current);
      },
      toggleKitchen: () => {
        setState((current) => ({ ...current, kitchenOpen: !current.kitchenOpen }));
        showToast(state.kitchenOpen ? "تم إغلاق المطبخ" : "المطبخ مفتوح الآن");
      },
      acceptIncomingOrder: () => {
        setState((current) => ({ ...current, incomingOrder: current.incomingOrder ? { ...current.incomingOrder, status: "preparing" } : null }));
        showToast(state.language === "ar" ? "تم قبول الطلب" : "Order accepted");
      },
      rejectIncomingOrder: () => {
        setState((current) => ({ ...current, incomingOrder: null }));
        showToast(state.language === "ar" ? "تم رفض الطلب" : "Order declined");
      },
      requestPayout: (amount) => {
        setState((current) => ({ ...current, lastPayout: amount }));
        showToast(state.language === "ar" ? "طلب التحويل عبر CliQ قيد المعالجة" : "CliQ payout request is processing");
      },
      setDriverAvailable: (driverAvailable) => setState((current) => ({ ...current, driverAvailable })),
      advanceDriverOrder: () => {
        const nextStatus: Record<NonNullable<Order>["status"], NonNullable<Order>["status"]> = { received: "preparing", preparing: "ready", ready: "on_the_way", on_the_way: "delivered", delivered: "delivered" };
        if (state.driverOrder && !canCarryLoad(state.driverVerification.cargoCapacity ?? "medium", state.driverOrder.requiredCapacity ?? "medium")) {
          showToast(state.language === "ar" ? "هذه الحمولة أكبر من سعة مركبتك" : "This order is larger than your vehicle capacity");
          return;
        }
        setState((current) => current.driverOrder ? { ...current, driverOrder: { ...current.driverOrder, status: nextStatus[current.driverOrder.status] } } : current);
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
