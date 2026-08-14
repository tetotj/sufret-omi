import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Linking from "expo-linking";

import { MapPreview } from "@/components/map-preview";
import { VerificationScreen } from "@/components/verification-screen";
import { complaintCategories, complaintStatuses, type ComplaintCategory } from "@/lib/complaint-data";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { driverVehicleLabels, loadCapacityLabels, mealSizeLabels } from "@/lib/verification-data";
import {
  categories,
  canCarryLoad,
  distanceKm,
  formatJod,
  getCategory,
  getOrderPricing,
  getKitchenDistanceKm,
  getKitchenMeals,
  getLocalized,
  getMeal,
  getRegion,
  kitchens,
  meals,
  orderStatuses,
  paymentLabels,
  type Localized,
  type RegionId,
  type Role,
  regions,
  scheduleLabels,
  t,
  totalCart,
  unitCount,
} from "@/lib/food-data";

type ViewId = "home" | "explore" | "discover" | "meals" | "orders" | "profile" | "kitchen" | "cart" | "complaints" | "dashboard" | "delivery";

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

export default function HomeScreen() {
  const { isAuthenticated, isGuest, language, role, toast, dismissToast, setRole, signIn, signOut, setSelectedKitchenId, canAccessRoleDashboard, cartCount, cartTotal, cartSpecialRequests, setCartSpecialRequests, addToCart } = useApp();
  const cartPreviewTotal = getOrderPricing(cartTotal, cartCount > 0 ? 1.25 : 0).grandTotal;
  const [view, setView] = useState<ViewId>(role === "mother" ? "dashboard" : role === "driver" ? "delivery" : "home");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customizingMeal, setCustomizingMeal] = useState<(typeof meals)[number] | null>(null);
  const [query, setQuery] = useState("");

  const confirmMealCustomization = (meal: (typeof meals)[number], specialRequests: string) => {
    addToCart(meal, specialRequests);
    setCustomizingMeal(null);
  };

  const changeRole = () => {
    const next = role === "customer" ? "mother" : "customer";
    setRole(next);
    setView(next === "mother" ? "dashboard" : "home");
  };

  const go = (next: ViewId) => {
    if (isGuest && (next === "cart" || next === "orders" || next === "dashboard")) {
      signOut();
      setView("home");
      setCheckoutOpen(false);
      return;
    }
    setView(next);
    setCheckoutOpen(false);
  };

  if (!isAuthenticated) {
    return <LoginScreen onSignedIn={(nextRole, guest = false) => { signIn(nextRole, guest); setView(nextRole === "mother" ? "dashboard" : nextRole === "driver" ? "delivery" : "home"); }} />;
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
        ) : view === "cart" ? (
          <CartScreen onBack={() => go("home")} onCheckout={() => setCheckoutOpen(true)} />
        ) : view === "complaints" ? (
          <ComplaintsScreen onBack={() => go("home")} />
        ) : view === "dashboard" ? (
          role === "mother" ? <MotherDashboard onBack={() => go("home")} /> : <CustomerDashboard onBack={() => go("home")} onNavigate={go} />
        ) : view === "delivery" ? (
          <DriverDashboard onBack={() => go("home")} />
        ) : view === "orders" ? (
          <OrdersScreen onBack={() => go("home")} />
        ) : view === "profile" ? (
          <ProfileScreen onRoleChange={changeRole} onDashboard={() => go("dashboard")} onSupport={() => go("complaints")} />
        ) : (
          <CustomerHome view={view} query={query} setQuery={setQuery} onNavigate={go} onRequestAdd={setCustomizingMeal} />
        )}

        {view !== "kitchen" && view !== "cart" && view !== "complaints" && view !== "dashboard" && view !== "delivery" && view !== "discover" && view !== "meals" && (
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

function LoginScreen({ onSignedIn }: { onSignedIn: (role: Role, guest?: boolean) => void }) {
  const { language, setLanguage } = useApp();
  const [mode, setMode] = useState<Role>("customer");
  const [isCreate, setIsCreate] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (phone.trim().length < 7 || password.trim().length < 4) {
      setError(language === "ar" ? "اكتبي رقم الموبايل وكلمة مرور من ٤ أحرف على الأقل" : "Enter a mobile number and a password of at least 4 characters");
      return;
    }
    setError("");
    onSignedIn(mode, false);
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
          <Text style={styles.inputLabel}>{language === "ar" ? "رقم الموبايل" : "Mobile number"}</Text>
          <View style={styles.inputWrap}><MaterialIcons name="smartphone" size={18} color="#236B45" /><TextInput value={phone} onChangeText={setPhone} placeholder={language === "ar" ? "07X XXX XXXX" : "07X XXX XXXX"} placeholderTextColor="#A4BDA7" keyboardType="phone-pad" style={styles.loginInput} textAlign={language === "ar" ? "right" : "left"} /></View>
          <Text style={styles.inputLabel}>{language === "ar" ? "كلمة المرور" : "Password"}</Text>
          <View style={styles.inputWrap}><MaterialIcons name="lock-outline" size={18} color="#236B45" /><TextInput value={password} onChangeText={setPassword} placeholder={language === "ar" ? "٤ أحرف على الأقل" : "At least 4 characters"} placeholderTextColor="#A4BDA7" secureTextEntry style={styles.loginInput} textAlign={language === "ar" ? "right" : "left"} /></View>
          {error ? <Text style={styles.loginError}>{error}</Text> : null}
          <Text style={styles.rolePrompt}>{language === "ar" ? "كيف رح تستخدمي سفرة أمي؟" : "How will you use Sufret Omi?"}</Text>
          <View style={styles.roleChoiceRow}><Pressable onPress={() => setMode("customer")} style={[styles.roleChoice, mode === "customer" && styles.roleChoiceActive]}><MaterialIcons name="restaurant" size={19} color={mode === "customer" ? "#FFFFFF" : "#236B45"} /><Text style={[styles.roleChoiceText, mode === "customer" && styles.roleChoiceTextActive]}>{language === "ar" ? "أطلب أكل" : "Order food"}</Text></Pressable><Pressable onPress={() => setMode("mother")} style={[styles.roleChoice, mode === "mother" && styles.roleChoiceActive]}><MaterialIcons name="storefront" size={19} color={mode === "mother" ? "#FFFFFF" : "#4F8F3B"} /><Text style={[styles.roleChoiceText, mode === "mother" && styles.roleChoiceTextActive]}>{language === "ar" ? "أطبخ وأبيع" : "Cook & sell"}</Text></Pressable><Pressable onPress={() => setMode("driver")} style={[styles.roleChoice, mode === "driver" && styles.roleChoiceActive]}><MaterialIcons name="two-wheeler" size={19} color={mode === "driver" ? "#FFFFFF" : "#C88A16"} /><Text style={[styles.roleChoiceText, mode === "driver" && styles.roleChoiceTextActive]}>{language === "ar" ? "أوصل الطلبات" : "Deliver"}</Text></Pressable></View>
          <Pressable onPress={submit} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{isCreate ? (language === "ar" ? "أنشئي حسابك" : "Create my account") : (language === "ar" ? "دخّليني عالسفرة" : "Enter Sufret Omi")}</Text><MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" /></Pressable>
          <Pressable onPress={() => onSignedIn("customer", true)} style={styles.guestButton}><Text style={styles.guestButtonText}>{language === "ar" ? "تصفّحي كضيفة" : "Continue as guest"}</Text></Pressable>
        </View>
        <View style={styles.loginTrust}><MaterialIcons name="verified-user" size={16} color="#4F8F3B" /><Text style={styles.loginTrustText}>{language === "ar" ? "بياناتك محفوظة، وطلباتك عند أمينة سفرة" : "Your data stays protected and your orders stay cared for"}</Text></View>
      </ScrollView>
    </ScreenContainer>
  );
}

function CustomerDashboard({ onBack, onNavigate }: { onBack: () => void; onNavigate: (view: ViewId) => void }) {
  const { language, activeOrder, selectedKitchen, cartCount, complaints, signOut } = useApp();
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#132218" /></Pressable><View><Text style={styles.eyebrow}>{language === "ar" ? "لوحة سفرتي" : "MY TABLE"}</Text><Text style={styles.pageTitle}>{language === "ar" ? "أهلاً سارة" : "Hello Sara"}</Text></View><Pressable onPress={signOut} style={styles.logoutButton}><MaterialIcons name="logout" size={17} color="#236B45" /><Text style={styles.logoutText}>{language === "ar" ? "خروج" : "Log out"}</Text></Pressable></View>
      <View style={styles.customerDashHero}><View><Text style={styles.customerDashOverline}>{language === "ar" ? "لمّتك الجاية" : "Your next gathering"}</Text><Text style={styles.customerDashTitle}>{activeOrder ? (language === "ar" ? "طلبك بالطريق" : "Your order is moving") : (language === "ar" ? "اختاري طبخة للعيلة" : "Pick a family meal")}</Text><Text style={styles.customerDashBody}>{activeOrder ? `${activeOrder.id} · ${getLocalized(activeOrder.eta, language)}` : (language === "ar" ? "مطابخ بيتية قريبة منك" : "Home kitchens close to you")}</Text></View><View style={styles.customerDashIcon}><MaterialIcons name={activeOrder ? "two-wheeler" : "restaurant"} size={30} color="#236B45" /></View></View>
      <View style={styles.dashboardGrid}><DashboardTile icon="receipt-long" title={language === "ar" ? "طلباتي" : "My orders"} detail={activeOrder ? (language === "ar" ? "طلب نشط" : "1 active") : (language === "ar" ? "شوفي السابق" : "See history")} onPress={() => onNavigate("orders")} /><DashboardTile icon="favorite-border" title={language === "ar" ? "مطابخي" : "Saved kitchens"} detail={language === "ar" ? "٣ مطابخ" : "3 saved"} onPress={() => onNavigate("kitchen")} /><DashboardTile icon="location-on" title={language === "ar" ? "عناويني" : "Addresses"} detail={language === "ar" ? "خلدا، عمّان" : "Khalda, Amman"} onPress={() => onNavigate("home")} /><DashboardTile icon="support-agent" title={language === "ar" ? "شكاوى ومساعدة" : "Complaints & help"} detail={complaints.length ? (language === "ar" ? `${complaints.length} شكوى · متابعة` : `${complaints.length} complaints · Track`) : (language === "ar" ? "أرسلي شكوى" : "Send a complaint")} onPress={() => onNavigate("complaints")} /></View>
      <SectionHeader title={language === "ar" ? "طلبك الحالي" : "Your current order"} action={language === "ar" ? "كل الطلبات" : "All orders"} onAction={() => onNavigate("orders")} />
      {activeOrder ? <Pressable onPress={() => onNavigate("orders")} style={styles.customerOrderCard}><View style={styles.customerOrderIcon}><MaterialIcons name="soup-kitchen" size={20} color="#4F8F3B" /></View><View style={styles.customerOrderCopy}><Text style={styles.customerOrderTitle}>{getLocalized(activeOrder.kitchen.name, language)}</Text><Text style={styles.customerOrderBody}>{activeOrder.id} · {getLocalized(activeOrder.eta, language)}</Text></View><MaterialIcons name="chevron-right" size={20} color="#4F8F3B" /></Pressable> : <Pressable onPress={() => onNavigate("home")} style={styles.customerOrderCard}><View style={styles.customerOrderIcon}><MaterialIcons name="add-circle" size={20} color="#236B45" /></View><View style={styles.customerOrderCopy}><Text style={styles.customerOrderTitle}>{language === "ar" ? "ابدئي أول طلب" : "Start your first order"}</Text><Text style={styles.customerOrderBody}>{language === "ar" ? "اختاري من مطابخ أمهات الأردن" : "Choose from Jordanian home kitchens"}</Text></View><MaterialIcons name="chevron-right" size={20} color="#236B45" /></Pressable>}
      <SectionHeader title={language === "ar" ? "اقتراح أمينة سفرة" : "A table pick for you"} action={language === "ar" ? "افتحي المطبخ" : "Open kitchen"} onAction={() => onNavigate("kitchen")} />
      <Pressable onPress={() => onNavigate("kitchen")} style={styles.recommendedKitchen}><Image source={{ uri: selectedKitchen.image }} style={styles.recommendedKitchenImage} /><View style={styles.recommendedKitchenOverlay} /><View style={styles.recommendedKitchenCopy}><Text style={styles.recommendedKitchenEyebrow}>{language === "ar" ? "الأكثر طلباً حولك" : "Most loved near you"}</Text><Text style={styles.recommendedKitchenName}>{getLocalized(selectedKitchen.name, language)}</Text><Text style={styles.recommendedKitchenMeta}>{getLocalized(selectedKitchen.neighborhood, language)} · 4.9 ★</Text></View></Pressable>
      <View style={styles.dashboardFootnote}><MaterialIcons name="shopping-cart" size={17} color="#236B45" /><Text style={styles.dashboardFootnoteText}>{cartCount > 0 ? (language === "ar" ? `${cartCount} أصناف بانتظارك في السفرة` : `${cartCount} items waiting in your cart`) : (language === "ar" ? "كل طلب بيحكي حكاية بيت" : "Every order tells a home story")}</Text></View>
    </ScrollView>
  );
}

function DriverDashboard({ onBack }: { onBack: () => void }) {
  const { language, driverAvailable, setDriverAvailable, driverOrder, driverVerification, advanceDriverOrder, showToast, signOut } = useApp();
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
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#132218" /></Pressable><View><Text style={styles.eyebrow}>{language === "ar" ? "لوحة التوصيل" : "DELIVERY HUB"}</Text><Text style={styles.pageTitle}>{language === "ar" ? "أهلاً يا محمد" : "Good morning, Mohammad"}</Text></View><Pressable onPress={signOut} style={styles.logoutButton}><MaterialIcons name="logout" size={17} color="#236B45" /><Text style={styles.logoutText}>{language === "ar" ? "خروج" : "Log out"}</Text></Pressable></View>
      <View style={styles.driverHero}><View><Text style={styles.driverOverline}>{language === "ar" ? "حالة المندوب" : "Driver status"}</Text><Text style={styles.driverTitle}>{driverAvailable ? (language === "ar" ? "متاح للتوصيل" : "Available for deliveries") : (language === "ar" ? "غير متاح الآن" : "Unavailable now")}</Text><Text style={styles.driverBody}>{driverAvailable ? (language === "ar" ? "رح توصلك الطلبات القريبة" : "Nearby orders will appear here") : (language === "ar" ? "شغّل التوفر لاستقبال طلبات" : "Turn on availability to receive orders")}</Text></View><Switch value={driverAvailable} onValueChange={setDriverAvailable} trackColor={{ false: "#D6E2D4", true: "#B8F000" }} thumbColor={driverAvailable ? "#4F8F3B" : "#5E7665"} /></View>
      <View style={styles.earningsRow}><DashboardMetric label={language === "ar" ? "توصيلات اليوم" : "Today's deliveries"} value="8" icon="two-wheeler" /><DashboardMetric label={language === "ar" ? "أرباح اليوم" : "Today's earnings"} value={language === "ar" ? "٢٤ د.أ" : "JOD 24"} icon="payments" /><DashboardMetric label={language === "ar" ? "التقييم" : "Rating"} value="4.9" icon="star" /></View>
      {driverOrder ? <>
        <View style={styles.driverOrderCard}><View style={styles.driverOrderHeader}><View><Text style={styles.incomingEyebrow}>{language === "ar" ? "التوصيلة الحالية" : "Current delivery"}</Text><Text style={styles.incomingId}>{driverOrder.id}</Text></View><View style={styles.driverOrderTag}><View style={styles.liveDot} /><Text style={styles.driverOrderTagText}>{currentStatus ? getLocalized(currentStatus.label, language) : "Live"}</Text></View></View><Text style={styles.driverOrderTitle}>{driverOrder.items.map((item) => `${item.quantity}× ${getLocalized(item.meal.name, language)}`).join("، ")}</Text><Text style={styles.driverOrderMeta}>{language === "ar" ? "استلام من" : "Pickup from"} {getLocalized(driverOrder.kitchen.name, language)} · {getLocalized(driverOrder.kitchen.neighborhood, language)}</Text><View style={[styles.capacityMatch, capacityFits ? styles.capacityMatchOk : styles.capacityMatchWarn]}><MaterialIcons name={capacityFits ? "check-circle" : "warning-amber"} size={16} color={capacityFits ? "#4F8F3B" : "#C44545"} /><Text style={[styles.capacityMatchText, !capacityFits && styles.capacityMatchTextWarn]}>{capacityFits ? (language === "ar" ? `${vehicleType ? getLocalized(driverVehicleLabels[vehicleType], language) : "مركبتك"} مناسبة لحمولة ${getLocalized(loadCapacityLabels[requiredCapacity], language)}` : `${vehicleType ? getLocalized(driverVehicleLabels[vehicleType], language) : "Your vehicle"} fits the ${getLocalized(loadCapacityLabels[requiredCapacity], language)} order`) : (language === "ar" ? "هذه الحمولة أكبر من سعة مركبتك" : "This order is larger than your vehicle capacity")}</Text></View>{driverOrder.specialRequests ? <View style={styles.driverSpecialRequest}><MaterialIcons name="edit-note" size={18} color="#8A6516" /><View style={styles.specialRequestCopy}><Text style={styles.specialRequestTitle}>{language === "ar" ? "تعليمات العميل" : "Customer instructions"}</Text><Text style={styles.specialRequestBody}>{driverOrder.specialRequests}</Text></View></View> : null}</View>
        <MapPreview pickupCoordinates={driverOrder.pickupCoordinates} dropoffCoordinates={driverOrder.dropoffCoordinates} onPressMap={() => void openNavigation(driverOrder.status === "ready" ? "pickup" : "dropoff")} />
        <View style={styles.routeCard}>
          <Pressable onPress={() => void openNavigation("pickup")} style={({ pressed }) => [styles.routeRow, pressed && styles.pressed]}><View style={[styles.routeMarker, styles.routeMarkerPickup]}><MaterialIcons name="storefront" size={14} color="#FFFFFF" /></View><View style={styles.routeCopy}><Text style={styles.routeLabel}>{language === "ar" ? "استلام من المطبخ" : "Pickup from kitchen"}</Text><Text style={styles.routeValue}>{getLocalized(driverOrder.pickupAddress, language)}</Text><Text style={styles.routeCoordinates}>{driverOrder.pickupCoordinates.latitude.toFixed(5)}, {driverOrder.pickupCoordinates.longitude.toFixed(5)}</Text><Text style={styles.routeDistance}>{language === "ar" ? `${pickupDistance.toFixed(1)} كم · حوالي ${pickupEtaMinutes} دقيقة للوصول` : `${pickupDistance.toFixed(1)} km · about ${pickupEtaMinutes} min to arrive`}</Text></View><MaterialIcons name="directions" size={20} color="#236B45" /></Pressable>
          <View style={styles.routeLine} />
          <Pressable onPress={() => void openNavigation("dropoff")} style={({ pressed }) => [styles.routeRow, pressed && styles.pressed]}><View style={[styles.routeMarker, styles.routeMarkerDropoff]}><MaterialIcons name="location-on" size={14} color="#FFFFFF" /></View><View style={styles.routeCopy}><Text style={styles.routeLabel}>{language === "ar" ? "تسليم للعميلة" : "Drop-off"}</Text><Text style={styles.routeValue}>{getLocalized(driverOrder.dropoffAddress, language)}</Text><Text style={styles.routeCoordinates}>{driverOrder.dropoffCoordinates.latitude.toFixed(5)}, {driverOrder.dropoffCoordinates.longitude.toFixed(5)}</Text><Text style={styles.routeDistance}>{language === "ar" ? `${deliveryDistance.toFixed(1)} كم · حوالي ${deliveryEtaMinutes} دقيقة للتسليم` : `${deliveryDistance.toFixed(1)} km · about ${deliveryEtaMinutes} min to deliver`}</Text></View><MaterialIcons name="directions" size={20} color="#236B45" /></Pressable>
        </View>
        <View style={styles.driverRatingsRow}><View style={styles.driverRatingBox}><MaterialIcons name="two-wheeler" size={17} color="#236B45" /><View><Text style={styles.driverRatingLabel}>{language === "ar" ? "تقييم السائق" : "Driver rating"}</Text><Text style={styles.driverRatingValue}>{driverRating.toFixed(1)} ★</Text></View></View><View style={styles.driverRatingBox}><MaterialIcons name="storefront" size={17} color="#4F8F3B" /><View><Text style={styles.driverRatingLabel}>{language === "ar" ? "تقييم المتجر" : "Store rating"}</Text><Text style={styles.driverRatingValue}>{driverOrder.kitchen.rating.toFixed(1)} ★</Text></View></View></View>
        {driverOrder.status !== "delivered" ? <Pressable disabled={!capacityFits} onPress={advance} style={({ pressed }) => [styles.driverActionButton, !capacityFits && styles.driverActionDisabled, pressed && styles.pressed]}>
<MaterialIcons name={driverOrder.status === "ready" ? "shopping-bag" : "check-circle"} size={19} color="#FFFFFF" /><Text style={styles.driverActionButtonText}>{actionLabel}</Text></Pressable> : <View style={styles.driverDone}><MaterialIcons name="check-circle" size={21} color="#4F8F3B" /><Text style={styles.driverDoneText}>{language === "ar" ? "تمت التوصيلة بنجاح، يعطيك العافية" : "Delivery complete, great work"}</Text></View>}
      </> : <View style={styles.driverDone}><MaterialIcons name="local-cafe" size={21} color="#236B45" /><Text style={styles.driverDoneText}>{language === "ar" ? "ما في طلبات قريبة حالياً" : "No nearby orders right now"}</Text></View>}
      <SectionHeader title={language === "ar" ? "مراحل التوصيل" : "Delivery steps"} action={language === "ar" ? "الدعم" : "Support"} onAction={() => showToast(language === "ar" ? "فريق الدعم معك" : "Support is here for you")} />
      <View style={styles.trackingCard}>{orderStatuses.slice(1, 5).map((status, index) => { const active = driverOrder ? orderStatuses.findIndex((item) => item.id === driverOrder.status) >= index + 2 : false; return <View key={status.id} style={styles.trackingRow}><View style={styles.trackRail}><View style={[styles.trackDot, active && styles.trackDotDone]}>{active && <MaterialIcons name="check" size={12} color="#FFFFFF" />}</View>{index < 3 && <View style={[styles.trackLine, active && styles.trackLineDone]} />}</View><View style={styles.trackCopy}><Text style={[styles.trackLabel, active && styles.trackLabelActive]}>{getLocalized(status.label, language)}</Text><Text style={styles.trackCaption}>{getLocalized(status.caption, language)}</Text></View><MaterialIcons name={status.icon as IconName} size={19} color={active ? "#4F8F3B" : "#A4BDA7"} /></View>; })}</View>
    </ScrollView>
  );
}

function DiscoverMapScreen({ onBack, onOpenMeals }: { onBack: () => void; onOpenMeals: () => void }) {
  const { language, selectedRegion, setSelectedRegion } = useApp();
  const region = getRegion(selectedRegion);
  const nearbyKitchens = useMemo(() => [...kitchens].sort((left, right) => getKitchenDistanceKm(left, region) - getKitchenDistanceKm(right, region)).slice(0, 3), [region]);

  return (
    <View style={styles.fullScreenPage}>
      <View style={styles.fullScreenHeader}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#132218" /></Pressable><View style={styles.fullScreenHeaderCopy}><Text style={styles.eyebrow}>{language === "ar" ? "اكتشفني" : "DISCOVER"}</Text><Text style={styles.pageTitle}>{language === "ar" ? "مطابخ حولك" : "Kitchens around you"}</Text></View><View style={styles.mapHeaderBadge}><MaterialIcons name="navigation" size={15} color="#4F8F3B" /><Text style={styles.mapHeaderBadgeText}>{getLocalized(region.label, language)}</Text></View></View>
      <View style={styles.fullMapArea}><MapPreview fullScreen onSelectRegion={(regionId) => { setSelectedRegion(regionId); }} /></View>
      <View style={styles.discoverSheet}><View style={styles.discoverSheetHandle} /><View style={styles.discoverSheetTop}><View><Text style={styles.discoverEyebrow}>{language === "ar" ? "الأقرب أولاً" : "NEAREST FIRST"}</Text><Text style={styles.discoverTitle}>{language === "ar" ? `أقرب مطابخ من ${getLocalized(region.label, language)}` : `Closest kitchens to ${getLocalized(region.label, language)}`}</Text></View><Text style={styles.discoverCount}>{kitchens.length} {language === "ar" ? "مطبخ" : "kitchens"}</Text></View><View style={styles.nearbyPreviewRow}>{nearbyKitchens.map((kitchen) => <View key={kitchen.id} style={styles.nearbyPreview}><View style={[styles.nearbyPreviewDot, { backgroundColor: kitchen.accent }]} /><View style={styles.nearbyPreviewCopy}><Text style={styles.nearbyPreviewName} numberOfLines={1}>{getLocalized(kitchen.name, language)}</Text><Text style={styles.nearbyPreviewDistance}>{getKitchenDistanceKm(kitchen, region).toFixed(1)} {language === "ar" ? "كم" : "km"}</Text></View></View>)}</View><Pressable onPress={onOpenMeals} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{language === "ar" ? "شاهدي كل الأكلات القريبة" : "See all nearby meals"}</Text><MaterialIcons name="restaurant" size={18} color="#FFFFFF" /></Pressable></View>
    </View>
  );
}

function MealsScreen({ onBack, onOpenCart, onOpenKitchen, onRequestAdd }: { onBack: () => void; onOpenCart: () => void; onOpenKitchen: (kitchenId: string) => void; onRequestAdd: (meal: (typeof meals)[number]) => void }) {
  const { language, selectedRegion, selectedCategory, setSelectedCategory, updateQuantity, cart, cartCount } = useApp();
  const region = getRegion(selectedRegion);
  const mealsTitle = selectedCategory === "all" ? (language === "ar" ? "كل الأكلات القريبة" : "All nearby meals") : getLocalized(getCategory(selectedCategory).label, language);
  const nearbyMeals = useMemo(() => meals.filter((meal) => selectedCategory === "all" || meal.category === selectedCategory).map((meal) => {
    const kitchen = kitchens.find((item) => item.id === meal.kitchenId) ?? kitchens[0];
    return { meal, kitchen, distance: getKitchenDistanceKm(kitchen, region) };
  }).sort((left, right) => left.distance - right.distance), [region, selectedCategory]);

  return (
    <View style={styles.fullScreenPage}><ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}><View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#132218" /></Pressable><View style={styles.fullScreenHeaderCopy}><Text style={styles.eyebrow}>{language === "ar" ? "كل الأكلات" : "ALL MEALS"}</Text><Text style={styles.pageTitle}>{mealsTitle}</Text></View><View style={styles.mapHeaderBadge}><MaterialIcons name="navigation" size={15} color="#4F8F3B" /><Text style={styles.mapHeaderBadgeText}>{getLocalized(region.label, language)}</Text></View></View><View style={styles.mealsIntro}><Text style={styles.mealsIntroTitle}>{language === "ar" ? "اختاري طبختك من حولك" : "Choose a dish around you"}</Text><Text style={styles.mealsIntroBody}>{language === "ar" ? "رتبنا لك كل الأصناف حسب قرب المطبخ من منطقتك." : "Every dish is ordered by how close its kitchen is to your region."}</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{["all", ...categories.map((category) => category.id)].map((categoryId) => { const category = categoryId === "all" ? null : getCategory(categoryId as never); return <Chip key={categoryId} label={category ? getLocalized(category.label, language) : language === "ar" ? "الكل" : "All"} selected={selectedCategory === categoryId} onPress={() => setSelectedCategory(categoryId as typeof selectedCategory)} />; })}</ScrollView><View style={styles.nearbySectionHeader}><Text style={styles.sectionTitle}>{language === "ar" ? `${nearbyMeals.length} صنف قريب منك` : `${nearbyMeals.length} meals near you`}</Text><Text style={styles.nearbySortLabel}>{language === "ar" ? "الأقرب ← الأبعد" : "Nearest → farthest"}</Text></View><View style={styles.mealList}>{nearbyMeals.map(({ meal, kitchen, distance }) => <View key={meal.id} style={styles.nearbyMealBlock}><MealRow meal={meal} language={language} quantity={cart.find((item) => item.meal.id === meal.id)?.quantity ?? 0} onRemove={() => updateQuantity(meal.id, (cart.find((item) => item.meal.id === meal.id)?.quantity ?? 1) - 1)} onPress={() => onOpenKitchen(kitchen.id)} onAdd={() => onRequestAdd(meal)} /><View style={styles.nearbyMealMeta}><Pressable onPress={() => onOpenKitchen(kitchen.id)} style={styles.nearbyKitchenLink}><MaterialIcons name="storefront" size={13} color="#4F8F3B" /><Text style={styles.nearbyKitchenLinkText}>{getLocalized(kitchen.name, language)}</Text></Pressable><Text style={styles.nearbyDistance}><MaterialIcons name="navigation" size={12} color="#236B45" /> {distance.toFixed(1)} {language === "ar" ? "كم" : "km"}</Text></View></View>)}</View></ScrollView></View>
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
    setSelectedRegion,
    setSelectedCategory,
    setSelectedKitchenId,
    selectedKitchen,
    activeOrder,
    updateQuantity,
  } = useApp();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [regionScope, setRegionScope] = useState<RegionId | "all">("all");
  const [priceSort, setPriceSort] = useState<"none" | "high" | "low">("none");
  const region = getRegion(selectedRegion);

  const visibleKitchens = useMemo(() => regionScope === "all" ? kitchens : kitchens.filter((kitchen) => kitchen.region === regionScope), [regionScope]);

  const visibleMeals = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = meals.filter((meal) => {
      const matchesQuery = !normalized || `${meal.name.ar} ${meal.name.en}`.toLowerCase().includes(normalized);
      const matchesCategory = selectedCategory === "all" || meal.category === selectedCategory;
      const kitchen = kitchens.find((item) => item.id === meal.kitchenId);
      const matchesRegion = regionScope === "all" || kitchen?.region === regionScope;
      return matchesQuery && matchesCategory && matchesRegion;
    });
    return [...filtered].sort((left, right) => priceSort === "high" ? right.price - left.price : priceSort === "low" ? left.price - right.price : 0);
  }, [query, selectedCategory, regionScope, priceSort]);

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
        <View style={styles.unifiedSearchField}><MaterialIcons name="search" size={18} color="#5E7665" /><TextInput value={query} onChangeText={setQuery} placeholder={language === "ar" ? "ابحثي" : "Search"} placeholderTextColor="#A4BDA7" style={styles.unifiedSearchInput} textAlign={language === "ar" ? "right" : "left"} /></View>
        <Pressable onPress={() => setFiltersOpen((value) => !value)} style={({ pressed }) => [styles.unifiedIconButton, filtersOpen && styles.unifiedIconButtonActive, pressed && styles.pressed]}><MaterialIcons name="tune" size={18} color={filtersOpen ? "#FFFFFF" : "#236B45"} /></Pressable>
        <Pressable onPress={() => onNavigate("cart")} style={({ pressed }) => [styles.unifiedCartButton, pressed && styles.pressed]}><MaterialIcons name="shopping-cart" size={19} color="#FFFFFF" />{cartCount > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>}</Pressable>
      </View>

      <Pressable onPress={() => onNavigate("kitchen")} style={({ pressed }) => [styles.heroCard, pressed && styles.pressed]}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroOverline}>{language === "ar" ? "من بيتنا لبيتك" : "From our homes to yours"}</Text>
          <Text style={styles.heroTitle}>{language === "ar" ? "أكل يلمّ العيلة" : "Food that brings family together"}</Text>
          <Text style={styles.heroBody}>{language === "ar" ? "اطلبي طبخة بيتية من أمهات الأردن" : "Order a home-cooked meal from Jordanian mothers"}</Text>
          <View style={styles.heroCta}><Text style={styles.heroCtaText}>{language === "ar" ? "تصفّحي اليوم" : "Browse today"}</Text><MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" /></View>
        </View>
        <View style={styles.heroArt}>
          <View style={styles.heroPlate}><MaterialIcons name="restaurant" size={34} color="#236B45" /></View>
          <View style={styles.heroLeafOne} /><View style={styles.heroLeafTwo} />
        </View>
      </Pressable>

      {filtersOpen && (
        <View style={styles.filterPanel}>
          <Text style={styles.filterTitle}>{language === "ar" ? "اختاري منطقتك" : "Choose your region"}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip label={language === "ar" ? "كل المملكة" : "All Jordan"} selected={regionScope === "all"} onPress={() => setRegionScope("all")} />
            {regions.map((item) => (
              <Chip key={item.id} label={getLocalized(item.label, language)} selected={regionScope === item.id} onPress={() => { setRegionScope(item.id); setSelectedRegion(item.id); }} />
            ))}
          </ScrollView>
          <Text style={styles.filterTitle}>{language === "ar" ? "ترتيب الأصناف حسب السعر" : "Sort meals by price"}</Text>
          <View style={styles.sortOptions}>
            {([{ id: "none", ar: "الأكثر طلباً", en: "Most ordered" }, { id: "high", ar: "الأغلى أولاً", en: "Price: high to low" }, { id: "low", ar: "الأرخص أولاً", en: "Price: low to high" }] as const).map((option) => <Pressable key={option.id} onPress={() => setPriceSort(option.id)} style={[styles.sortChip, priceSort === option.id && styles.sortChipActive]}><MaterialIcons name={option.id === "high" ? "arrow-downward" : option.id === "low" ? "arrow-upward" : "trending-up"} size={14} color={priceSort === option.id ? "#FFFFFF" : "#236B45"} /><Text style={[styles.sortChipText, priceSort === option.id && styles.sortChipTextActive]}>{language === "ar" ? option.ar : option.en}</Text></Pressable>)}
          </View>
        </View>
      )}

      <SectionHeader title={language === "ar" ? "شو نفسِك اليوم؟" : "What are you craving?"} action={language === "ar" ? "الكل" : "See all"} onAction={() => onNavigate("meals")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        <CategoryPill label={language === "ar" ? "الكل" : "All"} icon="apps" color="#236B45" selected={selectedCategory === "all"} onPress={() => { setSelectedCategory("all"); onNavigate("meals"); }} />
        {categories.map((category) => (
          <CategoryPill key={category.id} label={getLocalized(category.label, language)} icon={category.icon as IconName} color={category.color} selected={selectedCategory === category.id} onPress={() => { setSelectedCategory(category.id); onNavigate("meals"); }} />
        ))}
      </ScrollView>

      <SectionHeader title={language === "ar" ? `حول ${regionScope === "all" ? "كل المملكة" : getLocalized(region.label, language)}` : regionScope === "all" ? "Around all Jordan" : `Around ${getLocalized(region.label, language)}`} action={language === "ar" ? "الخريطة" : "Map"} onAction={() => onNavigate("discover")} />
      <MapPreview compact onSelectRegion={(regionId) => { setSelectedRegion(regionId); setRegionScope(regionId); }} onPressMap={() => onNavigate("discover")} />

      {activeOrder && (
        <Pressable onPress={() => onNavigate("orders")} style={styles.activeOrderCard}>
          <View style={styles.activeOrderTop}><View style={styles.liveDot} /><Text style={styles.activeOrderEyebrow}>{language === "ar" ? "طلبك يتحضّر الآن" : "Your order is cooking"}</Text><Text style={styles.activeOrderId}>{activeOrder.id}</Text></View>
          <View style={styles.activeOrderBody}><View><Text style={styles.activeOrderTitle}>{getLocalized(activeOrder.kitchen.name, language)}</Text><Text style={styles.activeOrderMeta}>{getLocalized(activeOrder.eta, language)}</Text></View><MaterialIcons name="chevron-right" size={22} color="#236B45" /></View>
        </Pressable>
      )}

      <SectionHeader title={language === "ar" ? "مطابخ بتحبّوها" : "Loved home kitchens"} action={language === "ar" ? "شوفي الكل" : "See all"} onAction={() => onNavigate("discover")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kitchenRow}>
        {visibleKitchens.map((kitchen) => (
          <Pressable key={kitchen.id} onPress={() => openKitchen(kitchen.id)} style={({ pressed }) => [styles.kitchenCard, pressed && styles.pressed]}>
            <View style={styles.kitchenImageWrap}><Image source={{ uri: kitchen.image }} style={styles.kitchenImage} /><View style={[styles.openPill, !kitchen.isOpen && styles.closedPill]}><View style={[styles.openDot, !kitchen.isOpen && styles.closedDot]} /><Text style={styles.openText}>{kitchen.isOpen ? (language === "ar" ? "مفتوح" : "Open") : (language === "ar" ? "مغلق" : "Closed")}</Text></View><View style={styles.ratingPill}><MaterialIcons name="star" size={12} color="#F59E0B" /><Text style={styles.ratingText}>{kitchen.rating}</Text></View></View>
            <View style={styles.kitchenCardCopy}><Text style={styles.kitchenName} numberOfLines={1}>{getLocalized(kitchen.name, language)}</Text><Text style={styles.kitchenNeighborhood}>{getLocalized(kitchen.neighborhood, language)}</Text><View style={styles.kitchenMeta}><Text style={styles.kitchenSpecialty}>{getLocalized(getCategory(kitchen.specialty).label, language)}</Text><Text style={styles.kitchenReviews}>· {kitchen.reviewCount} {language === "ar" ? "تقييم" : "reviews"}</Text></View></View>
          </Pressable>
        ))}
      </ScrollView>

      <SectionHeader title={language === "ar" ? "أكثر الأكلات طلباً" : "Most ordered today"} action={language === "ar" ? "أضيفي للسفرة" : "Add to table"} />
      <View style={styles.mealList}>
        {visibleMeals.map((meal) => (
          <MealRow key={meal.id} meal={meal} language={language} quantity={cart.find((item) => item.meal.id === meal.id)?.quantity ?? 0} onRemove={() => updateQuantity(meal.id, (cart.find((item) => item.meal.id === meal.id)?.quantity ?? 1) - 1)} onPress={() => openKitchen(meal.kitchenId)} onAdd={() => onRequestAdd(meal)} />
        ))}
      </View>
      {visibleMeals.length === 0 && <EmptyState language={language} />}

    </ScrollView>
  );
}

function KitchenProfile({ onBack, onCart, onRequestAdd }: { onBack: () => void; onCart: () => void; onRequestAdd: (meal: (typeof meals)[number]) => void }) {
  const { language, selectedKitchen, cart, cartCount, updateQuantity } = useApp();
  const kitchenMeals = getKitchenMeals(selectedKitchen.id);
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#132218" /></Pressable><Text style={styles.pageTitle}>{language === "ar" ? "مطبخ بيت" : "Home kitchen"}</Text><Pressable onPress={onCart} style={styles.iconButton}><MaterialIcons name="shopping-cart" size={20} color="#132218" />{cartCount > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>}</Pressable></View>
      <View style={styles.profileHero}><Image source={{ uri: selectedKitchen.image }} style={styles.profileImage} /><View style={styles.profileOverlay} /><View style={styles.profileHeroText}><View style={styles.profileVerified}><MaterialIcons name="verified" size={14} color="#FFFFFF" /><Text style={styles.profileVerifiedText}>{language === "ar" ? "مطبخ موثوق" : "Verified kitchen"}</Text></View><Text style={styles.profileName}>{getLocalized(selectedKitchen.name, language)}</Text><Text style={styles.profileNeighborhood}>{getLocalized(selectedKitchen.neighborhood, language)} · {getLocalized(selectedKitchen.motherName, language)}</Text></View></View>
      <View style={styles.profileStats}><StatItem icon="star" value={`${selectedKitchen.rating}`} label={language === "ar" ? "التقييم" : "Rating"} /><StatItem icon="local-dining" value={`${selectedKitchen.reviewCount}+`} label={language === "ar" ? "تجربة" : "orders"} /><StatItem icon="schedule" value="45m" label={language === "ar" ? "التحضير" : "prep"} /></View>
      <View style={styles.storyCard}><View style={styles.storyIcon}><MaterialIcons name="favorite" size={20} color="#236B45" /></View><View style={styles.storyCopy}><Text style={styles.storyTitle}>{language === "ar" ? "طبخته من وصفة أمها" : "A recipe passed down"}</Text><Text style={styles.storyBody}>{language === "ar" ? "كل طلب ينطبخ بنفس البيت وبنفس النفس الطيب." : "Every order is cooked in the same home with the same generous spirit."}</Text></View></View>
      <SectionHeader title={language === "ar" ? "قائمة اليوم" : "Today's menu"} action={language === "ar" ? "طلبات مسبقة" : "Advance order"} />
      <View style={styles.mealList}>{kitchenMeals.map((meal) => <MealRow key={meal.id} meal={meal} language={language} quantity={cart.find((item) => item.meal.id === meal.id)?.quantity ?? 0} onRemove={() => updateQuantity(meal.id, (cart.find((item) => item.meal.id === meal.id)?.quantity ?? 1) - 1)} onAdd={() => onRequestAdd(meal)} compact />)}</View>
    </ScrollView>
  );
}

function CartScreen({ onBack, onCheckout }: { onBack: () => void; onCheckout: () => void }) {
  const { language, cart, cartTotal, updateQuantity, clearCart, cartCount, cartSpecialRequests, setCartSpecialRequests } = useApp();
  const pricing = getOrderPricing(cartTotal, cart.length ? 1.25 : 0);
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#132218" /></Pressable><View><Text style={styles.pageTitle}>{language === "ar" ? "سفرتك" : "Your table"}</Text><Text style={styles.pageSubtitle}>{cartCount} {language === "ar" ? "وجبة" : "meals"} · {cart.length} {language === "ar" ? "أصناف" : "items"}</Text></View><Pressable onPress={clearCart} style={styles.clearButton}><Text style={styles.clearText}>{language === "ar" ? "مسح" : "Clear"}</Text></Pressable></View>
      {cart.length === 0 ? <EmptyCart language={language} onBack={onBack} /> : <>
        <View style={styles.cartItems}>{cart.map((item, index) => <CartItemRow key={`${item.meal.id}-${item.specialRequests ?? "default"}-${index}`} item={item} language={language} onUpdate={updateQuantity} />)}</View>
        <View style={styles.deliveryCard}><View style={styles.deliveryIcon}><MaterialIcons name="two-wheeler" size={21} color="#4F8F3B" /></View><View style={styles.deliveryCopy}><Text style={styles.deliveryTitle}>{language === "ar" ? "توصيل لباب البيت" : "Doorstep delivery"}</Text><Text style={styles.deliveryBody}>{language === "ar" ? "خلدا، شارع وصفي التل" : "Khalda, Wasfi Al-Tal St."}</Text></View><MaterialIcons name="chevron-right" size={20} color="#5E7665" /></View>
        <View style={styles.cartNoteCard}><View style={styles.cartNoteHeader}><MaterialIcons name="edit-note" size={20} color="#236B45" /><View style={styles.cartNoteCopy}><Text style={styles.cartNoteTitle}>{language === "ar" ? "ملاحظات للطلب" : "Order notes"}</Text><Text style={styles.cartNoteHint}>{language === "ar" ? "إذا بتحبي، اكتبي أي تعليمات عامة للمطبخ أو التوصيل" : "Add any general kitchen or delivery instructions"}</Text></View></View><TextInput value={cartSpecialRequests} onChangeText={setCartSpecialRequests} placeholder={language === "ar" ? "مثال: اتركي الطلب عند الباب..." : "Example: leave the order at the door..."} placeholderTextColor="#A4BDA7" multiline maxLength={180} style={styles.specialRequestInput} textAlign={language === "ar" ? "right" : "left"} /></View>
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

  return <Modal visible={Boolean(meal)} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.customizationSheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={styles.sheetEyebrow}>{language === "ar" ? "تخصيص الصنف" : "CUSTOMIZE MEAL"}</Text><Text style={styles.sheetTitle}>{language === "ar" ? "اختاري قبل الإضافة للسلة" : "Choose before adding to cart"}</Text></View><Pressable onPress={onClose} style={styles.closeButton}><MaterialIcons name="close" size={20} color="#132218" /></Pressable></View>{meal && <ScrollView style={styles.customizationScroll} contentContainerStyle={styles.customizationContent} showsVerticalScrollIndicator={false}><View style={styles.customizationMealHeader}><Image source={{ uri: meal.image }} style={styles.customizationMealImage} /><View style={styles.customizationMealCopy}><Text style={styles.customizationMealName}>{getLocalized(meal.name, language)}</Text><Text style={styles.customizationMealPrice}>{formatJod(meal.price, language)}</Text><Text style={styles.customizationHint}>{language === "ar" ? "اختياراتك ستُحفظ مع هذا الصنف في السلة" : "Your choices will be saved with this meal in the cart"}</Text></View></View><Text style={styles.ingredientGroupLabel}>{language === "ar" ? "إضافة مكونات" : "Add ingredients"}</Text><View style={styles.ingredientOptionGrid}>{addIngredientOptions.map((option) => { const selected = selectedAdditions.includes(option.id); return <Pressable key={`add-${option.id}`} onPress={() => toggle(option.id, "add")} style={[styles.ingredientOption, selected && styles.ingredientOptionSelected]}><MaterialIcons name={option.icon} size={17} color={selected ? "#FFFFFF" : "#236B45"} /><Text style={[styles.ingredientOptionText, selected && styles.ingredientOptionTextSelected]}>{getLocalized(option.label, language)}</Text><MaterialIcons name={selected ? "check-circle" : "add-circle-outline"} size={16} color={selected ? "#D9F99D" : "#A4BDA7"} /></Pressable>; })}</View><Text style={styles.ingredientGroupLabel}>{language === "ar" ? "إزالة مكونات" : "Remove ingredients"}</Text><View style={styles.ingredientOptionGrid}>{removeIngredientOptions.map((option) => { const selected = selectedRemovals.includes(option.id); return <Pressable key={`remove-${option.id}`} onPress={() => toggle(option.id, "remove")} style={[styles.ingredientOption, selected && styles.ingredientOptionRemoveSelected]}><MaterialIcons name={option.icon} size={17} color={selected ? "#8A6516" : "#236B45"} /><Text style={[styles.ingredientOptionText, selected && styles.ingredientOptionRemoveTextSelected]}>{getLocalized(option.label, language)}</Text><MaterialIcons name={selected ? "check-circle" : "remove-circle-outline"} size={16} color={selected ? "#C88A16" : "#A4BDA7"} /></Pressable>; })}</View><Text style={styles.ingredientGroupLabel}>{language === "ar" ? "ملاحظات إضافية" : "Extra notes"}</Text><View style={styles.specialRequestInputWrap}><MaterialIcons name="edit-note" size={20} color="#236B45" /><TextInput value={notes} onChangeText={setNotes} placeholder={language === "ar" ? "مثال: الصلصة على الجانب..." : "Example: sauce on the side..."} placeholderTextColor="#A4BDA7" multiline maxLength={180} style={styles.specialRequestInput} textAlign={language === "ar" ? "right" : "left"} /></View></ScrollView>}<Pressable onPress={submit} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{language === "ar" ? "أضف للسلة" : "Add to cart"}</Text><MaterialIcons name="shopping-cart" size={18} color="#FFFFFF" /></Pressable></View></View></Modal>;
}

function CheckoutModal({ visible, initialSpecialRequests, onClose, onComplete }: { visible: boolean; initialSpecialRequests: string; onClose: () => void; onComplete: () => void }) {
  const { language, placeOrder, cartTotal } = useApp();
  const pricing = getOrderPricing(cartTotal, 1.25);
  const [payment, setPayment] = useState<"cod" | "cliq" | "wallet">("cod");
  const [schedule, setSchedule] = useState<"now" | "scheduled">("now");
  const [specialRequests, setSpecialRequests] = useState("");
  const [selectedAdditions, setSelectedAdditions] = useState<string[]>([]);
  const [selectedRemovals, setSelectedRemovals] = useState<string[]>([]);

  useEffect(() => {
    if (visible) setSpecialRequests(initialSpecialRequests);
  }, [initialSpecialRequests, visible]);

  const buildSpecialRequests = () => {
    const additions = selectedAdditions.map((id) => addIngredientOptions.find((option) => option.id === id)).filter(Boolean).map((option) => getLocalized(option!.label, language));
    const removals = selectedRemovals.map((id) => removeIngredientOptions.find((option) => option.id === id)).filter(Boolean).map((option) => getLocalized(option!.label, language));
    return [additions.length ? `${language === "ar" ? "إضافة" : "Add"}: ${additions.join(language === "ar" ? "، " : ", ")}` : "", removals.length ? `${language === "ar" ? "إزالة" : "Remove"}: ${removals.join(language === "ar" ? "، " : ", ")}` : "", specialRequests.trim()].filter(Boolean).join(" · ");
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}><View style={styles.checkoutSheet}>
        <View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={styles.sheetEyebrow}>{language === "ar" ? "آخر خطوة" : "One last step"}</Text><Text style={styles.sheetTitle}>{language === "ar" ? "تأكيد الطلب" : "Confirm order"}</Text></View><Pressable onPress={onClose} style={styles.closeButton}><MaterialIcons name="close" size={20} color="#132218" /></Pressable></View>
        <Text style={styles.optionLabel}>{language === "ar" ? "متى بتحبي يوصل؟" : "When should it arrive?"}</Text>
        <View style={styles.optionRow}>{(["now", "scheduled"] as const).map((item) => <OptionCard key={item} selected={schedule === item} onPress={() => setSchedule(item)} icon={item === "now" ? "bolt" : "event"} title={t(scheduleLabels[item], language)} subtitle={item === "now" ? (language === "ar" ? "٤٥ دقيقة تقريباً" : "About 45 min") : (language === "ar" ? "مناسب للعزائم" : "Great for gatherings")} />)}</View>
        <Text style={styles.optionLabel}>{language === "ar" ? "طريقة الدفع" : "Payment method"}</Text>
        <View style={styles.paymentList}>{(["cod", "cliq", "wallet"] as const).map((item) => <Pressable key={item} onPress={() => setPayment(item)} style={[styles.paymentOption, payment === item && styles.paymentOptionActive]}><View style={[styles.paymentIcon, payment === item && styles.paymentIconActive]}><MaterialIcons name={item === "cod" ? "payments" : item === "cliq" ? "account-balance" : "wallet"} size={18} color={payment === item ? "#FFFFFF" : "#236B45"} /></View><View style={styles.paymentCopy}><Text style={styles.paymentTitle}>{t(paymentLabels[item], language)}</Text><Text style={styles.paymentSubtitle}>{item === "cod" ? (language === "ar" ? "ادفعي عند الباب" : "Pay at the door") : item === "cliq" ? (language === "ar" ? "تحويل فوري وآمن" : "Instant and secure transfer") : (language === "ar" ? "زين كاش، أورانج موني" : "Zain Cash, Orange Money")}</Text></View><MaterialIcons name={payment === item ? "radio-button-checked" : "radio-button-unchecked"} size={22} color={payment === item ? "#236B45" : "#A4BDA7"} /></Pressable>)}</View>
        <Text style={styles.optionLabel}>{language === "ar" ? "تخصيص الوجبة (اختياري)" : "Customize your meal (optional)"}</Text>
        <Text style={styles.ingredientGroupLabel}>{language === "ar" ? "إضافة مكونات" : "Add ingredients"}</Text>
        <View style={styles.ingredientOptionGrid}>{addIngredientOptions.map((option) => { const selected = selectedAdditions.includes(option.id); return <Pressable key={option.id} onPress={() => setSelectedAdditions((current) => selected ? current.filter((id) => id !== option.id) : [...current, option.id])} style={[styles.ingredientOption, selected && styles.ingredientOptionSelected]}><MaterialIcons name={option.icon} size={17} color={selected ? "#FFFFFF" : "#236B45"} /><Text style={[styles.ingredientOptionText, selected && styles.ingredientOptionTextSelected]}>{getLocalized(option.label, language)}</Text><MaterialIcons name={selected ? "check-circle" : "add-circle-outline"} size={16} color={selected ? "#D9F99D" : "#A4BDA7"} /></Pressable>; })}</View>
        <Text style={styles.ingredientGroupLabel}>{language === "ar" ? "إزالة مكونات" : "Remove ingredients"}</Text>
        <View style={styles.ingredientOptionGrid}>{removeIngredientOptions.map((option) => { const selected = selectedRemovals.includes(option.id); return <Pressable key={option.id} onPress={() => setSelectedRemovals((current) => selected ? current.filter((id) => id !== option.id) : [...current, option.id])} style={[styles.ingredientOption, selected && styles.ingredientOptionRemoveSelected]}><MaterialIcons name={option.icon} size={17} color={selected ? "#8A6516" : "#236B45"} /><Text style={[styles.ingredientOptionText, selected && styles.ingredientOptionRemoveTextSelected]}>{getLocalized(option.label, language)}</Text><MaterialIcons name={selected ? "check-circle" : "remove-circle-outline"} size={16} color={selected ? "#C88A16" : "#A4BDA7"} /></Pressable>; })}</View>
        <View style={styles.specialRequestInputWrap}><MaterialIcons name="edit-note" size={20} color="#236B45" /><TextInput value={specialRequests} onChangeText={setSpecialRequests} placeholder={language === "ar" ? "ملاحظات إضافية: الصلصة على الجانب..." : "Extra notes: sauce on the side..."} placeholderTextColor="#A4BDA7" multiline maxLength={180} style={styles.specialRequestInput} textAlign={language === "ar" ? "right" : "left"} /></View>
        <View style={styles.sheetPriceBreakdown}><SummaryRow label={language === "ar" ? "قيمة الطعام" : "Food subtotal"} value={formatJod(pricing.subtotal, language)} /><SummaryRow label={language === "ar" ? "التوصيل" : "Delivery"} value={formatJod(pricing.deliveryFee, language)} /><SummaryRow label={language === "ar" ? "عمولة المنصة (٥٪)" : "Platform commission (5%)"} value={formatJod(pricing.commission, language)} /></View><View style={styles.sheetTotal}><Text style={styles.sheetTotalLabel}>{language === "ar" ? "الإجمالي النهائي" : "Final total"}</Text><Text style={styles.sheetTotalValue}>{formatJod(pricing.grandTotal, language)}</Text></View>
        <Pressable onPress={() => { placeOrder(payment, schedule, buildSpecialRequests()); onComplete(); }} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{language === "ar" ? "أكّد واطلب" : "Confirm order"}</Text><MaterialIcons name="check" size={18} color="#FFFFFF" /></Pressable>
      </View></View>
    </Modal>
  );
}

function OrdersScreen({ onBack }: { onBack: () => void }) {
  const { language, activeOrder, advanceOrder, rateOrder, showToast } = useApp();
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
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#132218" /></Pressable><View><Text style={styles.pageTitle}>{language === "ar" ? "طلباتي" : "My orders"}</Text><Text style={styles.pageSubtitle}>{language === "ar" ? "كل لقمة إلها حكاية" : "Every bite has a story"}</Text></View><View style={styles.statusPill}><View style={styles.liveDot} /><Text style={styles.statusPillText}>{language === "ar" ? "مباشر" : "Live"}</Text></View></View>
      {activeOrder ? <>
        <View style={styles.orderHero}><View><Text style={styles.orderHeroEyebrow}>{language === "ar" ? "رقم الطلب" : "Order number"}</Text><Text style={styles.orderHeroId}>{activeOrder.id}</Text></View><View style={styles.orderEta}><Text style={styles.orderEtaLabel}>{language === "ar" ? "الوصول المتوقع" : "Estimated arrival"}</Text><Text style={styles.orderEtaValue}>{getLocalized(activeOrder.eta, language)}</Text></View></View>
                <MapPreview pickupCoordinates={activeOrder.pickupCoordinates} dropoffCoordinates={activeOrder.dropoffCoordinates} />
        {driver && <View style={styles.customerDriverCard}><View style={styles.customerDriverHeader}><View style={styles.driverAvatar}><MaterialIcons name="two-wheeler" size={22} color="#FFFFFF" /></View><View style={styles.customerDriverCopy}><Text style={styles.customerDriverEyebrow}>{language === "ar" ? "مندوبك بالطريق" : "Your driver is on the way"}</Text><Text style={styles.customerDriverName}>{getLocalized(driver.name, language)}</Text><Text style={styles.customerDriverMeta}>{getLocalized(driver.vehicle, language)} · {language === "ar" ? "لوحة" : "Plate"} {driver.plate}</Text></View><Pressable onPress={() => void callDriver()} style={({ pressed }) => [styles.callDriverButton, pressed && styles.pressed]}><MaterialIcons name="phone" size={18} color="#FFFFFF" /></Pressable></View><View style={styles.customerDriverStats}><View><Text style={styles.customerDriverStatLabel}>{language === "ar" ? "الوقت المتبقي" : "Time remaining"}</Text><Text style={styles.customerDriverStatValue}>{getLocalized(activeOrder.eta, language)}</Text></View><View><Text style={styles.customerDriverStatLabel}>{language === "ar" ? "من المطبخ" : "From kitchen"}</Text><Text style={styles.customerDriverStatValue}>{activeOrder.pickupCoordinates.latitude.toFixed(4)}, {activeOrder.pickupCoordinates.longitude.toFixed(4)}</Text></View><View><Text style={styles.customerDriverStatLabel}>{language === "ar" ? "التوصيل إلى" : "Delivering to"}</Text><Text style={styles.customerDriverStatValue}>{activeOrder.dropoffCoordinates.latitude.toFixed(4)}, {activeOrder.dropoffCoordinates.longitude.toFixed(4)}</Text></View></View></View>}
        {activeOrder.specialRequests ? <View style={styles.specialRequestCard}><MaterialIcons name="edit-note" size={19} color="#236B45" /><View style={styles.specialRequestCopy}><Text style={styles.specialRequestTitle}>{language === "ar" ? "طلباتك الخاصة" : "Your special requests"}</Text><Text style={styles.specialRequestBody}>{activeOrder.specialRequests}</Text></View></View> : null}
        <View style={styles.trackingCard}>
<Text style={styles.trackingTitle}>{language === "ar" ? "وين وصل طلبك؟" : "Where is your order?"}</Text>{orderStatuses.map((status, index) => { const done = index <= currentIndex; const active = index === currentIndex; return <View key={status.id} style={styles.trackingRow}><View style={styles.trackRail}><View style={[styles.trackDot, done && styles.trackDotDone, active && styles.trackDotActive]}>{done && <MaterialIcons name="check" size={12} color="#FFFFFF" />}</View>{index < orderStatuses.length - 1 && <View style={[styles.trackLine, index < currentIndex && styles.trackLineDone]} />}</View><View style={styles.trackCopy}><Text style={[styles.trackLabel, active && styles.trackLabelActive]}>{getLocalized(status.label, language)}</Text><Text style={styles.trackCaption}>{getLocalized(status.caption, language)}</Text></View><MaterialIcons name={status.icon as IconName} size={19} color={done ? "#4F8F3B" : "#A4BDA7"} /></View>; })}</View>
        {activeOrder.status !== "delivered" && <Pressable onPress={advanceOrder} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><MaterialIcons name="refresh" size={18} color="#236B45" /><Text style={styles.secondaryButtonText}>{language === "ar" ? "تحديث حالة الطلب" : "Refresh order status"}</Text></Pressable>}
        {activeOrder.status === "delivered" && (activeOrder.restaurantRating ? <View style={styles.deliveredCard}><MaterialIcons name="check-circle" size={22} color="#4F8F3B" /><Text style={styles.deliveredText}>{language === "ar" ? `شكراً لتقييمك المطعم ${activeOrder.restaurantRating} ★` : `Thanks for rating the restaurant ${activeOrder.restaurantRating} ★`}</Text></View> : <View style={styles.ratingCard}><View style={styles.ratingHeader}><View style={styles.ratingIcon}><MaterialIcons name="storefront" size={20} color="#236B45" /></View><View style={styles.ratingCopy}><Text style={styles.ratingTitle}>{language === "ar" ? "كيف كانت تجربتك مع المطعم؟" : "How was your restaurant experience?"}</Text><Text style={styles.ratingBody}>{language === "ar" ? "ساعدي أم أحمد بتقييم صادق" : "Help Umm Ahmad with an honest review"}</Text></View></View><View style={styles.ratingStarsRow}>{[1, 2, 3, 4, 5].map((value) => <Pressable key={value} onPress={() => setRating(value)} style={styles.ratingStarButton}><MaterialIcons name="star" size={30} color={value <= rating ? "#C88A16" : "#D6E2D4"} /></Pressable>)}</View><TextInput value={review} onChangeText={setReview} placeholder={language === "ar" ? "اكتبي تعليقاً اختيارياً..." : "Write an optional comment..."} placeholderTextColor="#A4BDA7" multiline maxLength={240} style={styles.ratingInput} textAlign={language === "ar" ? "right" : "left"} /><Pressable disabled={rating === 0} onPress={() => { rateOrder(rating, review); showToast(language === "ar" ? "تم حفظ تقييم المطعم" : "Restaurant rating saved"); }} style={({ pressed }) => [styles.ratingSubmit, rating === 0 && styles.ratingSubmitDisabled, pressed && styles.pressed]}><Text style={styles.ratingSubmitText}>{language === "ar" ? "حفظ التقييم" : "Save rating"}</Text><MaterialIcons name="send" size={17} color="#FFFFFF" /></Pressable></View>)}
      </> : <EmptyOrders language={language} onBack={onBack} />}
    </ScrollView>
  );
}

function ComplaintsScreen({ onBack }: { onBack: () => void }) {
  const { language, activeOrder, complaints, addComplaint, showToast } = useApp();
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

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: 4, quality: 0.75 });
    if (!result.canceled) setImageUris(result.assets.map((asset) => asset.uri).slice(0, 4));
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== "granted") {
      showToast(language === "ar" ? "نحتاج إذن الكاميرا لإرفاق صورة" : "Camera permission is needed to attach a photo");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75 });
    if (!result.canceled && result.assets[0]?.uri) setImageUris((current) => [...current, result.assets[0].uri].slice(0, 4));
  };

  const submitComplaint = () => {
    if (subject.trim().length < 3 || description.trim().length < 8) {
      showToast(language === "ar" ? "اكتبي عنواناً ووصفاً أوضح للشكوى" : "Please add a clearer subject and description");
      return;
    }
    addComplaint({ category, subject: subject.trim(), description: description.trim(), orderId: orderId.trim() || undefined, imageUris });
    showToast(language === "ar" ? "تم إرسال الشكوى لفريق الدعم" : "Your complaint was sent to support");
    resetForm();
    setFormOpen(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#132218" /></Pressable><View><Text style={styles.eyebrow}>{language === "ar" ? "الدعم والشكاوى" : "SUPPORT & COMPLAINTS"}</Text><Text style={styles.pageTitle}>{language === "ar" ? "نحن نسمعك" : "We hear you"}</Text></View><Pressable onPress={() => { resetForm(); setFormOpen((current) => !current); }} style={styles.complaintAddButton}><MaterialIcons name={formOpen ? "close" : "add"} size={18} color="#FFFFFF" /><Text style={styles.complaintAddButtonText}>{formOpen ? (language === "ar" ? "إلغاء" : "Close") : (language === "ar" ? "شكوى جديدة" : "New complaint")}</Text></Pressable></View>
      <View style={styles.complaintHero}><View style={styles.complaintHeroIcon}><MaterialIcons name="support-agent" size={28} color="#236B45" /></View><View style={styles.complaintHeroCopy}><Text style={styles.complaintHeroTitle}>{language === "ar" ? "خلّينا نساعدك" : "Let us help"}</Text><Text style={styles.complaintHeroBody}>{language === "ar" ? "ابعثي تفاصيل المشكلة وصوراً إن وجدت، وفريق سفرة يتابعها معك خطوة بخطوة." : "Share the details and any photos. The Sufret Omi team will follow up step by step."}</Text></View></View>
      {formOpen && <View style={styles.complaintFormCard}><Text style={styles.complaintFormTitle}>{language === "ar" ? "تفاصيل الشكوى" : "Complaint details"}</Text><Text style={styles.optionLabel}>{language === "ar" ? "نوع الشكوى" : "Complaint type"}</Text><View style={styles.complaintCategoryGrid}>{complaintCategories.map((item) => <Pressable key={item.id} onPress={() => setCategory(item.id)} style={[styles.complaintCategory, category === item.id && styles.complaintCategoryActive]}><MaterialIcons name={item.icon as IconName} size={17} color={category === item.id ? "#FFFFFF" : "#236B45"} /><Text style={[styles.complaintCategoryText, category === item.id && styles.complaintCategoryTextActive]}>{getLocalized(item.label, language)}</Text></Pressable>)}</View><TextInput value={subject} onChangeText={setSubject} placeholder={language === "ar" ? "عنوان مختصر للشكوى" : "Short complaint subject"} placeholderTextColor="#A4BDA7" style={styles.complaintSubjectInput} textAlign={language === "ar" ? "right" : "left"} maxLength={80} /><TextInput value={description} onChangeText={setDescription} placeholder={language === "ar" ? "اكتبي ماذا حدث بالتفصيل..." : "Tell us what happened..."} placeholderTextColor="#A4BDA7" style={styles.complaintDescriptionInput} textAlign={language === "ar" ? "right" : "left"} multiline maxLength={800} /><TextInput value={orderId} onChangeText={setOrderId} placeholder={language === "ar" ? "رقم الطلب (اختياري) مثل SO-2408" : "Order number (optional), e.g. SO-2408"} placeholderTextColor="#A4BDA7" style={styles.complaintSubjectInput} textAlign={language === "ar" ? "right" : "left"} maxLength={24} /><Text style={styles.complaintAttachLabel}>{language === "ar" ? `صور مرفقة (${imageUris.length}/4)` : `Attachments (${imageUris.length}/4)`}</Text><View style={styles.complaintAttachActions}><Pressable onPress={pickImages} style={({ pressed }) => [styles.complaintAttachButton, pressed && styles.pressed]}><MaterialIcons name="photo-library" size={18} color="#236B45" /><Text style={styles.complaintAttachText}>{language === "ar" ? "من الصور" : "Photo library"}</Text></Pressable><Pressable onPress={takePhoto} style={({ pressed }) => [styles.complaintAttachButton, pressed && styles.pressed]}><MaterialIcons name="photo-camera" size={18} color="#236B45" /><Text style={styles.complaintAttachText}>{language === "ar" ? "التقاط صورة" : "Take photo"}</Text></Pressable></View>{imageUris.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.complaintImageRow}>{imageUris.map((uri, index) => <View key={`${uri}-${index}`} style={styles.complaintImageWrap}><Image source={{ uri }} style={styles.complaintImage} /><Pressable onPress={() => setImageUris((current) => current.filter((_, imageIndex) => imageIndex !== index))} style={styles.complaintImageRemove}><MaterialIcons name="close" size={13} color="#FFFFFF" /></Pressable></View>)}</ScrollView>}<Pressable onPress={submitComplaint} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{language === "ar" ? "إرسال الشكوى" : "Send complaint"}</Text><MaterialIcons name="send" size={18} color="#FFFFFF" /></Pressable></View>}
      <View style={styles.complaintsSectionHeader}><View><Text style={styles.sectionTitle}>{language === "ar" ? "شكاواي" : "My complaints"}</Text><Text style={styles.complaintsSectionHint}>{complaints.length ? (language === "ar" ? `${complaints.length} شكوى محفوظة` : `${complaints.length} saved complaints`) : (language === "ar" ? "تابعي حالة كل طلب دعم" : "Track every support request")}</Text></View>{complaints.length > 0 && <MaterialIcons name="history" size={21} color="#4F8F3B" />}</View>
      {complaints.length === 0 ? <View style={styles.complaintEmptyCard}><MaterialIcons name="forum" size={32} color="#4F8F3B" /><Text style={styles.emptyTitle}>{language === "ar" ? "ما عندك شكاوى حالياً" : "No complaints yet"}</Text><Text style={styles.emptyBody}>{language === "ar" ? "إذا واجهتك أي مشكلة، أرسليها من زر شكوى جديدة." : "If anything goes wrong, send it from New complaint."}</Text><Pressable onPress={() => setFormOpen(true)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{language === "ar" ? "ابدئي شكوى" : "Start a complaint"}</Text></Pressable></View> : <View style={styles.complaintList}>{complaints.map((complaint) => { const categoryItem = complaintCategories.find((item) => item.id === complaint.category); return <View key={complaint.id} style={styles.complaintCard}><View style={styles.complaintCardTop}><View style={styles.complaintCardIcon}><MaterialIcons name={(categoryItem?.icon ?? "help-outline") as IconName} size={18} color="#236B45" /></View><View style={styles.complaintCardCopy}><Text style={styles.complaintCardCategory}>{categoryItem ? getLocalized(categoryItem.label, language) : complaint.category}</Text><Text style={styles.complaintCardTitle}>{complaint.subject}</Text></View><View style={[styles.complaintStatus, complaint.status === "resolved" || complaint.status === "closed" ? styles.complaintStatusResolved : complaint.status === "in_review" ? styles.complaintStatusReview : styles.complaintStatusNew]}><Text style={styles.complaintStatusText}>{getLocalized(complaintStatuses[complaint.status], language)}</Text></View></View><Text style={styles.complaintCardDescription}>{complaint.description}</Text><View style={styles.complaintCardMeta}><Text style={styles.complaintCardMetaText}>{complaint.id}</Text>{complaint.orderId && <Text style={styles.complaintCardMetaText}>{complaint.orderId}</Text>}<Text style={styles.complaintCardMetaText}>{new Date(complaint.createdAt).toLocaleDateString(language === "ar" ? "ar-JO" : "en-US")}</Text></View>{complaint.imageUris.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.complaintImageRow}>{complaint.imageUris.map((uri, index) => <Image key={`${complaint.id}-${index}`} source={{ uri }} style={styles.complaintListImage} />)}</ScrollView>}{complaint.response && <View style={styles.complaintResponse}><MaterialIcons name="support-agent" size={16} color="#236B45" /><Text style={styles.complaintResponseText}>{complaint.response}</Text></View>}</View>; })}</View>}
    </ScrollView>
  );
}

function MotherDashboard({ onBack }: { onBack: () => void }) {
  const { language, kitchenOpen, toggleKitchen, incomingOrder, acceptIncomingOrder, rejectIncomingOrder, requestPayout, lastPayout, setRole, motherVerification, complaints, updateComplaintStatus, showToast } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const incomingPricing = incomingOrder ? getOrderPricing(totalCart(incomingOrder.items), incomingOrder.deliveryFee ?? 1.25) : null;
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#132218" /></Pressable><View><Text style={styles.eyebrow}>{language === "ar" ? "لوحة الأم" : "MOTHER'S TABLE"}</Text><Text style={styles.pageTitle}>{language === "ar" ? "صباح الخير يا أم أحمد" : "Good morning, Umm Ahmad"}</Text></View><Pressable onPress={() => { setRole("customer"); onBack(); }} style={styles.roleIcon}><MaterialIcons name="person-outline" size={20} color="#236B45" /></Pressable></View>
      <View style={styles.dashboardHero}><View><Text style={styles.dashboardOverline}>{language === "ar" ? "حالة المطبخ" : "Kitchen status"}</Text><Text style={styles.dashboardTitle}>{kitchenOpen ? (language === "ar" ? "مطبخك مفتوح" : "Your kitchen is open") : (language === "ar" ? "المطبخ مغلق" : "Kitchen is closed")}</Text><Text style={styles.dashboardBody}>{kitchenOpen ? (language === "ar" ? "جاهزة تستقبلي طلبات الجيران" : "Ready to welcome neighborhood orders") : (language === "ar" ? "افتحيه لما تكوني جاهزة" : "Open it when you're ready")}</Text></View><Switch value={kitchenOpen} onValueChange={toggleKitchen} trackColor={{ false: "#D6E2D4", true: "#B8F000" }} thumbColor={kitchenOpen ? "#4F8F3B" : "#5E7665"} /></View>
      <View style={styles.earningsRow}><DashboardMetric label={language === "ar" ? "طلبات اليوم" : "Today's orders"} value="12" icon="receipt-long" /><DashboardMetric label={language === "ar" ? "أرباح الشهر" : "This month"} value={language === "ar" ? "٤٨٦ د.أ" : "JOD 486"} icon="trending-up" /><DashboardMetric label={language === "ar" ? "التقييم" : "Rating"} value="4.9" icon="star" /></View>
      <View style={styles.capacitySettingsCard}><View style={styles.capacitySettingsIcon}><MaterialIcons name="inventory-2" size={19} color="#236B45" /></View><View style={styles.capacitySettingsCopy}><Text style={styles.capacitySettingsTitle}>{language === "ar" ? "إعدادات حجم الطلب" : "Order-size settings"}</Text><Text style={styles.capacitySettingsBody}>{motherVerification.mealSize && motherVerification.deliveryCapacity ? `${getLocalized(mealSizeLabels[motherVerification.mealSize], language)} · ${getLocalized(loadCapacityLabels[motherVerification.deliveryCapacity], language)}` : language === "ar" ? "أكملي حجم الوجبات وسعة التوصيل من ملف التحقق" : "Complete meal size and delivery capacity in verification"}</Text></View><MaterialIcons name="tune" size={18} color="#4F8F3B" /></View>
      {incomingOrder && <View style={styles.incomingCard}><View style={styles.incomingTop}><View><Text style={styles.incomingEyebrow}>{language === "ar" ? "طلب جديد" : "New order"}</Text><Text style={styles.incomingId}>{incomingOrder.id}</Text></View><View style={styles.newPill}><Text style={styles.newPillText}>{language === "ar" ? "جديد" : "NEW"}</Text></View></View><Text style={styles.incomingTitle}>{incomingOrder.items.map((item) => `${item.quantity}× ${getLocalized(item.meal.name, language)}`).join("، ")}</Text><Text style={styles.incomingMeta}>{getLocalized(incomingOrder.eta, language)} · {formatJod(incomingOrder.total, language)} · {t(paymentLabels[incomingOrder.paymentMethod], language)}</Text>{incomingOrder.specialRequests ? <View style={styles.specialRequestCard}><MaterialIcons name="edit-note" size={18} color="#8A6516" /><View style={styles.specialRequestCopy}><Text style={styles.specialRequestTitle}>{language === "ar" ? "طلبات العميل الخاصة" : "Customer special requests"}</Text><Text style={styles.specialRequestBody}>{incomingOrder.specialRequests}</Text></View></View> : null}{incomingPricing && <View style={styles.earningsBreakdown}><SummaryRow label={language === "ar" ? "قيمة الطعام" : "Food subtotal"} value={formatJod(incomingPricing.subtotal, language)} /><SummaryRow label={language === "ar" ? "عمولة المنصة (٥٪)" : "Platform commission (5%)"} value={`-${formatJod(incomingPricing.commission, language)}`} /><View style={styles.summaryDivider} /><SummaryRow label={language === "ar" ? "صافي أرباحك" : "Your payout"} value={formatJod(incomingPricing.motherPayout, language)} strong /></View>}{incomingOrder.status === "received" ? <View style={styles.incomingActions}><Pressable onPress={rejectIncomingOrder} style={styles.rejectButton}><Text style={styles.rejectText}>{language === "ar" ? "رفض" : "Decline"}</Text></Pressable><Pressable onPress={acceptIncomingOrder} style={styles.acceptButton}><Text style={styles.acceptText}>{language === "ar" ? "قبول الطلب" : "Accept order"}</Text><MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" /></Pressable></View> : <View style={styles.prepNotice}><MaterialIcons name="soup-kitchen" size={18} color="#4F8F3B" /><Text style={styles.prepNoticeText}>{language === "ar" ? "الطلب قيد التحضير - وقت التسليم ٤٥ دقيقة" : "Preparing - ready in 45 minutes"}</Text></View>}</View>}
      <SectionHeader title={language === "ar" ? "شكاوى العملاء" : "Customer complaints"} action={complaints.length ? (language === "ar" ? "تحديث" : "Update") : ""} onAction={complaints.length ? () => { const next = complaints.find((complaint) => complaint.status === "new") ?? complaints.find((complaint) => complaint.status === "in_review"); if (next) { updateComplaintStatus(next.id, next.status === "new" ? "in_review" : "resolved", next.status === "new" ? (language === "ar" ? "تم استلام شكواك ونراجعها الآن." : "We received your complaint and are reviewing it.") : (language === "ar" ? "تمت معالجة الشكوى." : "The complaint has been addressed.")); showToast(language === "ar" ? "تم تحديث حالة الشكوى" : "Complaint status updated"); } } : undefined} />
      {complaints.length ? <View style={styles.complaintInbox}>{complaints.slice(0, 3).map((complaint) => { const categoryItem = complaintCategories.find((item) => item.id === complaint.category); return <View key={complaint.id} style={styles.complaintInboxRow}><View style={styles.complaintInboxIcon}><MaterialIcons name={(categoryItem?.icon ?? "help-outline") as IconName} size={16} color="#236B45" /></View><View style={styles.complaintInboxCopy}><Text style={styles.complaintInboxTitle}>{complaint.subject}</Text><Text style={styles.complaintInboxMeta}>{complaint.id} · {getLocalized(complaintStatuses[complaint.status], language)}{complaint.imageUris.length ? ` · ${complaint.imageUris.length} ${language === "ar" ? "صور" : "photos"}` : ""}</Text></View><Pressable onPress={() => { const nextStatus = complaint.status === "new" ? "in_review" : complaint.status === "in_review" ? "resolved" : complaint.status; updateComplaintStatus(complaint.id, nextStatus, nextStatus === "resolved" ? (language === "ar" ? "تمت معالجة الشكوى من فريق سفرة." : "The Sufret Omi team addressed this complaint.") : undefined); showToast(language === "ar" ? "تم تحديث الشكوى" : "Complaint updated"); }} style={styles.complaintInboxAction}><Text style={styles.complaintInboxActionText}>{complaint.status === "new" ? (language === "ar" ? "مراجعة" : "Review") : complaint.status === "in_review" ? (language === "ar" ? "حل" : "Resolve") : (language === "ar" ? "تمت" : "Done")}</Text></Pressable></View>; })}</View> : <View style={styles.supportEmptyCard}><MaterialIcons name="check-circle" size={20} color="#4F8F3B" /><Text style={styles.supportEmptyText}>{language === "ar" ? "لا توجد شكاوى جديدة على مطبخك" : "No new complaints for your kitchen"}</Text></View>}
      <SectionHeader title={language === "ar" ? "إدارة مطبخك" : "Manage your kitchen"} action={language === "ar" ? "عرض القائمة" : "View menu"} onAction={() => setMenuOpen((value) => !value)} />
      <View style={styles.dashboardList}><DashboardAction icon="restaurant-menu" title={language === "ar" ? "قائمة الأكلات" : "Menu items"} detail={language === "ar" ? "٥ أكلات · ٤ متاحة" : "5 meals · 4 available"} onPress={() => setMenuOpen((value) => !value)} /><DashboardAction icon="event" title={language === "ar" ? "طلبات مسبقة" : "Advance orders"} detail={language === "ar" ? "مناسبات الجمعة" : "Friday gatherings"} onPress={() => undefined} /><DashboardAction icon="account-balance" title={language === "ar" ? "الأرباح و CliQ" : "Earnings & CliQ"} detail={lastPayout ? (language === "ar" ? "طلب التحويل قيد المعالجة" : "Payout processing") : (language === "ar" ? "٣٨٦ د.أ جاهزة للتحويل" : "JOD 386 ready to payout")} onPress={() => requestPayout(386)} /> </View>
      {menuOpen && <View style={styles.menuManager}>{getKitchenMeals("umm-ahmad").map((meal) => <View key={meal.id} style={styles.menuManagerRow}><Image source={{ uri: meal.image }} style={styles.menuThumb} /><View style={styles.menuManagerCopy}><Text style={styles.menuManagerName}>{getLocalized(meal.name, language)}</Text><Text style={styles.menuManagerMeta}>{formatJod(meal.price, language)} · {meal.prepMinutes} min</Text></View><View style={styles.menuStatus}><View style={styles.openDot} /><Text style={styles.menuStatusText}>{language === "ar" ? "متاحة" : "Live"}</Text></View></View>)}</View>}
      <View style={styles.cliqCard}><View style={styles.cliqBadge}><Text style={styles.cliqBadgeText}>CliQ</Text></View><View style={styles.cliqCopy}><Text style={styles.cliqTitle}>{language === "ar" ? "حوّلي أرباحك بسهولة" : "Move your earnings easily"}</Text><Text style={styles.cliqBody}>{language === "ar" ? "آخر تحويل إلى 079 ••• 6281" : "Last payout to 079 ••• 6281"}</Text></View><MaterialIcons name="chevron-right" size={20} color="#4F8F3B" /></View>
    </ScrollView>
  );
}

function ProfileScreen({ onRoleChange, onDashboard, onSupport }: { onRoleChange: () => void; onDashboard: () => void; onSupport: () => void }) {
  const { language, setLanguage, selectedRegion, setSelectedRegion, signOut } = useApp();
  const nextRegion = () => { const index = regions.findIndex((item) => item.id === selectedRegion); setSelectedRegion(regions[(index + 1) % regions.length].id); };
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}><View style={styles.profileHeader}><Image source={require("@/assets/images/icon.png")} style={styles.profileAvatar} /><View><Text style={styles.profileGreeting}>{language === "ar" ? "أهلاً سارة" : "Hi Sara"}</Text><Text style={styles.profileMuted}>{language === "ar" ? "خلدا، عمّان" : "Khalda, Amman"}</Text></View><Pressable onPress={onRoleChange} style={styles.switchRoleButton}><MaterialIcons name="swap-horiz" size={16} color="#236B45" /><Text style={styles.switchRoleText}>{language === "ar" ? "وضع الأم" : "Mother mode"}</Text></Pressable></View><Pressable onPress={onDashboard} style={styles.profileDashboardCard}><View style={styles.profileDashboardIcon}><MaterialIcons name="grid-view" size={20} color="#FFFFFF" /></View><View style={styles.profileDashboardCopy}><Text style={styles.profileDashboardTitle}>{language === "ar" ? "لوحة التحكم" : "Dashboard"}</Text><Text style={styles.profileDashboardBody}>{language === "ar" ? "تابعي طلباتك ومطابخك وعناوينك" : "Manage orders, kitchens, and addresses"}</Text></View><MaterialIcons name="chevron-right" size={20} color="#FFFFFF" /></Pressable><View style={styles.settingsCard}><SettingRow icon="language" label={language === "ar" ? "اللغة" : "Language"} value={language === "ar" ? "العربية" : "English"} onPress={() => setLanguage(language === "ar" ? "en" : "ar")} /><SettingRow icon="location-on" label={language === "ar" ? "منطقتي" : "My area"} value={getLocalized(getRegion(selectedRegion).label, language)} onPress={nextRegion} /><SettingRow icon="notifications-none" label={language === "ar" ? "الإشعارات" : "Notifications"} value={language === "ar" ? "مفعّلة" : "On"} onPress={() => undefined} /><SettingRow icon="help-outline" label={language === "ar" ? "شكاوى ومساعدة" : "Complaints & help"} value={language === "ar" ? "إرسال ومتابعة شكوى" : "Send and track a complaint"} onPress={onSupport} /><SettingRow icon="logout" label={language === "ar" ? "تسجيل الخروج" : "Log out"} value={language === "ar" ? "الخروج من الحساب" : "Sign out"} onPress={signOut} /></View><View style={styles.aboutCard}><Text style={styles.aboutTitle}>{language === "ar" ? "من بيت أردني لكل بيت" : "From a Jordanian home to every home"}</Text><Text style={styles.aboutBody}>{language === "ar" ? "سفرة أمي تجمعك بأمهات يطبخوا بحب، عشان تضلّ لَمّة البيت على أحلى سفرة." : "Sufret Omi connects you with mothers who cook with care, keeping family time around a generous table."}</Text></View></ScrollView>;
}

function BottomNav({ active, onNavigate, role, language }: { active: ViewId; onNavigate: (view: ViewId) => void; role: Role; language: "ar" | "en" }) {
  const items: { id: ViewId; label: string; icon: IconName }[] = [{ id: "home", label: language === "ar" ? "الرئيسية" : "Home", icon: "home" }, { id: "discover", label: language === "ar" ? "اكتشفي" : "Explore", icon: "explore" }, { id: "orders", label: language === "ar" ? "طلباتي" : "Orders", icon: "receipt-long" }, { id: "profile", label: language === "ar" ? "حسابي" : "Profile", icon: "person-outline" }];
  return <View style={styles.bottomNav}>{items.map((item) => <Pressable key={item.id} onPress={() => onNavigate(item.id)} style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}><MaterialIcons name={item.icon} size={21} color={active === item.id ? "#236B45" : "#A4BDA7"} /><Text style={[styles.navLabel, active === item.id && styles.navLabelActive]}>{item.label}</Text></Pressable>)}<View style={styles.navBrandDot}><MaterialIcons name={role === "mother" ? "storefront" : "restaurant"} size={18} color="#FFFFFF" /></View></View>;
}

function FloatingCart({ language, count, total, onPress, bottomOffset }: { language: "ar" | "en"; count: number; total: number; onPress: () => void; bottomOffset: number }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.floatingCart, { bottom: bottomOffset }, pressed && styles.pressed]}><View><Text style={styles.floatingCartEyebrow}>{language === "ar" ? `${count} وجبة في السلة` : `${count} meals in cart`}</Text><Text style={styles.floatingCartPrice}>{formatJod(total, language)}</Text></View><View style={styles.floatingCartCtaWrap}><Text style={styles.floatingCartCta}>{language === "ar" ? "عرض السلة وإكمال الطلب" : "View cart & continue"}</Text><MaterialIcons name="arrow-forward" size={17} color="#D9F99D" /></View></Pressable>; }

function LanguageToggle() { const { language, setLanguage } = useApp(); return <Pressable onPress={() => setLanguage(language === "ar" ? "en" : "ar")} style={styles.languageToggle}><Text style={[styles.languageText, language === "ar" && styles.languageActive]}>ع</Text><Text style={styles.languageSlash}>/</Text><Text style={[styles.languageText, language === "en" && styles.languageActive]}>EN</Text></Pressable>; }

function SectionHeader({ title, action, onAction }: { title: string; action: string; onAction?: () => void }) { return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text><Pressable onPress={onAction} disabled={!onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable></View>; }

function CategoryPill({ label, icon, color, selected, onPress }: { label: string; icon: IconName; color: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.categoryPill, selected && { backgroundColor: color, borderColor: color }, pressed && styles.pressed]}><View style={[styles.categoryIcon, { backgroundColor: selected ? "rgba(255,255,255,0.18)" : `${color}18` }]}><MaterialIcons name={icon} size={18} color={selected ? "#FFFFFF" : color} /></View><Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{label}</Text></Pressable>; }

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>; }

function MealRow({ meal, language, onAdd, onRemove, onPress, compact = false, quantity = 0 }: { meal: (typeof meals)[number]; language: "ar" | "en"; onAdd: () => void; onRemove?: () => void; onPress?: () => void; compact?: boolean; quantity?: number }) { const category = getCategory(meal.category); return <Pressable onPress={onPress} style={({ pressed }) => [styles.mealRow, compact && styles.mealRowCompact, pressed && styles.pressed]}><Image source={{ uri: meal.image }} style={compact ? styles.mealImageCompact : styles.mealImage} /><View style={styles.mealCopy}><View style={styles.mealCategoryLine}><Text style={[styles.mealCategory, { color: category.color }]}>{getLocalized(category.label, language)}</Text><Text style={styles.mealPrep}>{meal.prepMinutes} min</Text></View><Text style={styles.mealName} numberOfLines={1}>{getLocalized(meal.name, language)}</Text><Text style={styles.mealDescription} numberOfLines={1}>{getLocalized(meal.description, language)}</Text><Text style={styles.mealPrice}>{formatJod(meal.price, language)}</Text></View><View style={styles.mealAddColumn}>{quantity > 0 && <View style={styles.quantityBadge}><Text style={styles.quantityBadgeText}>{quantity}</Text><Text style={styles.quantityBadgeLabel}>{language === "ar" ? "وجبة" : "meals"}</Text></View>}<View style={styles.quantityStepper}>{quantity > 0 && <Pressable onPress={onRemove} style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}><MaterialIcons name="remove" size={18} color="#236B45" /></Pressable>}<Pressable onPress={onAdd} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><MaterialIcons name="add" size={21} color="#FFFFFF" /></Pressable></View></View></Pressable>; }

function CartItemRow({ item, language, onUpdate }: { item: { meal: (typeof meals)[number]; quantity: number; specialRequests?: string }; language: "ar" | "en"; onUpdate: (mealId: string, quantity: number, specialRequests?: string) => void }) { return <View style={styles.cartItemRow}><Image source={{ uri: item.meal.image }} style={styles.cartItemImage} /><View style={styles.cartItemCopy}><Text style={styles.cartItemName}>{getLocalized(item.meal.name, language)}</Text>{item.specialRequests ? <View style={styles.cartItemRequest}><MaterialIcons name="tune" size={13} color="#8A6516" /><Text style={styles.cartItemRequestText}>{item.specialRequests}</Text></View> : null}<Text style={styles.cartItemPrice}>{formatJod(item.meal.price * item.quantity, language)}</Text><View style={styles.quantityControl}><Pressable onPress={() => onUpdate(item.meal.id, item.quantity - 1, item.specialRequests)} style={styles.quantityButton}><MaterialIcons name="remove" size={15} color="#236B45" /></Pressable><Text style={styles.quantityText}>{item.quantity}</Text><Pressable onPress={() => onUpdate(item.meal.id, item.quantity + 1, item.specialRequests)} style={styles.quantityButton}><MaterialIcons name="add" size={15} color="#236B45" /></Pressable></View></View></View>; }

function StatItem({ icon, value, label }: { icon: IconName; value: string; label: string }) { return <View style={styles.statItem}><MaterialIcons name={icon} size={16} color="#236B45" /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <View style={styles.summaryRow}><Text style={[styles.summaryLabel, strong && styles.summaryStrong]}>{label}</Text><Text style={[styles.summaryValue, strong && styles.summaryStrong]}>{value}</Text></View>; }
function OptionCard({ selected, onPress, icon, title, subtitle }: { selected: boolean; onPress: () => void; icon: IconName; title: string; subtitle: string }) { return <Pressable onPress={onPress} style={[styles.optionCard, selected && styles.optionCardActive]}><MaterialIcons name={icon} size={19} color={selected ? "#FFFFFF" : "#236B45"} /><Text style={[styles.optionCardTitle, selected && styles.optionCardTitleActive]}>{title}</Text><Text style={[styles.optionCardSubtitle, selected && styles.optionCardSubtitleActive]}>{subtitle}</Text></Pressable>; }
function DashboardMetric({ label, value, icon }: { label: string; value: string; icon: IconName }) { return <View style={styles.dashboardMetric}><MaterialIcons name={icon} size={17} color="#236B45" /><Text style={styles.dashboardMetricValue}>{value}</Text><Text style={styles.dashboardMetricLabel}>{label}</Text></View>; }
function DashboardTile({ icon, title, detail, onPress }: { icon: IconName; title: string; detail: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.dashboardTile, pressed && styles.pressed]}><View style={styles.dashboardTileIcon}><MaterialIcons name={icon} size={18} color="#236B45" /></View><View><Text style={styles.dashboardTileTitle}>{title}</Text><Text style={styles.dashboardTileDetail}>{detail}</Text></View></Pressable>; }
function DashboardAction({ icon, title, detail, onPress }: { icon: IconName; title: string; detail: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.dashboardAction, pressed && styles.pressed]}><View style={styles.dashboardActionIcon}><MaterialIcons name={icon} size={19} color="#236B45" /></View><View style={styles.dashboardActionCopy}><Text style={styles.dashboardActionTitle}>{title}</Text><Text style={styles.dashboardActionDetail}>{detail}</Text></View><MaterialIcons name="chevron-right" size={20} color="#A4BDA7" /></Pressable>; }
function SettingRow({ icon, label, value, onPress }: { icon: IconName; label: string; value: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}><View style={styles.settingIcon}><MaterialIcons name={icon} size={19} color="#236B45" /></View><Text style={styles.settingLabel}>{label}</Text><Text style={styles.settingValue}>{value}</Text><MaterialIcons name="chevron-right" size={19} color="#A4BDA7" /></Pressable>; }
function EmptyState({ language }: { language: "ar" | "en" }) { return <View style={styles.emptyState}><MaterialIcons name="search-off" size={30} color="#236B45" /><Text style={styles.emptyTitle}>{language === "ar" ? "ما لقينا هالطبخة" : "No meals found"}</Text><Text style={styles.emptyBody}>{language === "ar" ? "جرّبي كلمة ثانية أو شيلي الفلتر" : "Try another search or clear the filter"}</Text></View>; }
function EmptyCart({ language, onBack }: { language: "ar" | "en"; onBack: () => void }) { return <View style={styles.emptyState}><View style={styles.emptyBasket}><MaterialIcons name="shopping-cart" size={34} color="#236B45" /></View><Text style={styles.emptyTitle}>{language === "ar" ? "السفرة فاضية" : "Your table is empty"}</Text><Text style={styles.emptyBody}>{language === "ar" ? "اختاري طبخة بيتية وخلي اللمة تبدأ" : "Pick a home-cooked meal and start the gathering"}</Text><Pressable onPress={onBack} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{language === "ar" ? "تصفّحي المطابخ" : "Browse kitchens"}</Text></Pressable></View>; }
function EmptyOrders({ language, onBack }: { language: "ar" | "en"; onBack: () => void }) { return <View style={styles.emptyState}><MaterialIcons name="receipt-long" size={34} color="#236B45" /><Text style={styles.emptyTitle}>{language === "ar" ? "لسه ما في طلبات" : "No orders yet"}</Text><Text style={styles.emptyBody}>{language === "ar" ? "أول طلب بيبدأ من مطبخ بيت" : "Your first order starts at a home kitchen"}</Text><Pressable onPress={onBack} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{language === "ar" ? "اكتشفي الأكلات" : "Discover meals"}</Text></Pressable></View>; }

const styles = StyleSheet.create({
  loginScroll: { flexGrow: 1, padding: 20, paddingBottom: 38, justifyContent: "center", gap: 16 },
  loginTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  loginIcon: { width: 48, height: 48, borderRadius: 15 },
  loginLanguage: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16, backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8" },
  loginLanguageText: { color: "#236B45", fontSize: 11, fontWeight: "900" },
  loginBrand: { alignItems: "center", gap: 2, paddingVertical: 5 },
  loginBrandArabic: { color: "#236B45", fontSize: 32, fontWeight: "900" },
  loginBrandEnglish: { color: "#132218", fontSize: 16, fontWeight: "900", letterSpacing: 1.2 },
  loginTagline: { color: "#5E7665", fontSize: 11, marginTop: 4 },
  loginCard: { backgroundColor: "#FFFFFF", borderRadius: 24, borderWidth: 1, borderColor: "#DDEAD8", padding: 17, gap: 10, shadowColor: "#132218", shadowOpacity: 0.06, shadowRadius: 13, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  loginTabs: { flexDirection: "row", backgroundColor: "#F3F9F1", borderRadius: 13, padding: 3, gap: 4 },
  loginTab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  loginTabActive: { backgroundColor: "#236B45" },
  loginTabText: { color: "#5E7665", fontSize: 11, fontWeight: "900" },
  loginTabTextActive: { color: "#FFFFFF" },
  loginTitle: { color: "#132218", fontSize: 22, fontWeight: "900", marginTop: 5 },
  loginSubtitle: { color: "#5E7665", fontSize: 11, lineHeight: 17, marginBottom: 3 },
  inputLabel: { color: "#2B4933", fontSize: 11, fontWeight: "900", marginTop: 2 },
  inputWrap: { height: 47, borderRadius: 15, borderWidth: 1, borderColor: "#DDEAD8", backgroundColor: "#F6FBF3", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  loginInput: { flex: 1, color: "#132218", fontSize: 13, paddingVertical: 0 },
  loginError: { color: "#C44545", fontSize: 10, fontWeight: "800", lineHeight: 15 },
  rolePrompt: { color: "#132218", fontSize: 11, fontWeight: "900", marginTop: 4 },
  roleChoiceRow: { flexDirection: "row", gap: 8 },
  roleChoice: { flex: 1, minHeight: 54, borderRadius: 15, borderWidth: 1, borderColor: "#DDEAD8", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", gap: 4 },
  roleChoiceActive: { backgroundColor: "#236B45", borderColor: "#236B45" },
  roleChoiceText: { color: "#2B4933", fontSize: 11, fontWeight: "900" },
  roleChoiceTextActive: { color: "#FFFFFF" },
  guestButton: { alignItems: "center", paddingVertical: 6 },
  guestButtonText: { color: "#236B45", fontSize: 11, fontWeight: "900" },
  loginTrust: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 12 },
  loginTrustText: { color: "#4F8F3B", fontSize: 10, fontWeight: "800", textAlign: "center", flex: 1 },
  logoutButton: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F0FBEA", borderRadius: 13, paddingHorizontal: 9, paddingVertical: 8 },
  logoutText: { color: "#236B45", fontSize: 10, fontWeight: "900" },
  capacitySettingsCard: { flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 17, padding: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDEAD8" },
  capacitySettingsIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#F0FBEA" },
  capacitySettingsCopy: { flex: 1 },
  capacitySettingsTitle: { color: "#132218", fontSize: 11, fontWeight: "900" },
  capacitySettingsBody: { color: "#5E7665", fontSize: 10, marginTop: 3 },
  earningsBreakdown: { gap: 7, backgroundColor: "#F7FFF0", borderRadius: 14, padding: 10, borderWidth: 1, borderColor: "#D9F99D" },
  driverHero: { borderRadius: 23, padding: 18, backgroundColor: "#F3FFE6", borderWidth: 1, borderColor: "#D9F99D", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  driverOverline: { color: "#C88A16", fontSize: 10, fontWeight: "900" },
  driverTitle: { color: "#132218", fontSize: 21, fontWeight: "900", marginTop: 5 },
  driverBody: { color: "#1B5E3A", fontSize: 11, marginTop: 4 },
  driverOrderCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 15, borderWidth: 1, borderColor: "#D9F99D", gap: 9 },
  driverOrderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  driverOrderTag: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EEF9DB", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6 },
  driverOrderTagText: { color: "#4F8F3B", fontSize: 10, fontWeight: "900" },
  driverOrderTitle: { color: "#132218", fontSize: 14, fontWeight: "900" },
  driverOrderMeta: { color: "#5E7665", fontSize: 10 },
  driverSpecialRequest: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FFFDF3", borderRadius: 14, borderWidth: 1, borderColor: "#F0D99A", padding: 10 },
  routeCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 14, borderWidth: 1, borderColor: "#DDEAD8" },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeMarker: { width: 30, height: 30, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  routeMarkerPickup: { backgroundColor: "#4F8F3B" },
  routeMarkerDropoff: { backgroundColor: "#236B45" },
  routeCopy: { flex: 1 },
  routeLabel: { color: "#5E7665", fontSize: 10, fontWeight: "800" },
  routeValue: { color: "#132218", fontSize: 12, fontWeight: "900", marginTop: 2 },
  routeCoordinates: { color: "#A4BDA7", fontSize: 10, marginTop: 3, fontVariant: ["tabular-nums"] },
  routeDistance: { color: "#236B45", fontSize: 10, fontWeight: "900", marginTop: 3 },
  driverRatingsRow: { flexDirection: "row", gap: 8 },
  driverRatingBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F7FFF0", borderRadius: 15, padding: 10, borderWidth: 1, borderColor: "#C7E8C8" },
  driverRatingLabel: { color: "#5E7665", fontSize: 9, fontWeight: "800" },
  driverRatingValue: { color: "#132218", fontSize: 13, fontWeight: "900", marginTop: 2 },
  routeLine: { width: 2, height: 19, backgroundColor: "#D9F99D", marginLeft: 14, marginVertical: 2 },
  driverActionButton: { minHeight: 52, borderRadius: 17, backgroundColor: "#C88A16", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  driverActionDisabled: { backgroundColor: "#A4BDA7" },
  capacityMatch: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 7, marginTop: 2 },
  capacityMatchOk: { backgroundColor: "#EEF9DB" },
  capacityMatchWarn: { backgroundColor: "#FFF0F0" },
  capacityMatchText: { flex: 1, color: "#4F8F3B", fontSize: 10, fontWeight: "900" },
  capacityMatchTextWarn: { color: "#C44545" },
  driverActionButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  driverDone: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#EEF9DB", borderRadius: 16, padding: 13 },
  driverDoneText: { color: "#4F8F3B", fontSize: 11, fontWeight: "900" },
  fullScreenPage: { flex: 1, backgroundColor: "#F6FBF3" },
  fullScreenHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 },
  fullScreenHeaderCopy: { flex: 1 },
  mapHeaderBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#EEF9DB", borderRadius: 14, paddingHorizontal: 9, paddingVertical: 7 },
  mapHeaderBadgeText: { color: "#4F8F3B", fontSize: 10, fontWeight: "900" },
  fullMapArea: { flex: 1, minHeight: 360 },
  discoverSheet: { backgroundColor: "#F6FBF3", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: "#DDEAD8", padding: 16, gap: 12 },
  discoverSheetHandle: { width: 38, height: 4, borderRadius: 3, backgroundColor: "#D6E2D4", alignSelf: "center" },
  discoverSheetTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  discoverEyebrow: { color: "#236B45", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  discoverTitle: { color: "#132218", fontSize: 17, fontWeight: "900", marginTop: 3 },
  discoverCount: { color: "#5E7665", fontSize: 10, fontWeight: "800", marginTop: 3 },
  nearbyPreviewRow: { flexDirection: "row", gap: 8 },
  nearbyPreview: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, padding: 9, backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: "#DDEAD8" },
  nearbyPreviewDot: { width: 8, height: 8, borderRadius: 4 },
  nearbyPreviewCopy: { flex: 1 },
  nearbyPreviewName: { color: "#132218", fontSize: 10, fontWeight: "900" },
  nearbyPreviewDistance: { color: "#5E7665", fontSize: 9, marginTop: 2 },
  mealsIntro: { padding: 15, borderRadius: 20, backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8", gap: 4 },
  mealsIntroTitle: { color: "#132218", fontSize: 19, fontWeight: "900" },
  mealsIntroBody: { color: "#1B5E3A", fontSize: 11, lineHeight: 17 },
  nearbySectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  nearbySortLabel: { color: "#4F8F3B", fontSize: 10, fontWeight: "900" },
  nearbyMealBlock: { gap: 6 },
  nearbyMealMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 8 },
  nearbyKitchenLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  nearbyKitchenLinkText: { color: "#4F8F3B", fontSize: 10, fontWeight: "900" },
  nearbyDistance: { color: "#236B45", fontSize: 10, fontWeight: "900", flexDirection: "row", alignItems: "center" },
  customerDashHero: { borderRadius: 23, padding: 18, backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  customerDashOverline: { color: "#236B45", fontSize: 10, fontWeight: "900" },
  customerDashTitle: { color: "#132218", fontSize: 22, fontWeight: "900", marginTop: 5 },
  customerDashBody: { color: "#1B5E3A", fontSize: 11, marginTop: 4 },
  customerDashIcon: { width: 62, height: 62, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  dashboardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  dashboardTile: { width: "48%", minHeight: 92, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDEAD8", padding: 12, gap: 8 },
  dashboardTileIcon: { width: 33, height: 33, borderRadius: 12, backgroundColor: "#F0FBEA", alignItems: "center", justifyContent: "center" },
  dashboardTileTitle: { color: "#132218", fontSize: 12, fontWeight: "900" },
  dashboardTileDetail: { color: "#5E7665", fontSize: 10, marginTop: 2 },
  customerOrderCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#EEF9DB", borderRadius: 18, borderWidth: 1, borderColor: "#D9F99D", padding: 12 },
  customerOrderIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  customerOrderCopy: { flex: 1 },
  customerOrderTitle: { color: "#132218", fontSize: 12, fontWeight: "900" },
  customerOrderBody: { color: "#4F8F3B", fontSize: 10, marginTop: 3 },
  recommendedKitchen: { height: 148, borderRadius: 20, overflow: "hidden", position: "relative" },
  recommendedKitchenImage: { width: "100%", height: "100%" },
  recommendedKitchenOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(28,25,23,0.32)" },
  recommendedKitchenCopy: { position: "absolute", left: 15, right: 15, bottom: 14 },
  recommendedKitchenEyebrow: { color: "#D9F99D", fontSize: 10, fontWeight: "900" },
  recommendedKitchenName: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", marginTop: 3 },
  recommendedKitchenMeta: { color: "#F0F7EF", fontSize: 11, marginTop: 3 },
  dashboardFootnote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 3 },
  dashboardFootnoteText: { color: "#5E7665", fontSize: 10, fontWeight: "800" },
  root: { flex: 1, backgroundColor: "#F6FBF3" },
  rtl: {},
  ltr: {},
  scrollContent: { padding: 18, paddingBottom: 116, gap: 18 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandCluster: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandIcon: { width: 42, height: 42, borderRadius: 13 },
  eyebrow: { fontSize: 10, letterSpacing: 1.2, color: "#236B45", fontWeight: "900" },
  headerGreeting: { color: "#132218", fontSize: 19, fontWeight: "900", marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  unifiedControlsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, marginBottom: 3 },
  unifiedSearchField: { flex: 1, minWidth: 0, height: 42, borderRadius: 15, borderWidth: 1, borderColor: "#DDEAD8", backgroundColor: "#FFFFFF", paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  unifiedSearchInput: { flex: 1, minWidth: 0, color: "#132218", fontSize: 11, paddingVertical: 0 },
  unifiedIconButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8", alignItems: "center", justifyContent: "center" },
  unifiedIconButtonActive: { backgroundColor: "#236B45", borderColor: "#236B45" },
  unifiedCartButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#236B45", alignItems: "center", justifyContent: "center", position: "relative" },
  languageToggle: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 18, backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8" },
  languageText: { fontSize: 11, color: "#748A79", fontWeight: "800" },
  languageActive: { color: "#236B45" },
  languageSlash: { color: "#B9D6BB", fontSize: 11 },
  iconButton: { width: 39, height: 39, borderRadius: 14, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#DDEAD8" },
  cartBadge: { position: "absolute", right: -3, top: -4, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: "#236B45", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#F6FBF3" },
  cartBadgeText: { fontSize: 9, color: "#FFFFFF", fontWeight: "900" },
  heroCard: { backgroundColor: "#236B45", minHeight: 190, borderRadius: 28, padding: 20, flexDirection: "row", overflow: "hidden", position: "relative" },
  heroCopy: { flex: 1, zIndex: 2 },
  heroOverline: { color: "#D9F99D", fontSize: 12, fontWeight: "800", marginBottom: 9 },
  heroTitle: { color: "#FFFFFF", fontSize: 27, lineHeight: 32, fontWeight: "900", maxWidth: 220 },
  heroBody: { color: "#E6F9C7", fontSize: 12, lineHeight: 18, marginTop: 8, maxWidth: 210 },
  heroCta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16 },
  heroCtaText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  heroArt: { width: 120, alignItems: "center", justifyContent: "center", position: "relative" },
  heroPlate: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#F7FFF0", justifyContent: "center", alignItems: "center", borderWidth: 8, borderColor: "#C7E8C8", transform: [{ rotate: "-10deg" }] },
  heroLeafOne: { width: 32, height: 15, borderRadius: 20, backgroundColor: "#B8F000", position: "absolute", right: -1, top: 35, transform: [{ rotate: "34deg" }] },
  heroLeafTwo: { width: 28, height: 13, borderRadius: 20, backgroundColor: "#4F8F3B", position: "absolute", left: 7, bottom: 31, transform: [{ rotate: "-40deg" }] },
  searchRow: { flexDirection: "row", gap: 9 },
  topSearchRow: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 12, marginBottom: 5 },
  topSearchField: { flex: 1, height: 44, borderRadius: 16, borderWidth: 1, borderColor: "#DDEAD8", backgroundColor: "#FFFFFF", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 7 },
  topSearchInput: { flex: 1, color: "#132218", fontSize: 12, paddingVertical: 0 },
  topCartButton: { width: 44, height: 44, borderRadius: 16, backgroundColor: "#236B45", alignItems: "center", justifyContent: "center", position: "relative" },
  filterOnlyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 5, marginBottom: 3 },
  filterHint: { color: "#5E7665", fontSize: 10, fontWeight: "800" },
  searchField: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDEAD8", borderRadius: 16, height: 48, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, fontSize: 13, color: "#132218", paddingVertical: 0 },
  filterButton: { width: 48, height: 48, borderRadius: 16, justifyContent: "center", alignItems: "center", backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8" },
  filterButtonActive: { backgroundColor: "#236B45", borderColor: "#236B45" },
  filterPanel: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#DDEAD8", padding: 12, gap: 8 },
  filterTitle: { fontSize: 12, fontWeight: "900", color: "#132218" },
  sortOptions: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  sortChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 15, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#F7FFF0", borderWidth: 1, borderColor: "#C7E8C8" },
  sortChipActive: { backgroundColor: "#236B45", borderColor: "#236B45" },
  sortChipText: { fontSize: 10, color: "#236B45", fontWeight: "900" },
  sortChipTextActive: { color: "#FFFFFF" },
  chipRow: { gap: 8 },
  chip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#F3F9F1", borderWidth: 1, borderColor: "#DDEAD8" },
  chipSelected: { backgroundColor: "#4F8F3B", borderColor: "#4F8F3B" },
  chipText: { fontSize: 11, fontWeight: "800", color: "#2B4933" },
  chipTextSelected: { color: "#FFFFFF" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: "900", color: "#132218" },
  sectionAction: { color: "#236B45", fontSize: 11, fontWeight: "900" },
  categoryRow: { gap: 9, paddingRight: 4 },
  categoryPill: { width: 75, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 20, alignItems: "center", gap: 7, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDEAD8" },
  categoryIcon: { width: 35, height: 35, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  categoryText: { fontSize: 11, color: "#2B4933", fontWeight: "900" },
  categoryTextSelected: { color: "#FFFFFF" },
  activeOrderCard: { backgroundColor: "#EEF9DB", borderRadius: 20, padding: 14, borderWidth: 1, borderColor: "#D9F99D", gap: 11 },
  activeOrderTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4F8F3B" },
  activeOrderEyebrow: { fontSize: 10, color: "#4F8F3B", fontWeight: "900", flex: 1 },
  activeOrderId: { fontSize: 10, color: "#5E7665", fontWeight: "800" },
  activeOrderBody: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  activeOrderTitle: { color: "#132218", fontSize: 14, fontWeight: "900" },
  activeOrderMeta: { color: "#5E7665", fontSize: 11, marginTop: 3 },
  kitchenRow: { gap: 12, paddingRight: 4 },
  kitchenCard: { width: 208, backgroundColor: "#FFFFFF", borderRadius: 22, borderWidth: 1, borderColor: "#DDEAD8", overflow: "hidden" },
  kitchenImageWrap: { height: 132, position: "relative" },
  kitchenImage: { width: "100%", height: "100%" },
  openPill: { position: "absolute", top: 10, left: 10, backgroundColor: "#EEF9DB", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 4 },
  closedPill: { backgroundColor: "#F0F7EF" },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4F8F3B" },
  closedDot: { backgroundColor: "#A4BDA7" },
  openText: { fontSize: 10, color: "#4F8F3B", fontWeight: "900" },
  ratingPill: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 12, paddingHorizontal: 7, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 10, color: "#2B4933", fontWeight: "900" },
  kitchenCardCopy: { padding: 13, gap: 3 },
  kitchenName: { fontSize: 14, color: "#132218", fontWeight: "900" },
  kitchenNeighborhood: { fontSize: 11, color: "#5E7665" },
  kitchenMeta: { flexDirection: "row", gap: 5, alignItems: "center", marginTop: 4 },
  kitchenSpecialty: { fontSize: 10, color: "#236B45", fontWeight: "900" },
  kitchenReviews: { color: "#A4BDA7", fontSize: 10 },
  mealList: { gap: 10 },
  mealRow: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 10, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#DDEAD8" },
  mealRowCompact: { borderWidth: 0, padding: 0, borderRadius: 0 },
  mealImage: { width: 78, height: 78, borderRadius: 16 },
  mealImageCompact: { width: 84, height: 84, borderRadius: 16 },
  mealCopy: { flex: 1, gap: 3 },
  mealAddColumn: { alignItems: "center", justifyContent: "center", gap: 5 },
  quantityStepper: { flexDirection: "row", alignItems: "center", gap: 5 },
  removeButton: { width: 28, height: 28, borderRadius: 10, backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8", alignItems: "center", justifyContent: "center" },
  quantityBadge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: "#4F8F3B", alignItems: "center", justifyContent: "center" },
  quantityBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  quantityBadgeLabel: { color: "#E5F7C8", fontSize: 8, fontWeight: "800", marginLeft: 3 },
  mealCategoryLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  mealCategory: { fontSize: 10, fontWeight: "900" },
  mealPrep: { color: "#A4BDA7", fontSize: 10 },
  mealName: { fontSize: 14, color: "#132218", fontWeight: "900" },
  mealDescription: { fontSize: 10, color: "#5E7665" },
  mealPrice: { color: "#236B45", fontSize: 12, fontWeight: "900", marginTop: 2 },
  addButton: { width: 31, height: 31, borderRadius: 12, backgroundColor: "#236B45", justifyContent: "center", alignItems: "center" },
  floatingCart: { position: "absolute", left: 18, right: 18, bottom: 24, borderRadius: 18, backgroundColor: "#132218", paddingHorizontal: 16, paddingVertical: 13, flexDirection: "row", justifyContent: "space-between", alignItems: "center", shadowColor: "#132218", shadowOpacity: 0.24, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  floatingCartEyebrow: { color: "#A4BDA7", fontSize: 10, fontWeight: "700" },
  floatingCartPrice: { color: "#FFFFFF", fontSize: 15, fontWeight: "900", marginTop: 1 },
  floatingCartCta: { color: "#D9F99D", fontSize: 12, fontWeight: "900" },
  floatingCartCtaWrap: { flexDirection: "row", alignItems: "center", gap: 5 },
  pageTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDEAD8", justifyContent: "center", alignItems: "center" },
  pageTitle: { color: "#132218", fontSize: 20, fontWeight: "900" },
  pageSubtitle: { color: "#5E7665", fontSize: 11, marginTop: 2 },
  clearButton: { marginLeft: "auto", paddingHorizontal: 7, paddingVertical: 7 },
  clearText: { color: "#236B45", fontSize: 11, fontWeight: "900" },
  profileHero: { height: 245, borderRadius: 26, overflow: "hidden", position: "relative" },
  profileImage: { width: "100%", height: "100%" },
  profileOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(28,25,23,0.35)" },
  profileHeroText: { position: "absolute", left: 18, right: 18, bottom: 18 },
  profileVerified: { alignSelf: "flex-start", backgroundColor: "rgba(77,124,15,0.9)", borderRadius: 11, paddingHorizontal: 8, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  profileVerifiedText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  profileName: { color: "#FFFFFF", fontSize: 26, fontWeight: "900" },
  profileNeighborhood: { color: "#F0F7EF", fontSize: 12, marginTop: 4 },
  profileStats: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 14, flexDirection: "row", justifyContent: "space-around", borderWidth: 1, borderColor: "#DDEAD8" },
  statItem: { alignItems: "center", gap: 3 },
  statValue: { color: "#132218", fontSize: 15, fontWeight: "900" },
  statLabel: { color: "#5E7665", fontSize: 10 },
  storyCard: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 18, backgroundColor: "#F3FFE6", borderWidth: 1, borderColor: "#D9F99D" },
  storyIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" },
  storyCopy: { flex: 1 },
  storyTitle: { color: "#132218", fontSize: 13, fontWeight: "900" },
  storyBody: { color: "#5E7665", fontSize: 11, lineHeight: 16, marginTop: 3 },
  cartItems: { gap: 10 },
  cartItemRow: { flexDirection: "row", gap: 11, padding: 10, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#DDEAD8" },
  cartItemImage: { width: 75, height: 75, borderRadius: 15 },
  cartItemCopy: { flex: 1, justifyContent: "space-between", paddingVertical: 2 },
  cartItemName: { color: "#132218", fontSize: 13, fontWeight: "900" },
  cartItemPrice: { color: "#236B45", fontSize: 12, fontWeight: "900" },
  cartItemRequest: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 3 },
  cartItemRequestText: { flex: 1, color: "#8A6516", fontSize: 9, lineHeight: 13, fontWeight: "800" },
  quantityControl: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 13, backgroundColor: "#F0FBEA", paddingHorizontal: 5, paddingVertical: 3 },
  quantityButton: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  quantityText: { fontSize: 12, color: "#132218", fontWeight: "900" },
  deliveryCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: "#EEF9DB", borderRadius: 18, borderWidth: 1, borderColor: "#D9F99D" },
  complaintAddButton: { minHeight: 36, paddingHorizontal: 10, borderRadius: 13, backgroundColor: "#236B45", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  complaintAddButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  complaintHero: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: "#EEF9DB", borderRadius: 20, borderWidth: 1, borderColor: "#D9F99D" },
  complaintHeroIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  complaintHeroCopy: { flex: 1 },
  complaintHeroTitle: { color: "#132218", fontSize: 16, fontWeight: "900" },
  complaintHeroBody: { color: "#4F8F3B", fontSize: 11, lineHeight: 17, marginTop: 3 },
  complaintFormCard: { padding: 15, backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#DDEAD8", gap: 10 },
  complaintFormTitle: { color: "#132218", fontSize: 15, fontWeight: "900" },
  complaintCategoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  complaintCategory: { minHeight: 38, paddingHorizontal: 9, borderRadius: 13, backgroundColor: "#F7FFF0", borderWidth: 1, borderColor: "#DDEAD8", flexDirection: "row", alignItems: "center", gap: 5 },
  complaintCategoryActive: { backgroundColor: "#236B45", borderColor: "#236B45" },
  complaintCategoryText: { color: "#2B4933", fontSize: 10, fontWeight: "800" },
  complaintCategoryTextActive: { color: "#FFFFFF" },
  complaintSubjectInput: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#DDEAD8", backgroundColor: "#F7FFF0", color: "#132218", fontSize: 11, paddingHorizontal: 12, paddingVertical: 9 },
  complaintDescriptionInput: { minHeight: 105, borderRadius: 14, borderWidth: 1, borderColor: "#DDEAD8", backgroundColor: "#F7FFF0", color: "#132218", fontSize: 11, lineHeight: 17, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: "top" },
  complaintAttachLabel: { color: "#132218", fontSize: 11, fontWeight: "900", marginTop: 2 },
  complaintAttachActions: { flexDirection: "row", gap: 8 },
  complaintAttachButton: { flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  complaintAttachText: { color: "#236B45", fontSize: 10, fontWeight: "900" },
  complaintImageRow: { gap: 8, paddingVertical: 2 },
  complaintImageWrap: { width: 82, height: 82, borderRadius: 14, overflow: "hidden", position: "relative" },
  complaintImage: { width: "100%", height: "100%" },
  complaintImageRemove: { position: "absolute", top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(19,34,24,0.75)", alignItems: "center", justifyContent: "center" },
  complaintsSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  complaintsSectionHint: { color: "#5E7665", fontSize: 10, marginTop: 2 },
  complaintEmptyCard: { alignItems: "center", padding: 22, backgroundColor: "#F7FFF0", borderRadius: 20, borderWidth: 1, borderColor: "#DDEAD8", gap: 7 },
  complaintList: { gap: 10 },
  complaintCard: { padding: 14, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#DDEAD8", gap: 9 },
  complaintCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  complaintCardIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#F0FBEA", alignItems: "center", justifyContent: "center" },
  complaintCardCopy: { flex: 1 },
  complaintCardCategory: { color: "#4F8F3B", fontSize: 9, fontWeight: "900" },
  complaintCardTitle: { color: "#132218", fontSize: 13, fontWeight: "900", marginTop: 2 },
  complaintStatus: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 },
  complaintStatusNew: { backgroundColor: "#FFF5D6" },
  complaintStatusReview: { backgroundColor: "#EAF3FF" },
  complaintStatusResolved: { backgroundColor: "#E8F7E5" },
  complaintStatusText: { color: "#5E7665", fontSize: 9, fontWeight: "900" },
  complaintCardDescription: { color: "#405C48", fontSize: 11, lineHeight: 17 },
  complaintCardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  complaintCardMetaText: { color: "#8AA08D", fontSize: 9 },
  complaintListImage: { width: 68, height: 68, borderRadius: 12 },
  complaintResponse: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 12, backgroundColor: "#F0FBEA" },
  complaintResponseText: { flex: 1, color: "#236B45", fontSize: 10, lineHeight: 15, fontWeight: "800" },
  complaintInbox: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#DDEAD8", overflow: "hidden" },
  complaintInboxRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 11, borderBottomWidth: 1, borderBottomColor: "#EEF4EC" },
  complaintInboxIcon: { width: 31, height: 31, borderRadius: 11, backgroundColor: "#F0FBEA", alignItems: "center", justifyContent: "center" },
  complaintInboxCopy: { flex: 1 },
  complaintInboxTitle: { color: "#132218", fontSize: 11, fontWeight: "900" },
  complaintInboxMeta: { color: "#5E7665", fontSize: 9, marginTop: 2 },
  complaintInboxAction: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10, backgroundColor: "#EEF9DB" },
  complaintInboxActionText: { color: "#236B45", fontSize: 9, fontWeight: "900" },
  supportEmptyCard: { flexDirection: "row", alignItems: "center", gap: 8, padding: 13, backgroundColor: "#F7FFF0", borderRadius: 16, borderWidth: 1, borderColor: "#DDEAD8" },
  supportEmptyText: { color: "#4F8F3B", fontSize: 10, fontWeight: "800" },
  cartNoteCard: { padding: 14, backgroundColor: "#F7FFF0", borderRadius: 18, borderWidth: 1, borderColor: "#DDEAD8", gap: 10 },
  cartNoteHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cartNoteCopy: { flex: 1 },
  cartNoteTitle: { color: "#132218", fontSize: 13, fontWeight: "900" },
  cartNoteHint: { color: "#5E7665", fontSize: 11, lineHeight: 16, marginTop: 2 },
  deliveryIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  deliveryCopy: { flex: 1 },
  deliveryTitle: { fontSize: 13, color: "#132218", fontWeight: "900" },
  deliveryBody: { fontSize: 11, color: "#4F8F3B", marginTop: 2 },
  summaryCard: { padding: 15, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#DDEAD8", gap: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { fontSize: 12, color: "#5E7665" },
  summaryValue: { fontSize: 12, color: "#2B4933", fontWeight: "800" },
  summaryStrong: { color: "#132218", fontSize: 15, fontWeight: "900" },
  summaryDivider: { height: 1, backgroundColor: "#E8F1E6" },
  primaryButton: { minHeight: 52, borderRadius: 17, backgroundColor: "#236B45", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  secondaryButton: { minHeight: 46, borderRadius: 15, backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 15 },
  secondaryButtonText: { color: "#236B45", fontSize: 12, fontWeight: "900" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28,25,23,0.38)" },
  checkoutSheet: { backgroundColor: "#F6FBF3", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, paddingBottom: 28, gap: 13 },
  customizationSheet: { backgroundColor: "#F6FBF3", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, paddingBottom: 28, gap: 12, maxHeight: "92%" },
  customizationScroll: { maxHeight: 520 },
  customizationContent: { gap: 10, paddingBottom: 2 },
  customizationMealHeader: { flexDirection: "row", alignItems: "center", gap: 11, padding: 10, backgroundColor: "#FFFFFF", borderRadius: 17, borderWidth: 1, borderColor: "#DDEAD8" },
  customizationMealImage: { width: 62, height: 62, borderRadius: 15 },
  customizationMealCopy: { flex: 1, gap: 3 },
  customizationMealName: { color: "#132218", fontSize: 14, fontWeight: "900" },
  customizationMealPrice: { color: "#236B45", fontSize: 12, fontWeight: "900" },
  customizationHint: { color: "#5E7665", fontSize: 10, lineHeight: 14 },
  sheetHandle: { width: 38, height: 4, borderRadius: 3, backgroundColor: "#D6E2D4", alignSelf: "center" },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetEyebrow: { fontSize: 10, color: "#236B45", fontWeight: "900", letterSpacing: 1 },
  sheetTitle: { fontSize: 22, fontWeight: "900", color: "#132218", marginTop: 2 },
  closeButton: { width: 35, height: 35, borderRadius: 12, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" },
  optionLabel: { color: "#132218", fontSize: 12, fontWeight: "900", marginTop: 4 },
  optionRow: { flexDirection: "row", gap: 8 },
  optionCard: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: "#DDEAD8", backgroundColor: "#FFFFFF", padding: 11, gap: 5 },
  optionCardActive: { backgroundColor: "#236B45", borderColor: "#236B45" },
  optionCardTitle: { fontSize: 11, color: "#132218", fontWeight: "900" },
  optionCardTitleActive: { color: "#FFFFFF" },
  optionCardSubtitle: { fontSize: 9, color: "#5E7665" },
  optionCardSubtitleActive: { color: "#E6F9C7" },
  paymentList: { gap: 7 },
  ingredientGroupLabel: { color: "#5E7665", fontSize: 10, fontWeight: "900", marginTop: 2 },
  ingredientOptionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  ingredientOption: { width: "48%", minHeight: 42, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 13, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDEAD8" },
  ingredientOptionSelected: { backgroundColor: "#236B45", borderColor: "#236B45" },
  ingredientOptionRemoveSelected: { backgroundColor: "#FFF9E8", borderColor: "#F0D99A" },
  ingredientOptionText: { flex: 1, color: "#2B4933", fontSize: 10, fontWeight: "800" },
  ingredientOptionTextSelected: { color: "#FFFFFF" },
  ingredientOptionRemoveTextSelected: { color: "#8A6516" },
  specialRequestInputWrap: { minHeight: 72, flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#DDEAD8", padding: 11 },
  specialRequestInput: { flex: 1, minHeight: 64, color: "#132218", fontSize: 11, lineHeight: 17, padding: 0, textAlignVertical: "top" },
  paymentOption: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDEAD8" },
  paymentOptionActive: { borderColor: "#C7E8C8", backgroundColor: "#F7FFF0" },
  paymentIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#F0FBEA", justifyContent: "center", alignItems: "center" },
  paymentIconActive: { backgroundColor: "#236B45" },
  paymentCopy: { flex: 1 },
  paymentTitle: { color: "#132218", fontSize: 12, fontWeight: "900" },
  paymentSubtitle: { color: "#5E7665", fontSize: 10, marginTop: 2 },
  sheetPriceBreakdown: { gap: 3, marginTop: 2 },
  sheetTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 2 },
  sheetTotalLabel: { color: "#5E7665", fontSize: 12 },
  sheetTotalValue: { color: "#132218", fontSize: 18, fontWeight: "900" },
  orderHero: { padding: 16, backgroundColor: "#132218", borderRadius: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderHeroEyebrow: { color: "#A4BDA7", fontSize: 10, fontWeight: "800" },
  orderHeroId: { color: "#FFFFFF", fontSize: 21, fontWeight: "900", marginTop: 3 },
  orderEta: { alignItems: "flex-end" },
  orderEtaLabel: { color: "#A4BDA7", fontSize: 10 },
  orderEtaValue: { color: "#D9F99D", fontSize: 12, fontWeight: "900", marginTop: 3 },
  statusPill: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EEF9DB", borderRadius: 15, paddingHorizontal: 9, paddingVertical: 7 },
  statusPillText: { color: "#4F8F3B", fontSize: 10, fontWeight: "900" },
  trackingCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#DDEAD8" },
  trackingTitle: { color: "#132218", fontSize: 16, fontWeight: "900", marginBottom: 15 },
  trackingRow: { minHeight: 53, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  trackRail: { width: 18, alignItems: "center" },
  trackDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#E4EFE1", justifyContent: "center", alignItems: "center" },
  trackDotDone: { backgroundColor: "#4F8F3B" },
  trackDotActive: { borderWidth: 3, borderColor: "#D9F99D" },
  trackLine: { width: 2, height: 32, backgroundColor: "#E4EFE1" },
  trackLineDone: { backgroundColor: "#B8F000" },
  trackCopy: { flex: 1 },
  trackLabel: { color: "#5E7665", fontSize: 12, fontWeight: "800" },
  trackLabelActive: { color: "#132218", fontWeight: "900" },
  trackCaption: { color: "#A4BDA7", fontSize: 10, marginTop: 2 },
  specialRequestCard: { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: "#FFFDF3", borderRadius: 16, borderWidth: 1, borderColor: "#F0D99A", padding: 12 },
  specialRequestCopy: { flex: 1 },
  specialRequestTitle: { color: "#8A6516", fontSize: 11, fontWeight: "900" },
  specialRequestBody: { color: "#5E7665", fontSize: 11, lineHeight: 17, marginTop: 3 },
  deliveredCard: { flexDirection: "row", gap: 9, alignItems: "center", backgroundColor: "#F3FFE6", borderRadius: 16, padding: 13 },
  ratingCard: { backgroundColor: "#FFFFFF", borderRadius: 19, borderWidth: 1, borderColor: "#D9F99D", padding: 14, gap: 11 },
  ratingHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
  ratingIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#EEF9DB", alignItems: "center", justifyContent: "center" },
  ratingCopy: { flex: 1 },
  ratingTitle: { color: "#132218", fontSize: 13, fontWeight: "900" },
  ratingBody: { color: "#5E7665", fontSize: 10, marginTop: 3 },
  ratingStarsRow: { flexDirection: "row", justifyContent: "center", gap: 4 },
  ratingStarButton: { padding: 2 },
  ratingInput: { minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: "#DDEAD8", backgroundColor: "#F7FFF0", color: "#132218", fontSize: 11, lineHeight: 17, padding: 10 },
  ratingSubmit: { minHeight: 45, borderRadius: 14, backgroundColor: "#236B45", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  ratingSubmitDisabled: { backgroundColor: "#A4BDA7" },
  ratingSubmitText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  deliveredText: { color: "#1B5E3A", fontSize: 11, fontWeight: "800", flex: 1 },
  dashboardHero: { backgroundColor: "#4F8F3B", borderRadius: 23, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dashboardOverline: { color: "#D9F99D", fontSize: 10, fontWeight: "900" },
  dashboardTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", marginTop: 5 },
  dashboardBody: { color: "#E9F8BF", fontSize: 11, marginTop: 4 },
  earningsRow: { flexDirection: "row", gap: 8 },
  dashboardMetric: { flex: 1, borderRadius: 16, padding: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDEAD8", gap: 4 },
  dashboardMetricValue: { color: "#132218", fontSize: 15, fontWeight: "900" },
  dashboardMetricLabel: { color: "#5E7665", fontSize: 9 },
  incomingCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 15, borderWidth: 1, borderColor: "#D9F99D", gap: 9 },
  incomingTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  incomingEyebrow: { color: "#236B45", fontSize: 10, fontWeight: "900" },
  incomingId: { color: "#132218", fontSize: 17, fontWeight: "900", marginTop: 2 },
  newPill: { backgroundColor: "#F0FBEA", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  newPillText: { color: "#236B45", fontSize: 9, fontWeight: "900" },
  incomingTitle: { color: "#132218", fontSize: 14, fontWeight: "900" },
  incomingMeta: { color: "#5E7665", fontSize: 11 },
  incomingActions: { flexDirection: "row", gap: 8 },
  rejectButton: { flex: 0.32, height: 44, borderRadius: 14, backgroundColor: "#F0F7EF", alignItems: "center", justifyContent: "center" },
  rejectText: { color: "#5E7665", fontSize: 12, fontWeight: "900" },
  acceptButton: { flex: 1, height: 44, borderRadius: 14, backgroundColor: "#236B45", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  acceptText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  prepNotice: { backgroundColor: "#EEF9DB", borderRadius: 13, padding: 10, flexDirection: "row", alignItems: "center", gap: 7 },
  prepNoticeText: { color: "#4F8F3B", fontSize: 11, fontWeight: "800" },
  dashboardList: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#DDEAD8", overflow: "hidden" },
  dashboardAction: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: "#EFF6ED" },
  dashboardActionIcon: { width: 36, height: 36, borderRadius: 13, backgroundColor: "#F0FBEA", alignItems: "center", justifyContent: "center" },
  dashboardActionCopy: { flex: 1 },
  dashboardActionTitle: { color: "#132218", fontSize: 12, fontWeight: "900" },
  dashboardActionDetail: { color: "#5E7665", fontSize: 10, marginTop: 3 },
  menuManager: { backgroundColor: "#F7FFF0", padding: 12, borderRadius: 18, gap: 9 },
  menuManagerRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  menuThumb: { width: 42, height: 42, borderRadius: 12 },
  menuManagerCopy: { flex: 1 },
  menuManagerName: { color: "#132218", fontSize: 11, fontWeight: "900" },
  menuManagerMeta: { color: "#5E7665", fontSize: 10, marginTop: 2 },
  menuStatus: { flexDirection: "row", alignItems: "center", gap: 4 },
  menuStatusText: { fontSize: 9, color: "#4F8F3B", fontWeight: "900" },
  cliqCard: { backgroundColor: "#EEF9DB", borderRadius: 18, padding: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  cliqBadge: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#4F8F3B", justifyContent: "center", alignItems: "center" },
  cliqBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  cliqCopy: { flex: 1 },
  cliqTitle: { color: "#132218", fontSize: 12, fontWeight: "900" },
  cliqBody: { color: "#4F8F3B", fontSize: 10, marginTop: 3 },
  profileDashboardCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#4F8F3B", borderRadius: 19, padding: 13 },
  profileDashboardIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  profileDashboardCopy: { flex: 1 },
  profileDashboardTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  profileDashboardBody: { color: "#E9F8BF", fontSize: 10, marginTop: 3 },
  profileHeader: { flexDirection: "row", alignItems: "center", gap: 11, paddingBottom: 4 },
  profileAvatar: { width: 50, height: 50, borderRadius: 17 },
  profileGreeting: { color: "#132218", fontSize: 17, fontWeight: "900" },
  profileMuted: { color: "#5E7665", fontSize: 11, marginTop: 3 },
  switchRoleButton: { marginLeft: "auto", backgroundColor: "#F0FBEA", borderRadius: 14, paddingHorizontal: 9, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  switchRoleText: { color: "#236B45", fontSize: 10, fontWeight: "900" },
  roleIcon: { marginLeft: "auto", width: 39, height: 39, borderRadius: 13, backgroundColor: "#F0FBEA", justifyContent: "center", alignItems: "center" },
  settingsCard: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#DDEAD8", overflow: "hidden" },
  settingRow: { flexDirection: "row", alignItems: "center", padding: 13, gap: 10, borderBottomWidth: 1, borderBottomColor: "#EFF6ED" },
  settingIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#F0FBEA", alignItems: "center", justifyContent: "center" },
  settingLabel: { color: "#132218", fontSize: 12, fontWeight: "800", flex: 1 },
  settingValue: { color: "#5E7665", fontSize: 11 },
  aboutCard: { borderRadius: 20, padding: 16, backgroundColor: "#132218" },
  aboutTitle: { color: "#D9F99D", fontSize: 15, fontWeight: "900" },
  aboutBody: { color: "#D6E2D4", fontSize: 11, lineHeight: 17, marginTop: 7 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 8 },
  emptyBasket: { width: 66, height: 66, borderRadius: 24, backgroundColor: "#F0FBEA", justifyContent: "center", alignItems: "center", marginBottom: 5 },
  emptyTitle: { color: "#132218", fontSize: 17, fontWeight: "900" },
  emptyBody: { color: "#5E7665", fontSize: 11, textAlign: "center", maxWidth: 220, lineHeight: 17 },
  bottomNav: { position: "absolute", left: 14, right: 14, bottom: 13, height: 69, backgroundColor: "rgba(255,255,255,0.97)", borderRadius: 23, borderWidth: 1, borderColor: "#DDEAD8", flexDirection: "row", alignItems: "center", justifyContent: "space-around", shadowColor: "#132218", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 7 },
  navItem: { alignItems: "center", justifyContent: "center", gap: 4, minWidth: 55, paddingVertical: 7 },
  navLabel: { color: "#A4BDA7", fontSize: 9, fontWeight: "800" },
  navLabelActive: { color: "#236B45" },
  navBrandDot: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#236B45", alignItems: "center", justifyContent: "center", marginTop: -26, borderWidth: 4, borderColor: "#F6FBF3" },
  toast: { position: "absolute", left: 24, right: 24, bottom: 98, borderRadius: 15, backgroundColor: "#132218", paddingHorizontal: 13, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8, shadowColor: "#132218", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  toastText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", flex: 1 },
  customerDriverCard: { backgroundColor: "#F3FFE6", borderRadius: 22, padding: 15, gap: 14, borderWidth: 1, borderColor: "#D9F99D" },
  customerDriverHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  driverAvatar: { width: 44, height: 44, borderRadius: 16, backgroundColor: "#236B45", alignItems: "center", justifyContent: "center" },
  customerDriverCopy: { flex: 1, gap: 2 },
  customerDriverEyebrow: { color: "#1B5E3A", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 },
  customerDriverName: { color: "#132218", fontSize: 15, fontWeight: "900" },
  customerDriverMeta: { color: "#5E7665", fontSize: 11, fontWeight: "600" },
  callDriverButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#4F8F3B", alignItems: "center", justifyContent: "center" },
  customerDriverStats: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: "#D9F99D", paddingTop: 12 },
  customerDriverStatLabel: { color: "#A4BDA7", fontSize: 9, fontWeight: "800", marginBottom: 3 },
  customerDriverStatValue: { color: "#304A38", fontSize: 10, fontWeight: "800", maxWidth: 104 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
});
