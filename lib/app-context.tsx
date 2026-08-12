import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  CartItem,
  CategoryId,
  Kitchen,
  Language,
  Meal,
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

const STORAGE_KEY = "sufret-omi-session-v1";

const DEFAULT_PICKUP = { latitude: 31.963, longitude: 35.91 };
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
    pickupAddress: value.pickupAddress ?? fallback?.pickupAddress ?? { ar: `${getLocalized(kitchen.name, "ar")}، ${getLocalized(kitchen.neighborhood, "ar")}`, en: `${getLocalized(kitchen.name, "en")}, ${getLocalized(kitchen.neighborhood, "en")}` },
    dropoffAddress: value.dropoffAddress ?? fallback?.dropoffAddress ?? { ar: "عبدون، شارع الأمير هاشم", en: "Abdoun, Prince Hashem St." },
  };
}

type AppState = {
  isAuthenticated: boolean;
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
};

type AppContextValue = AppState & {
  signIn: (role: Role) => void;
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
  showToast: (message: string) => void;
  dismissToast: () => void;
  cartTotal: number;
  cartCount: number;
  selectedKitchen: Kitchen;
};

const AppContext = createContext<AppContextValue | null>(null);

const initialState: AppState = {
  isAuthenticated: false,
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
          activeOrder: parsed.activeOrder === undefined ? current.activeOrder : normalizeOrder(parsed.activeOrder as Partial<Order> | null, current.activeOrder),
          incomingOrder: parsed.incomingOrder === undefined ? current.incomingOrder : normalizeOrder(parsed.incomingOrder as Partial<Order> | null, current.incomingOrder),
          driverOrder: parsed.driverOrder === undefined ? current.driverOrder : normalizeOrder(parsed.driverOrder as Partial<Order> | null, current.driverOrder),
          toast: null,
        }));
      } catch {
        // Ignore invalid local state and use the safe defaults.
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

    return {
      ...state,
      selectedKitchen: getKitchen(state.selectedKitchenId),
      signIn: (role) => setState((current) => ({ ...current, isAuthenticated: true, role })),
      signOut: () => setState((current) => ({ ...current, isAuthenticated: false, cart: [], activeOrder: null })),
      cartTotal: totalCart(state.cart),
      cartCount: unitCount(state.cart),
      setLanguage: (language) => setState((current) => ({ ...current, language })),
      setRole: (role) => setState((current) => ({ ...current, role })),
      setSelectedRegion: (selectedRegion) => setState((current) => ({ ...current, selectedRegion })),
      setSelectedCategory: (selectedCategory) => setState((current) => ({ ...current, selectedCategory })),
      setSelectedKitchenId: (selectedKitchenId) => setState((current) => ({ ...current, selectedKitchenId })),
      addToCart: (meal) => {
        setState((current) => {
          const existing = current.cart.find((item) => item.meal.id === meal.id);
          const cart = existing
            ? current.cart.map((item) =>
                item.meal.id === meal.id ? { ...item, quantity: item.quantity + 1 } : item,
              )
            : [...current.cart, { meal, quantity: 1 }];
          return { ...current, cart };
        });
        showToast(state.language === "ar" ? `انضافت للسفرة · ${unitCount(state.cart) + 1} وجبة` : `Added to your table · ${unitCount(state.cart) + 1} meals`);
      },
      updateQuantity: (mealId, nextQuantity) =>
        setState((current) => ({
          ...current,
          cart:
            nextQuantity <= 0
              ? current.cart.filter((item) => item.meal.id !== mealId)
              : current.cart.map((item) => (item.meal.id === mealId ? { ...item, quantity: nextQuantity } : item)),
        })),
      clearCart: () => setState((current) => ({ ...current, cart: [] })),
      placeOrder: (paymentMethod, schedule) => {
        setState((current) => ({
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
            pickupAddress: { ar: "مطبخ أم أحمد، خلدا، عمّان", en: "Umm Ahmad's Kitchen, Khalda, Amman" },
            dropoffAddress: { ar: "عبدون، شارع الأمير هاشم", en: "Abdoun, Prince Hashem St." },
          },
          cart: [],
        }));
      },
      advanceOrder: () => {
        const nextStatus: Record<NonNullable<Order>["status"], NonNullable<Order>["status"]> = {
          received: "preparing",
          preparing: "ready",
          ready: "on_the_way",
          on_the_way: "delivered",
          delivered: "delivered",
        };
        setState((current) =>
          current.activeOrder
            ? { ...current, activeOrder: { ...current.activeOrder, status: nextStatus[current.activeOrder.status] } }
            : current,
        );
      },
      toggleKitchen: () => {
        setState((current) => ({ ...current, kitchenOpen: !current.kitchenOpen }));
        showToast(state.kitchenOpen ? "تم إغلاق المطبخ" : "المطبخ مفتوح الآن");
      },
      acceptIncomingOrder: () => {
        setState((current) => ({
          ...current,
          incomingOrder: current.incomingOrder ? { ...current.incomingOrder, status: "preparing" } : null,
        }));
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
        const nextStatus: Record<NonNullable<Order>["status"], NonNullable<Order>["status"]> = {
          received: "preparing",
          preparing: "ready",
          ready: "on_the_way",
          on_the_way: "delivered",
          delivered: "delivered",
        };
        setState((current) => current.driverOrder ? { ...current, driverOrder: { ...current.driverOrder, status: nextStatus[current.driverOrder.status] } } : current);
      },
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
