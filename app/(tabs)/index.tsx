import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { Image } from "expo-image";

import { MapPreview } from "@/components/map-preview";
import { UnifiedFilters, type UnifiedFilterSort } from "@/components/unified-filters";
import { VerificationScreen } from "@/components/verification-screen";
import { complaintCategories, complaintStatuses, type Complaint, type ComplaintCategory } from "@/lib/complaint-data";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/hooks/use-favorites";
import { trpc } from "@/lib/trpc";
import { getApiBaseUrl } from "@/constants/oauth";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { driverVehicleLabels, loadCapacityLabels, mealSizeLabels } from "@/lib/verification-data";
import { chooseImages, imageUriToDataUrl, MediaPermissionError } from "@/lib/media-picker";
import { getWeekdayFromDate, isMealAvailableOnDay, weeklyScheduleToCsv, weekdays } from "@/lib/schedule-data";
import {
  categories,
  canCarryLoad,
  distanceKm,
  formatJod,
  getCategory,
  getOrderPricing,
  getMultiOrderPricing,
  getKitchenDistanceKm,
  getLocalized,
  getRegion,
  kitchens,
  meals,
  orderStatuses,
  paymentLabels,
  type Localized,
  type Order,
  type OrderCustomerAction,
  type RegionId,
  type Role,
  regions,
  scheduleLabels,
  t,
  totalCart,
} from "@/lib/food-data";

type ViewId = "home" | "explore" | "discover" | "meals" | "orders" | "profile" | "favorites" | "kitchen" | "cart" | "complaints" | "dashboard" | "delivery";

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

type IngredientOption = { id: string; label: Localized; icon: IconName };

const addIngredientOptions: IngredientOption[] = [
  { id: "extra-rice", label: { ar: "أرز إضافي", en: "Extra rice" }, icon: "restaurant" },
  { id: "extra-sauce", label: { ar: "صلصة إضافية", en: "Extra sauce" }, icon: "water-drop" },
  { id: "pickles", label: { ar: "مخللات", en: "Pickles" }, icon: "spa" },
  { id: "nuts", label: { ar: "مكسرات", en: "Nuts" }, icon: "grain" },
];

const removeIngredientOptions: IngredientOption[] = [
  { id: "onions", label: { ar: "بصل", en: "Onions" }, icon: "remove-circle-outline" },
  { id: "spicy", label: { ar: "البهارات الحارة", en: "Spicy seasoning" }, icon: "local-fire-department" },
  { id: "nuts", label: { ar: "مكسرات", en: "Nuts" }, icon: "grain" },
  { id: "pickles", label: { ar: "مخللات", en: "Pickles" }, icon: "spa" },
];

const OFFER_MEAL_IDS = new Set(["mansaf-family", "maqluba-chicken", "zaatar-bakery"]);
function resolveRemoteAssetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith("/") ? `${getApiBaseUrl()}${url}` : url;
}

type AnnouncementSlide = { id: string; icon: IconName; eyebrowAr: string; eyebrowEn: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; ctaAr: string; ctaEn: string; target: "meals" | "orders"; imageUrl?: string | null };
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

const FALLBACK_ANNOUNCEMENTS: AnnouncementSlide[] = [
  { id: "fallback-multi-kitchen", icon: "restaurant-menu", eyebrowAr: "تحديث جديد من سفرة أمي", eyebrowEn: "A new Sufret Omi update", titleAr: "اطلبي من أكثر من مطعم", titleEn: "Order from multiple kitchens", bodyAr: "قسّمنا السلة تلقائياً لكل مطبخ حتى توصلك طلباتك بسهولة.", bodyEn: "Your cart is split for each kitchen for an easier delivery.", ctaAr: "اكتشفي الأكلات", ctaEn: "Discover meals", target: "meals" },
  { id: "fallback-offers", icon: "local-offer", eyebrowAr: "عروض أمهات الأردن", eyebrowEn: "Jordanian home offers", titleAr: "نكهة بيتية بانتظارك", titleEn: "A home-cooked offer awaits", bodyAr: "اكتشفي أكلات مميزة محضّرة بحب من مطابخ قريبة منك.", bodyEn: "Discover special meals prepared with care by kitchens near you.", ctaAr: "شاهدي العروض", ctaEn: "See offers", target: "meals" },
  { id: "fallback-tracking", icon: "two-wheeler", eyebrowAr: "تتبّع أسهل لطلباتك", eyebrowEn: "Easier order tracking", titleAr: "كل طلب في مكانه", titleEn: "Every order in one place", bodyAr: "تابعي حالة كل مطبخ وسائق خطوة بخطوة من شاشة طلباتي.", bodyEn: "Follow every kitchen and driver step by step from My Orders.", ctaAr: "تتبعي طلباتك", ctaEn: "Track orders", target: "orders" },
];

export default function HomeScreen() {
  const { isAuthenticated, isGuest, language, role, toast, dismissToast, setRole, signIn, signOut, setSelectedKitchenId, canAccessRoleDashboard, cartCount, cartTotal, cartSpecialRequests, setCartSpecialRequests, addToCart, isKitchenAvailable, showToast } = useApp();
  const cartPreviewTotal = getOrderPricing(cartTotal, cartCount > 0 ? 1.25 : 0).grandTotal;
  const [view, setView] = useState<ViewId>(role === "mother" ? "dashboard" : role === "driver" ? "delivery" : "home");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customizingMeal, setCustomizingMeal] = useState<(typeof meals)[number] | null>(null);
  const [query, setQuery] = useState("");

  const confirmMealCustomization = (meal: (typeof meals)[number], specialRequests: string) => {
    if (!isKitchenAvailable) {
      showToast(language === "ar" ? "المطبخ مغلق اليوم. جرّبي الطلب في يوم متاح." : "This kitchen is closed today. Please order on an available day.");
      setCustomizingMeal(null);
      return;
    }
    addToCart(meal, specialRequests);
    setCustomizingMeal(null);
  };

  const changeRole = () => {
    const next = role === "customer" ? "mother" : "customer";
    setRole(next);
    setView(next === "mother" ? "dashboard" : "home");
  };

  const go = (next: ViewId) => {
    if (isGuest && (next === "cart" || next === "orders" || next === "dashboard" || next === "favorites")) {
      signOut();
      setView("home");
      setCheckoutOpen(false);
      return;
    }
    setView(next);
    setCheckoutOpen(false);
  };

  if (!isAuthenticated) {
    return <LoginScreen onSignedIn={(nextRole, guest = false, phone = "", accountStatus) => { signIn(nextRole, guest, phone, accountStatus); setView(nextRole === "mother" ? "dashboard" : nextRole === "driver" ? "delivery" : "home"); }} />;
  }

  if ((role === "mother" || role === "driver") && !canAccessRoleDashboard(role)) {
    return <VerificationScreen role={role} />;
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} containerClassName="bg-background" className="flex-1">
      <View style={[styles.root, language === "ar" ? styles.rtl : styles.ltr]}>
        {view === "discover" ? (
          <DiscoverMapScreen onBack={() => go("home")} onOpenMeals={() => go("meals")} />
        ) : view === "meals" ? (
          <MealsScreen onBack={() => go("home")} onOpenCart={() => go("cart")} onOpenKitchen={(kitchenId) => { setView("kitchen"); setSelectedKitchenId(kitchenId); }} onRequestAdd={setCustomizingMeal} />
        ) : view === "kitchen" ? (
          <KitchenProfile onBack={() => go("home")} onCart={() => go("cart")} onRequestAdd={setCustomizingMeal} />
        ) : view === "favorites" ? (
          <FavoritesScreen onBack={() => go("home")} onOpenKitchen={(kitchenId) => { setSelectedKitchenId(kitchenId); setView("kitchen"); }} onRequestAdd={setCustomizingMeal} />
        ) : view === "cart" ? (
          <CartScreen onBack={() => go("home")} onCheckout={() => setCheckoutOpen(true)} />
        ) : view === "complaints" ? (
          <ComplaintsScreen onBack={() => go("home")} />
        ) : view === "dashboard" ? (
          role === "mother" ? <MotherDashboard onBack={() => go("home")} /> : <CustomerDashboard onBack={() => go("home")} onNavigate={go} />
        ) : view === "delivery" ? (
          <DriverDashboard onBack={() => go("home")} />
        ) : view === "orders" ? (
          <OrdersScreen onBack={() => go("home")} onOpenCart={() => go("cart")} />
        ) : view === "profile" ? (
          <ProfileScreen onRoleChange={changeRole} onDashboard={() => go("dashboard")} onSupport={() => go("complaints")} />
        ) : (
          <CustomerHome view={view} query={query} setQuery={setQuery} onNavigate={go} onRequestAdd={setCustomizingMeal} />
        )}

        {view !== "kitchen" && view !== "favorites" && view !== "cart" && view !== "complaints" && view !== "dashboard" && view !== "delivery" && view !== "discover" && view !== "meals" && (
          <BottomNav active={view} onNavigate={go} role={role} language={language} />
        )}

        {role === "customer" && cartCount > 0 && view !== "cart" && view !== "dashboard" && view !== "delivery" && <FloatingCart language={language} count={cartCount} total={cartPreviewTotal} onPress={() => go("cart")} bottomOffset={view === "home" || view === "explore" || view === "orders" || view === "profile" ? 88 : 24} />}
        {toast && (
          <Pressable onPress={dismissToast} style={styles.toast}>
            <MaterialIcons name="check-circle" size={18} color="#FFFFFF" />
            <Text style={styles.toastText}>{toast}</Text>
          </Pressable>
        )}
      </View>
      <MealCustomizationModal meal={customizingMeal} onClose={() => setCustomizingMeal(null)} onConfirm={confirmMealCustomization} />
      <CheckoutModal visible={checkoutOpen} initialSpecialRequests={cartSpecialRequests} onClose={() => setCheckoutOpen(false)} onComplete={() => { setCheckoutOpen(false); setCartSpecialRequests(""); go("orders"); }} />
    </ScreenContainer>
  );
}

function LoginScreen({ onSignedIn }: { onSignedIn: (role: Role, guest?: boolean, phone?: string, accountStatus?: "active" | "pending_approval" | "suspended" | "rejected") => void }) {
  const { language, setLanguage } = useApp();
  const localSignIn = trpc.auth.localSignIn.useMutation();
  const [mode, setMode] = useState<Role>("customer");
  const [isCreate, setIsCreate] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    if (phone.trim().length < 7 || password.trim().length < 4) {
      setError(language === "ar" ? "اكتبي رقم الموبايل وكلمة مرور من ٤ أحرف على الأقل" : "Enter a mobile number and a password of at least 4 characters");
      return;
    }
    setError("");
    try {
      const result = await localSignIn.mutateAsync({ phone: phone.trim(), name: name.trim() || undefined, role: mode });
      const accountStatus = result.accountStatus as "active" | "pending_approval" | "suspended" | "rejected";
      onSignedIn(result.businessRole as Role, false, phone.trim(), accountStatus);
    } catch {
      setError(language === "ar" ? "تعذر حفظ الحساب. تحققي من اتصال الخدمة وحاولي مرة أخرى." : "The account could not be saved. Check the service connection and try again.");
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} containerClassName="bg-background" className="flex-1">
      <ScrollView contentContainerStyle={styles.loginScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.loginTopRow}><Image source={require("@/assets/images/icon.png")} style={styles.loginIcon} /><Pressable onPress={() => setLanguage(language === "ar" ? "en" : "ar")} style={styles.loginLanguage}><Text style={styles.loginLanguageText}>{language === "ar" ? "English" : "العربية"}</Text></Pressable></View>
        <View style={styles.loginBrand}><Text style={styles.loginBrandArabic}>سفرة أمي</Text><Text style={styles.loginBrandEnglish}>Sufret Omi</Text><Text style={styles.loginTagline}>{language === "ar" ? "من بيتنا لبيتك، بمحبة" : "From our home to yours, with care"}</Text></View>
        <View style={styles.loginCard}>
          <View style={styles.loginTabs}><Pressable onPress={() => setIsCreate(false)} style={[styles.loginTab, !isCreate && styles.loginTabActive]}><Text style={[styles.loginTabText, !isCreate && styles.loginTabTextActive]}>{language === "ar" ? "تسجيل الدخول" : "Log in"}</Text></Pressable><Pressable onPress={() => setIsCreate(true)} style={[styles.loginTab, isCreate && styles.loginTabActive]}><Text style={[styles.loginTabText, isCreate && styles.loginTabTextActive]}>{language === "ar" ? "حساب جديد" : "Create account"}</Text></Pressable></View>
          <Text style={styles.loginTitle}>{isCreate ? (language === "ar" ? "أهلاً في سفرتك" : "Welcome to your table") : (language === "ar" ? "رجعنا نشتقنالك" : "Welcome back")}</Text>
          <Text style={styles.loginSubtitle}>{isCreate ? (language === "ar" ? "خلّي أول طلب يبدأ من بيت أردني" : "Let your first order start at a Jordanian home") : (language === "ar" ? "دخّلي بياناتك وكمّلي لمة اليوم" : "Enter your details and continue your gathering")}</Text>
          {isCreate && <><Text style={styles.inputLabel}>{language === "ar" ? "الاسم" : "Name"}</Text><View style={styles.inputWrap}><MaterialIcons name="person-outline" size={18} color="#00AFC4" /><TextInput value={name} onChangeText={setName} placeholder={language === "ar" ? "الاسم الكامل" : "Full name"} placeholderTextColor="#8ABAC0" style={styles.loginInput} textAlign={language === "ar" ? "right" : "left"} /></View></>}
          <Text style={styles.inputLabel}>{language === "ar" ? "رقم الموبايل" : "Mobile number"}</Text>
          <View style={styles.inputWrap}><MaterialIcons name="smartphone" size={18} color="#00AFC4" /><TextInput value={phone} onChangeText={setPhone} placeholder={language === "ar" ? "07X XXX XXXX" : "07X XXX XXXX"} placeholderTextColor="#8ABAC0" keyboardType="phone-pad" style={styles.loginInput} textAlign={language === "ar" ? "right" : "left"} /></View>
          <Text style={styles.inputLabel}>{language === "ar" ? "كلمة المرور" : "Password"}</Text>
          <View style={styles.inputWrap}><MaterialIcons name="lock-outline" size={18} color="#00AFC4" /><TextInput value={password} onChangeText={setPassword} placeholder={language === "ar" ? "٤ أحرف على الأقل" : "At least 4 characters"} placeholderTextColor="#8ABAC0" secureTextEntry style={styles.loginInput} textAlign={language === "ar" ? "right" : "left"} /></View>
          {error ? <Text style={styles.loginError}>{error}</Text> : null}
          <Text style={styles.rolePrompt}>{language === "ar" ? "كيف رح تستخدمي سفرة أمي؟" : "How will you use Sufret Omi?"}</Text>
          <View style={styles.roleChoiceRow}><Pressable onPress={() => setMode("customer")} style={[styles.roleChoice, mode === "customer" && styles.roleChoiceActive]}><MaterialIcons name="restaurant" size={19} color={mode === "customer" ? "#FFFFFF" : "#00AFC4"} /><Text style={[styles.roleChoiceText, mode === "customer" && styles.roleChoiceTextActive]}>{language === "ar" ? "أطلب أكل" : "Order food"}</Text></Pressable><Pressable onPress={() => setMode("mother")} style={[styles.roleChoice, mode === "mother" && styles.roleChoiceActive]}><MaterialIcons name="storefront" size={19} color={mode === "mother" ? "#FFFFFF" : "#2E9B72"} /><Text style={[styles.roleChoiceText, mode === "mother" && styles.roleChoiceTextActive]}>{language === "ar" ? "أطبخ وأبيع" : "Cook & sell"}</Text></Pressable><Pressable onPress={() => setMode("driver")} style={[styles.roleChoice, mode === "driver" && styles.roleChoiceActive]}><MaterialIcons name="two-wheeler" size={19} color={mode === "driver" ? "#FFFFFF" : "#C98A2E"} /><Text style={[styles.roleChoiceText, mode === "driver" && styles.roleChoiceTextActive]}>{language === "ar" ? "أوصل الطلبات" : "Deliver"}</Text></Pressable></View>
          <Pressable disabled={localSignIn.isPending} onPress={() => void submit()} style={({ pressed }) => [styles.primaryButton, localSignIn.isPending && styles.disabledButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{localSignIn.isPending ? (language === "ar" ? "جاري حفظ الحساب..." : "Saving account...") : isCreate ? (language === "ar" ? "أنشئي حسابك" : "Create my account") : (language === "ar" ? "دخّليني عالسفرة" : "Enter Sufret Omi")}</Text><MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" /></Pressable>
          <Pressable onPress={() => onSignedIn("customer", true)} style={styles.guestButton}><Text style={styles.guestButtonText}>{language === "ar" ? "تصفّحي كضيفة" : "Continue as guest"}</Text></Pressable>
        </View>
        <View style={styles.loginTrust}><MaterialIcons name="verified-user" size={16} color="#2E9B72" /><Text style={styles.loginTrustText}>{language === "ar" ? "بياناتك محفوظة، وطلباتك عند أمينة سفرة" : "Your data stays protected and your orders stay cared for"}</Text></View>
      </ScrollView>
    </ScreenContainer>
  );
}

function CustomerDashboard({ onBack, onNavigate }: { onBack: () => void; onNavigate: (view: ViewId) => void }) {
  const { language, activeOrder, activeOrders, selectedKitchen, cartCount, complaints, signOut } = useApp();
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#082E34" /></Pressable><View><Text style={styles.eyebrow}>{language === "ar" ? "لوحة سفرتي" : "MY TABLE"}</Text><Text style={styles.pageTitle}>{language === "ar" ? "أهلاً سارة" : "Hello Sara"}</Text></View><Pressable onPress={signOut} style={styles.logoutButton}><MaterialIcons name="logout" size={17} color="#00AFC4" /><Text style={styles.logoutText}>{language === "ar" ? "خروج" : "Log out"}</Text></Pressable></View>
      <View style={styles.customerDashHero}><View><Text style={styles.customerDashOverline}>{language === "ar" ? "لمّتك الجاية" : "Your next gathering"}</Text><Text style={styles.customerDashTitle}>{activeOrder ? (activeOrders.length > 1 ? (language === "ar" ? `${activeOrders.length} طلبات بالطريق` : `${activeOrders.length} orders are moving`) : (language === "ar" ? "طلبك بالطريق" : "Your order is moving")) : (language === "ar" ? "اختاري طبخة للعيلة" : "Pick a family meal")}</Text><Text style={styles.customerDashBody}>{activeOrder ? `${activeOrder.id} · ${getLocalized(activeOrder.eta, language)}` : (language === "ar" ? "مطابخ بيتية قريبة منك" : "Home kitchens close to you")}</Text></View><View style={styles.customerDashIcon}><MaterialIcons name={activeOrder ? "two-wheeler" : "restaurant"} size={30} color="#00AFC4" /></View></View>
      <View style={styles.dashboardGrid}><DashboardTile icon="receipt-long" title={language === "ar" ? "طلباتي" : "My orders"} detail={activeOrder ? (language === "ar" ? `${activeOrders.length || 1} طلبات نشطة` : `${activeOrders.length || 1} active`) : (language === "ar" ? "شوفي السابق" : "See history")} onPress={() => onNavigate("orders")} /><DashboardTile icon="favorite-border" title={language === "ar" ? "مطابخي" : "Saved kitchens"} detail={language === "ar" ? "المفضلة" : "Favorites"} onPress={() => onNavigate("favorites")} /><DashboardTile icon="location-on" title={language === "ar" ? "عناويني" : "Addresses"} detail={language === "ar" ? "خلدا، عمّان" : "Khalda, Amman"} onPress={() => onNavigate("home")} /><DashboardTile icon="support-agent" title={language === "ar" ? "شكاوى ومساعدة" : "Complaints & help"} detail={complaints.length ? (language === "ar" ? `${complaints.length} شكوى · متابعة` : `${complaints.length} complaints · Track`) : (language === "ar" ? "أرسلي شكوى" : "Send a complaint")} onPress={() => onNavigate("complaints")} /></View>
      <SectionHeader title={language === "ar" ? "طلبك الحالي" : "Your current order"} action={language === "ar" ? "كل الطلبات" : "All orders"} onAction={() => onNavigate("orders")} />
      {activeOrder ? <Pressable onPress={() => onNavigate("orders")} style={styles.customerOrderCard}><View style={styles.customerOrderIcon}><MaterialIcons name="soup-kitchen" size={20} color="#2E9B72" /></View><View style={styles.customerOrderCopy}><Text style={styles.customerOrderTitle}>{getLocalized(activeOrder.kitchen.name, language)}</Text><Text style={styles.customerOrderBody}>{activeOrder.id} · {getLocalized(activeOrder.eta, language)}</Text></View><MaterialIcons name="chevron-right" size={20} color="#2E9B72" /></Pressable> : <Pressable onPress={() => onNavigate("home")} style={styles.customerOrderCard}><View style={styles.customerOrderIcon}><MaterialIcons name="add-circle" size={20} color="#00AFC4" /></View><View style={styles.customerOrderCopy}><Text style={styles.customerOrderTitle}>{language === "ar" ? "ابدئي أول طلب" : "Start your first order"}</Text><Text style={styles.customerOrderBody}>{language === "ar" ? "اختاري من مطابخ أمهات الأردن" : "Choose from Jordanian home kitchens"}</Text></View><MaterialIcons name="chevron-right" size={20} color="#00AFC4" /></Pressable>}
      <SectionHeader title={language === "ar" ? "اقتراح أمينة سفرة" : "A table pick for you"} action={language === "ar" ? "افتحي المطبخ" : "Open kitchen"} onAction={() => onNavigate("kitchen")} />
      <Pressable onPress={() => onNavigate("kitchen")} style={styles.recommendedKitchen}><Image source={{ uri: selectedKitchen.image }} style={styles.recommendedKitchenImage} /><View style={styles.recommendedKitchenOverlay} /><View style={styles.recommendedKitchenCopy}><Text style={styles.recommendedKitchenEyebrow}>{language === "ar" ? "الأكثر طلباً حولك" : "Most loved near you"}</Text><Text style={styles.recommendedKitchenName}>{getLocalized(selectedKitchen.name, language)}</Text><Text style={styles.recommendedKitchenMeta}>{getLocalized(selectedKitchen.neighborhood, language)} · 4.9 ★</Text></View></Pressable>
      <View style={styles.dashboardFootnote}><MaterialIcons name="shopping-cart" size={17} color="#00AFC4" /><Text style={styles.dashboardFootnoteText}>{cartCount > 0 ? (language === "ar" ? `${cartCount} أصناف بانتظارك في السفرة` : `${cartCount} items waiting in your cart`) : (language === "ar" ? "كل طلب بيحكي حكاية بيت" : "Every order tells a home story")}</Text></View>
    </ScrollView>
  );
}

function useDriverLocationTracking(enabled: boolean, onLocation: (coordinates: { latitude: number; longitude: number; accuracy?: number }) => void) {
  const callbackRef = useRef(onLocation);
  const [status, setStatus] = useState<"idle" | "requesting" | "active" | "denied" | "unavailable">("idle");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    callbackRef.current = onLocation;
  }, [onLocation]);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let browserWatchId: number | null = null;
    const handlePosition = (position: { coords: { latitude: number; longitude: number; accuracy?: number | null } }) => {
      if (cancelled) return;
      const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: typeof position.coords.accuracy === "number" ? position.coords.accuracy : undefined };
      callbackRef.current(coordinates);
      setLastUpdatedAt(new Date().toISOString());
      setStatus("active");
    };

    void (async () => {
      setStatus("requesting");
      if (Platform.OS === "web") {
        if (!globalThis.navigator?.geolocation) {
          setStatus("unavailable");
          return;
        }
        browserWatchId = globalThis.navigator.geolocation.watchPosition(handlePosition, () => setStatus("denied"), { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 });
        return;
      }
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setStatus("unavailable");
        return;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setStatus("denied");
        return;
      }
      subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 10_000, distanceInterval: 20 }, handlePosition);
      if (!cancelled) setStatus("active");
    })().catch(() => setStatus("denied"));

    return () => {
      cancelled = true;
      subscription?.remove();
      if (browserWatchId !== null) globalThis.navigator?.geolocation?.clearWatch(browserWatchId);
    };
  }, [enabled]);

  return { status, lastUpdatedAt };
}

function useDriverOrderAlert(orderSignature: string, enabled: boolean) {
  const player = useAudioPlayer(require("@/assets/audio/driver-order-alert.wav"));
  const previousSignature = useRef(orderSignature);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).then(() => setAudioReady(true)).catch(() => setAudioReady(false));
  }, []);

  useEffect(() => {
    if (enabled && orderSignature && orderSignature !== previousSignature.current) {
      try {
        player.seekTo(0);
        player.play();
      } catch {
        // Audio is an enhancement; the visible order card remains the source of truth.
      }
    }
    previousSignature.current = orderSignature;
  }, [enabled, orderSignature, player]);

  const playTestAlert = () => {
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // Ignore playback errors on browsers that require a prior user gesture.
    }
  };

  return { audioReady, playTestAlert };
}

function DriverDashboard({ onBack }: { onBack: () => void }) {
  const { language, driverAvailable, setDriverAvailable, driverOrder, driverOrders, selectDriverOrder, driverVerification, advanceDriverOrder, updateDriverLocation, showToast, signOut } = useApp();
  const registerPushTokenMutation = trpc.notifications.registerPushToken.useMutation();
  const updateDriverLocationMutation = trpc.driverLocation.update.useMutation();
  const lastPublishedLocation = useRef<{ orderId: string; latitude: number; longitude: number; at: number } | null>(null);
  const publishDriverLocation = useCallback((coordinates: { latitude: number; longitude: number; accuracy?: number }) => {
    const order = driverOrder;
    const now = Date.now();
    const previous = lastPublishedLocation.current;
    const sameOrder = Boolean(order && previous?.orderId === order.id);
    const movedEnough = !sameOrder || !previous || Math.abs(previous.latitude - coordinates.latitude) >= 0.0003 || Math.abs(previous.longitude - coordinates.longitude) >= 0.0003;
    const waitedEnough = !sameOrder || !previous || now - previous.at >= 30_000;
    if (!movedEnough && !waitedEnough) return;
    updateDriverLocation({ latitude: coordinates.latitude, longitude: coordinates.longitude });
    if (!order) return;
    lastPublishedLocation.current = { orderId: order.id, latitude: coordinates.latitude, longitude: coordinates.longitude, at: now };
    void updateDriverLocationMutation.mutateAsync({ orderId: order.id, latitude: coordinates.latitude, longitude: coordinates.longitude, accuracy: coordinates.accuracy }).catch(() => {
      if (lastPublishedLocation.current?.orderId === order.id && lastPublishedLocation.current.at === now) lastPublishedLocation.current = previous;
    });
  }, [driverOrder, updateDriverLocation, updateDriverLocationMutation]);
  const locationTracking = useDriverLocationTracking(driverAvailable && Boolean(driverOrder) && driverOrder?.status !== "delivered", publishDriverLocation);
  const newOrderSignature = driverOrders.filter((order) => order.status === "received").map((order) => order.id).join("|");
  const orderAlert = useDriverOrderAlert(newOrderSignature, driverAvailable);

  useEffect(() => {
    if (!driverAvailable || Platform.OS === "web") return;
    let cancelled = false;
    const registerDriverPushToken = async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        const finalStatus = existingStatus === "granted" ? existingStatus : (await Notifications.requestPermissionsAsync()).status;
        if (finalStatus !== "granted") return;
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) return;
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        if (!cancelled) await registerPushTokenMutation.mutateAsync({ token, platform: Platform.OS === "ios" ? "ios" : "android" });
      } catch {
        // Push registration is optional; the local sound alert remains available.
      }
    };
    void registerDriverPushToken();
    return () => {
      cancelled = true;
    };
  }, [driverAvailable, registerPushTokenMutation]);
  const currentStatus = driverOrder ? orderStatuses.find((status) => status.id === driverOrder.status) : null;
  const actionLabel = driverOrder?.status === "ready" ? (language === "ar" ? "استلمت الطلب من المطبخ" : "Picked up from kitchen") : driverOrder?.status === "on_the_way" ? (language === "ar" ? "تم التوصيل للعميلة" : "Delivered to customer") : language === "ar" ? "تحديث الحالة" : "Update status";
  const pickupDistance = driverOrder ? distanceKm(driverOrder.driverCoordinates ?? driverOrder.pickupCoordinates, driverOrder.pickupCoordinates) : 0;
  const deliveryDistance = driverOrder ? distanceKm(driverOrder.pickupCoordinates, driverOrder.dropoffCoordinates) : 0;
  const pickupEtaMinutes = Math.max(1, Math.round(pickupDistance * 4));
  const deliveryEtaMinutes = Math.max(5, Math.round(deliveryDistance * 5));
  const driverRating = driverOrder?.driverRating ?? 4.9;
  const requiredCapacity = driverOrder?.requiredCapacity ?? "medium";
  const vehicleType = driverVerification.vehicleType ?? driverOrder?.driver?.vehicleType ?? null;
  const cargoCapacity = driverVerification.cargoCapacity ?? driverOrder?.driver?.cargoCapacity ?? null;
  const capacityFits = driverOrder ? canCarryLoad(cargoCapacity, requiredCapacity) : true;

  const openNavigation = async (destination: "pickup" | "dropoff") => {
    if (!driverOrder) return;
    const coordinates = destination === "pickup" ? driverOrder.pickupCoordinates : driverOrder.dropoffCoordinates;
    const address = destination === "pickup" ? driverOrder.pickupAddress : driverOrder.dropoffAddress;
    const url = `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`;
    try {
      await Linking.openURL(url);
      showToast(language === "ar" ? `تم فتح الخرائط: ${getLocalized(address, language)}` : `Maps opened: ${getLocalized(address, language)}`);
    } catch {
      showToast(language === "ar" ? "تعذر فتح تطبيق الخرائط" : "Could not open maps");
    }
  };

  const advance = () => {
    const shouldNavigateToDropoff = driverOrder?.status === "ready";
    advanceDriverOrder();
    if (shouldNavigateToDropoff) {
      void openNavigation("dropoff");
    } else {
      showToast(language === "ar" ? "تم تحديث حالة التوصيل" : "Delivery status updated");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#082E34" /></Pressable><View><Text style={styles.eyebrow}>{language === "ar" ? "لوحة التوصيل" : "DELIVERY HUB"}</Text><Text style={styles.pageTitle}>{language === "ar" ? "أهلاً يا محمد" : "Good morning, Mohammad"}</Text></View><Pressable onPress={signOut} style={styles.logoutButton}><MaterialIcons name="logout" size={17} color="#00AFC4" /><Text style={styles.logoutText}>{language === "ar" ? "خروج" : "Log out"}</Text></Pressable></View>
      <View style={styles.driverHero}><View><Text style={styles.driverOverline}>{language === "ar" ? "حالة المندوب" : "Driver status"}</Text><Text style={styles.driverTitle}>{driverAvailable ? (language === "ar" ? "متاح للتوصيل" : "Available for deliveries") : (language === "ar" ? "غير متاح الآن" : "Unavailable now")}</Text><Text style={styles.driverBody}>{driverAvailable ? (language === "ar" ? "رح توصلك الطلبات القريبة" : "Nearby orders will appear here") : (language === "ar" ? "شغّل التوفر لاستقبال طلبات" : "Turn on availability to receive orders")}</Text></View><Switch value={driverAvailable} onValueChange={setDriverAvailable} trackColor={{ false: "#D6E2D4", true: "#F2B84B" }} thumbColor={driverAvailable ? "#2E9B72" : "#4C747A"} /></View>
      <View style={styles.driverAlertRow}><MaterialIcons name="notifications-active" size={17} color={orderAlert.audioReady ? "#D76545" : "#8A6516"} /><Text style={styles.driverAlertText}>{orderAlert.audioReady ? (language === "ar" ? "التنبيه الصوتي جاهز للطلبات الجديدة" : "Sound alert is ready for new orders") : (language === "ar" ? "شغّلي الصوت من الجهاز لتنبيه الطلبات" : "Enable device audio for order alerts")}</Text><Pressable onPress={orderAlert.playTestAlert} style={({ pressed }) => [styles.driverAlertButton, pressed && styles.pressed]}><MaterialIcons name="volume-up" size={15} color="#D76545" /><Text style={styles.driverAlertButtonText}>{language === "ar" ? "اختبار" : "Test"}</Text></Pressable></View>
      {driverOrders.length > 1 && <View style={styles.driverOrdersQueue}><Text style={styles.driverOrdersQueueTitle}>{language === "ar" ? `${driverOrders.length} توصيلات مستقلة` : `${driverOrders.length} separate deliveries`}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.driverOrdersQueueRow}>{driverOrders.map((order) => <Pressable key={order.id} onPress={() => selectDriverOrder(order.id)} style={[styles.driverOrderChip, driverOrder?.id === order.id && styles.driverOrderChipActive]}><Text style={[styles.driverOrderChipId, driverOrder?.id === order.id && styles.driverOrderChipTextActive]}>{order.id}</Text><Text style={[styles.driverOrderChipKitchen, driverOrder?.id === order.id && styles.driverOrderChipTextActive]} numberOfLines={1}>{getLocalized(order.kitchen.name, language)}</Text></Pressable>)}</ScrollView></View>}
      <View style={styles.earningsRow}><DashboardMetric label={language === "ar" ? "توصيلات اليوم" : "Today's deliveries"} value="8" icon="two-wheeler" /><DashboardMetric label={language === "ar" ? "أرباح اليوم" : "Today's earnings"} value={language === "ar" ? "٢٤ د.أ" : "JOD 24"} icon="payments" /><DashboardMetric label={language === "ar" ? "التقييم" : "Rating"} value="4.9" icon="star" /></View>
      {driverOrder ? <>
        <View style={styles.driverOrderCard}><View style={styles.driverOrderHeader}><View><Text style={styles.incomingEyebrow}>{language === "ar" ? "التوصيلة الحالية" : "Current delivery"}</Text><Text style={styles.incomingId}>{driverOrder.id}</Text></View><View style={styles.driverOrderTag}><View style={styles.liveDot} /><Text style={styles.driverOrderTagText}>{currentStatus ? getLocalized(currentStatus.label, language) : "Live"}</Text></View></View><Text style={styles.driverOrderTitle}>{driverOrder.items.map((item) => `${item.quantity}× ${getLocalized(item.meal.name, language)}`).join("، ")}</Text><Text style={styles.driverOrderMeta}>{language === "ar" ? "استلام من" : "Pickup from"} {getLocalized(driverOrder.kitchen.name, language)} · {getLocalized(driverOrder.kitchen.neighborhood, language)}</Text><View style={[styles.capacityMatch, capacityFits ? styles.capacityMatchOk : styles.capacityMatchWarn]}><MaterialIcons name={capacityFits ? "check-circle" : "warning-amber"} size={16} color={capacityFits ? "#2E9B72" : "#C4555D"} /><Text style={[styles.capacityMatchText, !capacityFits && styles.capacityMatchTextWarn]}>{capacityFits ? (language === "ar" ? `${vehicleType ? getLocalized(driverVehicleLabels[vehicleType], language) : "مركبتك"} مناسبة لحمولة ${getLocalized(loadCapacityLabels[requiredCapacity], language)}` : `${vehicleType ? getLocalized(driverVehicleLabels[vehicleType], language) : "Your vehicle"} fits the ${getLocalized(loadCapacityLabels[requiredCapacity], language)} order`) : (language === "ar" ? "هذه الحمولة أكبر من سعة مركبتك" : "This order is larger than your vehicle capacity")}</Text></View>{driverOrder.specialRequests ? <View style={styles.driverSpecialRequest}><MaterialIcons name="edit-note" size={18} color="#8A6516" /><View style={styles.specialRequestCopy}><Text style={styles.specialRequestTitle}>{language === "ar" ? "تعليمات العميل" : "Customer instructions"}</Text><Text style={styles.specialRequestBody}>{driverOrder.specialRequests}</Text></View></View> : null}</View>
                 <OrderChat orderId={driverOrder.id} language={language} />
         <View style={styles.driverLocationStatus}><MaterialIcons name={locationTracking.status === "active" ? "my-location" : locationTracking.status === "denied" ? "location-disabled" : "location-searching"} size={17} color={locationTracking.status === "active" ? "#2E9B72" : "#C98A2E"} /><View style={styles.driverLocationCopy}><Text style={styles.driverLocationTitle}>{locationTracking.status === "active" ? (language === "ar" ? "موقعك يُحدّث أثناء التوصيل" : "Your location is updating") : locationTracking.status === "requesting" ? (language === "ar" ? "جارٍ طلب صلاحية الموقع..." : "Requesting location permission...") : locationTracking.status === "denied" ? (language === "ar" ? "صلاحية الموقع مرفوضة" : "Location permission denied") : locationTracking.status === "unavailable" ? (language === "ar" ? "الموقع غير متاح حالياً" : "Location is currently unavailable") : (language === "ar" ? "تتبّع الموقع متوقف" : "Location tracking paused")}</Text><Text style={styles.driverLocationMeta}>{locationTracking.lastUpdatedAt ? `${language === "ar" ? "آخر تحديث" : "Last update"} ${new Date(locationTracking.lastUpdatedAt).toLocaleTimeString(language === "ar" ? "ar-JO" : "en-JO", { hour: "2-digit", minute: "2-digit" })}` : (language === "ar" ? "يظهر موقع السائق للعميلة بعد أول تحديث" : "The customer sees the driver after the first update")}</Text></View><View style={[styles.driverLocationDot, locationTracking.status === "active" && styles.driverLocationDotActive]} /></View>
        <MapPreview pickupCoordinates={driverOrder.pickupCoordinates} driverCoordinates={driverOrder.driverCoordinates} dropoffCoordinates={driverOrder.dropoffCoordinates} onPressMap={() => void openNavigation(driverOrder.status === "ready" ? "pickup" : "dropoff")} />
        <View style={styles.routeCard}>
          <Pressable onPress={() => void openNavigation("pickup")} style={({ pressed }) => [styles.routeRow, pressed && styles.pressed]}><View style={[styles.routeMarker, styles.routeMarkerPickup]}><MaterialIcons name="storefront" size={14} color="#FFFFFF" /></View><View style={styles.routeCopy}><Text style={styles.routeLabel}>{language === "ar" ? "استلام من المطبخ" : "Pickup from kitchen"}</Text><Text style={styles.routeValue}>{getLocalized(driverOrder.pickupAddress, language)}</Text><Text style={styles.routeCoordinates}>{driverOrder.pickupCoordinates.latitude.toFixed(5)}, {driverOrder.pickupCoordinates.longitude.toFixed(5)}</Text><Text style={styles.routeDistance}>{language === "ar" ? `${pickupDistance.toFixed(1)} كم · حوالي ${pickupEtaMinutes} دقيقة للوصول` : `${pickupDistance.toFixed(1)} km · about ${pickupEtaMinutes} min to arrive`}</Text></View><MaterialIcons name="directions" size={20} color="#00AFC4" /></Pressable>
          <View style={styles.routeLine} />
          <Pressable onPress={() => void openNavigation("dropoff")} style={({ pressed }) => [styles.routeRow, pressed && styles.pressed]}><View style={[styles.routeMarker, styles.routeMarkerDropoff]}><MaterialIcons name="location-on" size={14} color="#FFFFFF" /></View><View style={styles.routeCopy}><Text style={styles.routeLabel}>{language === "ar" ? "تسليم للعميلة" : "Drop-off"}</Text><Text style={styles.routeValue}>{getLocalized(driverOrder.dropoffAddress, language)}</Text><Text style={styles.routeCoordinates}>{driverOrder.dropoffCoordinates.latitude.toFixed(5)}, {driverOrder.dropoffCoordinates.longitude.toFixed(5)}</Text><Text style={styles.routeDistance}>{language === "ar" ? `${deliveryDistance.toFixed(1)} كم · حوالي ${deliveryEtaMinutes} دقيقة للتسليم` : `${deliveryDistance.toFixed(1)} km · about ${deliveryEtaMinutes} min to deliver`}</Text></View><MaterialIcons name="directions" size={20} color="#00AFC4" /></Pressable>
        </View>
        <View style={styles.driverRatingsRow}><View style={styles.driverRatingBox}><MaterialIcons name="two-wheeler" size={17} color="#00AFC4" /><View><Text style={styles.driverRatingLabel}>{language === "ar" ? "تقييم السائق" : "Driver rating"}</Text><Text style={styles.driverRatingValue}>{driverRating.toFixed(1)} ★</Text></View></View><View style={styles.driverRatingBox}><MaterialIcons name="storefront" size={17} color="#2E9B72" /><View><Text style={styles.driverRatingLabel}>{language === "ar" ? "تقييم المتجر" : "Store rating"}</Text><Text style={styles.driverRatingValue}>{driverOrder.kitchen.rating.toFixed(1)} ★</Text></View></View></View>
        {driverOrder.status !== "delivered" ? <Pressable disabled={!capacityFits} onPress={advance} style={({ pressed }) => [styles.driverActionButton, !capacityFits && styles.driverActionDisabled, pressed && styles.pressed]}>
<MaterialIcons name={driverOrder.status === "ready" ? "shopping-bag" : "check-circle"} size={19} color="#FFFFFF" /><Text style={styles.driverActionButtonText}>{actionLabel}</Text></Pressable> : <View style={styles.driverDone}><MaterialIcons name="check-circle" size={21} color="#2E9B72" /><Text style={styles.driverDoneText}>{language === "ar" ? "تمت التوصيلة بنجاح، يعطيك العافية" : "Delivery complete, great work"}</Text></View>}
      </> : <View style={styles.driverDone}><MaterialIcons name="local-cafe" size={21} color="#00AFC4" /><Text style={styles.driverDoneText}>{language === "ar" ? "ما في طلبات قريبة حالياً" : "No nearby orders right now"}</Text></View>}
      <SectionHeader title={language === "ar" ? "مراحل التوصيل" : "Delivery steps"} action={language === "ar" ? "الدعم" : "Support"} onAction={() => showToast(language === "ar" ? "فريق الدعم معك" : "Support is here for you")} />
      <View style={styles.trackingCard}>{orderStatuses.slice(1, 5).map((status, index) => { const active = driverOrder ? orderStatuses.findIndex((item) => item.id === driverOrder.status) >= index + 2 : false; return <View key={status.id} style={styles.trackingRow}><View style={styles.trackRail}><View style={[styles.trackDot, active && styles.trackDotDone]}>{active && <MaterialIcons name="check" size={12} color="#FFFFFF" />}</View>{index < 3 && <View style={[styles.trackLine, active && styles.trackLineDone]} />}</View><View style={styles.trackCopy}><Text style={[styles.trackLabel, active && styles.trackLabelActive]}>{getLocalized(status.label, language)}</Text><Text style={styles.trackCaption}>{getLocalized(status.caption, language)}</Text></View><MaterialIcons name={status.icon as IconName} size={19} color={active ? "#2E9B72" : "#8ABAC0"} /></View>; })}</View>
    </ScrollView>
  );
}

function DiscoverMapScreen({ onBack, onOpenMeals }: { onBack: () => void; onOpenMeals: () => void }) {
  const { language, selectedRegion, setSelectedRegion } = useApp();
  const region = getRegion(selectedRegion);
  const nearbyKitchens = useMemo(() => [...kitchens].sort((left, right) => getKitchenDistanceKm(left, region) - getKitchenDistanceKm(right, region)).slice(0, 3), [region]);

  return (
    <View style={styles.fullScreenPage}>
      <View style={styles.fullScreenHeader}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#082E34" /></Pressable><View style={styles.fullScreenHeaderCopy}><Text style={styles.eyebrow}>{language === "ar" ? "اكتشفني" : "DISCOVER"}</Text><Text style={styles.pageTitle}>{language === "ar" ? "مطابخ حولك" : "Kitchens around you"}</Text></View><View style={styles.mapHeaderBadge}><MaterialIcons name="navigation" size={15} color="#2E9B72" /><Text style={styles.mapHeaderBadgeText}>{getLocalized(region.label, language)}</Text></View></View>
      <View style={styles.fullMapArea}><MapPreview fullScreen onSelectRegion={(regionId) => { setSelectedRegion(regionId); }} /></View>
      <View style={styles.discoverSheet}><View style={styles.discoverSheetHandle} /><View style={styles.discoverSheetTop}><View><Text style={styles.discoverEyebrow}>{language === "ar" ? "الأقرب أولاً" : "NEAREST FIRST"}</Text><Text style={styles.discoverTitle}>{language === "ar" ? `أقرب مطابخ من ${getLocalized(region.label, language)}` : `Closest kitchens to ${getLocalized(region.label, language)}`}</Text></View><Text style={styles.discoverCount}>{kitchens.length} {language === "ar" ? "مطبخ" : "kitchens"}</Text></View><View style={styles.nearbyPreviewRow}>{nearbyKitchens.map((kitchen) => <View key={kitchen.id} style={styles.nearbyPreview}><View style={[styles.nearbyPreviewDot, { backgroundColor: kitchen.accent }]} /><View style={styles.nearbyPreviewCopy}><Text style={styles.nearbyPreviewName} numberOfLines={1}>{getLocalized(kitchen.name, language)}</Text><Text style={styles.nearbyPreviewDistance}>{getKitchenDistanceKm(kitchen, region).toFixed(1)} {language === "ar" ? "كم" : "km"}</Text></View></View>)}</View><Pressable onPress={onOpenMeals} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{language === "ar" ? "شاهدي كل الأكلات القريبة" : "See all nearby meals"}</Text><MaterialIcons name="restaurant" size={18} color="#FFFFFF" /></Pressable></View>
    </View>
  );
}

function MealsScreen({ onBack, onOpenCart, onOpenKitchen, onRequestAdd }: { onBack: () => void; onOpenCart: () => void; onOpenKitchen: (kitchenId: string) => void; onRequestAdd: (meal: (typeof meals)[number]) => void }) {
  const { language, selectedRegion, selectedCategory, selectedSubcategory, setSelectedRegion, setSelectedCategory, setSelectedSubcategory, updateQuantity, cart, availableMeals } = useApp();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [regionScope, setRegionScope] = useState<RegionId | "all">(selectedRegion);
  const [filterSort, setFilterSort] = useState<UnifiedFilterSort>("distance");
  const region = getRegion(selectedRegion);
  const activeRegion = regionScope === "all" ? region : getRegion(regionScope);
  const mealsTitle = selectedCategory === "all" ? (language === "ar" ? "كل الأكلات القريبة" : "All nearby meals") : getLocalized(getCategory(selectedCategory).label, language);
  const nearbyMeals = useMemo(() => availableMeals.filter((meal) => (selectedCategory === "all" || meal.category === selectedCategory) && (selectedSubcategory === "all" || meal.subcategory === selectedSubcategory)).map((meal) => {
    const kitchen = kitchens.find((item) => item.id === meal.kitchenId) ?? kitchens[0];
    return { meal, kitchen, distance: getKitchenDistanceKm(kitchen, activeRegion) };
  }).filter(({ kitchen }) => regionScope === "all" || kitchen.region === regionScope).sort((left, right) => {
    if (filterSort === "rating") return right.kitchen.rating - left.kitchen.rating;
    if (filterSort === "fast") return left.meal.prepMinutes - right.meal.prepMinutes;
    if (filterSort === "high") return right.meal.price - left.meal.price;
    if (filterSort === "low") return left.meal.price - right.meal.price;
    return left.distance - right.distance;
  }), [activeRegion, availableMeals, regionScope, selectedCategory, selectedSubcategory, filterSort]);

  return (
    <View style={styles.fullScreenPage}><ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}><View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#082E34" /></Pressable><View style={styles.fullScreenHeaderCopy}><Text style={styles.eyebrow}>{language === "ar" ? "كل الأكلات" : "ALL MEALS"}</Text><Text style={styles.pageTitle}>{mealsTitle}</Text></View><View style={styles.mapHeaderBadge}><MaterialIcons name="navigation" size={15} color="#2E9B72" /><Text style={styles.mapHeaderBadgeText}>{regionScope === "all" ? (language === "ar" ? "كل المملكة" : "All Jordan") : getLocalized(activeRegion.label, language)}</Text></View><Pressable onPress={() => setFiltersOpen(true)} style={({ pressed }) => [styles.mealsFilterButton, filtersOpen && styles.mealsFilterButtonActive, pressed && styles.pressed]}><MaterialIcons name="tune" size={18} color={filtersOpen ? "#FFFFFF" : "#00AFC4"} /><Text style={[styles.mealsFilterButtonText, filtersOpen && styles.mealsFilterButtonTextActive]}>{language === "ar" ? "فلاتر" : "Filters"}</Text></Pressable></View><UnifiedFilters visible={filtersOpen} language={language} regionScope={regionScope} category={selectedCategory} subcategory={selectedSubcategory} sort={filterSort} onRegionChange={(next) => { setRegionScope(next); if (next !== "all") setSelectedRegion(next); }} onCategoryChange={setSelectedCategory} onSubcategoryChange={setSelectedSubcategory} onSortChange={setFilterSort} onClose={() => setFiltersOpen(false)} /><View style={styles.mealsIntro}><Text style={styles.mealsIntroTitle}>{language === "ar" ? "اختاري طبختك من حولك" : "Choose a dish around you"}</Text><Text style={styles.mealsIntroBody}>{language === "ar" ? "رتبنا لك كل الأصناف حسب قرب المطبخ من منطقتك." : "Every dish is ordered by how close its kitchen is to your region."}</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{["all", ...categories.map((category) => category.id)].map((categoryId) => { const category = categoryId === "all" ? null : getCategory(categoryId as never); return <Chip key={categoryId} label={category ? getLocalized(category.label, language) : language === "ar" ? "الكل" : "All"} selected={selectedCategory === categoryId} onPress={() => setSelectedCategory(categoryId as typeof selectedCategory)} />; })}</ScrollView><View style={styles.nearbySectionHeader}><Text style={styles.sectionTitle}>{language === "ar" ? `${nearbyMeals.length} صنف قريب منك` : `${nearbyMeals.length} meals near you`}</Text><Text style={styles.nearbySortLabel}>{language === "ar" ? "الأقرب ← الأبعد" : "Nearest → farthest"}</Text></View><View style={styles.mealList}>{nearbyMeals.map(({ meal, kitchen, distance }) => <View key={meal.id} style={styles.nearbyMealBlock}><MealRow meal={meal} language={language} quantity={cart.find((item) => item.meal.id === meal.id)?.quantity ?? 0} onRemove={() => updateQuantity(meal.id, (cart.find((item) => item.meal.id === meal.id)?.quantity ?? 1) - 1)} onPress={() => onOpenKitchen(kitchen.id)} onAdd={() => onRequestAdd(meal)} /><View style={styles.nearbyMealMeta}><Pressable onPress={() => onOpenKitchen(kitchen.id)} style={styles.nearbyKitchenLink}><MaterialIcons name="storefront" size={13} color="#2E9B72" /><Text style={styles.nearbyKitchenLinkText}>{getLocalized(kitchen.name, language)}</Text></Pressable><Text style={styles.nearbyDistance}><MaterialIcons name="navigation" size={12} color="#00AFC4" /> {distance.toFixed(1)} {language === "ar" ? "كم" : "km"}</Text></View></View>)}</View></ScrollView></View>
  );
}

function CustomerHome({
  view,
  query,
  setQuery,
  onNavigate,
  onRequestAdd,
}: {
  view: ViewId;
  query: string;
  setQuery: (value: string) => void;
  onNavigate: (view: ViewId) => void;
  onRequestAdd: (meal: (typeof meals)[number]) => void;
}) {
  const {
    language,
    cart,
    cartCount,
    selectedRegion,
    selectedCategory,
    selectedSubcategory,
    setSelectedRegion,
    setSelectedCategory,
    setSelectedSubcategory,
    setSelectedKitchenId,
    availableMeals,
    activeOrder,
    updateQuantity,
    isKitchenAvailable,
  } = useApp();
  const { mealIds: favoriteMealIds, kitchenIds: favoriteKitchenIds, toggle: toggleFavorite } = useFavorites();
  const favoriteCount = favoriteMealIds.size + favoriteKitchenIds.size;
  const announcementsQuery = trpc.marketing.announcements.useQuery(undefined, { staleTime: 60_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false });
  const offersQuery = trpc.marketing.offers.useQuery(undefined, { staleTime: 60_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false });
  const announcements = useMemo<AnnouncementSlide[]>(() => announcementsQuery.data !== undefined ? announcementsQuery.data.map((item) => ({ ...item, icon: item.icon as IconName, imageUrl: resolveRemoteAssetUrl(item.imageUrl) })) : FALLBACK_ANNOUNCEMENTS, [announcementsQuery.data]);
  const offerRecords = useMemo(() => offersQuery.data ?? [], [offersQuery.data]);
  const offerMealIds = useMemo(() => new Set(offersQuery.data !== undefined ? offerRecords.map((offer) => offer.mealId) : [...OFFER_MEAL_IDS]), [offersQuery.data, offerRecords]);
  const offerBadges = useMemo(() => new Map(offerRecords.map((offer) => [offer.mealId, language === "ar" ? offer.badgeAr : offer.badgeEn])), [offerRecords, language]);
  const offerImages = useMemo(() => new Map(offerRecords.map((offer) => [offer.mealId, resolveRemoteAssetUrl(offer.imageUrl)])), [offerRecords]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [regionScope, setRegionScope] = useState<RegionId | "all">("all");
  const [filterSort, setFilterSort] = useState<UnifiedFilterSort>("recommended");
  const [offersOnly, setOffersOnly] = useState(false);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const region = getRegion(selectedRegion);
  const announcement = announcements[announcementIndex] ?? announcements[0];
  const kitchenById = useMemo(() => new Map(kitchens.map((kitchen) => [kitchen.id, kitchen])), []);
  const cartQuantityByMeal = useMemo(() => new Map(cart.map((item) => [item.meal.id, item.quantity])), [cart]);
  useEffect(() => { const timer = setInterval(() => setAnnouncementIndex((current) => (current + 1) % announcements.length), 5000); return () => clearInterval(timer); }, [announcements.length]);

  const visibleKitchens = useMemo(() => regionScope === "all" ? kitchens : kitchens.filter((kitchen) => kitchen.region === regionScope), [regionScope]);

  const visibleMeals = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = availableMeals.filter((meal) => {
      const matchesQuery = !normalized || `${meal.name.ar} ${meal.name.en}`.toLowerCase().includes(normalized);
      const matchesCategory = selectedCategory === "all" || meal.category === selectedCategory;
      const matchesSubcategory = selectedSubcategory === "all" || meal.subcategory === selectedSubcategory;
      const matchesOffer = !offersOnly || offerMealIds.has(meal.id);
      const kitchen = kitchenById.get(meal.kitchenId);
      const matchesRegion = regionScope === "all" || kitchen?.region === regionScope;
      return matchesQuery && matchesCategory && matchesSubcategory && matchesOffer && matchesRegion;
    });
    return [...filtered].sort((left, right) => {
      const leftKitchen = kitchenById.get(left.kitchenId);
      const rightKitchen = kitchenById.get(right.kitchenId);
      if (filterSort === "high") return right.price - left.price;
      if (filterSort === "low") return left.price - right.price;
      if (filterSort === "rating") return (rightKitchen?.rating ?? 0) - (leftKitchen?.rating ?? 0);
      if (filterSort === "fast") return left.prepMinutes - right.prepMinutes;
      if (filterSort === "distance") return (leftKitchen ? getKitchenDistanceKm(leftKitchen, region) : Number.MAX_SAFE_INTEGER) - (rightKitchen ? getKitchenDistanceKm(rightKitchen, region) : Number.MAX_SAFE_INTEGER);
      return (rightKitchen?.rating ?? 0) - (leftKitchen?.rating ?? 0);
    });
  }, [availableMeals, query, selectedCategory, selectedSubcategory, regionScope, filterSort, region, offersOnly, offerMealIds, kitchenById]);

  const openKitchen = (kitchenId: string) => {
    setSelectedKitchenId(kitchenId);
    onNavigate("kitchen");
  };

  const title = view === "explore" ? (language === "ar" ? "اكتشفي سفرتك" : "Discover your table") : language === "ar" ? "أهلاً يا جارتنا" : "Welcome, neighbor";

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View style={styles.brandCluster}>
          <Image source={require("@/assets/images/icon.png")} style={styles.brandIcon} />
          <View>
            <Text style={styles.eyebrow}>{language === "ar" ? "سفرة أمي" : "SUFRET OMI"}</Text>
            <Text style={styles.headerGreeting}>{title}</Text>
          </View>
        </View>
        <View style={styles.headerActions} />
      </View>
      <View style={styles.unifiedControlsRow}>
        <LanguageToggle />
        <View style={styles.unifiedSearchField}><MaterialIcons name="search" size={18} color="#4C747A" /><TextInput value={query} onChangeText={setQuery} placeholder={language === "ar" ? "ابحثي" : "Search"} placeholderTextColor="#8ABAC0" style={styles.unifiedSearchInput} textAlign={language === "ar" ? "right" : "left"} /></View>
        <Pressable onPress={() => setFiltersOpen((value) => !value)} style={({ pressed }) => [styles.unifiedIconButton, filtersOpen && styles.unifiedIconButtonActive, pressed && styles.pressed]}><MaterialIcons name="tune" size={18} color={filtersOpen ? "#FFFFFF" : "#00AFC4"} /></Pressable>
        <Pressable onPress={() => onNavigate("favorites")} style={({ pressed }) => [styles.unifiedIconButton, view === "favorites" && styles.unifiedIconButtonActive, pressed && styles.pressed]}><MaterialIcons name={view === "favorites" ? "favorite" : "favorite-border"} size={18} color={view === "favorites" ? "#FFFFFF" : "#D76545"} />{favoriteCount > 0 && <View style={styles.favoriteBadge}><Text style={styles.favoriteBadgeText}>{favoriteCount}</Text></View>}</Pressable>
        <Pressable onPress={() => onNavigate("cart")} style={({ pressed }) => [styles.unifiedCartButton, pressed && styles.pressed]}><MaterialIcons name="shopping-cart" size={19} color="#FFFFFF" />{cartCount > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>}</Pressable>
      </View>
      {!isKitchenAvailable && <View style={styles.scheduleClosedBanner}><MaterialIcons name="event-busy" size={19} color="#A55A40" /><View style={styles.scheduleClosedCopy}><Text style={styles.scheduleClosedTitle}>{language === "ar" ? "المطبخ مغلق اليوم" : "Kitchen closed today"}</Text><Text style={styles.scheduleClosedBody}>{language === "ar" ? "يمكنك التصفح الآن والطلب في يوم متاح." : "You can browse now and order on an available day."}</Text></View></View>}

      <View style={styles.announcementBoard}>
        <View style={styles.announcementSlide}><View style={styles.announcementSlideCopy}><View style={styles.announcementSlideHeader}><View style={styles.announcementHeaderIcon}><MaterialIcons name="campaign" size={21} color="#FFFFFF" /></View><Text style={styles.announcementSlideEyebrow}>{language === "ar" ? announcement.eyebrowAr : announcement.eyebrowEn}</Text></View><Text style={styles.announcementSlideTitle}>{language === "ar" ? announcement.titleAr : announcement.titleEn}</Text><Text style={styles.announcementSlideBody}>{language === "ar" ? announcement.bodyAr : announcement.bodyEn}</Text><Pressable onPress={() => onNavigate(announcement.target)} style={({ pressed }) => [styles.announcementCta, pressed && styles.pressed]}><Text style={styles.announcementCtaText}>{language === "ar" ? announcement.ctaAr : announcement.ctaEn}</Text><MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" /></Pressable></View><View style={styles.announcementVisual}>{announcement.imageUrl ? <Image source={{ uri: announcement.imageUrl }} style={styles.announcementImage} /> : <View style={styles.announcementVisualCircle}><MaterialIcons name={announcement.icon} size={42} color="#00AFC4" /></View>}<View style={styles.announcementVisualSparkOne} /><View style={styles.announcementVisualSparkTwo} /></View></View>
        <View style={styles.announcementFooter}><View style={styles.announcementDots}>{announcements.map((item, index) => <Pressable key={item.id} onPress={() => setAnnouncementIndex(index)} style={[styles.announcementDot, index === announcementIndex && styles.announcementDotActive]} />)}</View><View style={styles.announcementNav}><Pressable onPress={() => setAnnouncementIndex((current) => (current - 1 + announcements.length) % announcements.length)} style={styles.announcementNavButton}><MaterialIcons name="chevron-left" size={18} color="#00AFC4" /></Pressable><Text style={styles.announcementCounter}>{announcementIndex + 1}/{announcements.length}</Text><Pressable onPress={() => setAnnouncementIndex((current) => (current + 1) % announcements.length)} style={styles.announcementNavButton}><MaterialIcons name="chevron-right" size={18} color="#00AFC4" /></Pressable></View></View>
      </View>


      {filtersOpen && (
        <View style={styles.filterPanel}>
          <UnifiedFilters visible={filtersOpen} language={language} regionScope={regionScope} category={selectedCategory} subcategory={selectedSubcategory} sort={filterSort} onRegionChange={(next) => { setRegionScope(next); if (next !== "all") setSelectedRegion(next); }} onCategoryChange={(next) => { setOffersOnly(false); setSelectedCategory(next); }} onSubcategoryChange={setSelectedSubcategory} onSortChange={setFilterSort} onClose={() => setFiltersOpen(false)} />
        </View>
      )}

      <SectionHeader title={language === "ar" ? "شو نفسِك اليوم؟" : "What are you craving?"} action={language === "ar" ? "الكل" : "See all"} onAction={() => onNavigate("meals")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        <CategoryPill label={language === "ar" ? "الكل" : "All"} icon="apps" color="#00AFC4" selected={!offersOnly && selectedCategory === "all"} onPress={() => { setOffersOnly(false); setSelectedCategory("all"); }} />
        <CategoryPill label={language === "ar" ? "العروض" : "Offers"} icon="local-offer" color="#D76545" selected={offersOnly} onPress={() => { setOffersOnly(true); setSelectedCategory("all"); }} />
        {categories.map((category) => (
          <CategoryPill key={category.id} label={getLocalized(category.label, language)} icon={category.icon as IconName} color={category.color} selected={!offersOnly && selectedCategory === category.id} onPress={() => { setOffersOnly(false); setSelectedCategory(category.id); }} />
        ))}
      </ScrollView>

      <SectionHeader title={language === "ar" ? `حول ${regionScope === "all" ? "كل المملكة" : getLocalized(region.label, language)}` : regionScope === "all" ? "Around all Jordan" : `Around ${getLocalized(region.label, language)}`} action={language === "ar" ? "الخريطة" : "Map"} onAction={() => onNavigate("discover")} />
      <MapPreview compact onSelectRegion={(regionId) => { setSelectedRegion(regionId); setRegionScope(regionId); }} onPressMap={() => onNavigate("discover")} />

      {activeOrder && (
        <Pressable onPress={() => onNavigate("orders")} style={styles.activeOrderCard}>
          <View style={styles.activeOrderTop}><View style={styles.liveDot} /><Text style={styles.activeOrderEyebrow}>{language === "ar" ? "طلبك يتحضّر الآن" : "Your order is cooking"}</Text><Text style={styles.activeOrderId}>{activeOrder.id}</Text></View>
          <View style={styles.activeOrderBody}><View><Text style={styles.activeOrderTitle}>{getLocalized(activeOrder.kitchen.name, language)}</Text><Text style={styles.activeOrderMeta}>{getLocalized(activeOrder.eta, language)}</Text></View><MaterialIcons name="chevron-right" size={22} color="#00AFC4" /></View>
        </Pressable>
      )}

      <SectionHeader title={language === "ar" ? "مطابخ بتحبّوها" : "Loved home kitchens"} action={language === "ar" ? "شوفي الكل" : "See all"} onAction={() => onNavigate("discover")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kitchenRow}>
        {visibleKitchens.map((kitchen) => (
          <Pressable key={kitchen.id} onPress={() => openKitchen(kitchen.id)} style={({ pressed }) => [styles.kitchenCard, pressed && styles.pressed]}><Pressable onPress={(event) => { event.stopPropagation(); void toggleFavorite("kitchen", kitchen.id); }} style={styles.favoriteFloatingButton}><MaterialIcons name={favoriteKitchenIds.has(kitchen.id) ? "favorite" : "favorite-border"} size={18} color={favoriteKitchenIds.has(kitchen.id) ? "#D76545" : "#00AFC4"} /></Pressable>
            <View style={styles.kitchenImageWrap}><Image source={{ uri: kitchen.image }} style={styles.kitchenImage} /><View style={[styles.openPill, !kitchen.isOpen && styles.closedPill]}><View style={[styles.openDot, !kitchen.isOpen && styles.closedDot]} /><Text style={styles.openText}>{kitchen.isOpen ? (language === "ar" ? "مفتوح" : "Open") : (language === "ar" ? "مغلق" : "Closed")}</Text></View><View style={styles.ratingPill}><MaterialIcons name="star" size={12} color="#F2B84B" /><Text style={styles.ratingText}>{kitchen.rating}</Text></View></View>
            <View style={styles.kitchenCardCopy}><Text style={styles.kitchenName} numberOfLines={1}>{getLocalized(kitchen.name, language)}</Text><Text style={styles.kitchenNeighborhood}>{getLocalized(kitchen.neighborhood, language)}</Text><View style={styles.kitchenMeta}><Text style={styles.kitchenSpecialty}>{getLocalized(getCategory(kitchen.specialty).label, language)}</Text><Text style={styles.kitchenReviews}>· {kitchen.reviewCount} {language === "ar" ? "تقييم" : "reviews"}</Text></View></View>
          </Pressable>
        ))}
      </ScrollView>

      <SectionHeader title={offersOnly ? (language === "ar" ? "عروض اليوم" : "Today's offers") : language === "ar" ? "أكثر الأكلات طلباً" : "Most ordered today"} action={language === "ar" ? "أضيفي للسفرة" : "Add to table"} />
      <View style={styles.mealList}>
        {visibleMeals.map((meal) => {
          const quantity = cartQuantityByMeal.get(meal.id) ?? 0;
          return <MealRow key={meal.id} meal={meal} language={language} isFavorite={favoriteMealIds.has(meal.id)} onToggleFavorite={() => void toggleFavorite("meal", meal.id)} offerBadge={offersOnly ? offerBadges.get(meal.id) : undefined} offerImage={offersOnly ? offerImages.get(meal.id) : undefined} quantity={quantity} onRemove={() => updateQuantity(meal.id, Math.max(0, quantity - 1))} onPress={() => openKitchen(meal.kitchenId)} onAdd={() => onRequestAdd(meal)} />;
        })}
      </View>
      {visibleMeals.length === 0 && <EmptyState language={language} />}

    </ScrollView>
  );
}

function FavoritesScreen({ onBack, onOpenKitchen, onRequestAdd }: { onBack: () => void; onOpenKitchen: (kitchenId: string) => void; onRequestAdd: (meal: (typeof meals)[number]) => void }) {
  const { language, cart, updateQuantity, availableMeals } = useApp();
  const { mealIds, kitchenIds, toggle } = useFavorites();
  const favoriteMeals = availableMeals.filter((meal) => mealIds.has(meal.id));
  const favoriteKitchens = kitchens.filter((kitchen) => kitchenIds.has(kitchen.id));
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
    <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#082E34" /></Pressable><View><Text style={styles.eyebrow}>{language === "ar" ? "محفوظاتك" : "YOUR SAVED TABLE"}</Text><Text style={styles.pageTitle}>{language === "ar" ? "المفضلة" : "Favorites"}</Text></View><View style={styles.favoriteHeaderIcon}><MaterialIcons name="favorite" size={19} color="#D76545" /></View></View>
    {favoriteKitchens.length > 0 && <><View style={styles.favoritesSectionHeader}><Text style={styles.sectionTitle}>{language === "ar" ? "مطابخي المفضلة" : "Saved kitchens"}</Text><Text style={styles.favoritesCount}>{favoriteKitchens.length}</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kitchenRow}>{favoriteKitchens.map((kitchen) => <Pressable key={kitchen.id} onPress={() => onOpenKitchen(kitchen.id)} style={({ pressed }) => [styles.kitchenCard, pressed && styles.pressed]}><Pressable onPress={(event) => { event.stopPropagation(); void toggle("kitchen", kitchen.id); }} style={styles.favoriteFloatingButton}><MaterialIcons name="favorite" size={18} color="#D76545" /></Pressable><View style={styles.kitchenImageWrap}><Image source={{ uri: kitchen.image }} style={styles.kitchenImage} /></View><View style={styles.kitchenCardCopy}><Text style={styles.kitchenName} numberOfLines={1}>{getLocalized(kitchen.name, language)}</Text><Text style={styles.kitchenNeighborhood}>{getLocalized(kitchen.neighborhood, language)}</Text></View></Pressable>)}</ScrollView></>}
    <View style={styles.favoritesSectionHeader}><Text style={styles.sectionTitle}>{language === "ar" ? "أطباقي المفضلة" : "Saved meals"}</Text><Text style={styles.favoritesCount}>{favoriteMeals.length}</Text></View>
    {favoriteMeals.length > 0 ? <View style={styles.mealList}>{favoriteMeals.map((meal) => <MealRow key={meal.id} meal={meal} language={language} isFavorite onToggleFavorite={() => void toggle("meal", meal.id)} quantity={cart.find((item) => item.meal.id === meal.id)?.quantity ?? 0} onRemove={() => updateQuantity(meal.id, (cart.find((item) => item.meal.id === meal.id)?.quantity ?? 1) - 1)} onAdd={() => onRequestAdd(meal)} onPress={() => onOpenKitchen(meal.kitchenId)} />)}</View> : <View style={styles.emptyState}><MaterialIcons name="favorite-border" size={34} color="#D76545" /><Text style={styles.emptyTitle}>{language === "ar" ? "لم تحفظي شيئاً بعد" : "Nothing saved yet"}</Text><Text style={styles.emptyBody}>{language === "ar" ? "اضغطي القلب بجانب أي طبق أو مطبخ ليظهر هنا." : "Tap the heart beside any meal or kitchen to save it here."}</Text><Pressable onPress={onBack} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{language === "ar" ? "اكتشفي الأكلات" : "Discover meals"}</Text></Pressable></View>}
  </ScrollView>;
}

function KitchenProfile({ onBack, onCart, onRequestAdd }: { onBack: () => void; onCart: () => void; onRequestAdd: (meal: (typeof meals)[number]) => void }) {
  const { language, selectedKitchen, cart, cartCount, updateQuantity, availableMeals, kitchenDescriptions } = useApp();
  const { mealIds: favoriteMealIds, kitchenIds: favoriteKitchenIds, toggle: toggleFavorite } = useFavorites();
  const kitchenDescriptionQuery = trpc.kitchens.profile.useQuery({ kitchenId: selectedKitchen.id }, { staleTime: 30_000, gcTime: 5 * 60_000, retry: false });
  const fallbackDescription = kitchenDescriptions[selectedKitchen.id] ?? { ...(selectedKitchen.description ?? { ar: "أكلات بيتية طازجة نحضرها يومياً بحب.", en: "Fresh home-cooked dishes prepared daily with care." }), showDescription: false };
  const remoteDescription = kitchenDescriptionQuery.data;
  const kitchenDescription = { ar: remoteDescription?.descriptionAr || fallbackDescription.ar, en: remoteDescription?.descriptionEn || fallbackDescription.en };
  const showKitchenDescription = remoteDescription?.showDescription ?? fallbackDescription.showDescription;
  const kitchenMeals = availableMeals.filter((meal) => meal.kitchenId === selectedKitchen.id);
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#082E34" /></Pressable><Text style={styles.pageTitle}>{language === "ar" ? "مطبخ بيت" : "Home kitchen"}</Text><Pressable onPress={onCart} style={styles.iconButton}><MaterialIcons name="shopping-cart" size={20} color="#082E34" />{cartCount > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>}</Pressable></View>
      <View style={styles.profileHero}><Image source={{ uri: selectedKitchen.image }} style={styles.profileImage} /><View style={styles.profileOverlay} /><Pressable onPress={() => void toggleFavorite("kitchen", selectedKitchen.id)} style={styles.profileFavoriteButton}><MaterialIcons name={favoriteKitchenIds.has(selectedKitchen.id) ? "favorite" : "favorite-border"} size={22} color={favoriteKitchenIds.has(selectedKitchen.id) ? "#D76545" : "#FFFFFF"} /></Pressable><View style={styles.profileHeroText}><View style={styles.profileVerified}><MaterialIcons name="verified" size={14} color="#FFFFFF" /><Text style={styles.profileVerifiedText}>{language === "ar" ? "مطبخ موثوق" : "Verified kitchen"}</Text></View><Text style={styles.profileName}>{getLocalized(selectedKitchen.name, language)}</Text><Text style={styles.profileNeighborhood}>{getLocalized(selectedKitchen.neighborhood, language)} · {getLocalized(selectedKitchen.motherName, language)}</Text></View></View>
      <View style={styles.profileStats}><StatItem icon="star" value={`${selectedKitchen.rating}`} label={language === "ar" ? "التقييم" : "Rating"} /><StatItem icon="local-dining" value={`${selectedKitchen.reviewCount}+`} label={language === "ar" ? "تجربة" : "orders"} /><StatItem icon="schedule" value="45m" label={language === "ar" ? "التحضير" : "prep"} /></View>
      {showKitchenDescription && <View style={styles.kitchenDescriptionCard}><View style={styles.kitchenDescriptionIcon}><MaterialIcons name="short-text" size={22} color="#00AFC4" /></View><Text style={styles.kitchenDescriptionText}>{getLocalized(kitchenDescription, language)}</Text></View>}
      <SectionHeader title={language === "ar" ? "قائمة اليوم" : "Today's menu"} action={language === "ar" ? "طلبات مسبقة" : "Advance order"} />
      <View style={styles.mealList}>{kitchenMeals.map((meal) => <MealRow key={meal.id} meal={meal} language={language} isFavorite={favoriteMealIds.has(meal.id)} onToggleFavorite={() => void toggleFavorite("meal", meal.id)} quantity={cart.find((item) => item.meal.id === meal.id)?.quantity ?? 0} onRemove={() => updateQuantity(meal.id, (cart.find((item) => item.meal.id === meal.id)?.quantity ?? 1) - 1)} onAdd={() => onRequestAdd(meal)} compact />)}</View>
    </ScrollView>
  );
}

function CartScreen({ onBack, onCheckout }: { onBack: () => void; onCheckout: () => void }) {
  const { language, cart, cartTotal, updateQuantity, clearCart, cartCount, cartSpecialRequests, setCartSpecialRequests } = useApp();
  const pricing = getOrderPricing(cartTotal, cart.length ? 1.25 : 0);
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#082E34" /></Pressable><View><Text style={styles.pageTitle}>{language === "ar" ? "سفرتك" : "Your table"}</Text><Text style={styles.pageSubtitle}>{cartCount} {language === "ar" ? "وجبة" : "meals"} · {cart.length} {language === "ar" ? "أصناف" : "items"}</Text></View><Pressable onPress={clearCart} style={styles.clearButton}><Text style={styles.clearText}>{language === "ar" ? "مسح" : "Clear"}</Text></Pressable></View>
      {cart.length === 0 ? <EmptyCart language={language} onBack={onBack} /> : <>
        <View style={styles.cartItems}>{cart.map((item, index) => <CartItemRow key={`${item.meal.id}-${item.specialRequests ?? "default"}-${index}`} item={item} language={language} onUpdate={updateQuantity} />)}</View>
        <View style={styles.deliveryCard}><View style={styles.deliveryIcon}><MaterialIcons name="two-wheeler" size={21} color="#2E9B72" /></View><View style={styles.deliveryCopy}><Text style={styles.deliveryTitle}>{language === "ar" ? "توصيل لباب البيت" : "Doorstep delivery"}</Text><Text style={styles.deliveryBody}>{language === "ar" ? "خلدا، شارع وصفي التل" : "Khalda, Wasfi Al-Tal St."}</Text></View><MaterialIcons name="chevron-right" size={20} color="#4C747A" /></View>
        <View style={styles.cartNoteCard}><View style={styles.cartNoteHeader}><MaterialIcons name="edit-note" size={20} color="#00AFC4" /><View style={styles.cartNoteCopy}><Text style={styles.cartNoteTitle}>{language === "ar" ? "ملاحظات للطلب" : "Order notes"}</Text><Text style={styles.cartNoteHint}>{language === "ar" ? "إذا بتحبي، اكتبي أي تعليمات عامة للمطبخ أو التوصيل" : "Add any general kitchen or delivery instructions"}</Text></View></View><TextInput value={cartSpecialRequests} onChangeText={setCartSpecialRequests} placeholder={language === "ar" ? "مثال: اتركي الطلب عند الباب..." : "Example: leave the order at the door..."} placeholderTextColor="#8ABAC0" multiline maxLength={180} style={styles.specialRequestInput} textAlign={language === "ar" ? "right" : "left"} /></View>
        <View style={styles.summaryCard}><SummaryRow label={language === "ar" ? "عدد الوجبات" : "Meal quantity"} value={`${cartCount}`} /><SummaryRow label={language === "ar" ? "عدد الأصناف" : "Different meals"} value={`${cart.length}`} /><SummaryRow label={language === "ar" ? "المجموع" : "Subtotal"} value={formatJod(pricing.subtotal, language)} /><SummaryRow label={language === "ar" ? "التوصيل" : "Delivery"} value={formatJod(pricing.deliveryFee, language)} /><SummaryRow label={language === "ar" ? "عمولة المنصة (٥٪)" : "Platform commission (5%)"} value={formatJod(pricing.commission, language)} /><View style={styles.summaryDivider} /><SummaryRow label={language === "ar" ? "الإجمالي" : "Total"} value={formatJod(pricing.grandTotal, language)} strong /></View>
        <Pressable onPress={onCheckout} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{language === "ar" ? "كمّلي الطلب" : "Continue to checkout"}</Text><MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" /></Pressable>
      </>}
    </ScrollView>
  );
}

function MealCustomizationModal({ meal, onClose, onConfirm }: { meal: (typeof meals)[number] | null; onClose: () => void; onConfirm: (meal: (typeof meals)[number], specialRequests: string) => void }) {
  const { language } = useApp();
  const [selectedAdditions, setSelectedAdditions] = useState<string[]>([]);
  const [selectedRemovals, setSelectedRemovals] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setSelectedAdditions([]);
    setSelectedRemovals([]);
    setNotes("");
  }, [meal?.id]);

  const toggle = (id: string, kind: "add" | "remove") => {
    const setter = kind === "add" ? setSelectedAdditions : setSelectedRemovals;
    setter((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const submit = () => {
    if (!meal) return;
    const additions = selectedAdditions.map((id) => addIngredientOptions.find((option) => option.id === id)).filter(Boolean).map((option) => getLocalized(option!.label, language));
    const removals = selectedRemovals.map((id) => removeIngredientOptions.find((option) => option.id === id)).filter(Boolean).map((option) => getLocalized(option!.label, language));
    const request = [additions.length ? `${language === "ar" ? "إضافة" : "Add"}: ${additions.join(language === "ar" ? "، " : ", ")}` : "", removals.length ? `${language === "ar" ? "إزالة" : "Remove"}: ${removals.join(language === "ar" ? "، " : ", ")}` : "", notes.trim()].filter(Boolean).join(" · ");
    onConfirm(meal, request);
  };

  return <Modal visible={Boolean(meal)} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.customizationSheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={styles.sheetEyebrow}>{language === "ar" ? "تخصيص الصنف" : "CUSTOMIZE MEAL"}</Text><Text style={styles.sheetTitle}>{language === "ar" ? "اختاري قبل الإضافة للسلة" : "Choose before adding to cart"}</Text></View><Pressable onPress={onClose} style={styles.closeButton}><MaterialIcons name="close" size={20} color="#082E34" /></Pressable></View>{meal && <ScrollView style={styles.customizationScroll} contentContainerStyle={styles.customizationContent} showsVerticalScrollIndicator={false}><View style={styles.customizationMealHeader}><Image source={{ uri: meal.image }} style={styles.customizationMealImage} /><View style={styles.customizationMealCopy}><Text style={styles.customizationMealName}>{getLocalized(meal.name, language)}</Text><Text style={styles.customizationMealPrice}>{formatJod(meal.price, language)}</Text><Text style={styles.customizationHint}>{language === "ar" ? "اختياراتك ستُحفظ مع هذا الصنف في السلة" : "Your choices will be saved with this meal in the cart"}</Text></View></View><Text style={styles.ingredientGroupLabel}>{language === "ar" ? "إضافة مكونات" : "Add ingredients"}</Text><View style={styles.ingredientOptionGrid}>{addIngredientOptions.map((option) => { const selected = selectedAdditions.includes(option.id); return <Pressable key={`add-${option.id}`} onPress={() => toggle(option.id, "add")} style={[styles.ingredientOption, selected && styles.ingredientOptionSelected]}><MaterialIcons name={option.icon} size={17} color={selected ? "#FFFFFF" : "#00AFC4"} /><Text style={[styles.ingredientOptionText, selected && styles.ingredientOptionTextSelected]}>{getLocalized(option.label, language)}</Text><MaterialIcons name={selected ? "check-circle" : "add-circle-outline"} size={16} color={selected ? "#F6D889" : "#8ABAC0"} /></Pressable>; })}</View><Text style={styles.ingredientGroupLabel}>{language === "ar" ? "إزالة مكونات" : "Remove ingredients"}</Text><View style={styles.ingredientOptionGrid}>{removeIngredientOptions.map((option) => { const selected = selectedRemovals.includes(option.id); return <Pressable key={`remove-${option.id}`} onPress={() => toggle(option.id, "remove")} style={[styles.ingredientOption, selected && styles.ingredientOptionRemoveSelected]}><MaterialIcons name={option.icon} size={17} color={selected ? "#8A6516" : "#00AFC4"} /><Text style={[styles.ingredientOptionText, selected && styles.ingredientOptionRemoveTextSelected]}>{getLocalized(option.label, language)}</Text><MaterialIcons name={selected ? "check-circle" : "remove-circle-outline"} size={16} color={selected ? "#C98A2E" : "#8ABAC0"} /></Pressable>; })}</View><Text style={styles.ingredientGroupLabel}>{language === "ar" ? "ملاحظات إضافية" : "Extra notes"}</Text><View style={styles.specialRequestInputWrap}><MaterialIcons name="edit-note" size={20} color="#00AFC4" /><TextInput value={notes} onChangeText={setNotes} placeholder={language === "ar" ? "مثال: الصلصة على الجانب..." : "Example: sauce on the side..."} placeholderTextColor="#8ABAC0" multiline maxLength={180} style={styles.specialRequestInput} textAlign={language === "ar" ? "right" : "left"} /></View></ScrollView>}<Pressable onPress={submit} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{language === "ar" ? "أضف للسلة" : "Add to cart"}</Text><MaterialIcons name="shopping-cart" size={18} color="#FFFFFF" /></Pressable></View></View></Modal>;
}

function CheckoutModal({ visible, initialSpecialRequests, onClose, onComplete }: { visible: boolean; initialSpecialRequests: string; onClose: () => void; onComplete: () => void }) {
  const { language, customerPhone, placeOrder, cart } = useApp();
  const orderSmsMutation = trpc.notifications.sendOrderConfirmationSms.useMutation();
  const multiPricing = getMultiOrderPricing(cart, 1.25);
  const pricing = multiPricing;
  const [payment, setPayment] = useState<"cod" | "cliq" | "wallet">("cod");
  const [schedule, setSchedule] = useState<"now" | "scheduled">("now");
  const [specialRequests, setSpecialRequests] = useState("");
  useEffect(() => {
    if (visible) setSpecialRequests(initialSpecialRequests);
  }, [initialSpecialRequests, visible]);

  const buildSpecialRequests = () => specialRequests.trim();

  const confirmOrder = () => {
    const placed = placeOrder(payment, schedule, buildSpecialRequests());
    if (placed) {
      if (customerPhone.trim()) void orderSmsMutation.mutateAsync({ phone: customerPhone.trim(), orderCount: Math.max(1, multiPricing.groups.length), total: pricing.grandTotal, language }).catch(() => undefined);
      onComplete();
    }
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}><View style={styles.checkoutSheet}>
        <View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={styles.sheetEyebrow}>{language === "ar" ? "آخر خطوة" : "One last step"}</Text><Text style={styles.sheetTitle}>{language === "ar" ? "تأكيد الطلب" : "Confirm order"}</Text></View><Pressable onPress={onClose} style={styles.closeButton}><MaterialIcons name="close" size={20} color="#082E34" /></Pressable></View>
        <Text style={styles.optionLabel}>{language === "ar" ? "متى بتحبي يوصل؟" : "When should it arrive?"}</Text>
        <View style={styles.optionRow}>{(["now", "scheduled"] as const).map((item) => <OptionCard key={item} selected={schedule === item} onPress={() => setSchedule(item)} icon={item === "now" ? "bolt" : "event"} title={t(scheduleLabels[item], language)} subtitle={item === "now" ? (language === "ar" ? "٤٥ دقيقة تقريباً" : "About 45 min") : (language === "ar" ? "مناسب للعزائم" : "Great for gatherings")} />)}</View>
        <Text style={styles.optionLabel}>{language === "ar" ? "طريقة الدفع" : "Payment method"}</Text>
        <View style={styles.paymentList}>{(["cod", "cliq", "wallet"] as const).map((item) => <Pressable key={item} onPress={() => setPayment(item)} style={[styles.paymentOption, payment === item && styles.paymentOptionActive]}><View style={[styles.paymentIcon, payment === item && styles.paymentIconActive]}><MaterialIcons name={item === "cod" ? "payments" : item === "cliq" ? "account-balance" : "wallet"} size={18} color={payment === item ? "#FFFFFF" : "#00AFC4"} /></View><View style={styles.paymentCopy}><Text style={styles.paymentTitle}>{t(paymentLabels[item], language)}</Text><Text style={styles.paymentSubtitle}>{item === "cod" ? (language === "ar" ? "ادفعي عند الباب" : "Pay at the door") : item === "cliq" ? (language === "ar" ? "تحويل فوري وآمن" : "Instant and secure transfer") : (language === "ar" ? "زين كاش، أورانج موني" : "Zain Cash, Orange Money")}</Text></View><MaterialIcons name={payment === item ? "radio-button-checked" : "radio-button-unchecked"} size={22} color={payment === item ? "#00AFC4" : "#8ABAC0"} /></Pressable>)}</View>
        <Text style={styles.optionLabel}>{language === "ar" ? "ملاحظات الطلب (اختياري)" : "Order notes (optional)"}</Text>
        <View style={styles.specialRequestInputWrap}><MaterialIcons name="edit-note" size={20} color="#00AFC4" /><TextInput value={specialRequests} onChangeText={setSpecialRequests} placeholder={language === "ar" ? "مثال: اتركي الطلب عند الباب..." : "Example: leave the order at the door..."} placeholderTextColor="#8ABAC0" multiline maxLength={180} style={styles.specialRequestInput} textAlign={language === "ar" ? "right" : "left"} /></View>
        {multiPricing.groups.length > 1 && <View style={styles.multiOrderSummary}><Text style={styles.multiOrderSummaryTitle}>{language === "ar" ? `${multiPricing.groups.length} طلبات منفصلة من مطابخ مختلفة` : `${multiPricing.groups.length} separate orders from different kitchens`}</Text>{multiPricing.groups.map((group) => { const kitchen = kitchens.find((item) => item.id === group.kitchenId) ?? kitchens[0]; return <View key={group.kitchenId} style={styles.multiOrderRow}><Text style={styles.multiOrderKitchen}>{getLocalized(kitchen.name, language)}</Text><Text style={styles.multiOrderTotal}>{formatJod(group.pricing.grandTotal, language)}</Text></View>; })}</View>}
        <View style={styles.sheetPriceBreakdown}><SummaryRow label={language === "ar" ? "قيمة الطعام" : "Food subtotal"} value={formatJod(pricing.subtotal, language)} /><SummaryRow label={language === "ar" ? "التوصيل لكل مطبخ" : "Delivery per kitchen"} value={formatJod(pricing.deliveryFee, language)} /><SummaryRow label={language === "ar" ? "عمولة المنصة (٥٪)" : "Platform commission (5%)"} value={formatJod(pricing.commission, language)} /></View><View style={styles.sheetTotal}><Text style={styles.sheetTotalLabel}>{language === "ar" ? "الإجمالي النهائي" : "Final total"}</Text><Text style={styles.sheetTotalValue}>{formatJod(pricing.grandTotal, language)}</Text></View>
        <Pressable onPress={confirmOrder} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{language === "ar" ? "أكّد واطلب" : "Confirm order"}</Text><MaterialIcons name="check" size={18} color="#FFFFFF" /></Pressable>
      </View></View>
    </Modal>
  );
}

function OrdersScreen({ onBack, onOpenCart }: { onBack: () => void; onOpenCart: () => void }) {
  const { language, activeOrder, activeOrders, orderHistory, reorder, selectActiveOrder, advanceOrder, rateOrder, showToast } = useApp();
  const { user } = useAuth();
  const latestLocationQuery = trpc.driverLocation.latest.useQuery({ orderId: activeOrder?.id ?? "none" }, { enabled: Boolean(user && activeOrder?.driver), staleTime: 20_000, gcTime: 2 * 60_000, refetchInterval: 30_000, refetchIntervalInBackground: false, retry: false });
  const liveDriverCoordinates = latestLocationQuery.data ? { latitude: latestLocationQuery.data.latitude, longitude: latestLocationQuery.data.longitude } : activeOrder?.driverCoordinates;
  const liveLocationUpdatedAt = latestLocationQuery.data?.capturedAt ?? activeOrder?.driverLocationUpdatedAt;
  const currentIndex = activeOrder ? orderStatuses.findIndex((item) => item.id === activeOrder.status) : -1;
  const driver = activeOrder?.driver;
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const callDriver = async () => {
    if (!driver) return;
    try {
      await Linking.openURL(`tel:${driver.phone}`);
    } catch {
      showToast(language === "ar" ? "تعذّر فتح الاتصال" : "Could not open the phone app");
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#082E34" /></Pressable><View><Text style={styles.pageTitle}>{language === "ar" ? "طلباتي" : "My orders"}</Text><Text style={styles.pageSubtitle}>{language === "ar" ? "كل لقمة إلها حكاية" : "Every bite has a story"}</Text></View><View style={styles.statusPill}><View style={styles.liveDot} /><Text style={styles.statusPillText}>{language === "ar" ? "مباشر" : "Live"}</Text></View></View>
      {activeOrders.length > 1 && <View style={styles.activeOrdersPanel}><Text style={styles.activeOrdersTitle}>{language === "ar" ? "طلباتك المنفصلة" : "Your separate orders"}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeOrdersRow}>{activeOrders.map((order) => <Pressable key={order.id} onPress={() => selectActiveOrder(order.id)} style={[styles.activeOrderChip, activeOrder?.id === order.id && styles.activeOrderChipActive]}><Text style={[styles.activeOrderChipId, activeOrder?.id === order.id && styles.activeOrderChipTextActive]}>{order.id}</Text><Text style={[styles.activeOrderChipKitchen, activeOrder?.id === order.id && styles.activeOrderChipTextActive]} numberOfLines={1}>{getLocalized(order.kitchen.name, language)}</Text></Pressable>)}</ScrollView></View>}
      {activeOrders.length > 1 && <MultiOrderTrackingSection orders={activeOrders} language={language} selectedOrderId={activeOrder?.id} onSelectOrder={selectActiveOrder} onAdvanceOrder={(orderId) => advanceOrder(orderId)} onShowToast={showToast} />}
      {activeOrders.length <= 1 && activeOrder ? <>
        <View style={styles.orderHero}><View><Text style={styles.orderHeroEyebrow}>{language === "ar" ? "رقم الطلب" : "Order number"}</Text><Text style={styles.orderHeroId}>{activeOrder.id}</Text></View><View style={styles.orderEta}><Text style={styles.orderEtaLabel}>{language === "ar" ? "الوصول المتوقع" : "Estimated arrival"}</Text><Text style={styles.orderEtaValue}>{getLocalized(activeOrder.eta, language)}</Text></View></View>
                <MapPreview pickupCoordinates={activeOrder.pickupCoordinates} driverCoordinates={liveDriverCoordinates} dropoffCoordinates={activeOrder.dropoffCoordinates} />
        {driver && <View style={styles.customerDriverCard}><View style={styles.customerDriverHeader}><View style={styles.driverAvatar}><MaterialIcons name="two-wheeler" size={22} color="#FFFFFF" /></View><View style={styles.customerDriverCopy}><Text style={styles.customerDriverEyebrow}>{language === "ar" ? "مندوبك بالطريق" : "Your driver is on the way"}</Text><Text style={styles.customerDriverName}>{getLocalized(driver.name, language)}</Text><Text style={styles.customerDriverMeta}>{getLocalized(driver.vehicle, language)} · {language === "ar" ? "لوحة" : "Plate"} {driver.plate}</Text></View><Pressable onPress={() => void callDriver()} style={({ pressed }) => [styles.callDriverButton, pressed && styles.pressed]}><MaterialIcons name="phone" size={18} color="#FFFFFF" /></Pressable></View><View style={styles.customerDriverStats}><View><Text style={styles.customerDriverStatLabel}>{language === "ar" ? "الوقت المتبقي" : "Time remaining"}</Text><Text style={styles.customerDriverStatValue}>{getLocalized(activeOrder.eta, language)}</Text></View><View><Text style={styles.customerDriverStatLabel}>{language === "ar" ? "موقع السائق" : "Driver location"}</Text><Text style={styles.customerDriverStatValue}>{liveDriverCoordinates ? `${liveDriverCoordinates.latitude.toFixed(4)}, ${liveDriverCoordinates.longitude.toFixed(4)}` : (language === "ar" ? "بانتظار أول تحديث" : "Waiting for first update")}</Text></View><View><Text style={styles.customerDriverStatLabel}>{language === "ar" ? "آخر تحديث" : "Last update"}</Text><Text style={styles.customerDriverStatValue}>{liveLocationUpdatedAt ? new Date(liveLocationUpdatedAt).toLocaleTimeString(language === "ar" ? "ar-JO" : "en-JO", { hour: "2-digit", minute: "2-digit" }) : "—"}</Text></View><View><Text style={styles.customerDriverStatLabel}>{language === "ar" ? "التوصيل إلى" : "Delivering to"}</Text><Text style={styles.customerDriverStatValue}>{activeOrder.dropoffCoordinates.latitude.toFixed(4)}, {activeOrder.dropoffCoordinates.longitude.toFixed(4)}</Text></View></View></View>}
        {activeOrder.specialRequests ? <View style={styles.specialRequestCard}><MaterialIcons name="edit-note" size={19} color="#00AFC4" /><View style={styles.specialRequestCopy}><Text style={styles.specialRequestTitle}>{language === "ar" ? "طلباتك الخاصة" : "Your special requests"}</Text><Text style={styles.specialRequestBody}>{activeOrder.specialRequests}</Text></View></View> : null}
        <OrderChat orderId={activeOrder.id} language={language} />
        <OrderActionPanel order={activeOrder} language={language} />
        <View style={styles.trackingCard}>
<Text style={styles.trackingTitle}>{language === "ar" ? "وين وصل طلبك؟" : "Where is your order?"}</Text>{orderStatuses.map((status, index) => { const done = index <= currentIndex; const active = index === currentIndex; return <View key={status.id} style={styles.trackingRow}><View style={styles.trackRail}><View style={[styles.trackDot, done && styles.trackDotDone, active && styles.trackDotActive]}>{done && <MaterialIcons name="check" size={12} color="#FFFFFF" />}</View>{index < orderStatuses.length - 1 && <View style={[styles.trackLine, index < currentIndex && styles.trackLineDone]} />}</View><View style={styles.trackCopy}><Text style={[styles.trackLabel, active && styles.trackLabelActive]}>{getLocalized(status.label, language)}</Text><Text style={styles.trackCaption}>{getLocalized(status.caption, language)}</Text></View><MaterialIcons name={status.icon as IconName} size={19} color={done ? "#2E9B72" : "#8ABAC0"} /></View>; })}</View>
        {activeOrder.status !== "delivered" && <Pressable onPress={() => advanceOrder(activeOrder.id)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><MaterialIcons name="refresh" size={18} color="#00AFC4" /><Text style={styles.secondaryButtonText}>{language === "ar" ? "تحديث حالة الطلب" : "Refresh order status"}</Text></Pressable>}
        {activeOrder.status === "delivered" && (activeOrder.restaurantRating ? <View style={styles.deliveredCard}><MaterialIcons name="check-circle" size={22} color="#2E9B72" /><Text style={styles.deliveredText}>{language === "ar" ? `شكراً لتقييمك المطعم ${activeOrder.restaurantRating} ★` : `Thanks for rating the restaurant ${activeOrder.restaurantRating} ★`}</Text></View> : <View style={styles.ratingCard}><View style={styles.ratingHeader}><View style={styles.ratingIcon}><MaterialIcons name="storefront" size={20} color="#00AFC4" /></View><View style={styles.ratingCopy}><Text style={styles.ratingTitle}>{language === "ar" ? "كيف كانت تجربتك مع المطعم؟" : "How was your restaurant experience?"}</Text><Text style={styles.ratingBody}>{language === "ar" ? "ساعدي أم أحمد بتقييم صادق" : "Help Umm Ahmad with an honest review"}</Text></View></View><View style={styles.ratingStarsRow}>{[1, 2, 3, 4, 5].map((value) => <Pressable key={value} onPress={() => setRating(value)} style={styles.ratingStarButton}><MaterialIcons name="star" size={30} color={value <= rating ? "#C98A2E" : "#D6E2D4"} /></Pressable>)}</View><TextInput value={review} onChangeText={setReview} placeholder={language === "ar" ? "اكتبي تعليقاً اختيارياً..." : "Write an optional comment..."} placeholderTextColor="#8ABAC0" multiline maxLength={240} style={styles.ratingInput} textAlign={language === "ar" ? "right" : "left"} /><Pressable disabled={rating === 0} onPress={() => { rateOrder(rating, review); showToast(language === "ar" ? "تم حفظ تقييم المطعم" : "Restaurant rating saved"); }} style={({ pressed }) => [styles.ratingSubmit, rating === 0 && styles.ratingSubmitDisabled, pressed && styles.pressed]}><Text style={styles.ratingSubmitText}>{language === "ar" ? "حفظ التقييم" : "Save rating"}</Text><MaterialIcons name="send" size={17} color="#FFFFFF" /></Pressable></View>)}
        <Pressable onPress={onBack} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><MaterialIcons name="restaurant" size={18} color="#00AFC4" /><Text style={styles.secondaryButtonText}>{language === "ar" ? "العودة للتسوق وإضافة أصناف" : "Back to shopping and add items"}</Text></Pressable>
        <OrderHistorySection orders={orderHistory.filter((order) => !activeOrders.some((active) => active.id === order.id))} language={language} onReorder={(order) => { reorder(order); onOpenCart(); }} />
      </> : !activeOrder ? <OrderHistorySection orders={orderHistory} language={language} onReorder={(order) => { reorder(order); onOpenCart(); }} emptyOnBack={onBack} /> : null}
      {activeOrders.length > 1 && <OrderHistorySection orders={orderHistory.filter((order) => !activeOrders.some((active) => active.id === order.id))} language={language} onReorder={(order) => { reorder(order); onOpenCart(); }} />}
    </ScrollView>
  );
}

function OrderChat({ orderId, language }: { orderId: string; language: "ar" | "en" }) {
  const { role, orderMessages, sendOrderMessage } = useApp();
  const { user, isAuthenticated } = useAuth();
  const [draft, setDraft] = useState("");
  const localMessages = orderMessages[orderId] ?? [];
  const remoteMessagesQuery = trpc.chat.list.useQuery({ orderId }, { enabled: isAuthenticated, retry: false });
  const sendRemoteMessage = trpc.chat.send.useMutation({ onSuccess: () => { void remoteMessagesQuery.refetch(); } });
  const messages = remoteMessagesQuery.data?.length ? remoteMessagesQuery.data : localMessages;
  const senderName = user?.name?.trim() || (role === "customer" ? (language === "ar" ? "العميلة" : "Customer") : role === "driver" ? (language === "ar" ? "السائق" : "Driver") : (language === "ar" ? "المطبخ" : "Kitchen"));
  const send = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setDraft("");
    if (isAuthenticated) {
      try {
        await sendRemoteMessage.mutateAsync({ orderId, senderRole: role, senderName, body: trimmed });
        return;
      } catch {
        // Fall back to the local conversation when a locally-created demo order is not in the database yet.
      }
    }
    sendOrderMessage(orderId, trimmed);
  };
  return <View style={styles.chatCard}><View style={styles.chatHeader}><View style={styles.chatIcon}><MaterialIcons name="chat" size={17} color="#FFFFFF" /></View><View style={styles.chatHeaderCopy}><Text style={styles.chatTitle}>{language === "ar" ? "محادثة الطلب" : "Order chat"}</Text><Text style={styles.chatSubtitle}>{language === "ar" ? "تواصلي مع السائق أو المطبخ حول هذا الطلب" : "Message the driver or kitchen about this order"}</Text></View><View style={styles.chatSecurePill}><MaterialIcons name="lock" size={11} color="#2E9B72" /><Text style={styles.chatSecureText}>{language === "ar" ? "خاصة" : "Private"}</Text></View></View><View style={styles.chatMessages}>{messages.length === 0 ? <Text style={styles.chatEmpty}>{language === "ar" ? "لا توجد رسائل بعد. اكتبي ملاحظة عند الحاجة." : "No messages yet. Send a note when needed."}</Text> : messages.map((message) => <View key={message.id} style={[styles.chatBubble, message.senderRole === role && styles.chatBubbleMine]}><Text style={styles.chatMeta}>{message.senderName} · {new Date(message.createdAt).toLocaleTimeString(language === "ar" ? "ar-JO" : "en-JO", { hour: "2-digit", minute: "2-digit" })}</Text><Text style={styles.chatBody}>{message.body}</Text></View>)}</View><View style={styles.chatComposer}><TextInput value={draft} onChangeText={setDraft} onSubmitEditing={send} returnKeyType="send" placeholder={language === "ar" ? "اكتبي رسالة..." : "Write a message..."} placeholderTextColor="#8ABAC0" style={styles.chatInput} textAlign={language === "ar" ? "right" : "left"} maxLength={500} /><Pressable onPress={send} style={({ pressed }) => [styles.chatSend, pressed && styles.pressed]}><MaterialIcons name="send" size={17} color="#FFFFFF" /></Pressable></View></View>;
}

function OrderActionPanel({ order, language }: { order: Order; language: "ar" | "en" }) {
  const { requestOrderAction } = useApp();
  const { user } = useAuth();
  const [modalAction, setModalAction] = useState<Exclude<OrderCustomerAction, "none"> | null>(null);
  const [note, setNote] = useState("");
  const remoteActionsQuery = trpc.orderActions.list.useQuery({ orderId: order.id }, { enabled: Boolean(user), retry: false });
  const createRemoteAction = trpc.orderActions.create.useMutation({ onSuccess: () => { void remoteActionsQuery.refetch(); } });
  const remotePendingAction = remoteActionsQuery.data?.find((item) => item.status === "pending");
  const displayedAction = order.customerAction && order.customerAction !== "none" ? order.customerAction : remotePendingAction?.action;
  const canCancel = order.status === "received" || order.status === "preparing";
  const canReplace = order.status === "on_the_way" || order.status === "delivered";
  const submit = async () => {
    if (!modalAction) return;
    const trimmedNote = note.trim();
    if (user) {
      try {
        await createRemoteAction.mutateAsync({ orderId: order.id, action: modalAction, note: trimmedNote || undefined });
        requestOrderAction(order.id, modalAction, trimmedNote);
        setNote("");
        setModalAction(null);
        return;
      } catch {
        // Local fallback keeps demo and offline-created orders usable.
      }
    }
    requestOrderAction(order.id, modalAction, trimmedNote);
    setNote("");
    setModalAction(null);
  };
  if (displayedAction) return <View style={styles.orderActionPending}><MaterialIcons name="hourglass-top" size={17} color="#C98A2E" /><Text style={styles.orderActionPendingText}>{displayedAction === "cancellation_requested" ? (language === "ar" ? "طلب الإلغاء قيد المراجعة" : "Cancellation request is under review") : (language === "ar" ? "طلب الاستبدال قيد المراجعة" : "Replacement request is under review")}</Text></View>;
  if (!canCancel && !canReplace) return null;
  return <><View style={styles.orderActionPanel}><View style={styles.orderActionCopy}><Text style={styles.orderActionTitle}>{language === "ar" ? "تحتاجين مساعدة بالطلب؟" : "Need help with this order?"}</Text><Text style={styles.orderActionSubtitle}>{language === "ar" ? "أرسلي طلباً سريعاً لفريق المتابعة" : "Send a quick request to the support team"}</Text></View><View style={styles.orderActionButtons}>{canCancel && <Pressable onPress={() => setModalAction("cancellation_requested")} style={({ pressed }) => [styles.orderActionButton, styles.orderActionCancel, pressed && styles.pressed]}><MaterialIcons name="cancel" size={15} color="#C4555D" /><Text style={styles.orderActionCancelText}>{language === "ar" ? "طلب إلغاء" : "Request cancel"}</Text></Pressable>}{canReplace && <Pressable onPress={() => setModalAction("replacement_requested")} style={({ pressed }) => [styles.orderActionButton, styles.orderActionReplace, pressed && styles.pressed]}><MaterialIcons name="swap-horiz" size={15} color="#2E9B72" /><Text style={styles.orderActionReplaceText}>{language === "ar" ? "طلب استبدال" : "Request replacement"}</Text></Pressable>}</View></View><Modal visible={Boolean(modalAction)} transparent animationType="fade" onRequestClose={() => setModalAction(null)}><View style={styles.modalBackdrop}><View style={styles.orderActionModal}><Text style={styles.sheetEyebrow}>{language === "ar" ? "طلب سريع" : "Quick request"}</Text><Text style={styles.sheetTitle}>{modalAction === "cancellation_requested" ? (language === "ar" ? "طلب إلغاء الطلب" : "Request cancellation") : (language === "ar" ? "طلب استبدال الطلب" : "Request replacement")}</Text><Text style={styles.orderActionModalBody}>{language === "ar" ? "اكتبي السبب إن أحببتِ، وسيظهر لفريق المتابعة مع رقم الطلب." : "Add an optional reason. The support team will receive it with the order number."}</Text><TextInput value={note} onChangeText={setNote} placeholder={language === "ar" ? "السبب (اختياري)" : "Reason (optional)"} placeholderTextColor="#8ABAC0" multiline maxLength={240} style={styles.orderActionNoteInput} textAlign={language === "ar" ? "right" : "left"} /><View style={styles.orderActionModalButtons}><Pressable onPress={() => setModalAction(null)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryButtonText}>{language === "ar" ? "رجوع" : "Back"}</Text></Pressable><Pressable onPress={submit} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{language === "ar" ? "إرسال الطلب" : "Send request"}</Text><MaterialIcons name="send" size={17} color="#FFFFFF" /></Pressable></View></View></View></Modal></>;
}

function MultiOrderTrackingSection({ orders, language, selectedOrderId, onSelectOrder, onAdvanceOrder, onShowToast }: { orders: Order[]; language: "ar" | "en"; selectedOrderId?: string; onSelectOrder: (orderId: string) => void; onAdvanceOrder: (orderId: string) => void; onShowToast: (message: string) => void }) {
  return <View style={styles.multiOrderSection}><View style={styles.multiOrderSectionHeader}><View><Text style={styles.sectionTitle}>{language === "ar" ? "تتبع كل طلب" : "Track every order"}</Text><Text style={styles.multiOrderSectionHint}>{language === "ar" ? "كل مطعم له سائق ووقت وصول ومسار مستقل" : "Each kitchen has its own driver, ETA, and route"}</Text></View><View style={styles.multiOrderCount}><MaterialIcons name="layers" size={15} color="#00AFC4" /><Text style={styles.multiOrderCountText}>{orders.length}</Text></View></View>{orders.map((order) => <MultiOrderTrackingCard key={order.id} order={order} language={language} selected={order.id === selectedOrderId} onSelect={() => onSelectOrder(order.id)} onAdvance={() => onAdvanceOrder(order.id)} onShowToast={onShowToast} />)}</View>;
}

function MultiOrderTrackingCard({ order, language, selected, onSelect, onAdvance, onShowToast }: { order: Order; language: "ar" | "en"; selected: boolean; onSelect: () => void; onAdvance: () => void; onShowToast: (message: string) => void }) {
  const statusIndex = orderStatuses.findIndex((status) => status.id === order.status);
  const currentStatus = orderStatuses[statusIndex];
  const driver = order.driver;
  const pickupDistance = distanceKm(order.driverCoordinates ?? order.pickupCoordinates, order.pickupCoordinates);
  const deliveryDistance = distanceKm(order.pickupCoordinates, order.dropoffCoordinates);
  const pickupEtaMinutes = Math.max(1, Math.round(pickupDistance * 4));
  const deliveryEtaMinutes = Math.max(5, Math.round(deliveryDistance * 5));

  const openMaps = async (destination: "pickup" | "dropoff") => {
    const coordinates = destination === "pickup" ? order.pickupCoordinates : order.dropoffCoordinates;
    const address = destination === "pickup" ? order.pickupAddress : order.dropoffAddress;
    try {
      const origin = order.driverCoordinates ? `&origin=${order.driverCoordinates.latitude},${order.driverCoordinates.longitude}` : "";
      await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${coordinates.latitude},${coordinates.longitude}${origin}&travelmode=driving`);
      onShowToast(language === "ar" ? `تم فتح مسار ${getLocalized(address, language)}` : `Opened route to ${getLocalized(address, language)}`);
    } catch {
      onShowToast(language === "ar" ? "تعذّر فتح الخرائط لهذا الطلب" : "Could not open maps for this order");
    }
  };

  const callDriver = async () => {
    if (!driver) return;
    try {
      await Linking.openURL(`tel:${driver.phone}`);
    } catch {
      onShowToast(language === "ar" ? "تعذّر الاتصال بالسائق" : "Could not call the driver");
    }
  };

  return <View style={[styles.multiOrderCard, selected && styles.multiOrderCardSelected]}>
    <View style={styles.multiOrderCardHeader}><View style={styles.multiOrderKitchenMark}><MaterialIcons name="storefront" size={18} color="#FFFFFF" /></View><View style={styles.multiOrderKitchenCopy}><Text style={styles.multiOrderKitchenName} numberOfLines={1}>{getLocalized(order.kitchen.name, language)}</Text><Text style={styles.multiOrderOrderId}>{order.id} · {order.items.reduce((sum, item) => sum + item.quantity, 0)} {language === "ar" ? "وجبة" : "meals"}</Text></View><View style={styles.multiOrderStatus}><View style={styles.liveDot} /><Text style={styles.multiOrderStatusText}>{currentStatus ? getLocalized(currentStatus.label, language) : "Live"}</Text></View></View>
    <View style={styles.multiOrderItemLine}><Text style={styles.multiOrderItems} numberOfLines={2}>{order.items.map((item) => `${item.quantity}× ${getLocalized(item.meal.name, language)}`).join("، ")}</Text><Text style={styles.multiOrderEta}>{getLocalized(order.eta, language)}</Text></View>
    <View style={styles.multiOrderProgress}>{orderStatuses.map((status, index) => { const done = index <= statusIndex; return <View key={status.id} style={styles.multiOrderProgressStep}><View style={[styles.multiOrderProgressDot, done && styles.multiOrderProgressDotDone]} />{index < orderStatuses.length - 1 && <View style={[styles.multiOrderProgressLine, done && styles.multiOrderProgressLineDone]} />}<Text style={[styles.multiOrderProgressLabel, done && styles.multiOrderProgressLabelDone]} numberOfLines={1}>{getLocalized(status.label, language)}</Text></View>; })}</View>
    {driver ? <View style={styles.multiOrderDriverRow}><View style={styles.multiOrderDriverAvatar}><MaterialIcons name="two-wheeler" size={17} color="#FFFFFF" /></View><View style={styles.multiOrderDriverCopy}><Text style={styles.multiOrderDriverLabel}>{language === "ar" ? "السائق المعيّن" : "Assigned driver"}</Text><Text style={styles.multiOrderDriverName}>{getLocalized(driver.name, language)}</Text><Text style={styles.multiOrderDriverMeta}>{getLocalized(driver.vehicle, language)} · {language === "ar" ? "تقييم" : "Rating"} {order.driverRating?.toFixed(1) ?? "4.9"} ★</Text></View><Pressable onPress={() => void callDriver()} style={({ pressed }) => [styles.multiOrderCallButton, pressed && styles.pressed]}><MaterialIcons name="phone" size={17} color="#FFFFFF" /></Pressable></View> : <View style={styles.multiOrderNoDriver}><MaterialIcons name="person-search" size={17} color="#C98A2E" /><Text style={styles.multiOrderNoDriverText}>{language === "ar" ? "يجري تعيين سائق مناسب للحمولة" : "A suitable driver is being assigned"}</Text></View>}
    <MapPreview pickupCoordinates={order.pickupCoordinates} driverCoordinates={order.driverCoordinates} dropoffCoordinates={order.dropoffCoordinates} onPressMap={() => void openMaps(order.status === "ready" || order.status === "on_the_way" ? "dropoff" : "pickup")} />
    <View style={styles.multiOrderRouteSummary}><Pressable onPress={() => void openMaps("pickup")} style={({ pressed }) => [styles.multiOrderRoutePoint, pressed && styles.pressed]}><View style={[styles.multiOrderRouteDot, styles.multiOrderRouteDotPickup]} /><View style={styles.multiOrderRouteCopy}><Text style={styles.multiOrderRouteLabel}>{language === "ar" ? "المطعم" : "Kitchen"}</Text><Text style={styles.multiOrderRouteValue} numberOfLines={1}>{getLocalized(order.pickupAddress, language)}</Text><Text style={styles.multiOrderRouteMeta}>{pickupDistance.toFixed(1)} {language === "ar" ? `كم · ${pickupEtaMinutes} د للوصول` : `km · ${pickupEtaMinutes} min away`}</Text></View><MaterialIcons name="directions" size={18} color="#00AFC4" /></Pressable><View style={styles.multiOrderRouteDivider} /><Pressable onPress={() => void openMaps("dropoff")} style={({ pressed }) => [styles.multiOrderRoutePoint, pressed && styles.pressed]}><View style={[styles.multiOrderRouteDot, styles.multiOrderRouteDotDropoff]} /><View style={styles.multiOrderRouteCopy}><Text style={styles.multiOrderRouteLabel}>{language === "ar" ? "التسليم" : "Drop-off"}</Text><Text style={styles.multiOrderRouteValue} numberOfLines={1}>{getLocalized(order.dropoffAddress, language)}</Text><Text style={styles.multiOrderRouteMeta}>{deliveryDistance.toFixed(1)} {language === "ar" ? `كم · ${deliveryEtaMinutes} د للتسليم` : `km · ${deliveryEtaMinutes} min to deliver`}</Text></View><MaterialIcons name="directions" size={18} color="#2E9B72" /></Pressable></View>
    <OrderActionPanel order={order} language={language} />
    <View style={styles.multiOrderCardActions}><Pressable onPress={onSelect} style={({ pressed }) => [styles.multiOrderFocusButton, pressed && styles.pressed]}><MaterialIcons name="center-focus-strong" size={16} color="#00AFC4" /><Text style={styles.multiOrderFocusText}>{selected ? (language === "ar" ? "محدد الآن" : "Selected") : language === "ar" ? "عرض التفاصيل" : "View details"}</Text></Pressable>{order.status !== "delivered" && <Pressable onPress={onAdvance} style={({ pressed }) => [styles.multiOrderRefreshButton, pressed && styles.pressed]}><MaterialIcons name="refresh" size={16} color="#FFFFFF" /><Text style={styles.multiOrderRefreshText}>{language === "ar" ? "تحديث التتبع" : "Refresh tracking"}</Text></Pressable>}</View>
  </View>;
}

function OrderHistorySection({ orders, language, onReorder, emptyOnBack }: { orders: Order[]; language: "ar" | "en"; onReorder: (order: Order) => void; emptyOnBack?: () => void }) {
  if (!orders.length) return emptyOnBack ? <EmptyOrders language={language} onBack={emptyOnBack} /> : null;
  return <View style={styles.orderHistoryCard}><View style={styles.orderHistoryHeader}><View><Text style={styles.sectionTitle}>{language === "ar" ? "طلباتك السابقة" : "Previous orders"}</Text><Text style={styles.orderHistoryHint}>{language === "ar" ? "أعيدي أي طلب مع تخصيصاته" : "Repeat any order with its customizations"}</Text></View><MaterialIcons name="history" size={22} color="#2E9B72" /></View>{orders.slice(0, 10).map((order) => <View key={order.id} style={styles.orderHistoryRow}><View style={styles.orderHistoryCopy}><Text style={styles.orderHistoryId}>{order.id}</Text><Text style={styles.orderHistoryKitchen}>{getLocalized(order.kitchen.name, language)}</Text><Text style={styles.orderHistoryItems}>{order.items.map((item) => `${item.quantity}× ${getLocalized(item.meal.name, language)}`).join("، ")}</Text><Text style={styles.orderHistoryMeta}>{formatJod(order.total, language)} · {getLocalized(order.eta, language)}</Text></View><Pressable onPress={() => onReorder(order)} style={({ pressed }) => [styles.reorderButton, pressed && styles.pressed]}><MaterialIcons name="replay" size={16} color="#FFFFFF" /><Text style={styles.reorderButtonText}>{language === "ar" ? "إعادة الطلب" : "Reorder"}</Text></Pressable></View>)}</View>;
}

function ComplaintsScreen({ onBack }: { onBack: () => void }) {
  const { language, activeOrder, complaints: localComplaints, addComplaint, showToast } = useApp();
  const { user } = useAuth();
  const remoteComplaintsQuery = trpc.complaints.mine.useQuery(undefined, { enabled: Boolean(user) });
  const createComplaintMutation = trpc.complaints.create.useMutation();
  const complaints = user ? ((remoteComplaintsQuery.data ?? []) as unknown as Complaint[]) : localComplaints;
  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState<ComplaintCategory>("order");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [orderId, setOrderId] = useState(activeOrder?.id ?? "");
  const [imageUris, setImageUris] = useState<string[]>([]);

  useEffect(() => {
    if (!orderId && activeOrder?.id) setOrderId(activeOrder.id);
  }, [activeOrder?.id, orderId]);

  const resetForm = () => {
    setCategory("order");
    setSubject("");
    setDescription("");
    setOrderId(activeOrder?.id ?? "");
    setImageUris([]);
  };

  const mediaErrorMessage = (error: unknown, source: "camera" | "library") => {
    if (error instanceof MediaPermissionError) {
      return source === "camera"
        ? language === "ar" ? "اسمحي للتطبيق باستخدام الكاميرا من إعدادات الهاتف ثم حاولي مرة أخرى" : "Allow camera access in phone settings, then try again"
        : language === "ar" ? "اسمحي للتطبيق بالوصول إلى الصور من إعدادات الهاتف ثم حاولي مرة أخرى" : "Allow photo access in phone settings, then try again";
    }
    return source === "camera"
      ? language === "ar" ? "تعذّر فتح الكاميرا. حاولي مرة أخرى." : "Could not open the camera. Please try again."
      : language === "ar" ? "تعذّر فتح الاستوديو. حاولي مرة أخرى." : "Could not open the photo library. Please try again.";
  };

  const pickImages = async () => {
    try {
      const selected = await chooseImages("library", { multiple: true });
      if (selected.length) setImageUris((current) => [...current, ...selected].slice(0, 4));
    } catch (error) {
      showToast(mediaErrorMessage(error, "library"));
    }
  };

  const takePhoto = async () => {
    try {
      const selected = await chooseImages("camera");
      if (selected.length) setImageUris((current) => [...current, ...selected].slice(0, 4));
    } catch (error) {
      showToast(mediaErrorMessage(error, "camera"));
    }
  };

  const submitComplaint = async () => {
    if (subject.trim().length < 3 || description.trim().length < 8) {
      showToast(language === "ar" ? "اكتبي عنواناً ووصفاً أوضح للشكوى" : "Please add a clearer subject and description");
      return;
    }
    const complaintId = `CMP-${Date.now().toString().slice(-6)}`;
    try {
      const imagePayloads = await Promise.all(imageUris.map(imageUriToDataUrl));
      const saved = await createComplaintMutation.mutateAsync({ id: complaintId, category, subject: subject.trim(), description: description.trim(), orderId: orderId.trim() || undefined, images: imagePayloads });
      addComplaint({ category, subject: subject.trim(), description: description.trim(), orderId: orderId.trim() || undefined, imageUris: saved.imageUris });
      await remoteComplaintsQuery.refetch();
      showToast(language === "ar" ? "تم حفظ الشكوى والصور في قاعدة البيانات" : "Complaint and photos saved to the database");
      resetForm();
      setFormOpen(false);
    } catch {
      if (!user) {
        addComplaint({ category, subject: subject.trim(), description: description.trim(), orderId: orderId.trim() || undefined, imageUris });
        showToast(language === "ar" ? "حُفظت محلياً. سجّلي الدخول بحساب المنصة لمزامنتها على الخادم." : "Saved locally. Sign in with a platform account to sync it to the server.");
        resetForm();
        setFormOpen(false);
      } else {
        showToast(language === "ar" ? "تعذر حفظ الشكوى على الخادم" : "Could not save the complaint on the server");
      }
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#082E34" /></Pressable><View><Text style={styles.eyebrow}>{language === "ar" ? "الدعم والشكاوى" : "SUPPORT & COMPLAINTS"}</Text><Text style={styles.pageTitle}>{language === "ar" ? "نحن نسمعك" : "We hear you"}</Text></View><Pressable onPress={() => { resetForm(); setFormOpen((current) => !current); }} style={styles.complaintAddButton}><MaterialIcons name={formOpen ? "close" : "add"} size={18} color="#FFFFFF" /><Text style={styles.complaintAddButtonText}>{formOpen ? (language === "ar" ? "إلغاء" : "Close") : (language === "ar" ? "شكوى جديدة" : "New complaint")}</Text></Pressable></View>
      <View style={styles.complaintHero}><View style={styles.complaintHeroIcon}><MaterialIcons name="support-agent" size={28} color="#00AFC4" /></View><View style={styles.complaintHeroCopy}><Text style={styles.complaintHeroTitle}>{language === "ar" ? "خلّينا نساعدك" : "Let us help"}</Text><Text style={styles.complaintHeroBody}>{language === "ar" ? "ابعثي تفاصيل المشكلة وصوراً إن وجدت، وفريق سفرة يتابعها معك خطوة بخطوة." : "Share the details and any photos. The Sufret Omi team will follow up step by step."}</Text></View></View>
      {formOpen && <View style={styles.complaintFormCard}><Text style={styles.complaintFormTitle}>{language === "ar" ? "تفاصيل الشكوى" : "Complaint details"}</Text><Text style={styles.optionLabel}>{language === "ar" ? "نوع الشكوى" : "Complaint type"}</Text><View style={styles.complaintCategoryGrid}>{complaintCategories.map((item) => <Pressable key={item.id} onPress={() => setCategory(item.id)} style={[styles.complaintCategory, category === item.id && styles.complaintCategoryActive]}><MaterialIcons name={item.icon as IconName} size={17} color={category === item.id ? "#FFFFFF" : "#00AFC4"} /><Text style={[styles.complaintCategoryText, category === item.id && styles.complaintCategoryTextActive]}>{getLocalized(item.label, language)}</Text></Pressable>)}</View><TextInput value={subject} onChangeText={setSubject} placeholder={language === "ar" ? "عنوان مختصر للشكوى" : "Short complaint subject"} placeholderTextColor="#8ABAC0" style={styles.complaintSubjectInput} textAlign={language === "ar" ? "right" : "left"} maxLength={80} /><TextInput value={description} onChangeText={setDescription} placeholder={language === "ar" ? "اكتبي ماذا حدث بالتفصيل..." : "Tell us what happened..."} placeholderTextColor="#8ABAC0" style={styles.complaintDescriptionInput} textAlign={language === "ar" ? "right" : "left"} multiline maxLength={800} /><TextInput value={orderId} onChangeText={setOrderId} placeholder={language === "ar" ? "رقم الطلب (اختياري) مثل SO-2408" : "Order number (optional), e.g. SO-2408"} placeholderTextColor="#8ABAC0" style={styles.complaintSubjectInput} textAlign={language === "ar" ? "right" : "left"} maxLength={24} /><Text style={styles.complaintAttachLabel}>{language === "ar" ? `صور مرفقة (${imageUris.length}/4)` : `Attachments (${imageUris.length}/4)`}</Text><View style={styles.complaintAttachActions}><Pressable onPress={pickImages} style={({ pressed }) => [styles.complaintAttachButton, pressed && styles.pressed]}><MaterialIcons name="photo-library" size={18} color="#00AFC4" /><Text style={styles.complaintAttachText}>{language === "ar" ? "من الصور" : "Photo library"}</Text></Pressable><Pressable onPress={takePhoto} style={({ pressed }) => [styles.complaintAttachButton, pressed && styles.pressed]}><MaterialIcons name="photo-camera" size={18} color="#00AFC4" /><Text style={styles.complaintAttachText}>{language === "ar" ? "التقاط صورة" : "Take photo"}</Text></Pressable></View>{imageUris.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.complaintImageRow}>{imageUris.map((uri, index) => <View key={`${uri}-${index}`} style={styles.complaintImageWrap}><Image source={{ uri }} style={styles.complaintImage} /><Pressable onPress={() => setImageUris((current) => current.filter((_, imageIndex) => imageIndex !== index))} style={styles.complaintImageRemove}><MaterialIcons name="close" size={13} color="#FFFFFF" /></Pressable></View>)}</ScrollView>}<Pressable disabled={createComplaintMutation.isPending} onPress={submitComplaint} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, createComplaintMutation.isPending && styles.disabledButton]}><Text style={styles.primaryButtonText}>{createComplaintMutation.isPending ? (language === "ar" ? "جارٍ الحفظ..." : "Saving...") : (language === "ar" ? "إرسال الشكوى" : "Send complaint")}</Text><MaterialIcons name={createComplaintMutation.isPending ? "hourglass-top" : "send"} size={18} color="#FFFFFF" /></Pressable></View>}
      <View style={styles.complaintsSectionHeader}><View><Text style={styles.sectionTitle}>{language === "ar" ? "شكاواي" : "My complaints"}</Text><Text style={styles.complaintsSectionHint}>{complaints.length ? (language === "ar" ? `${complaints.length} شكوى محفوظة` : `${complaints.length} saved complaints`) : (language === "ar" ? "تابعي حالة كل طلب دعم" : "Track every support request")}</Text></View>{complaints.length > 0 && <MaterialIcons name="history" size={21} color="#2E9B72" />}</View>
      {complaints.length === 0 ? <View style={styles.complaintEmptyCard}><MaterialIcons name="forum" size={32} color="#2E9B72" /><Text style={styles.emptyTitle}>{language === "ar" ? "ما عندك شكاوى حالياً" : "No complaints yet"}</Text><Text style={styles.emptyBody}>{language === "ar" ? "إذا واجهتك أي مشكلة، أرسليها من زر شكوى جديدة." : "If anything goes wrong, send it from New complaint."}</Text><Pressable onPress={() => setFormOpen(true)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{language === "ar" ? "ابدئي شكوى" : "Start a complaint"}</Text></Pressable></View> : <View style={styles.complaintList}>{complaints.map((complaint) => { const categoryItem = complaintCategories.find((item) => item.id === complaint.category); return <View key={complaint.id} style={styles.complaintCard}><View style={styles.complaintCardTop}><View style={styles.complaintCardIcon}><MaterialIcons name={(categoryItem?.icon ?? "help-outline") as IconName} size={18} color="#00AFC4" /></View><View style={styles.complaintCardCopy}><Text style={styles.complaintCardCategory}>{categoryItem ? getLocalized(categoryItem.label, language) : complaint.category}</Text><Text style={styles.complaintCardTitle}>{complaint.subject}</Text></View><View style={[styles.complaintStatus, complaint.status === "resolved" || complaint.status === "closed" ? styles.complaintStatusResolved : complaint.status === "in_review" ? styles.complaintStatusReview : styles.complaintStatusNew]}><Text style={styles.complaintStatusText}>{getLocalized(complaintStatuses[complaint.status], language)}</Text></View></View><Text style={styles.complaintCardDescription}>{complaint.description}</Text><View style={styles.complaintCardMeta}><Text style={styles.complaintCardMetaText}>{complaint.id}</Text>{complaint.orderId && <Text style={styles.complaintCardMetaText}>{complaint.orderId}</Text>}<Text style={styles.complaintCardMetaText}>{new Date(complaint.createdAt).toLocaleDateString(language === "ar" ? "ar-JO" : "en-US")}</Text></View>{complaint.imageUris.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.complaintImageRow}>{complaint.imageUris.map((uri, index) => <Image key={`${complaint.id}-${index}`} source={{ uri }} style={styles.complaintListImage} />)}</ScrollView>}{complaint.response && <View style={styles.complaintResponse}><MaterialIcons name="support-agent" size={16} color="#00AFC4" /><Text style={styles.complaintResponseText}>{complaint.response}</Text></View>}</View>; })}</View>}
    </ScrollView>
  );
}

function MotherDashboard({ onBack }: { onBack: () => void }) {
  const { language, toggleKitchen, incomingOrder, incomingOrders, selectIncomingOrder, acceptIncomingOrder, rejectIncomingOrder, requestPayout, lastPayout, setRole, motherVerification, complaints, updateComplaintStatus, showToast, weeklySchedule, toggleClosedDay, toggleMealScheduleDay, isKitchenAvailable, availableMeals, removeMeal, kitchenDescriptions, updateKitchenDescription: saveLocalKitchenDescription } = useApp();
  const { user } = useAuth();
  const kitchenDescriptionQuery = trpc.kitchens.profile.useQuery({ kitchenId: "umm-ahmad" }, { staleTime: 30_000, gcTime: 5 * 60_000, retry: false });
  const saveKitchenDescriptionMutation = trpc.kitchens.updateDescription.useMutation({
    onSuccess: (saved) => {
      saveLocalKitchenDescription(saved.kitchenId, { ar: saved.descriptionAr, en: saved.descriptionEn, showDescription: saved.showDescription });
      void kitchenDescriptionQuery.refetch();
      setDescriptionEditorOpen(false);
      showToast(language === "ar" ? "تم حفظ وصف المطبخ" : "Kitchen description saved");
    },
    onError: () => showToast(language === "ar" ? "تعذر حفظ الوصف في قاعدة البيانات" : "Could not save the description to the database"),
  });
  const fallbackDescription = kitchenDescriptions["umm-ahmad"] ?? { ...(kitchens.find((kitchen) => kitchen.id === "umm-ahmad")?.description ?? { ar: "أكلات بيتية طازجة نحضرها يومياً بحب.", en: "Fresh home-cooked dishes prepared daily with care." }), showDescription: false };
  const remoteDescription = kitchenDescriptionQuery.data;
  const hasRemoteDescription = Boolean(remoteDescription && (remoteDescription.descriptionAr.trim() || remoteDescription.descriptionEn.trim()));
  const currentDescription = hasRemoteDescription ? { ar: remoteDescription?.descriptionAr || fallbackDescription.ar, en: remoteDescription?.descriptionEn || fallbackDescription.en } : fallbackDescription;
  const currentShowDescription = remoteDescription?.showDescription ?? fallbackDescription.showDescription;
  const [descriptionEditorOpen, setDescriptionEditorOpen] = useState(false);
  const [descriptionAr, setDescriptionAr] = useState(currentDescription.ar);
  const [descriptionEn, setDescriptionEn] = useState(currentDescription.en);
  const [showDescription, setShowDescription] = useState(currentShowDescription);
  useEffect(() => {
    setDescriptionAr(currentDescription.ar);
    setDescriptionEn(currentDescription.en);
    setShowDescription(currentShowDescription);
  }, [currentDescription.ar, currentDescription.en, currentShowDescription]);
  const saveDescription = () => {
    const nextAr = descriptionAr.trim();
    const nextEn = descriptionEn.trim();
    if (showDescription && !nextAr && !nextEn) {
      showToast(language === "ar" ? "اكتبي وصفاً واحداً على الأقل أو أخفيه عن العملاء" : "Add a description or hide it from customers");
      return;
    }
    if (user) {
      saveKitchenDescriptionMutation.mutate({ kitchenId: "umm-ahmad", descriptionAr: nextAr, descriptionEn: nextEn, showDescription });
      return;
    }
    saveLocalKitchenDescription("umm-ahmad", { ar: nextAr, en: nextEn, showDescription });
    setDescriptionEditorOpen(false);
    showToast(language === "ar" ? "تم حفظ الوصف على هذا الجهاز. سجلي الدخول لمزامنته عبر الأجهزة." : "Saved on this device. Sign in to sync it across devices.");
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [newMealNameAr, setNewMealNameAr] = useState("");
  const [newMealNameEn, setNewMealNameEn] = useState("");
  const [newMealDescAr, setNewMealDescAr] = useState("");
  const [newMealDescEn, setNewMealDescEn] = useState("");
  const [newMealCategory, setNewMealCategory] = useState<"mansaf" | "maqluba" | "mahshi" | "bakery" | "moona" | "desserts" | "dairy" | "cheese">("mansaf");
  const [newMealPrice, setNewMealPrice] = useState("5.50");
  const [newMealPrep, setNewMealPrep] = useState("45");
  const [newMealLimit, setNewMealLimit] = useState("15");
  const [newMealImage, setNewMealImage] = useState("https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=84");
  const createMealMutation = trpc.kitchens.createMeal.useMutation();
  const todayClosed = weeklySchedule.closedDays.includes(getWeekdayFromDate());
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const motherMeals = availableMeals.filter((meal) => meal.kitchenId === "umm-ahmad");
  const confirmRemoveMeal = (meal: (typeof meals)[number]) => {
    const title = language === "ar" ? "إزالة الطبخة؟" : "Remove this dish?";
    const message = language === "ar" ? `سيتم إخفاء «${getLocalized(meal.name, language)}» من قائمة مطبخك وإزالتها من السلة إن وُجدت.` : `“${getLocalized(meal.name, language)}” will be hidden from your menu and removed from the cart if present.`;
    const remove = () => removeMeal(meal.id);
    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n\n${message}`)) remove();
      return;
    }
    Alert.alert(title, message, [
      { text: language === "ar" ? "إلغاء" : "Cancel", style: "cancel" },
      { text: language === "ar" ? "إزالة" : "Remove", style: "destructive", onPress: remove },
    ]);
  };
  const downloadWeeklySchedule = async () => {
    const csv = weeklyScheduleToCsv(weeklySchedule, motherMeals);
    if (Platform.OS === "web") {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "sufret-omi-weekly-schedule.csv";
      anchor.click();
      URL.revokeObjectURL(url);
      showToast(language === "ar" ? "تم تنزيل الجدول الأسبوعي" : "Weekly schedule downloaded");
      return;
    }
    try {
      const fileUri = `${FileSystem.documentDirectory}sufret-omi-weekly-schedule.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: language === "ar" ? "الجدول الأسبوعي" : "Weekly schedule" });
      else showToast(language === "ar" ? "تم إنشاء الجدول داخل الجهاز" : "Schedule created on the device");
    } catch {
      showToast(language === "ar" ? "تعذر تنزيل الجدول حالياً" : "Could not download the schedule");
    }
  };
  const incomingPricing = incomingOrder ? getOrderPricing(totalCart(incomingOrder.items), incomingOrder.deliveryFee ?? 1.25) : null;
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#082E34" /></Pressable><View><Text style={styles.eyebrow}>{language === "ar" ? "لوحة الأم" : "MOTHER'S TABLE"}</Text><Text style={styles.pageTitle}>{language === "ar" ? "صباح الخير يا أم أحمد" : "Good morning, Umm Ahmad"}</Text></View><Pressable onPress={() => { setRole("customer"); onBack(); }} style={styles.roleIcon}><MaterialIcons name="person-outline" size={20} color="#00AFC4" /></Pressable></View>
      <View style={styles.dashboardHero}><View><Text style={styles.dashboardOverline}>{language === "ar" ? "حالة المطبخ" : "Kitchen status"}</Text><Text style={styles.dashboardTitle}>{isKitchenAvailable ? (language === "ar" ? "مطبخك مفتوح" : "Your kitchen is open") : (language === "ar" ? "المطبخ مغلق" : "Kitchen is closed")}</Text><Text style={styles.dashboardBody}>{todayClosed ? (language === "ar" ? "مغلق حسب جدولك الأسبوعي اليوم" : "Closed according to your weekly schedule") : isKitchenAvailable ? (language === "ar" ? "جاهزة تستقبلي طلبات الجيران" : "Ready to welcome neighborhood orders") : (language === "ar" ? "افتحيه لما تكوني جاهزة" : "Open it when you're ready")}</Text></View><Switch disabled={todayClosed} value={isKitchenAvailable} onValueChange={toggleKitchen} trackColor={{ false: "#D6E2D4", true: "#F2B84B" }} thumbColor={isKitchenAvailable ? "#2E9B72" : "#4C747A"} /></View>
      <View style={styles.earningsRow}><DashboardMetric label={language === "ar" ? "طلبات اليوم" : "Today's orders"} value="12" icon="receipt-long" /><DashboardMetric label={language === "ar" ? "أرباح الشهر" : "This month"} value={language === "ar" ? "٤٨٦ د.أ" : "JOD 486"} icon="trending-up" /><DashboardMetric label={language === "ar" ? "التقييم" : "Rating"} value="4.9" icon="star" /></View>
      <View style={styles.capacitySettingsCard}><View style={styles.capacitySettingsIcon}><MaterialIcons name="inventory-2" size={19} color="#00AFC4" /></View><View style={styles.capacitySettingsCopy}><Text style={styles.capacitySettingsTitle}>{language === "ar" ? "إعدادات حجم الطلب" : "Order-size settings"}</Text><Text style={styles.capacitySettingsBody}>{motherVerification.mealSize && motherVerification.deliveryCapacity ? `${getLocalized(mealSizeLabels[motherVerification.mealSize], language)} · ${getLocalized(loadCapacityLabels[motherVerification.deliveryCapacity], language)}` : language === "ar" ? "أكملي حجم الوجبات وسعة التوصيل من ملف التحقق" : "Complete meal size and delivery capacity in verification"}</Text></View><MaterialIcons name="tune" size={18} color="#2E9B72" /></View>
      <View style={styles.kitchenDescriptionEditorCard}><View style={styles.kitchenDescriptionEditorHeader}><View style={styles.kitchenDescriptionEditorIcon}><MaterialIcons name="edit-note" size={20} color="#00AFC4" /></View><View style={styles.kitchenDescriptionEditorCopy}><Text style={styles.kitchenDescriptionEditorTitle}>{language === "ar" ? "وصف مطبخك" : "Your kitchen description"}</Text><Text style={styles.kitchenDescriptionEditorHint}>{language === "ar" ? "يظهر للزبائن أسفل معلومات المطبخ" : "Shown to customers below your kitchen details"}</Text></View><Pressable onPress={() => setDescriptionEditorOpen((value) => !value)} style={({ pressed }) => [styles.descriptionEditButton, pressed && styles.pressed]}><MaterialIcons name={descriptionEditorOpen ? "expand-less" : "edit"} size={17} color="#00AFC4" /><Text style={styles.descriptionEditButtonText}>{descriptionEditorOpen ? (language === "ar" ? "إغلاق" : "Close") : (language === "ar" ? "تعديل" : "Edit")}</Text></Pressable><View style={styles.descriptionVisibilityControl}><Text style={styles.descriptionVisibilityText}>{showDescription ? (language === "ar" ? "ظاهر" : "Visible") : (language === "ar" ? "مخفي" : "Hidden")}</Text><Switch value={showDescription} onValueChange={setShowDescription} trackColor={{ false: "#D6E2D4", true: "#BFEFF2" }} thumbColor={showDescription ? "#00AFC4" : "#4C747A"} /></View></View><Text style={styles.kitchenDescriptionPreview}>{getLocalized(currentDescription, language)}</Text>{descriptionEditorOpen && <View style={styles.kitchenDescriptionEditor}><Text style={styles.descriptionFieldLabel}>{language === "ar" ? "الوصف بالعربي" : "Arabic description"}</Text><TextInput value={descriptionAr} onChangeText={setDescriptionAr} placeholder="اكتبي وصفاً مختصراً لمطبخك" placeholderTextColor="#8ABAC0" multiline maxLength={500} textAlign="right" style={styles.descriptionTextInput} /><Text style={styles.descriptionFieldLabel}>{language === "ar" ? "الوصف بالإنجليزية" : "English description"}</Text><TextInput value={descriptionEn} onChangeText={setDescriptionEn} placeholder="Write a short description of your kitchen" placeholderTextColor="#8ABAC0" multiline maxLength={500} textAlign="left" style={styles.descriptionTextInput} /><View style={styles.descriptionActions}><Pressable onPress={() => { setDescriptionAr(currentDescription.ar); setDescriptionEn(currentDescription.en); setShowDescription(currentShowDescription); setDescriptionEditorOpen(false); }} style={({ pressed }) => [styles.descriptionCancelButton, pressed && styles.pressed]}><Text style={styles.descriptionCancelText}>{language === "ar" ? "إلغاء" : "Cancel"}</Text></Pressable><Pressable disabled={saveKitchenDescriptionMutation.isPending} onPress={saveDescription} style={({ pressed }) => [styles.descriptionSaveButton, saveKitchenDescriptionMutation.isPending && styles.disabledButton, pressed && styles.pressed]}><Text style={styles.descriptionSaveText}>{saveKitchenDescriptionMutation.isPending ? (language === "ar" ? "جاري الحفظ..." : "Saving...") : (language === "ar" ? "حفظ الوصف" : "Save description")}</Text></Pressable></View></View>}</View>
      <View style={styles.scheduleCard}><View style={styles.scheduleHeader}><View style={styles.scheduleHeaderCopy}><Text style={styles.scheduleTitle}>{language === "ar" ? "جدول مطبخك الأسبوعي" : "Your weekly kitchen schedule"}</Text><Text style={styles.scheduleHint}>{language === "ar" ? "حددي أيام الإغلاق وتوفر كل طبق" : "Set closed days and meal availability"}</Text></View><Pressable onPress={() => void downloadWeeklySchedule()} style={({ pressed }) => [styles.scheduleDownloadButton, pressed && styles.pressed]}><MaterialIcons name="download" size={16} color="#00AFC4" /><Text style={styles.scheduleDownloadText}>{language === "ar" ? "تنزيل" : "Download"}</Text></Pressable></View><Pressable onPress={() => setScheduleOpen((value) => !value)} style={styles.scheduleToggle}><View style={styles.scheduleToggleIcon}><MaterialIcons name="event-available" size={18} color="#00AFC4" /></View><View style={styles.scheduleToggleCopy}><Text style={styles.scheduleToggleTitle}>{language === "ar" ? "أيام إغلاق المتجر" : "Store closed days"}</Text><Text style={styles.scheduleToggleHint}>{weeklySchedule.closedDays.length ? weeklySchedule.closedDays.map((day) => weekdays.find((item) => item.id === day)?.label[language]).join("، ") : language === "ar" ? "المتجر مفتوح طوال الأسبوع" : "Open all week"}</Text></View><MaterialIcons name={scheduleOpen ? "expand-less" : "expand-more"} size={20} color="#2E9B72" /></Pressable>{scheduleOpen && <View style={styles.scheduleEditor}><Text style={styles.scheduleGroupLabel}>{language === "ar" ? "اضغطي على اليوم لإغلاقه" : "Tap a day to close the store"}</Text><View style={styles.weekdayGrid}>{weekdays.map((day) => { const closed = weeklySchedule.closedDays.includes(day.id); return <Pressable key={day.id} onPress={() => toggleClosedDay(day.id)} style={[styles.weekdayChip, closed && styles.weekdayChipClosed]}><MaterialIcons name={closed ? "event-busy" : "event-available"} size={14} color={closed ? "#A55A40" : "#00AFC4"} /><Text style={[styles.weekdayChipText, closed && styles.weekdayChipTextClosed]}>{day.label[language]}</Text></Pressable>; })}</View><Text style={styles.scheduleGroupLabel}>{language === "ar" ? "توفر الأطباق" : "Meal availability"}</Text>{motherMeals.map((meal) => <View key={meal.id} style={styles.mealScheduleRow}><View style={styles.mealScheduleCopy}><Text style={styles.mealScheduleName}>{getLocalized(meal.name, language)}</Text><Text style={styles.mealScheduleMeta}>{getLocalized(meal.description, language)}</Text></View><View style={styles.mealDayMiniGrid}>{weekdays.map((day) => { const available = isMealAvailableOnDay(weeklySchedule, meal.id, day.id); return <Pressable key={`${meal.id}-${day.id}`} onPress={() => toggleMealScheduleDay(meal.id, day.id)} disabled={weeklySchedule.closedDays.includes(day.id)} style={[styles.mealDayMini, available && styles.mealDayMiniActive, weeklySchedule.closedDays.includes(day.id) && styles.mealDayMiniDisabled]}><Text style={[styles.mealDayMiniText, available && styles.mealDayMiniTextActive]}>{day.label[language].slice(0, 1)}</Text></Pressable>; })}</View></View>)}</View>}</View>
      {incomingOrders.length > 1 && <View style={styles.incomingQueue}><Text style={styles.incomingQueueTitle}>{language === "ar" ? `${incomingOrders.length} طلبات بانتظار مطبخك` : `${incomingOrders.length} orders for your kitchen`}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.incomingQueueRow}>{incomingOrders.map((order) => <Pressable key={order.id} onPress={() => selectIncomingOrder(order.id)} style={[styles.incomingQueueChip, incomingOrder?.id === order.id && styles.incomingQueueChipActive]}><Text style={[styles.incomingQueueChipId, incomingOrder?.id === order.id && styles.incomingQueueChipTextActive]}>{order.id}</Text><Text style={[styles.incomingQueueChipKitchen, incomingOrder?.id === order.id && styles.incomingQueueChipTextActive]} numberOfLines={1}>{getLocalized(order.kitchen.name, language)}</Text></Pressable>)}</ScrollView></View>}
      {incomingOrder && <View style={styles.incomingCard}><View style={styles.incomingTop}><View><Text style={styles.incomingEyebrow}>{language === "ar" ? "طلب جديد" : "New order"}</Text><Text style={styles.incomingId}>{incomingOrder.id}</Text></View><View style={styles.newPill}><Text style={styles.newPillText}>{language === "ar" ? "جديد" : "NEW"}</Text></View></View><Text style={styles.incomingTitle}>{incomingOrder.items.map((item) => `${item.quantity}× ${getLocalized(item.meal.name, language)}`).join("، ")}</Text><Text style={styles.incomingMeta}>{getLocalized(incomingOrder.eta, language)} · {formatJod(incomingOrder.total, language)} · {t(paymentLabels[incomingOrder.paymentMethod], language)}</Text>{incomingOrder.specialRequests ? <View style={styles.specialRequestCard}><MaterialIcons name="edit-note" size={18} color="#8A6516" /><View style={styles.specialRequestCopy}><Text style={styles.specialRequestTitle}>{language === "ar" ? "طلبات العميل الخاصة" : "Customer special requests"}</Text><Text style={styles.specialRequestBody}>{incomingOrder.specialRequests}</Text></View></View> : null}{incomingPricing && <View style={styles.earningsBreakdown}><SummaryRow label={language === "ar" ? "قيمة الطعام" : "Food subtotal"} value={formatJod(incomingPricing.subtotal, language)} /><SummaryRow label={language === "ar" ? "عمولة المنصة (٥٪)" : "Platform commission (5%)"} value={`-${formatJod(incomingPricing.commission, language)}`} /><View style={styles.summaryDivider} /><SummaryRow label={language === "ar" ? "صافي أرباحك" : "Your payout"} value={formatJod(incomingPricing.motherPayout, language)} strong /></View>}{incomingOrder.status === "received" ? <View style={styles.incomingActions}><Pressable onPress={() => rejectIncomingOrder(incomingOrder.id)} style={styles.rejectButton}><Text style={styles.rejectText}>{language === "ar" ? "رفض" : "Decline"}</Text></Pressable><Pressable onPress={() => acceptIncomingOrder(incomingOrder.id)} style={styles.acceptButton}><Text style={styles.acceptText}>{language === "ar" ? "قبول الطلب" : "Accept order"}</Text><MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" /></Pressable></View> : <View style={styles.prepNotice}><MaterialIcons name="soup-kitchen" size={18} color="#2E9B72" /><Text style={styles.prepNoticeText}>{language === "ar" ? "الطلب قيد التحضير - وقت التسليم ٤٥ دقيقة" : "Preparing - ready in 45 minutes"}</Text></View>}</View>}
      <SectionHeader title={language === "ar" ? "شكاوى العملاء" : "Customer complaints"} action={complaints.length ? (language === "ar" ? "تحديث" : "Update") : ""} onAction={complaints.length ? () => { const next = complaints.find((complaint) => complaint.status === "new") ?? complaints.find((complaint) => complaint.status === "in_review"); if (next) { updateComplaintStatus(next.id, next.status === "new" ? "in_review" : "resolved", next.status === "new" ? (language === "ar" ? "تم استلام شكواك ونراجعها الآن." : "We received your complaint and are reviewing it.") : (language === "ar" ? "تمت معالجة الشكوى." : "The complaint has been addressed.")); showToast(language === "ar" ? "تم تحديث حالة الشكوى" : "Complaint status updated"); } } : undefined} />
      {complaints.length ? <View style={styles.complaintInbox}>{complaints.slice(0, 3).map((complaint) => { const categoryItem = complaintCategories.find((item) => item.id === complaint.category); return <View key={complaint.id} style={styles.complaintInboxRow}><View style={styles.complaintInboxIcon}><MaterialIcons name={(categoryItem?.icon ?? "help-outline") as IconName} size={16} color="#00AFC4" /></View><View style={styles.complaintInboxCopy}><Text style={styles.complaintInboxTitle}>{complaint.subject}</Text><Text style={styles.complaintInboxMeta}>{complaint.id} · {getLocalized(complaintStatuses[complaint.status], language)}{complaint.imageUris.length ? ` · ${complaint.imageUris.length} ${language === "ar" ? "صور" : "photos"}` : ""}</Text></View><Pressable onPress={() => { const nextStatus = complaint.status === "new" ? "in_review" : complaint.status === "in_review" ? "resolved" : complaint.status; updateComplaintStatus(complaint.id, nextStatus, nextStatus === "resolved" ? (language === "ar" ? "تمت معالجة الشكوى من فريق سفرة." : "The Sufret Omi team addressed this complaint.") : undefined); showToast(language === "ar" ? "تم تحديث الشكوى" : "Complaint updated"); }} style={styles.complaintInboxAction}><Text style={styles.complaintInboxActionText}>{complaint.status === "new" ? (language === "ar" ? "مراجعة" : "Review") : complaint.status === "in_review" ? (language === "ar" ? "حل" : "Resolve") : (language === "ar" ? "تمت" : "Done")}</Text></Pressable></View>; })}</View> : <View style={styles.supportEmptyCard}><MaterialIcons name="check-circle" size={20} color="#2E9B72" /><Text style={styles.supportEmptyText}>{language === "ar" ? "لا توجد شكاوى جديدة على مطبخك" : "No new complaints for your kitchen"}</Text></View>}
      <SectionHeader title={language === "ar" ? "إدارة مطبخك" : "Manage your kitchen"} action={language === "ar" ? "عرض القائمة" : "View menu"} onAction={() => setMenuOpen((value) => !value)} />
      <View style={styles.dashboardList}><DashboardAction icon="restaurant-menu" title={language === "ar" ? "قائمة الأكلات" : "Menu items"} detail={language === "ar" ? `${motherMeals.length} أكلات · ${motherMeals.length} متاحة` : `${motherMeals.length} meals · ${motherMeals.length} available`} onPress={() => setMenuOpen((value) => !value)} /><DashboardAction icon="event" title={language === "ar" ? "طلبات مسبقة" : "Advance orders"} detail={language === "ar" ? "مناسبات الجمعة" : "Friday gatherings"} onPress={() => undefined} /><DashboardAction icon="account-balance" title={language === "ar" ? "الأرباح و CliQ" : "Earnings & CliQ"} detail={lastPayout ? (language === "ar" ? "طلب التحويل قيد المعالجة" : "Payout processing") : (language === "ar" ? "٣٨٦ د.أ جاهزة للتحويل" : "JOD 386 ready to payout")} onPress={() => requestPayout(386)} /> </View>
      <View style={styles.menuActionRow}>
        <Pressable onPress={() => setAddMealOpen((value) => !value)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><MaterialIcons name="add" size={18} color="#FFFFFF" /><Text style={styles.primaryButtonText}>{language === "ar" ? "إضافة طبخة جديدة للاعتماد" : "Add new dish for approval"}</Text></Pressable>
      </View>
      {addMealOpen && <View style={styles.kitchenDescriptionEditor}>
        <Text style={styles.descriptionFieldLabel}>{language === "ar" ? "اسم الطبخة بالعربي" : "Arabic dish name"}</Text>
        <TextInput value={newMealNameAr} onChangeText={setNewMealNameAr} placeholder="مثال: منسف لحم بلدي" placeholderTextColor="#8ABAC0" textAlign="right" style={styles.descriptionTextInput} />
        <Text style={styles.descriptionFieldLabel}>{language === "ar" ? "اسم الطبخة بالإنجليزية" : "English dish name"}</Text>
        <TextInput value={newMealNameEn} onChangeText={setNewMealNameEn} placeholder="Example: Local Lamb Mansaf" placeholderTextColor="#8ABAC0" textAlign="left" style={styles.descriptionTextInput} />
        <Text style={styles.descriptionFieldLabel}>{language === "ar" ? "الوصف بالعربي" : "Arabic description"}</Text>
        <TextInput value={newMealDescAr} onChangeText={setNewMealDescAr} placeholder="اكتبي وصفاً للطبخة..." placeholderTextColor="#8ABAC0" multiline textAlign="right" style={styles.descriptionTextInput} />
        <Text style={styles.descriptionFieldLabel}>{language === "ar" ? "الوصف بالإنجليزية" : "English description"}</Text>
        <TextInput value={newMealDescEn} onChangeText={setNewMealDescEn} placeholder="Write a description..." placeholderTextColor="#8ABAC0" multiline textAlign="left" style={styles.descriptionTextInput} />
        <Text style={styles.descriptionFieldLabel}>{language === "ar" ? "فئة الطبخة" : "Dish category"}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{categories.map((category) => <Chip key={category.id} label={getLocalized(category.label, language)} selected={newMealCategory === category.id} onPress={() => setNewMealCategory(category.id as typeof newMealCategory)} />)}</ScrollView>
        <Text style={styles.descriptionFieldLabel}>{language === "ar" ? "رابط صورة الطبخة" : "Dish image URL"}</Text>
        <TextInput value={newMealImage} onChangeText={setNewMealImage} placeholder="https://..." placeholderTextColor="#8ABAC0" keyboardType="url" autoCapitalize="none" style={styles.descriptionTextInput} />
        <Text style={styles.descriptionFieldLabel}>{language === "ar" ? "السعر (د.أ)" : "Price (JOD)"}</Text>
        <TextInput value={newMealPrice} onChangeText={setNewMealPrice} placeholder="5.50" placeholderTextColor="#8ABAC0" keyboardType="numeric" style={styles.descriptionTextInput} />
        <Text style={styles.descriptionFieldLabel}>{language === "ar" ? "وقت التحضير (دقيقة)" : "Prep minutes"}</Text>
        <TextInput value={newMealPrep} onChangeText={setNewMealPrep} placeholder="45" placeholderTextColor="#8ABAC0" keyboardType="numeric" style={styles.descriptionTextInput} />
        <Text style={styles.descriptionFieldLabel}>{language === "ar" ? "الحد اليومي للوجبات" : "Daily order limit"}</Text>
        <TextInput value={newMealLimit} onChangeText={setNewMealLimit} placeholder="15" placeholderTextColor="#8ABAC0" keyboardType="numeric" style={styles.descriptionTextInput} />
        <View style={styles.descriptionActions}>
          <Pressable onPress={() => setAddMealOpen(false)} style={({ pressed }) => [styles.descriptionCancelButton, pressed && styles.pressed]}><Text style={styles.descriptionCancelText}>{language === "ar" ? "إلغاء" : "Cancel"}</Text></Pressable>
          <Pressable disabled={createMealMutation.isPending} onPress={() => {
            if (!newMealNameAr.trim()) { showToast(language === "ar" ? "يرجى كتابة اسم الطبخة" : "Please enter dish name"); return; }
            createMealMutation.mutate({
              kitchenId: "umm-ahmad",
              nameAr: newMealNameAr.trim(),
              nameEn: newMealNameEn.trim() || newMealNameAr.trim(),
              descriptionAr: newMealDescAr.trim(),
              descriptionEn: newMealDescEn.trim() || newMealDescAr.trim(),
              category: newMealCategory,
              price: newMealPrice.trim() || "5.00",
              prepMinutes: Number(newMealPrep) || 45,
              dailyLimit: Number(newMealLimit) || 15,
              image: newMealImage,
            }, {
              onSuccess: () => {
                showToast(language === "ar" ? "تم إرسال الطبخة إلى المشرف للاعتماد والنشر" : "Dish submitted to supervisor for approval");
                setAddMealOpen(false);
                setNewMealNameAr("");
                setNewMealNameEn("");
                setNewMealDescAr("");
                setNewMealDescEn("");
              },
              onError: () => showToast(language === "ar" ? "تعذر إرسال الطبخة" : "Could not submit dish"),
            });
          }} style={({ pressed }) => [styles.descriptionSaveButton, createMealMutation.isPending && styles.disabledButton, pressed && styles.pressed]}><Text style={styles.descriptionSaveText}>{createMealMutation.isPending ? (language === "ar" ? "جاري الإرسال..." : "Submitting...") : (language === "ar" ? "إرسال للمشرف" : "Submit to supervisor")}</Text></Pressable>
        </View>
      </View>}
      {menuOpen && <View style={styles.menuManager}>{motherMeals.length ? motherMeals.map((meal) => <View key={meal.id} style={styles.menuManagerRow}><Image source={{ uri: meal.image }} style={styles.menuThumb} /><View style={styles.menuManagerCopy}><Text style={styles.menuManagerName}>{getLocalized(meal.name, language)}</Text><Text style={styles.menuManagerMeta}>{formatJod(meal.price, language)} · {meal.prepMinutes} min</Text></View><View style={styles.menuStatus}><View style={styles.openDot} /><Text style={styles.menuStatusText}>{language === "ar" ? "متاحة" : "Live"}</Text></View><Pressable onPress={() => confirmRemoveMeal(meal)} style={({ pressed }) => [styles.menuRemoveButton, pressed && styles.pressed]} accessibilityLabel={language === "ar" ? `إزالة ${getLocalized(meal.name, language)}` : `Remove ${getLocalized(meal.name, language)}`}><MaterialIcons name="delete-outline" size={18} color="#C4555D" /></Pressable></View>) : <View style={styles.menuEmpty}><MaterialIcons name="restaurant-menu" size={22} color="#8ABAC0" /><Text style={styles.menuEmptyText}>{language === "ar" ? "لا توجد طبخات في القائمة حالياً" : "No dishes are currently on the menu"}</Text></View>}</View>}
      <View style={styles.cliqCard}><View style={styles.cliqBadge}><Text style={styles.cliqBadgeText}>CliQ</Text></View><View style={styles.cliqCopy}><Text style={styles.cliqTitle}>{language === "ar" ? "حوّلي أرباحك بسهولة" : "Move your earnings easily"}</Text><Text style={styles.cliqBody}>{language === "ar" ? "آخر تحويل إلى 079 ••• 6281" : "Last payout to 079 ••• 6281"}</Text></View><MaterialIcons name="chevron-right" size={20} color="#2E9B72" /></View>
    </ScrollView>
  );
}

function ProfileScreen({ onRoleChange, onDashboard, onSupport }: { onRoleChange: () => void; onDashboard: () => void; onSupport: () => void }) {
  const { language, setLanguage, selectedRegion, setSelectedRegion, signOut } = useApp();
  const nextRegion = () => { const index = regions.findIndex((item) => item.id === selectedRegion); setSelectedRegion(regions[(index + 1) % regions.length].id); };
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}><View style={styles.profileHeader}><Image source={require("@/assets/images/icon.png")} style={styles.profileAvatar} /><View><Text style={styles.profileGreeting}>{language === "ar" ? "أهلاً سارة" : "Hi Sara"}</Text><Text style={styles.profileMuted}>{language === "ar" ? "خلدا، عمّان" : "Khalda, Amman"}</Text></View><Pressable onPress={onRoleChange} style={styles.switchRoleButton}><MaterialIcons name="swap-horiz" size={16} color="#00AFC4" /><Text style={styles.switchRoleText}>{language === "ar" ? "وضع الأم" : "Mother mode"}</Text></Pressable></View><Pressable onPress={onDashboard} style={styles.profileDashboardCard}><View style={styles.profileDashboardIcon}><MaterialIcons name="grid-view" size={20} color="#FFFFFF" /></View><View style={styles.profileDashboardCopy}><Text style={styles.profileDashboardTitle}>{language === "ar" ? "لوحة التحكم" : "Dashboard"}</Text><Text style={styles.profileDashboardBody}>{language === "ar" ? "تابعي طلباتك ومطابخك وعناوينك" : "Manage orders, kitchens, and addresses"}</Text></View><MaterialIcons name="chevron-right" size={20} color="#FFFFFF" /></Pressable><View style={styles.settingsCard}><SettingRow icon="language" label={language === "ar" ? "اللغة" : "Language"} value={language === "ar" ? "العربية" : "English"} onPress={() => setLanguage(language === "ar" ? "en" : "ar")} /><SettingRow icon="location-on" label={language === "ar" ? "منطقتي" : "My area"} value={getLocalized(getRegion(selectedRegion).label, language)} onPress={nextRegion} /><SettingRow icon="notifications-none" label={language === "ar" ? "الإشعارات" : "Notifications"} value={language === "ar" ? "مفعّلة" : "On"} onPress={() => undefined} /><SettingRow icon="help-outline" label={language === "ar" ? "شكاوى ومساعدة" : "Complaints & help"} value={language === "ar" ? "إرسال ومتابعة شكوى" : "Send and track a complaint"} onPress={onSupport} /><SettingRow icon="logout" label={language === "ar" ? "تسجيل الخروج" : "Log out"} value={language === "ar" ? "الخروج من الحساب" : "Sign out"} onPress={signOut} /></View><View style={styles.aboutCard}><Text style={styles.aboutTitle}>{language === "ar" ? "من بيت أردني لكل بيت" : "From a Jordanian home to every home"}</Text><Text style={styles.aboutBody}>{language === "ar" ? "سفرة أمي تجمعك بأمهات يطبخوا بحب، عشان تضلّ لَمّة البيت على أحلى سفرة." : "Sufret Omi connects you with mothers who cook with care, keeping family time around a generous table."}</Text></View></ScrollView>;
}

function BottomNav({ active, onNavigate, role, language }: { active: ViewId; onNavigate: (view: ViewId) => void; role: Role; language: "ar" | "en" }) {
  const items: { id: ViewId; label: string; icon: IconName }[] = [{ id: "home", label: language === "ar" ? "الرئيسية" : "Home", icon: "home" }, { id: "discover", label: language === "ar" ? "اكتشفي" : "Explore", icon: "explore" }, { id: "orders", label: language === "ar" ? "طلباتي" : "Orders", icon: "receipt-long" }, { id: "profile", label: language === "ar" ? "حسابي" : "Profile", icon: "person-outline" }];
  return <View style={styles.bottomNav}>{items.map((item) => <Pressable key={item.id} onPress={() => onNavigate(item.id)} style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}><MaterialIcons name={item.icon} size={21} color={active === item.id ? "#00AFC4" : "#8ABAC0"} /><Text style={[styles.navLabel, active === item.id && styles.navLabelActive]}>{item.label}</Text></Pressable>)}<View style={styles.navBrandDot}><MaterialIcons name={role === "mother" ? "storefront" : "restaurant"} size={18} color="#FFFFFF" /></View></View>;
}

function FloatingCart({ language, count, total, onPress, bottomOffset }: { language: "ar" | "en"; count: number; total: number; onPress: () => void; bottomOffset: number }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.floatingCart, { bottom: bottomOffset }, pressed && styles.pressed]}><View><Text style={styles.floatingCartEyebrow}>{language === "ar" ? `${count} وجبة في السلة` : `${count} meals in cart`}</Text><Text style={styles.floatingCartPrice}>{formatJod(total, language)}</Text></View><View style={styles.floatingCartCtaWrap}><Text style={styles.floatingCartCta}>{language === "ar" ? "عرض السلة وإكمال الطلب" : "View cart & continue"}</Text><MaterialIcons name="arrow-forward" size={17} color="#F6D889" /></View></Pressable>; }

function LanguageToggle() { const { language, setLanguage } = useApp(); return <Pressable onPress={() => setLanguage(language === "ar" ? "en" : "ar")} style={styles.languageToggle}><Text style={[styles.languageText, language === "ar" && styles.languageActive]}>ع</Text><Text style={styles.languageSlash}>/</Text><Text style={[styles.languageText, language === "en" && styles.languageActive]}>EN</Text></Pressable>; }

function SectionHeader({ title, action, onAction }: { title: string; action: string; onAction?: () => void }) { return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text><Pressable onPress={onAction} disabled={!onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable></View>; }

function CategoryPill({ label, icon, color, selected, onPress }: { label: string; icon: IconName; color: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.categoryPill, selected && { backgroundColor: color, borderColor: color }, pressed && styles.pressed]}><View style={[styles.categoryIcon, { backgroundColor: selected ? "rgba(255,255,255,0.18)" : `${color}18` }]}><MaterialIcons name={icon} size={18} color={selected ? "#FFFFFF" : color} /></View><Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{label}</Text></Pressable>; }

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>; }

function MealRow({ meal, language, onAdd, onRemove, onPress, onToggleFavorite, isFavorite = false, compact = false, quantity = 0, offerBadge, offerImage }: { meal: (typeof meals)[number]; language: "ar" | "en"; onAdd: () => void; onRemove?: () => void; onPress?: () => void; onToggleFavorite?: () => void; isFavorite?: boolean; compact?: boolean; quantity?: number; offerBadge?: string; offerImage?: string | null }) { const category = getCategory(meal.category); return <Pressable onPress={onPress} style={({ pressed }) => [styles.mealRow, compact && styles.mealRowCompact, pressed && styles.pressed]}><Image source={{ uri: resolveRemoteAssetUrl(offerImage) || meal.image }} style={compact ? styles.mealImageCompact : styles.mealImage} /><View style={styles.mealCopy}><View style={styles.mealCategoryLine}><Text style={[styles.mealCategory, { color: category.color }]}>{getLocalized(category.label, language)}</Text><Text style={styles.mealPrep}>{meal.prepMinutes} min</Text></View><Text style={styles.mealName} numberOfLines={1}>{getLocalized(meal.name, language)}</Text><Text style={styles.mealDescription} numberOfLines={1}>{getLocalized(meal.description, language)}</Text>{offerBadge && <View style={styles.offerMealBadge}><MaterialIcons name="local-offer" size={11} color="#A55A40" /><Text style={styles.offerMealBadgeText} numberOfLines={1}>{offerBadge}</Text></View>}<Text style={styles.mealPrice}>{formatJod(meal.price, language)}</Text></View><View style={styles.mealAddColumn}>{onToggleFavorite && <Pressable onPress={(event) => { event.stopPropagation(); onToggleFavorite(); }} style={styles.mealFavoriteButton}><MaterialIcons name={isFavorite ? "favorite" : "favorite-border"} size={18} color={isFavorite ? "#D76545" : "#00AFC4"} /></Pressable>}{quantity > 0 && <View style={styles.quantityBadge}><Text style={styles.quantityBadgeText}>{quantity}</Text><Text style={styles.quantityBadgeLabel}>{language === "ar" ? "وجبة" : "meals"}</Text></View>}<View style={styles.quantityStepper}>{quantity > 0 && <Pressable onPress={onRemove} style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}><MaterialIcons name="remove" size={18} color="#00AFC4" /></Pressable>}<Pressable onPress={onAdd} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><MaterialIcons name="add" size={21} color="#FFFFFF" /></Pressable></View></View></Pressable>; }

function CartItemRow({ item, language, onUpdate }: { item: { meal: (typeof meals)[number]; quantity: number; specialRequests?: string }; language: "ar" | "en"; onUpdate: (mealId: string, quantity: number, specialRequests?: string) => void }) { return <View style={styles.cartItemRow}><Image source={{ uri: item.meal.image }} style={styles.cartItemImage} /><View style={styles.cartItemCopy}><Text style={styles.cartItemName}>{getLocalized(item.meal.name, language)}</Text>{item.specialRequests ? <View style={styles.cartItemRequest}><MaterialIcons name="tune" size={13} color="#8A6516" /><Text style={styles.cartItemRequestText}>{item.specialRequests}</Text></View> : null}<Text style={styles.cartItemPrice}>{formatJod(item.meal.price * item.quantity, language)}</Text><View style={styles.quantityControl}><Pressable onPress={() => onUpdate(item.meal.id, item.quantity - 1, item.specialRequests)} style={styles.quantityButton}><MaterialIcons name="remove" size={15} color="#00AFC4" /></Pressable><Text style={styles.quantityText}>{item.quantity}</Text><Pressable onPress={() => onUpdate(item.meal.id, item.quantity + 1, item.specialRequests)} style={styles.quantityButton}><MaterialIcons name="add" size={15} color="#00AFC4" /></Pressable></View></View></View>; }

function StatItem({ icon, value, label }: { icon: IconName; value: string; label: string }) { return <View style={styles.statItem}><MaterialIcons name={icon} size={16} color="#00AFC4" /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <View style={styles.summaryRow}><Text style={[styles.summaryLabel, strong && styles.summaryStrong]}>{label}</Text><Text style={[styles.summaryValue, strong && styles.summaryStrong]}>{value}</Text></View>; }
function OptionCard({ selected, onPress, icon, title, subtitle }: { selected: boolean; onPress: () => void; icon: IconName; title: string; subtitle: string }) { return <Pressable onPress={onPress} style={[styles.optionCard, selected && styles.optionCardActive]}><MaterialIcons name={icon} size={19} color={selected ? "#FFFFFF" : "#00AFC4"} /><Text style={[styles.optionCardTitle, selected && styles.optionCardTitleActive]}>{title}</Text><Text style={[styles.optionCardSubtitle, selected && styles.optionCardSubtitleActive]}>{subtitle}</Text></Pressable>; }
function DashboardMetric({ label, value, icon }: { label: string; value: string; icon: IconName }) { return <View style={styles.dashboardMetric}><MaterialIcons name={icon} size={17} color="#00AFC4" /><Text style={styles.dashboardMetricValue}>{value}</Text><Text style={styles.dashboardMetricLabel}>{label}</Text></View>; }
function DashboardTile({ icon, title, detail, onPress }: { icon: IconName; title: string; detail: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.dashboardTile, pressed && styles.pressed]}><View style={styles.dashboardTileIcon}><MaterialIcons name={icon} size={18} color="#00AFC4" /></View><View><Text style={styles.dashboardTileTitle}>{title}</Text><Text style={styles.dashboardTileDetail}>{detail}</Text></View></Pressable>; }
function DashboardAction({ icon, title, detail, onPress }: { icon: IconName; title: string; detail: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.dashboardAction, pressed && styles.pressed]}><View style={styles.dashboardActionIcon}><MaterialIcons name={icon} size={19} color="#00AFC4" /></View><View style={styles.dashboardActionCopy}><Text style={styles.dashboardActionTitle}>{title}</Text><Text style={styles.dashboardActionDetail}>{detail}</Text></View><MaterialIcons name="chevron-right" size={20} color="#8ABAC0" /></Pressable>; }
function SettingRow({ icon, label, value, onPress }: { icon: IconName; label: string; value: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}><View style={styles.settingIcon}><MaterialIcons name={icon} size={19} color="#00AFC4" /></View><Text style={styles.settingLabel}>{label}</Text><Text style={styles.settingValue}>{value}</Text><MaterialIcons name="chevron-right" size={19} color="#8ABAC0" /></Pressable>; }
function EmptyState({ language }: { language: "ar" | "en" }) { return <View style={styles.emptyState}><MaterialIcons name="search-off" size={30} color="#00AFC4" /><Text style={styles.emptyTitle}>{language === "ar" ? "ما لقينا هالطبخة" : "No meals found"}</Text><Text style={styles.emptyBody}>{language === "ar" ? "جرّبي كلمة ثانية أو شيلي الفلتر" : "Try another search or clear the filter"}</Text></View>; }
function EmptyCart({ language, onBack }: { language: "ar" | "en"; onBack: () => void }) { return <View style={styles.emptyState}><View style={styles.emptyBasket}><MaterialIcons name="shopping-cart" size={34} color="#00AFC4" /></View><Text style={styles.emptyTitle}>{language === "ar" ? "السفرة فاضية" : "Your table is empty"}</Text><Text style={styles.emptyBody}>{language === "ar" ? "اختاري طبخة بيتية وخلي اللمة تبدأ" : "Pick a home-cooked meal and start the gathering"}</Text><Pressable onPress={onBack} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{language === "ar" ? "تصفّحي المطابخ" : "Browse kitchens"}</Text></Pressable></View>; }
function EmptyOrders({ language, onBack }: { language: "ar" | "en"; onBack: () => void }) { return <View style={styles.emptyState}><MaterialIcons name="receipt-long" size={34} color="#00AFC4" /><Text style={styles.emptyTitle}>{language === "ar" ? "لسه ما في طلبات" : "No orders yet"}</Text><Text style={styles.emptyBody}>{language === "ar" ? "أول طلب بيبدأ من مطبخ بيت" : "Your first order starts at a home kitchen"}</Text><Pressable onPress={onBack} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{language === "ar" ? "اكتشفي الأكلات" : "Discover meals"}</Text></Pressable></View>; }

const styles = StyleSheet.create({
  loginScroll: { flexGrow: 1, padding: 20, paddingBottom: 38, justifyContent: "center", gap: 16 },
  loginTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  loginIcon: { width: 48, height: 48, borderRadius: 15 },
  loginLanguage: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16, backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8" },
  loginLanguageText: { color: "#00AFC4", fontSize: 11, fontWeight: "900" },
  loginBrand: { alignItems: "center", gap: 2, paddingVertical: 5 },
  loginBrandArabic: { color: "#00AFC4", fontSize: 32, fontWeight: "900" },
  loginBrandEnglish: { color: "#082E34", fontSize: 16, fontWeight: "900", letterSpacing: 1.2 },
  loginTagline: { color: "#4C747A", fontSize: 11, marginTop: 4 },
  loginCard: { backgroundColor: "#FFFFFF", borderRadius: 24, borderWidth: 1, borderColor: "#C6EDEF", padding: 17, gap: 10, shadowColor: "#082E34", shadowOpacity: 0.06, shadowRadius: 13, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  loginTabs: { flexDirection: "row", backgroundColor: "#F3F9F1", borderRadius: 13, padding: 3, gap: 4 },
  loginTab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  loginTabActive: { backgroundColor: "#00AFC4" },
  loginTabText: { color: "#4C747A", fontSize: 11, fontWeight: "900" },
  loginTabTextActive: { color: "#FFFFFF" },
  loginTitle: { color: "#082E34", fontSize: 22, fontWeight: "900", marginTop: 5 },
  loginSubtitle: { color: "#4C747A", fontSize: 11, lineHeight: 17, marginBottom: 3 },
  inputLabel: { color: "#1A4B52", fontSize: 11, fontWeight: "900", marginTop: 2 },
  inputWrap: { height: 47, borderRadius: 15, borderWidth: 1, borderColor: "#C6EDEF", backgroundColor: "#F2FEFF", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  loginInput: { flex: 1, color: "#082E34", fontSize: 13, paddingVertical: 0 },
  loginError: { color: "#C4555D", fontSize: 10, fontWeight: "800", lineHeight: 15 },
  rolePrompt: { color: "#082E34", fontSize: 11, fontWeight: "900", marginTop: 4 },
  roleChoiceRow: { flexDirection: "row", gap: 8 },
  roleChoice: { flex: 1, minHeight: 54, borderRadius: 15, borderWidth: 1, borderColor: "#C6EDEF", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", gap: 4 },
  roleChoiceActive: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" },
  roleChoiceText: { color: "#1A4B52", fontSize: 11, fontWeight: "900" },
  roleChoiceTextActive: { color: "#FFFFFF" },
  guestButton: { alignItems: "center", paddingVertical: 6 },
  guestButtonText: { color: "#00AFC4", fontSize: 11, fontWeight: "900" },
  loginTrust: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 12 },
  loginTrustText: { color: "#2E9B72", fontSize: 10, fontWeight: "800", textAlign: "center", flex: 1 },
  logoutButton: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F0FBEA", borderRadius: 13, paddingHorizontal: 9, paddingVertical: 8 },
  logoutText: { color: "#00AFC4", fontSize: 10, fontWeight: "900" },
  capacitySettingsCard: { flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 17, padding: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C6EDEF" },
  capacitySettingsIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#F0FBEA" },
  capacitySettingsCopy: { flex: 1 },
  capacitySettingsTitle: { color: "#082E34", fontSize: 11, fontWeight: "900" },
  capacitySettingsBody: { color: "#4C747A", fontSize: 10, marginTop: 3 },
  kitchenDescriptionEditorCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 13, borderWidth: 1, borderColor: "#C6EDEF", gap: 10 },
  kitchenDescriptionEditorHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  kitchenDescriptionEditorIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#E5FCFF", justifyContent: "center", alignItems: "center" },
  kitchenDescriptionEditorCopy: { flex: 1 },
  kitchenDescriptionEditorTitle: { color: "#082E34", fontSize: 12, fontWeight: "900" },
  kitchenDescriptionEditorHint: { color: "#4C747A", fontSize: 9, marginTop: 2 },
  descriptionEditButton: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#F0FBEA", borderRadius: 11, paddingHorizontal: 8, paddingVertical: 7 },
  descriptionEditButtonText: { color: "#00AFC4", fontSize: 10, fontWeight: "900" },
  descriptionVisibilityControl: { flexDirection: "row", alignItems: "center", gap: 3 },
  descriptionVisibilityText: { color: "#2E9B72", fontSize: 9, fontWeight: "900" },
  kitchenDescriptionPreview: { color: "#4C747A", fontSize: 11, lineHeight: 17 },
  kitchenDescriptionEditor: { gap: 7, borderTopWidth: 1, borderTopColor: "#EFF6ED", paddingTop: 10 },
  descriptionFieldLabel: { color: "#082E34", fontSize: 10, fontWeight: "900" },
  descriptionTextInput: { minHeight: 62, borderWidth: 1, borderColor: "#C6EDEF", borderRadius: 12, backgroundColor: "#F8FFFF", color: "#082E34", paddingHorizontal: 10, paddingVertical: 9, fontSize: 11, lineHeight: 17 },
  descriptionActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 3 },
  descriptionCancelButton: { minHeight: 36, borderRadius: 11, paddingHorizontal: 14, justifyContent: "center", alignItems: "center", backgroundColor: "#F7FFF0" },
  descriptionCancelText: { color: "#4C747A", fontSize: 10, fontWeight: "900" },
  descriptionSaveButton: { minHeight: 36, borderRadius: 11, paddingHorizontal: 14, justifyContent: "center", alignItems: "center", backgroundColor: "#00AFC4" },
  descriptionSaveText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  earningsBreakdown: { gap: 7, backgroundColor: "#F7FFF0", borderRadius: 14, padding: 10, borderWidth: 1, borderColor: "#F6D889" },
  driverHero: { borderRadius: 23, padding: 18, backgroundColor: "#E5FCFF", borderWidth: 1, borderColor: "#F6D889", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  driverOverline: { color: "#C98A2E", fontSize: 10, fontWeight: "900" },
  driverTitle: { color: "#082E34", fontSize: 21, fontWeight: "900", marginTop: 5 },
  driverBody: { color: "#1B5E3A", fontSize: 11, marginTop: 4 },
  driverLocationStatus: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#F4FFFB", borderRadius: 15, borderWidth: 1, borderColor: "#C7E8C8", padding: 11 },
  driverLocationCopy: { flex: 1 },
  driverLocationTitle: { color: "#1B5E3A", fontSize: 11, fontWeight: "900" },
  driverLocationMeta: { color: "#6F9BA0", fontSize: 9, marginTop: 3 },
  driverLocationDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#F6D889" },
  driverLocationDotActive: { backgroundColor: "#2E9B72" },
  driverAlertRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF8EC", borderRadius: 14, borderWidth: 1, borderColor: "#F6D889", padding: 10 },
  driverAlertText: { flex: 1, color: "#8A6516", fontSize: 10, fontWeight: "800" },
  driverAlertButton: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8B7A8", paddingHorizontal: 8, paddingVertical: 6 },
  driverAlertButtonText: { color: "#D76545", fontSize: 10, fontWeight: "900" },
  driverOrderCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 15, borderWidth: 1, borderColor: "#F6D889", gap: 9 },
  driverOrderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  driverOrderTag: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EEF9DB", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6 },
  driverOrderTagText: { color: "#2E9B72", fontSize: 10, fontWeight: "900" },
  driverOrderTitle: { color: "#082E34", fontSize: 14, fontWeight: "900" },
  driverOrderMeta: { color: "#4C747A", fontSize: 10 },
  driverSpecialRequest: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FFFDF3", borderRadius: 14, borderWidth: 1, borderColor: "#F0D99A", padding: 10 },
  routeCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 14, borderWidth: 1, borderColor: "#C6EDEF" },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeMarker: { width: 30, height: 30, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  routeMarkerPickup: { backgroundColor: "#2E9B72" },
  routeMarkerDropoff: { backgroundColor: "#00AFC4" },
  routeCopy: { flex: 1 },
  routeLabel: { color: "#4C747A", fontSize: 10, fontWeight: "800" },
  routeValue: { color: "#082E34", fontSize: 12, fontWeight: "900", marginTop: 2 },
  routeCoordinates: { color: "#8ABAC0", fontSize: 10, marginTop: 3, fontVariant: ["tabular-nums"] },
  routeDistance: { color: "#00AFC4", fontSize: 10, fontWeight: "900", marginTop: 3 },
  driverRatingsRow: { flexDirection: "row", gap: 8 },
  driverRatingBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F7FFF0", borderRadius: 15, padding: 10, borderWidth: 1, borderColor: "#C7E8C8" },
  driverRatingLabel: { color: "#4C747A", fontSize: 9, fontWeight: "800" },
  driverRatingValue: { color: "#082E34", fontSize: 13, fontWeight: "900", marginTop: 2 },
  routeLine: { width: 2, height: 19, backgroundColor: "#F6D889", marginLeft: 14, marginVertical: 2 },
  driverActionButton: { minHeight: 52, borderRadius: 17, backgroundColor: "#C98A2E", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  driverActionDisabled: { backgroundColor: "#8ABAC0" },
  capacityMatch: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 7, marginTop: 2 },
  capacityMatchOk: { backgroundColor: "#EEF9DB" },
  capacityMatchWarn: { backgroundColor: "#FFF0F0" },
  capacityMatchText: { flex: 1, color: "#2E9B72", fontSize: 10, fontWeight: "900" },
  capacityMatchTextWarn: { color: "#C4555D" },
  driverActionButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  driverDone: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#EEF9DB", borderRadius: 16, padding: 13 },
  driverDoneText: { color: "#2E9B72", fontSize: 11, fontWeight: "900" },
  fullScreenPage: { flex: 1, backgroundColor: "#F2FEFF" },
  fullScreenHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 },
  fullScreenHeaderCopy: { flex: 1 },
  mapHeaderBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#EEF9DB", borderRadius: 14, paddingHorizontal: 9, paddingVertical: 7 },
  mapHeaderBadgeText: { color: "#2E9B72", fontSize: 10, fontWeight: "900" },
  mealsFilterButton: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C6EDEF", borderRadius: 14, paddingHorizontal: 9, paddingVertical: 7 },
  mealsFilterButtonActive: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" },
  mealsFilterButtonText: { color: "#00AFC4", fontSize: 10, fontWeight: "900" },
  mealsFilterButtonTextActive: { color: "#FFFFFF" },
  sideFilterBackdrop: { flex: 1, backgroundColor: "rgba(8,46,52,0.42)", justifyContent: "center" },
  sideFilterSheet: { width: "86%", maxWidth: 390, minHeight: "78%", maxHeight: "92%", backgroundColor: "#FFFFFF", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, shadowColor: "#082E34", shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  sideFilterContent: { gap: 9, flexGrow: 1 },
  sideFilterSheetRtl: { alignSelf: "flex-end", borderTopLeftRadius: 26, borderBottomLeftRadius: 26 },
  sideFilterSheetLtr: { alignSelf: "flex-start", borderTopRightRadius: 26, borderBottomRightRadius: 26 },
  sideFilterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  sideFilterTitle: { color: "#082E34", fontSize: 22, fontWeight: "900" },
  sideFilterClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F2FEFF", alignItems: "center", justifyContent: "center" },
  sideFilterSectionTitle: { color: "#082E34", fontSize: 13, fontWeight: "900", marginTop: 7 },
  sideFilterCheckboxRow: { minHeight: 43, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: "#ECF7F7" },
  sideFilterCheckbox: { width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: "#A7C9CD", alignItems: "center", justifyContent: "center" },
  sideFilterCheckboxActive: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" },
  sideFilterCheckboxLabel: { flex: 1, color: "#193F45", fontSize: 12, fontWeight: "700" },
  sideFilterPriceRow: { flexDirection: "row", gap: 7 },
  sideFilterPriceButton: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: "#F7FFFF", borderWidth: 1, borderColor: "#C6EDEF", alignItems: "center", justifyContent: "center" },
  sideFilterPriceButtonActive: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" },
  sideFilterPriceText: { color: "#365A60", fontSize: 11, fontWeight: "800" },
  sideFilterPriceTextActive: { color: "#FFFFFF" },
  sideFilterRadioRow: { minHeight: 39, flexDirection: "row", alignItems: "center", gap: 10 },
  sideFilterRadio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: "#A7C9CD", alignItems: "center", justifyContent: "center" },
  sideFilterRadioActive: { borderColor: "#00AFC4" },
  sideFilterRadioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#00AFC4" },
  sideFilterRadioLabel: { color: "#193F45", fontSize: 12, fontWeight: "700" },
  sideFilterActions: { flexDirection: "row", gap: 9, marginTop: "auto", paddingTop: 9 },
  sideFilterClearButton: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: "#EAF4F4", alignItems: "center", justifyContent: "center" },
  sideFilterClearText: { color: "#65868A", fontSize: 12, fontWeight: "900" },
  sideFilterApplyButton: { flex: 1.35, minHeight: 48, borderRadius: 14, backgroundColor: "#00AFC4", alignItems: "center", justifyContent: "center" },
  sideFilterApplyText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  fullMapArea: { flex: 1, minHeight: 360 },
  discoverSheet: { backgroundColor: "#F2FEFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: "#C6EDEF", padding: 16, gap: 12 },
  discoverSheetHandle: { width: 38, height: 4, borderRadius: 3, backgroundColor: "#D6E2D4", alignSelf: "center" },
  discoverSheetTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  discoverEyebrow: { color: "#00AFC4", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  discoverTitle: { color: "#082E34", fontSize: 17, fontWeight: "900", marginTop: 3 },
  discoverCount: { color: "#4C747A", fontSize: 10, fontWeight: "800", marginTop: 3 },
  nearbyPreviewRow: { flexDirection: "row", gap: 8 },
  nearbyPreview: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, padding: 9, backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: "#C6EDEF" },
  nearbyPreviewDot: { width: 8, height: 8, borderRadius: 4 },
  nearbyPreviewCopy: { flex: 1 },
  nearbyPreviewName: { color: "#082E34", fontSize: 10, fontWeight: "900" },
  nearbyPreviewDistance: { color: "#4C747A", fontSize: 9, marginTop: 2 },
  mealsIntro: { padding: 15, borderRadius: 20, backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8", gap: 4 },
  mealsIntroTitle: { color: "#082E34", fontSize: 19, fontWeight: "900" },
  mealsIntroBody: { color: "#1B5E3A", fontSize: 11, lineHeight: 17 },
  nearbySectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  nearbySortLabel: { color: "#2E9B72", fontSize: 10, fontWeight: "900" },
  nearbyMealBlock: { gap: 6 },
  nearbyMealMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 8 },
  nearbyKitchenLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  nearbyKitchenLinkText: { color: "#2E9B72", fontSize: 10, fontWeight: "900" },
  nearbyDistance: { color: "#00AFC4", fontSize: 10, fontWeight: "900", flexDirection: "row", alignItems: "center" },
  customerDashHero: { borderRadius: 23, padding: 18, backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  customerDashOverline: { color: "#00AFC4", fontSize: 10, fontWeight: "900" },
  customerDashTitle: { color: "#082E34", fontSize: 22, fontWeight: "900", marginTop: 5 },
  customerDashBody: { color: "#1B5E3A", fontSize: 11, marginTop: 4 },
  customerDashIcon: { width: 62, height: 62, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  dashboardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  dashboardTile: { width: "48%", minHeight: 92, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C6EDEF", padding: 12, gap: 8 },
  dashboardTileIcon: { width: 33, height: 33, borderRadius: 12, backgroundColor: "#F0FBEA", alignItems: "center", justifyContent: "center" },
  dashboardTileTitle: { color: "#082E34", fontSize: 12, fontWeight: "900" },
  dashboardTileDetail: { color: "#4C747A", fontSize: 10, marginTop: 2 },
  customerOrderCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#EEF9DB", borderRadius: 18, borderWidth: 1, borderColor: "#F6D889", padding: 12 },
  customerOrderIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  customerOrderCopy: { flex: 1 },
  customerOrderTitle: { color: "#082E34", fontSize: 12, fontWeight: "900" },
  customerOrderBody: { color: "#2E9B72", fontSize: 10, marginTop: 3 },
  recommendedKitchen: { height: 148, borderRadius: 20, overflow: "hidden", position: "relative" },
  recommendedKitchenImage: { width: "100%", height: "100%" },
  recommendedKitchenOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(28,25,23,0.32)" },
  recommendedKitchenCopy: { position: "absolute", left: 15, right: 15, bottom: 14 },
  recommendedKitchenEyebrow: { color: "#F6D889", fontSize: 10, fontWeight: "900" },
  recommendedKitchenName: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", marginTop: 3 },
  recommendedKitchenMeta: { color: "#F0F7EF", fontSize: 11, marginTop: 3 },
  dashboardFootnote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 3 },
  dashboardFootnoteText: { color: "#4C747A", fontSize: 10, fontWeight: "800" },
  root: { flex: 1, backgroundColor: "#F2FEFF" },
  rtl: {},
  ltr: {},
  scrollContent: { padding: 18, paddingBottom: 116, gap: 18 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandCluster: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandIcon: { width: 42, height: 42, borderRadius: 13 },
  eyebrow: { fontSize: 10, letterSpacing: 1.2, color: "#00AFC4", fontWeight: "900" },
  headerGreeting: { color: "#082E34", fontSize: 19, fontWeight: "900", marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  unifiedControlsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, marginBottom: 3 },
  unifiedSearchField: { flex: 1, minWidth: 0, height: 42, borderRadius: 15, borderWidth: 1, borderColor: "#C6EDEF", backgroundColor: "#FFFFFF", paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  unifiedSearchInput: { flex: 1, minWidth: 0, color: "#082E34", fontSize: 11, paddingVertical: 0 },
  unifiedIconButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8", alignItems: "center", justifyContent: "center" },
  unifiedIconButtonActive: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" },
  unifiedCartButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#00AFC4", alignItems: "center", justifyContent: "center", position: "relative" },
  languageToggle: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 18, backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8" },
  languageText: { fontSize: 11, color: "#748A79", fontWeight: "800" },
  languageActive: { color: "#00AFC4" },
  languageSlash: { color: "#B9D6BB", fontSize: 11 },
  iconButton: { width: 39, height: 39, borderRadius: 14, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#C6EDEF" },
  cartBadge: { position: "absolute", right: -3, top: -4, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: "#00AFC4", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#F2FEFF" },
  cartBadgeText: { fontSize: 9, color: "#FFFFFF", fontWeight: "900" },
  favoriteBadge: { position: "absolute", right: -3, top: -4, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: "#D76545", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#F2FEFF" },
  favoriteBadgeText: { fontSize: 9, color: "#FFFFFF", fontWeight: "900" },
  announcementBoard: { backgroundColor: "#FFFFFF", minHeight: 190, borderRadius: 28, borderWidth: 1, borderColor: "#BCEFF4", padding: 18, overflow: "hidden", shadowColor: "#00AFC4", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  announcementSlide: { minHeight: 145, flexDirection: "row", alignItems: "center", gap: 10 },
  announcementSlideCopy: { flex: 1, zIndex: 2 },
  announcementSlideHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  announcementHeaderIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#00AFC4", justifyContent: "center", alignItems: "center" },
  announcementSlideEyebrow: { color: "#00AFC4", fontSize: 10, fontWeight: "900", flexShrink: 1 },
  announcementSlideTitle: { color: "#082E34", fontSize: 22, lineHeight: 27, fontWeight: "900", maxWidth: 220 },
  announcementSlideBody: { color: "#4C747A", fontSize: 11, lineHeight: 17, marginTop: 7, maxWidth: 230 },
  announcementCta: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#00AFC4", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, marginTop: 12 },
  announcementCtaText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  announcementVisual: { width: 105, height: 145, justifyContent: "center", alignItems: "center", position: "relative" },
  announcementImage: { width: 96, height: 96, borderRadius: 28, borderWidth: 4, borderColor: "#C6EDEF" },
  announcementVisualCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: "#E5FCFF", borderWidth: 8, borderColor: "#C6EDEF", justifyContent: "center", alignItems: "center", transform: [{ rotate: "-8deg" }] },
  announcementVisualSparkOne: { width: 28, height: 13, borderRadius: 20, backgroundColor: "#F6D889", position: "absolute", right: 0, top: 30, transform: [{ rotate: "28deg" }] },
  announcementVisualSparkTwo: { width: 23, height: 11, borderRadius: 20, backgroundColor: "#2E9B72", position: "absolute", left: 3, bottom: 32, transform: [{ rotate: "-35deg" }] },
  announcementFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  announcementDots: { flexDirection: "row", alignItems: "center", gap: 5 },
  announcementDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#C6EDEF" },
  announcementDotActive: { width: 20, backgroundColor: "#00AFC4" },
  announcementNav: { flexDirection: "row", alignItems: "center", gap: 4 },
  announcementNavButton: { width: 27, height: 27, borderRadius: 10, backgroundColor: "#F0FCFD", justifyContent: "center", alignItems: "center" },
  announcementCounter: { color: "#4C747A", fontSize: 10, fontWeight: "800", minWidth: 25, textAlign: "center" },
  offersRow: { gap: 12, paddingBottom: 4 },
  offerCard: { width: 224, height: 190, borderRadius: 22, overflow: "hidden", backgroundColor: "#38231C", position: "relative", shadowColor: "#D76545", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  offerImage: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  offerShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(56,35,28,0.52)" },
  offerBadge: { position: "absolute", top: 12, right: 12, backgroundColor: "#F2B84B", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 },
  offerBadgeText: { color: "#082E34", fontSize: 9, fontWeight: "900" },
  offerMealBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 7, backgroundColor: "#FFF1D2", marginTop: 3 },
  offerMealBadgeText: { color: "#A55A40", fontSize: 8, fontWeight: "900" },
  offerCardCopy: { position: "absolute", left: 14, right: 14, bottom: 13, gap: 3 },
  offerLabel: { color: "#F6D889", fontSize: 10, fontWeight: "900" },
  offerName: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  offerKitchen: { color: "#E5FCFF", fontSize: 10 },
  offerCta: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#D76545", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, marginTop: 5 },
  offerCtaText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  heroCard: { backgroundColor: "#00AFC4", minHeight: 190, borderRadius: 28, padding: 20, flexDirection: "row", overflow: "hidden", position: "relative" },
  heroCopy: { flex: 1, zIndex: 2 },
  heroOverline: { color: "#F6D889", fontSize: 12, fontWeight: "800", marginBottom: 9 },
  heroTitle: { color: "#FFFFFF", fontSize: 27, lineHeight: 32, fontWeight: "900", maxWidth: 220 },
  heroBody: { color: "#E6F9C7", fontSize: 12, lineHeight: 18, marginTop: 8, maxWidth: 210 },
  heroCta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16 },
  heroCtaText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  heroArt: { width: 120, alignItems: "center", justifyContent: "center", position: "relative" },
  heroPlate: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#F7FFF0", justifyContent: "center", alignItems: "center", borderWidth: 8, borderColor: "#C7E8C8", transform: [{ rotate: "-10deg" }] },
  heroLeafOne: { width: 32, height: 15, borderRadius: 20, backgroundColor: "#F2B84B", position: "absolute", right: -1, top: 35, transform: [{ rotate: "34deg" }] },
  heroLeafTwo: { width: 28, height: 13, borderRadius: 20, backgroundColor: "#2E9B72", position: "absolute", left: 7, bottom: 31, transform: [{ rotate: "-40deg" }] },
  searchRow: { flexDirection: "row", gap: 9 },
  topSearchRow: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 12, marginBottom: 5 },
  topSearchField: { flex: 1, height: 44, borderRadius: 16, borderWidth: 1, borderColor: "#C6EDEF", backgroundColor: "#FFFFFF", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 7 },
  topSearchInput: { flex: 1, color: "#082E34", fontSize: 12, paddingVertical: 0 },
  topCartButton: { width: 44, height: 44, borderRadius: 16, backgroundColor: "#00AFC4", alignItems: "center", justifyContent: "center", position: "relative" },
  filterOnlyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 5, marginBottom: 3 },
  filterHint: { color: "#4C747A", fontSize: 10, fontWeight: "800" },
  searchField: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C6EDEF", borderRadius: 16, height: 48, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, fontSize: 13, color: "#082E34", paddingVertical: 0 },
  filterButton: { width: 48, height: 48, borderRadius: 16, justifyContent: "center", alignItems: "center", backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8" },
  filterButtonActive: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" },
  filterPanel: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#C6EDEF", padding: 12, gap: 8 },
  filterTitle: { fontSize: 12, fontWeight: "900", color: "#082E34" },
  sortOptions: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  sortChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 15, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#F7FFF0", borderWidth: 1, borderColor: "#C7E8C8" },
  sortChipActive: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" },
  sortChipText: { fontSize: 10, color: "#00AFC4", fontWeight: "900" },
  sortChipTextActive: { color: "#FFFFFF" },
  chipRow: { gap: 8 },
  chip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#F3F9F1", borderWidth: 1, borderColor: "#C6EDEF" },
  chipSelected: { backgroundColor: "#2E9B72", borderColor: "#2E9B72" },
  chipText: { fontSize: 11, fontWeight: "800", color: "#1A4B52" },
  chipTextSelected: { color: "#FFFFFF" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: "900", color: "#082E34" },
  sectionAction: { color: "#00AFC4", fontSize: 11, fontWeight: "900" },
  categoryRow: { gap: 9, paddingRight: 4 },
  categoryPill: { width: 75, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 20, alignItems: "center", gap: 7, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C6EDEF" },
  categoryIcon: { width: 35, height: 35, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  categoryText: { fontSize: 11, color: "#1A4B52", fontWeight: "900" },
  categoryTextSelected: { color: "#FFFFFF" },
  activeOrderCard: { backgroundColor: "#EEF9DB", borderRadius: 20, padding: 14, borderWidth: 1, borderColor: "#F6D889", gap: 11 },
  activeOrderTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#2E9B72" },
  activeOrderEyebrow: { fontSize: 10, color: "#2E9B72", fontWeight: "900", flex: 1 },
  activeOrderId: { fontSize: 10, color: "#4C747A", fontWeight: "800" },
  activeOrderBody: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  activeOrderTitle: { color: "#082E34", fontSize: 14, fontWeight: "900" },
  activeOrderMeta: { color: "#4C747A", fontSize: 11, marginTop: 3 },
  kitchenRow: { gap: 12, paddingRight: 4 },
  kitchenCard: { width: 208, backgroundColor: "#FFFFFF", borderRadius: 22, borderWidth: 1, borderColor: "#C6EDEF", overflow: "hidden" },
  kitchenImageWrap: { height: 132, position: "relative" },
  favoriteFloatingButton: { position: "absolute", top: 10, right: 10, zIndex: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.94)", alignItems: "center", justifyContent: "center", shadowColor: "#082E34", shadowOpacity: 0.12, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  kitchenImage: { width: "100%", height: "100%" },
  openPill: { position: "absolute", top: 10, left: 10, backgroundColor: "#EEF9DB", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 4 },
  closedPill: { backgroundColor: "#F0F7EF" },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#2E9B72" },
  closedDot: { backgroundColor: "#8ABAC0" },
  openText: { fontSize: 10, color: "#2E9B72", fontWeight: "900" },
  ratingPill: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 12, paddingHorizontal: 7, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 10, color: "#1A4B52", fontWeight: "900" },
  kitchenCardCopy: { padding: 13, gap: 3 },
  kitchenName: { fontSize: 14, color: "#082E34", fontWeight: "900" },
  kitchenNeighborhood: { fontSize: 11, color: "#4C747A" },
  kitchenMeta: { flexDirection: "row", gap: 5, alignItems: "center", marginTop: 4 },
  kitchenSpecialty: { fontSize: 10, color: "#00AFC4", fontWeight: "900" },
  kitchenReviews: { color: "#8ABAC0", fontSize: 10 },
  mealList: { gap: 10 },
  mealRow: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 10, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#C6EDEF" },
  mealRowCompact: { borderWidth: 0, padding: 0, borderRadius: 0 },
  mealImage: { width: 78, height: 78, borderRadius: 16 },
  mealImageCompact: { width: 84, height: 84, borderRadius: 16 },
  mealCopy: { flex: 1, gap: 3 },
  mealAddColumn: { alignItems: "center", justifyContent: "center", gap: 5 },
  mealFavoriteButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#F2FEFF", alignItems: "center", justifyContent: "center" },
  quantityStepper: { flexDirection: "row", alignItems: "center", gap: 5 },
  removeButton: { width: 28, height: 28, borderRadius: 10, backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8", alignItems: "center", justifyContent: "center" },
  quantityBadge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: "#2E9B72", alignItems: "center", justifyContent: "center" },
  quantityBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  quantityBadgeLabel: { color: "#E5F7C8", fontSize: 8, fontWeight: "800", marginLeft: 3 },
  mealCategoryLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  mealCategory: { fontSize: 10, fontWeight: "900" },
  mealPrep: { color: "#8ABAC0", fontSize: 10 },
  mealName: { fontSize: 14, color: "#082E34", fontWeight: "900" },
  mealDescription: { fontSize: 10, color: "#4C747A" },
  mealPrice: { color: "#00AFC4", fontSize: 12, fontWeight: "900", marginTop: 2 },
  addButton: { width: 31, height: 31, borderRadius: 12, backgroundColor: "#00AFC4", justifyContent: "center", alignItems: "center" },
  floatingCart: { position: "absolute", left: 18, right: 18, bottom: 24, borderRadius: 18, backgroundColor: "#082E34", paddingHorizontal: 16, paddingVertical: 13, flexDirection: "row", justifyContent: "space-between", alignItems: "center", shadowColor: "#082E34", shadowOpacity: 0.24, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  floatingCartEyebrow: { color: "#8ABAC0", fontSize: 10, fontWeight: "700" },
  floatingCartPrice: { color: "#FFFFFF", fontSize: 15, fontWeight: "900", marginTop: 1 },
  floatingCartCta: { color: "#F6D889", fontSize: 12, fontWeight: "900" },
  floatingCartCtaWrap: { flexDirection: "row", alignItems: "center", gap: 5 },
  pageTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C6EDEF", justifyContent: "center", alignItems: "center" },
  pageTitle: { color: "#082E34", fontSize: 20, fontWeight: "900" },
  pageSubtitle: { color: "#4C747A", fontSize: 11, marginTop: 2 },
  clearButton: { marginLeft: "auto", paddingHorizontal: 7, paddingVertical: 7 },
  clearText: { color: "#00AFC4", fontSize: 11, fontWeight: "900" },
  profileHero: { height: 245, borderRadius: 26, overflow: "hidden", position: "relative" },
  profileFavoriteButton: { position: "absolute", top: 14, right: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(8,46,52,0.55)", alignItems: "center", justifyContent: "center", zIndex: 2 },
  profileImage: { width: "100%", height: "100%" },
  profileOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(28,25,23,0.35)" },
  profileHeroText: { position: "absolute", left: 18, right: 18, bottom: 18 },
  profileVerified: { alignSelf: "flex-start", backgroundColor: "rgba(77,124,15,0.9)", borderRadius: 11, paddingHorizontal: 8, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  profileVerifiedText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  profileName: { color: "#FFFFFF", fontSize: 26, fontWeight: "900" },
  profileNeighborhood: { color: "#F0F7EF", fontSize: 12, marginTop: 4 },
  profileStats: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 14, flexDirection: "row", justifyContent: "space-around", borderWidth: 1, borderColor: "#C6EDEF" },
  kitchenDescriptionCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 18, backgroundColor: "#E5FCFF", borderWidth: 1, borderColor: "#C6EDEF" },
  kitchenDescriptionIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" },
  kitchenDescriptionText: { flex: 1, color: "#4C747A", fontSize: 12, lineHeight: 19, fontWeight: "700" },
  statItem: { alignItems: "center", gap: 3 },
  statValue: { color: "#082E34", fontSize: 15, fontWeight: "900" },
  statLabel: { color: "#4C747A", fontSize: 10 },
  cartItems: { gap: 10 },
  cartItemRow: { flexDirection: "row", gap: 11, padding: 10, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#C6EDEF" },
  cartItemImage: { width: 75, height: 75, borderRadius: 15 },
  cartItemCopy: { flex: 1, justifyContent: "space-between", paddingVertical: 2 },
  cartItemName: { color: "#082E34", fontSize: 13, fontWeight: "900" },
  cartItemPrice: { color: "#00AFC4", fontSize: 12, fontWeight: "900" },
  cartItemRequest: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 3 },
  cartItemRequestText: { flex: 1, color: "#8A6516", fontSize: 9, lineHeight: 13, fontWeight: "800" },
  quantityControl: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 13, backgroundColor: "#F0FBEA", paddingHorizontal: 5, paddingVertical: 3 },
  quantityButton: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  quantityText: { fontSize: 12, color: "#082E34", fontWeight: "900" },
  deliveryCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: "#EEF9DB", borderRadius: 18, borderWidth: 1, borderColor: "#F6D889" },
  complaintAddButton: { minHeight: 36, paddingHorizontal: 10, borderRadius: 13, backgroundColor: "#00AFC4", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  complaintAddButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  complaintHero: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: "#EEF9DB", borderRadius: 20, borderWidth: 1, borderColor: "#F6D889" },
  complaintHeroIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  complaintHeroCopy: { flex: 1 },
  complaintHeroTitle: { color: "#082E34", fontSize: 16, fontWeight: "900" },
  complaintHeroBody: { color: "#2E9B72", fontSize: 11, lineHeight: 17, marginTop: 3 },
  complaintFormCard: { padding: 15, backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#C6EDEF", gap: 10 },
  complaintFormTitle: { color: "#082E34", fontSize: 15, fontWeight: "900" },
  complaintCategoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  complaintCategory: { minHeight: 38, paddingHorizontal: 9, borderRadius: 13, backgroundColor: "#F7FFF0", borderWidth: 1, borderColor: "#C6EDEF", flexDirection: "row", alignItems: "center", gap: 5 },
  complaintCategoryActive: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" },
  complaintCategoryText: { color: "#1A4B52", fontSize: 10, fontWeight: "800" },
  complaintCategoryTextActive: { color: "#FFFFFF" },
  complaintSubjectInput: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#C6EDEF", backgroundColor: "#F7FFF0", color: "#082E34", fontSize: 11, paddingHorizontal: 12, paddingVertical: 9 },
  complaintDescriptionInput: { minHeight: 105, borderRadius: 14, borderWidth: 1, borderColor: "#C6EDEF", backgroundColor: "#F7FFF0", color: "#082E34", fontSize: 11, lineHeight: 17, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: "top" },
  complaintAttachLabel: { color: "#082E34", fontSize: 11, fontWeight: "900", marginTop: 2 },
  complaintAttachActions: { flexDirection: "row", gap: 8 },
  complaintAttachButton: { flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  complaintAttachText: { color: "#00AFC4", fontSize: 10, fontWeight: "900" },
  complaintImageRow: { gap: 8, paddingVertical: 2 },
  complaintImageWrap: { width: 82, height: 82, borderRadius: 14, overflow: "hidden", position: "relative" },
  complaintImage: { width: "100%", height: "100%" },
  complaintImageRemove: { position: "absolute", top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(19,34,24,0.75)", alignItems: "center", justifyContent: "center" },
  complaintsSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  complaintsSectionHint: { color: "#4C747A", fontSize: 10, marginTop: 2 },
  complaintEmptyCard: { alignItems: "center", padding: 22, backgroundColor: "#F7FFF0", borderRadius: 20, borderWidth: 1, borderColor: "#C6EDEF", gap: 7 },
  complaintList: { gap: 10 },
  complaintCard: { padding: 14, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#C6EDEF", gap: 9 },
  complaintCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  complaintCardIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#F0FBEA", alignItems: "center", justifyContent: "center" },
  complaintCardCopy: { flex: 1 },
  complaintCardCategory: { color: "#2E9B72", fontSize: 9, fontWeight: "900" },
  complaintCardTitle: { color: "#082E34", fontSize: 13, fontWeight: "900", marginTop: 2 },
  complaintStatus: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 },
  complaintStatusNew: { backgroundColor: "#FFF5D6" },
  complaintStatusReview: { backgroundColor: "#EAF3FF" },
  complaintStatusResolved: { backgroundColor: "#E8F7E5" },
  complaintStatusText: { color: "#4C747A", fontSize: 9, fontWeight: "900" },
  complaintCardDescription: { color: "#405C48", fontSize: 11, lineHeight: 17 },
  complaintCardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  complaintCardMetaText: { color: "#8AA08D", fontSize: 9 },
  complaintListImage: { width: 68, height: 68, borderRadius: 12 },
  complaintResponse: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 12, backgroundColor: "#F0FBEA" },
  complaintResponseText: { flex: 1, color: "#00AFC4", fontSize: 10, lineHeight: 15, fontWeight: "800" },
  disabledButton: { opacity: 0.55 },
  complaintInbox: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#C6EDEF", overflow: "hidden" },
  complaintInboxRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 11, borderBottomWidth: 1, borderBottomColor: "#EEF4EC" },
  complaintInboxIcon: { width: 31, height: 31, borderRadius: 11, backgroundColor: "#F0FBEA", alignItems: "center", justifyContent: "center" },
  complaintInboxCopy: { flex: 1 },
  complaintInboxTitle: { color: "#082E34", fontSize: 11, fontWeight: "900" },
  complaintInboxMeta: { color: "#4C747A", fontSize: 9, marginTop: 2 },
  complaintInboxAction: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10, backgroundColor: "#EEF9DB" },
  complaintInboxActionText: { color: "#00AFC4", fontSize: 9, fontWeight: "900" },
  supportEmptyCard: { flexDirection: "row", alignItems: "center", gap: 8, padding: 13, backgroundColor: "#F7FFF0", borderRadius: 16, borderWidth: 1, borderColor: "#C6EDEF" },
  supportEmptyText: { color: "#2E9B72", fontSize: 10, fontWeight: "800" },
  cartNoteCard: { padding: 14, backgroundColor: "#F7FFF0", borderRadius: 18, borderWidth: 1, borderColor: "#C6EDEF", gap: 10 },
  cartNoteHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cartNoteCopy: { flex: 1 },
  cartNoteTitle: { color: "#082E34", fontSize: 13, fontWeight: "900" },
  cartNoteHint: { color: "#4C747A", fontSize: 11, lineHeight: 16, marginTop: 2 },
  deliveryIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  deliveryCopy: { flex: 1 },
  deliveryTitle: { fontSize: 13, color: "#082E34", fontWeight: "900" },
  deliveryBody: { fontSize: 11, color: "#2E9B72", marginTop: 2 },
  summaryCard: { padding: 15, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#C6EDEF", gap: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { fontSize: 12, color: "#4C747A" },
  summaryValue: { fontSize: 12, color: "#1A4B52", fontWeight: "800" },
  summaryStrong: { color: "#082E34", fontSize: 15, fontWeight: "900" },
  summaryDivider: { height: 1, backgroundColor: "#E8F1E6" },
  primaryButton: { minHeight: 52, borderRadius: 17, backgroundColor: "#00AFC4", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  secondaryButton: { minHeight: 46, borderRadius: 15, backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 15 },
  secondaryButtonText: { color: "#00AFC4", fontSize: 12, fontWeight: "900" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28,25,23,0.38)" },
  checkoutSheet: { backgroundColor: "#F2FEFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, paddingBottom: 28, gap: 13 },
  customizationSheet: { backgroundColor: "#F2FEFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, paddingBottom: 28, gap: 12, maxHeight: "92%" },
  customizationScroll: { maxHeight: 520 },
  customizationContent: { gap: 10, paddingBottom: 2 },
  customizationMealHeader: { flexDirection: "row", alignItems: "center", gap: 11, padding: 10, backgroundColor: "#FFFFFF", borderRadius: 17, borderWidth: 1, borderColor: "#C6EDEF" },
  customizationMealImage: { width: 62, height: 62, borderRadius: 15 },
  customizationMealCopy: { flex: 1, gap: 3 },
  customizationMealName: { color: "#082E34", fontSize: 14, fontWeight: "900" },
  customizationMealPrice: { color: "#00AFC4", fontSize: 12, fontWeight: "900" },
  customizationHint: { color: "#4C747A", fontSize: 10, lineHeight: 14 },
  sheetHandle: { width: 38, height: 4, borderRadius: 3, backgroundColor: "#D6E2D4", alignSelf: "center" },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetEyebrow: { fontSize: 10, color: "#00AFC4", fontWeight: "900", letterSpacing: 1 },
  sheetTitle: { fontSize: 22, fontWeight: "900", color: "#082E34", marginTop: 2 },
  closeButton: { width: 35, height: 35, borderRadius: 12, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" },
  optionLabel: { color: "#082E34", fontSize: 12, fontWeight: "900", marginTop: 4 },
  optionRow: { flexDirection: "row", gap: 8 },
  optionCard: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: "#C6EDEF", backgroundColor: "#FFFFFF", padding: 11, gap: 5 },
  optionCardActive: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" },
  optionCardTitle: { fontSize: 11, color: "#082E34", fontWeight: "900" },
  optionCardTitleActive: { color: "#FFFFFF" },
  optionCardSubtitle: { fontSize: 9, color: "#4C747A" },
  optionCardSubtitleActive: { color: "#E6F9C7" },
  paymentList: { gap: 7 },
  ingredientGroupLabel: { color: "#4C747A", fontSize: 10, fontWeight: "900", marginTop: 2 },
  ingredientOptionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  ingredientOption: { width: "48%", minHeight: 42, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 13, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C6EDEF" },
  ingredientOptionSelected: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" },
  ingredientOptionRemoveSelected: { backgroundColor: "#FFF9E8", borderColor: "#F0D99A" },
  ingredientOptionText: { flex: 1, color: "#1A4B52", fontSize: 10, fontWeight: "800" },
  ingredientOptionTextSelected: { color: "#FFFFFF" },
  ingredientOptionRemoveTextSelected: { color: "#8A6516" },
  specialRequestInputWrap: { minHeight: 72, flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#C6EDEF", padding: 11 },
  specialRequestInput: { flex: 1, minHeight: 64, color: "#082E34", fontSize: 11, lineHeight: 17, padding: 0, textAlignVertical: "top" },
  paymentOption: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C6EDEF" },
  paymentOptionActive: { borderColor: "#C7E8C8", backgroundColor: "#F7FFF0" },
  paymentIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#F0FBEA", justifyContent: "center", alignItems: "center" },
  paymentIconActive: { backgroundColor: "#00AFC4" },
  paymentCopy: { flex: 1 },
  paymentTitle: { color: "#082E34", fontSize: 12, fontWeight: "900" },
  paymentSubtitle: { color: "#4C747A", fontSize: 10, marginTop: 2 },
  multiOrderSummary: { backgroundColor: "#E5FCFF", borderRadius: 16, padding: 12, gap: 7, borderWidth: 1, borderColor: "#C6EDEF" },
  multiOrderSummaryTitle: { color: "#082E34", fontSize: 11, fontWeight: "900" },
  multiOrderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 5, borderTopWidth: 1, borderTopColor: "#C6EDEF" },
  multiOrderKitchen: { color: "#4C747A", fontSize: 10, fontWeight: "800" },
  multiOrderTotal: { color: "#00AFC4", fontSize: 10, fontWeight: "900" },
  sheetPriceBreakdown: { gap: 3, marginTop: 2 },
  sheetTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 2 },
  sheetTotalLabel: { color: "#4C747A", fontSize: 12 },
  sheetTotalValue: { color: "#082E34", fontSize: 18, fontWeight: "900" },
  activeOrdersPanel: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 12, borderWidth: 1, borderColor: "#C6EDEF", gap: 8 },
  activeOrdersTitle: { color: "#082E34", fontSize: 12, fontWeight: "900" },
  activeOrdersRow: { gap: 8, paddingRight: 2 },
  activeOrderChip: { minWidth: 118, maxWidth: 155, backgroundColor: "#F2FEFF", borderRadius: 13, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#D8F1F3", gap: 3 },
  activeOrderChipActive: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" },
  activeOrderChipId: { color: "#00AFC4", fontSize: 10, fontWeight: "900" },
  activeOrderChipKitchen: { color: "#4C747A", fontSize: 10, fontWeight: "800" },
  activeOrderChipTextActive: { color: "#FFFFFF" },
  multiOrderSection: { gap: 12 },
  multiOrderSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  multiOrderSectionHint: { color: "#4C747A", fontSize: 10, marginTop: 3 },
  multiOrderCount: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#E5FCFF", borderRadius: 14, paddingHorizontal: 9, paddingVertical: 7 },
  multiOrderCountText: { color: "#00AFC4", fontSize: 12, fontWeight: "900" },
  multiOrderCard: { backgroundColor: "#FFFFFF", borderRadius: 22, padding: 13, borderWidth: 1, borderColor: "#C6EDEF", gap: 11 },
  multiOrderCardSelected: { borderColor: "#00AFC4", shadowColor: "#00AFC4", shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  multiOrderCardHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
  multiOrderKitchenMark: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#D76545", alignItems: "center", justifyContent: "center" },
  multiOrderKitchenCopy: { flex: 1, gap: 2 },
  multiOrderKitchenName: { color: "#082E34", fontSize: 13, fontWeight: "900" },
  multiOrderOrderId: { color: "#4C747A", fontSize: 10, fontWeight: "700" },
  multiOrderStatus: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EEF9DB", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6 },
  multiOrderStatusText: { color: "#2E9B72", fontSize: 9, fontWeight: "900" },
  multiOrderItemLine: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  multiOrderItems: { flex: 1, color: "#082E34", fontSize: 11, fontWeight: "800", lineHeight: 16 },
  multiOrderProgress: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingVertical: 3 },
  multiOrderProgressStep: { flex: 1, alignItems: "center", position: "relative" },
  multiOrderProgressDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#D8F1F3", borderWidth: 2, borderColor: "#FFFFFF", zIndex: 2 },
  multiOrderProgressDotDone: { backgroundColor: "#2E9B72" },
  multiOrderProgressLine: { position: "absolute", top: 4, left: "50%", right: "-50%", height: 2, backgroundColor: "#D8F1F3" },
  multiOrderProgressLineDone: { backgroundColor: "#F2B84B" },
  multiOrderProgressLabel: { color: "#8ABAC0", fontSize: 7, fontWeight: "700", marginTop: 4, textAlign: "center" },
  multiOrderProgressLabelDone: { color: "#2E9B72", fontWeight: "900" },
  multiOrderEta: { color: "#A55A40", fontSize: 10, fontWeight: "900", textAlign: "right", maxWidth: 95 },
  multiOrderDriverRow: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#E5FCFF", borderRadius: 15, padding: 10 },
  multiOrderDriverAvatar: { width: 32, height: 32, borderRadius: 11, backgroundColor: "#00AFC4", alignItems: "center", justifyContent: "center" },
  multiOrderDriverCopy: { flex: 1, gap: 1 },
  multiOrderDriverLabel: { color: "#4C747A", fontSize: 9, fontWeight: "800" },
  multiOrderDriverName: { color: "#082E34", fontSize: 12, fontWeight: "900" },
  multiOrderDriverMeta: { color: "#4C747A", fontSize: 9 },
  multiOrderCallButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#2E9B72", alignItems: "center", justifyContent: "center" },
  multiOrderNoDriver: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#FFF8E7", borderRadius: 14, padding: 10 },
  multiOrderNoDriverText: { flex: 1, color: "#8A6516", fontSize: 10, fontWeight: "800" },
  multiOrderRouteSummary: { backgroundColor: "#F2FEFF", borderRadius: 16, padding: 10, gap: 8 },
  multiOrderRoutePoint: { flexDirection: "row", alignItems: "center", gap: 8 },
  multiOrderRouteDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: "#FFFFFF" },
  multiOrderRouteDotPickup: { backgroundColor: "#D76545" },
  multiOrderRouteDotDropoff: { backgroundColor: "#2E9B72" },
  multiOrderRouteCopy: { flex: 1, gap: 1 },
  multiOrderRouteLabel: { color: "#4C747A", fontSize: 9, fontWeight: "800" },
  multiOrderRouteValue: { color: "#082E34", fontSize: 10, fontWeight: "900" },
  multiOrderRouteMeta: { color: "#00AFC4", fontSize: 9, fontWeight: "800" },
  multiOrderRouteDivider: { height: 1, backgroundColor: "#C6EDEF", marginLeft: 19 },
  multiOrderCardActions: { flexDirection: "row", gap: 8 },
  multiOrderFocusButton: { flex: 1, borderWidth: 1, borderColor: "#BCEFF4", borderRadius: 12, paddingVertical: 9, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5 },
  multiOrderFocusText: { color: "#00AFC4", fontSize: 10, fontWeight: "900" },
  multiOrderRefreshButton: { flex: 1, backgroundColor: "#00AFC4", borderRadius: 12, paddingVertical: 9, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5 },
  multiOrderRefreshText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  orderHero: { padding: 16, backgroundColor: "#082E34", borderRadius: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderHistoryCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 15, borderWidth: 1, borderColor: "#C6EDEF", gap: 10 },
  orderHistoryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  orderHistoryHint: { color: "#4C747A", fontSize: 10, marginTop: 3 },
  orderHistoryRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#EFF6ED" },
  orderHistoryCopy: { flex: 1, gap: 2 },
  orderHistoryId: { color: "#00AFC4", fontSize: 11, fontWeight: "900" },
  orderHistoryKitchen: { color: "#082E34", fontSize: 12, fontWeight: "900" },
  orderHistoryItems: { color: "#4C747A", fontSize: 10, lineHeight: 15 },
  orderHistoryMeta: { color: "#8A6516", fontSize: 10, fontWeight: "800" },
  reorderButton: { minHeight: 38, borderRadius: 13, backgroundColor: "#00AFC4", paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  reorderButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  scheduleClosedBanner: { flexDirection: "row", alignItems: "center", gap: 9, padding: 11, borderRadius: 15, backgroundColor: "#FFF1EB", borderWidth: 1, borderColor: "#F0C7B7" },
  scheduleClosedCopy: { flex: 1, gap: 2 },
  scheduleClosedTitle: { color: "#A55A40", fontSize: 11, fontWeight: "900" },
  scheduleClosedBody: { color: "#9A6B5A", fontSize: 10 },
  scheduleCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 15, borderWidth: 1, borderColor: "#C6EDEF", gap: 12 },
  scheduleHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  scheduleHeaderCopy: { flex: 1 },
  scheduleTitle: { color: "#082E34", fontSize: 14, fontWeight: "900" },
  scheduleHint: { color: "#4C747A", fontSize: 10, marginTop: 3 },
  scheduleDownloadButton: { minHeight: 35, borderRadius: 12, backgroundColor: "#F0FBEA", paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 4 },
  scheduleDownloadText: { color: "#00AFC4", fontSize: 10, fontWeight: "900" },
  scheduleToggle: { flexDirection: "row", alignItems: "center", gap: 9, padding: 10, backgroundColor: "#F7FFF0", borderRadius: 15 },
  scheduleToggleIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  scheduleToggleCopy: { flex: 1 },
  scheduleToggleTitle: { color: "#082E34", fontSize: 11, fontWeight: "900" },
  scheduleToggleHint: { color: "#4C747A", fontSize: 10, marginTop: 3 },
  scheduleEditor: { gap: 9, paddingTop: 2 },
  scheduleGroupLabel: { color: "#00AFC4", fontSize: 10, fontWeight: "900" },
  weekdayGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  weekdayChip: { minHeight: 34, borderRadius: 11, backgroundColor: "#F0FBEA", paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#C6EDEF" },
  weekdayChipClosed: { backgroundColor: "#FFF1EB", borderColor: "#F0C7B7" },
  weekdayChipText: { color: "#00AFC4", fontSize: 9, fontWeight: "900" },
  weekdayChipTextClosed: { color: "#A55A40" },
  mealScheduleRow: { gap: 7, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#EFF6ED" },
  mealScheduleCopy: { gap: 2 },
  mealScheduleName: { color: "#082E34", fontSize: 11, fontWeight: "900" },
  mealScheduleMeta: { color: "#4C747A", fontSize: 9 },
  mealDayMiniGrid: { flexDirection: "row", gap: 5 },
  mealDayMini: { width: 27, height: 27, borderRadius: 9, backgroundColor: "#F7FFF0", borderWidth: 1, borderColor: "#C6EDEF", alignItems: "center", justifyContent: "center" },
  mealDayMiniActive: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" },
  mealDayMiniDisabled: { opacity: 0.4 },
  mealDayMiniText: { color: "#4C747A", fontSize: 9, fontWeight: "900" },
  mealDayMiniTextActive: { color: "#F6D889" },
  orderHeroEyebrow: { color: "#8ABAC0", fontSize: 10, fontWeight: "800" },
  orderHeroId: { color: "#FFFFFF", fontSize: 21, fontWeight: "900", marginTop: 3 },
  orderEta: { alignItems: "flex-end" },
  orderEtaLabel: { color: "#8ABAC0", fontSize: 10 },
  orderEtaValue: { color: "#F6D889", fontSize: 12, fontWeight: "900", marginTop: 3 },
  statusPill: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EEF9DB", borderRadius: 15, paddingHorizontal: 9, paddingVertical: 7 },
  statusPillText: { color: "#2E9B72", fontSize: 10, fontWeight: "900" },
  trackingCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#C6EDEF" },
  orderActionPanel: { backgroundColor: "#FFFDF3", borderRadius: 18, padding: 13, borderWidth: 1, borderColor: "#F0D99A", gap: 9 },
  orderActionCopy: { gap: 2 },
  orderActionTitle: { color: "#082E34", fontSize: 12, fontWeight: "900" },
  orderActionSubtitle: { color: "#6F7F75", fontSize: 10 },
  orderActionButtons: { flexDirection: "row", gap: 8 },
  orderActionButton: { flex: 1, minHeight: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5, borderWidth: 1 },
  orderActionCancel: { backgroundColor: "#FFF4F4", borderColor: "#F0C4C8" },
  orderActionReplace: { backgroundColor: "#F0FAE9", borderColor: "#C7E8C8" },
  orderActionCancelText: { color: "#C4555D", fontSize: 10, fontWeight: "900" },
  orderActionReplaceText: { color: "#2E9B72", fontSize: 10, fontWeight: "900" },
  orderActionPending: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#FFFDF3", borderRadius: 15, padding: 11, borderWidth: 1, borderColor: "#F0D99A" },
  orderActionPendingText: { flex: 1, color: "#8A6516", fontSize: 11, fontWeight: "900" },
  orderActionModal: { width: "100%", maxWidth: 460, backgroundColor: "#FFFFFF", borderRadius: 24, padding: 18, gap: 10 },
  orderActionModalBody: { color: "#4C747A", fontSize: 11, lineHeight: 17 },
  orderActionNoteInput: { minHeight: 86, backgroundColor: "#F7FFF0", borderWidth: 1, borderColor: "#C7E8C8", borderRadius: 14, color: "#082E34", paddingHorizontal: 11, paddingVertical: 10, fontSize: 11 },
  orderActionModalButtons: { flexDirection: "row", gap: 8 },
  chatCard: { backgroundColor: "#F7FFF0", borderRadius: 20, padding: 14, borderWidth: 1, borderColor: "#C7E8C8", gap: 10 },
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
  chatIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: "#2E9B72", alignItems: "center", justifyContent: "center" },
  chatHeaderCopy: { flex: 1, gap: 2 },
  chatTitle: { color: "#082E34", fontSize: 13, fontWeight: "900" },
  chatSubtitle: { color: "#4C747A", fontSize: 10 },
  chatSecurePill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#EAF7E7", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 5 },
  chatSecureText: { color: "#2E9B72", fontSize: 9, fontWeight: "800" },
  chatMessages: { gap: 7, maxHeight: 180 },
  chatEmpty: { color: "#6F9BA0", fontSize: 10, lineHeight: 16 },
  chatBubble: { alignSelf: "flex-start", maxWidth: "86%", backgroundColor: "#FFFFFF", borderRadius: 13, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#C7E8C8", paddingHorizontal: 10, paddingVertical: 8 },
  chatBubbleMine: { alignSelf: "flex-end", backgroundColor: "#E5FCFF", borderColor: "#A8E6EA", borderBottomLeftRadius: 13, borderBottomRightRadius: 4 },
  chatMeta: { color: "#8ABAC0", fontSize: 9, fontWeight: "800", marginBottom: 2 },
  chatBody: { color: "#082E34", fontSize: 11, lineHeight: 16 },
  chatComposer: { flexDirection: "row", alignItems: "flex-end", gap: 7 },
  chatInput: { flex: 1, minHeight: 40, maxHeight: 80, backgroundColor: "#FFFFFF", borderRadius: 13, borderWidth: 1, borderColor: "#C7E8C8", color: "#082E34", fontSize: 11, paddingHorizontal: 10, paddingVertical: 9 },
  chatSend: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#00AFC4", alignItems: "center", justifyContent: "center" },
  trackingTitle: { color: "#082E34", fontSize: 16, fontWeight: "900", marginBottom: 15 },
  trackingRow: { minHeight: 53, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  trackRail: { width: 18, alignItems: "center" },
  trackDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#E4EFE1", justifyContent: "center", alignItems: "center" },
  trackDotDone: { backgroundColor: "#2E9B72" },
  trackDotActive: { borderWidth: 3, borderColor: "#F6D889" },
  trackLine: { width: 2, height: 32, backgroundColor: "#E4EFE1" },
  trackLineDone: { backgroundColor: "#F2B84B" },
  trackCopy: { flex: 1 },
  trackLabel: { color: "#4C747A", fontSize: 12, fontWeight: "800" },
  trackLabelActive: { color: "#082E34", fontWeight: "900" },
  trackCaption: { color: "#8ABAC0", fontSize: 10, marginTop: 2 },
  specialRequestCard: { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: "#FFFDF3", borderRadius: 16, borderWidth: 1, borderColor: "#F0D99A", padding: 12 },
  specialRequestCopy: { flex: 1 },
  specialRequestTitle: { color: "#8A6516", fontSize: 11, fontWeight: "900" },
  specialRequestBody: { color: "#4C747A", fontSize: 11, lineHeight: 17, marginTop: 3 },
  deliveredCard: { flexDirection: "row", gap: 9, alignItems: "center", backgroundColor: "#E5FCFF", borderRadius: 16, padding: 13 },
  ratingCard: { backgroundColor: "#FFFFFF", borderRadius: 19, borderWidth: 1, borderColor: "#F6D889", padding: 14, gap: 11 },
  ratingHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
  ratingIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#EEF9DB", alignItems: "center", justifyContent: "center" },
  ratingCopy: { flex: 1 },
  ratingTitle: { color: "#082E34", fontSize: 13, fontWeight: "900" },
  ratingBody: { color: "#4C747A", fontSize: 10, marginTop: 3 },
  ratingStarsRow: { flexDirection: "row", justifyContent: "center", gap: 4 },
  ratingStarButton: { padding: 2 },
  ratingInput: { minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: "#C6EDEF", backgroundColor: "#F7FFF0", color: "#082E34", fontSize: 11, lineHeight: 17, padding: 10 },
  ratingSubmit: { minHeight: 45, borderRadius: 14, backgroundColor: "#00AFC4", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  ratingSubmitDisabled: { backgroundColor: "#8ABAC0" },
  ratingSubmitText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  deliveredText: { color: "#1B5E3A", fontSize: 11, fontWeight: "800", flex: 1 },
  dashboardHero: { backgroundColor: "#2E9B72", borderRadius: 23, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dashboardOverline: { color: "#F6D889", fontSize: 10, fontWeight: "900" },
  dashboardTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", marginTop: 5 },
  dashboardBody: { color: "#E9F8BF", fontSize: 11, marginTop: 4 },
  driverOrdersQueue: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 12, borderWidth: 1, borderColor: "#C6EDEF", gap: 8 },
  menuActionRow: { paddingHorizontal: 16, marginVertical: 8 },
  driverOrdersQueueTitle: { color: "#082E34", fontSize: 12, fontWeight: "900" },
  driverOrdersQueueRow: { gap: 8, paddingRight: 2 },
  driverOrderChip: { minWidth: 118, maxWidth: 155, backgroundColor: "#F2FEFF", borderRadius: 13, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#D8F1F3", gap: 3 },
  driverOrderChipActive: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" },
  driverOrderChipId: { color: "#00AFC4", fontSize: 10, fontWeight: "900" },
  driverOrderChipKitchen: { color: "#4C747A", fontSize: 10, fontWeight: "800" },
  driverOrderChipTextActive: { color: "#FFFFFF" },
  incomingQueue: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 12, borderWidth: 1, borderColor: "#C6EDEF", gap: 8 },
  incomingQueueTitle: { color: "#082E34", fontSize: 12, fontWeight: "900" },
  incomingQueueRow: { gap: 8, paddingRight: 2 },
  incomingQueueChip: { minWidth: 118, maxWidth: 155, backgroundColor: "#F2FEFF", borderRadius: 13, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#D8F1F3", gap: 3 },
  incomingQueueChipActive: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" },
  incomingQueueChipId: { color: "#00AFC4", fontSize: 10, fontWeight: "900" },
  incomingQueueChipKitchen: { color: "#4C747A", fontSize: 10, fontWeight: "800" },
  incomingQueueChipTextActive: { color: "#FFFFFF" },
  earningsRow: { flexDirection: "row", gap: 8 },
  dashboardMetric: { flex: 1, borderRadius: 16, padding: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C6EDEF", gap: 4 },
  dashboardMetricValue: { color: "#082E34", fontSize: 15, fontWeight: "900" },
  dashboardMetricLabel: { color: "#4C747A", fontSize: 9 },
  incomingCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 15, borderWidth: 1, borderColor: "#F6D889", gap: 9 },
  incomingTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  incomingEyebrow: { color: "#00AFC4", fontSize: 10, fontWeight: "900" },
  incomingId: { color: "#082E34", fontSize: 17, fontWeight: "900", marginTop: 2 },
  newPill: { backgroundColor: "#F0FBEA", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  newPillText: { color: "#00AFC4", fontSize: 9, fontWeight: "900" },
  incomingTitle: { color: "#082E34", fontSize: 14, fontWeight: "900" },
  incomingMeta: { color: "#4C747A", fontSize: 11 },
  incomingActions: { flexDirection: "row", gap: 8 },
  rejectButton: { flex: 0.32, height: 44, borderRadius: 14, backgroundColor: "#F0F7EF", alignItems: "center", justifyContent: "center" },
  rejectText: { color: "#4C747A", fontSize: 12, fontWeight: "900" },
  acceptButton: { flex: 1, height: 44, borderRadius: 14, backgroundColor: "#00AFC4", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  acceptText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  prepNotice: { backgroundColor: "#EEF9DB", borderRadius: 13, padding: 10, flexDirection: "row", alignItems: "center", gap: 7 },
  prepNoticeText: { color: "#2E9B72", fontSize: 11, fontWeight: "800" },
  dashboardList: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#C6EDEF", overflow: "hidden" },
  dashboardAction: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: "#EFF6ED" },
  dashboardActionIcon: { width: 36, height: 36, borderRadius: 13, backgroundColor: "#F0FBEA", alignItems: "center", justifyContent: "center" },
  dashboardActionCopy: { flex: 1 },
  dashboardActionTitle: { color: "#082E34", fontSize: 12, fontWeight: "900" },
  dashboardActionDetail: { color: "#4C747A", fontSize: 10, marginTop: 3 },
  menuManager: { backgroundColor: "#F7FFF0", padding: 12, borderRadius: 18, gap: 9 },
  menuManagerRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  menuThumb: { width: 42, height: 42, borderRadius: 12 },
  menuManagerCopy: { flex: 1 },
  menuManagerName: { color: "#082E34", fontSize: 11, fontWeight: "900" },
  menuManagerMeta: { color: "#4C747A", fontSize: 10, marginTop: 2 },
  menuStatus: { flexDirection: "row", alignItems: "center", gap: 4 },
  menuStatusText: { fontSize: 9, color: "#2E9B72", fontWeight: "900" },
  menuRemoveButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#FFF1F1", justifyContent: "center", alignItems: "center" },
  menuEmpty: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  menuEmptyText: { color: "#4C747A", fontSize: 10, fontWeight: "800" },
  cliqCard: { backgroundColor: "#EEF9DB", borderRadius: 18, padding: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  cliqBadge: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#2E9B72", justifyContent: "center", alignItems: "center" },
  cliqBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  cliqCopy: { flex: 1 },
  cliqTitle: { color: "#082E34", fontSize: 12, fontWeight: "900" },
  cliqBody: { color: "#2E9B72", fontSize: 10, marginTop: 3 },
  profileDashboardCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#2E9B72", borderRadius: 19, padding: 13 },
  profileDashboardIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  profileDashboardCopy: { flex: 1 },
  profileDashboardTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  profileDashboardBody: { color: "#E9F8BF", fontSize: 10, marginTop: 3 },
  profileHeader: { flexDirection: "row", alignItems: "center", gap: 11, paddingBottom: 4 },
  profileAvatar: { width: 50, height: 50, borderRadius: 17 },
  profileGreeting: { color: "#082E34", fontSize: 17, fontWeight: "900" },
  profileMuted: { color: "#4C747A", fontSize: 11, marginTop: 3 },
  switchRoleButton: { marginLeft: "auto", backgroundColor: "#F0FBEA", borderRadius: 14, paddingHorizontal: 9, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  switchRoleText: { color: "#00AFC4", fontSize: 10, fontWeight: "900" },
  roleIcon: { marginLeft: "auto", width: 39, height: 39, borderRadius: 13, backgroundColor: "#F0FBEA", justifyContent: "center", alignItems: "center" },
  settingsCard: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#C6EDEF", overflow: "hidden" },
  settingRow: { flexDirection: "row", alignItems: "center", padding: 13, gap: 10, borderBottomWidth: 1, borderBottomColor: "#EFF6ED" },
  settingIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#F0FBEA", alignItems: "center", justifyContent: "center" },
  settingLabel: { color: "#082E34", fontSize: 12, fontWeight: "800", flex: 1 },
  settingValue: { color: "#4C747A", fontSize: 11 },
  aboutCard: { borderRadius: 20, padding: 16, backgroundColor: "#082E34" },
  aboutTitle: { color: "#F6D889", fontSize: 15, fontWeight: "900" },
  aboutBody: { color: "#D6E2D4", fontSize: 11, lineHeight: 17, marginTop: 7 },
  favoriteHeaderIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#FFF1EC", alignItems: "center", justifyContent: "center" },
  favoritesSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 10 },
  favoritesCount: { minWidth: 26, paddingHorizontal: 8, paddingVertical: 4, textAlign: "center", borderRadius: 12, backgroundColor: "#FFF1EC", color: "#A55A40", fontSize: 11, fontWeight: "900" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 8 },
  emptyBasket: { width: 66, height: 66, borderRadius: 24, backgroundColor: "#F0FBEA", justifyContent: "center", alignItems: "center", marginBottom: 5 },
  emptyTitle: { color: "#082E34", fontSize: 17, fontWeight: "900" },
  emptyBody: { color: "#4C747A", fontSize: 11, textAlign: "center", maxWidth: 220, lineHeight: 17 },
  bottomNav: { position: "absolute", left: 14, right: 14, bottom: 13, height: 69, backgroundColor: "rgba(255,255,255,0.97)", borderRadius: 23, borderWidth: 1, borderColor: "#C6EDEF", flexDirection: "row", alignItems: "center", justifyContent: "space-around", shadowColor: "#082E34", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 7 },
  navItem: { alignItems: "center", justifyContent: "center", gap: 4, minWidth: 55, paddingVertical: 7 },
  navLabel: { color: "#8ABAC0", fontSize: 9, fontWeight: "800" },
  navLabelActive: { color: "#00AFC4" },
  navBrandDot: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#00AFC4", alignItems: "center", justifyContent: "center", marginTop: -26, borderWidth: 4, borderColor: "#F2FEFF" },
  toast: { position: "absolute", left: 24, right: 24, bottom: 98, borderRadius: 15, backgroundColor: "#082E34", paddingHorizontal: 13, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8, shadowColor: "#082E34", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  toastText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", flex: 1 },
  customerDriverCard: { backgroundColor: "#E5FCFF", borderRadius: 22, padding: 15, gap: 14, borderWidth: 1, borderColor: "#F6D889" },
  customerDriverHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  driverAvatar: { width: 44, height: 44, borderRadius: 16, backgroundColor: "#00AFC4", alignItems: "center", justifyContent: "center" },
  customerDriverCopy: { flex: 1, gap: 2 },
  customerDriverEyebrow: { color: "#1B5E3A", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 },
  customerDriverName: { color: "#082E34", fontSize: 15, fontWeight: "900" },
  customerDriverMeta: { color: "#4C747A", fontSize: 11, fontWeight: "600" },
  callDriverButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#2E9B72", alignItems: "center", justifyContent: "center" },
  customerDriverStats: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: "#F6D889", paddingTop: 12 },
  customerDriverStatLabel: { color: "#8ABAC0", fontSize: 9, fontWeight: "800", marginBottom: 3 },
  customerDriverStatValue: { color: "#304A38", fontSize: 10, fontWeight: "800", maxWidth: 104 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
});
