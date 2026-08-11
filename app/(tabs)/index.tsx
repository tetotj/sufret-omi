import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
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

import { MapPreview } from "@/components/map-preview";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import {
  categories,
  formatJod,
  getCategory,
  getKitchenMeals,
  getLocalized,
  getMeal,
  getRegion,
  kitchens,
  meals,
  orderStatuses,
  paymentLabels,
  regions,
  scheduleLabels,
  t,
  unitCount,
} from "@/lib/food-data";

type ViewId = "home" | "explore" | "orders" | "profile" | "kitchen" | "cart" | "dashboard";

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

export default function HomeScreen() {
  const { language, role, toast, dismissToast, setRole } = useApp();
  const [view, setView] = useState<ViewId>(role === "mother" ? "dashboard" : "home");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [query, setQuery] = useState("");

  const changeRole = () => {
    const next = role === "customer" ? "mother" : "customer";
    setRole(next);
    setView(next === "mother" ? "dashboard" : "home");
  };

  const go = (next: ViewId) => {
    setView(next);
    setCheckoutOpen(false);
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} containerClassName="bg-background" className="flex-1">
      <View style={[styles.root, language === "ar" ? styles.rtl : styles.ltr]}>
        {view === "kitchen" ? (
          <KitchenProfile onBack={() => go("home")} onCart={() => go("cart")} />
        ) : view === "cart" ? (
          <CartScreen onBack={() => go("home")} onCheckout={() => setCheckoutOpen(true)} />
        ) : view === "dashboard" ? (
          <MotherDashboard onBack={() => go("home")} />
        ) : view === "orders" ? (
          <OrdersScreen onBack={() => go("home")} />
        ) : view === "profile" ? (
          <ProfileScreen onRoleChange={changeRole} />
        ) : (
          <CustomerHome view={view} query={query} setQuery={setQuery} onNavigate={go} />
        )}

        {view !== "kitchen" && view !== "cart" && view !== "dashboard" && (
          <BottomNav active={view} onNavigate={go} role={role} language={language} />
        )}

        {toast && (
          <Pressable onPress={dismissToast} style={styles.toast}>
            <MaterialIcons name="check-circle" size={18} color="#FFFFFF" />
            <Text style={styles.toastText}>{toast}</Text>
          </Pressable>
        )}
      </View>
      <CheckoutModal visible={checkoutOpen} onClose={() => setCheckoutOpen(false)} onComplete={() => { setCheckoutOpen(false); go("orders"); }} />
    </ScreenContainer>
  );
}

function CustomerHome({
  view,
  query,
  setQuery,
  onNavigate,
}: {
  view: ViewId;
  query: string;
  setQuery: (value: string) => void;
  onNavigate: (view: ViewId) => void;
}) {
  const {
    language,
    cartCount,
    selectedRegion,
    selectedCategory,
    setSelectedRegion,
    setSelectedCategory,
    setSelectedKitchenId,
    selectedKitchen,
    activeOrder,
    addToCart,
    cartTotal,
  } = useApp();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const region = getRegion(selectedRegion);

  const visibleMeals = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return meals.filter((meal) => {
      const matchesQuery = !normalized || `${meal.name.ar} ${meal.name.en}`.toLowerCase().includes(normalized);
      const matchesCategory = selectedCategory === "all" || meal.category === selectedCategory;
      return matchesQuery && matchesCategory;
    });
  }, [query, selectedCategory]);

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
        <View style={styles.headerActions}>
          <LanguageToggle />
          <Pressable onPress={() => onNavigate("cart")} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <MaterialIcons name="shopping-basket" size={20} color="#1C1917" />
            {cartCount > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>}
          </Pressable>
        </View>
      </View>

      <Pressable onPress={() => onNavigate("kitchen")} style={({ pressed }) => [styles.heroCard, pressed && styles.pressed]}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroOverline}>{language === "ar" ? "من بيتنا لبيتك" : "From our homes to yours"}</Text>
          <Text style={styles.heroTitle}>{language === "ar" ? "أكل يلمّ العيلة" : "Food that brings family together"}</Text>
          <Text style={styles.heroBody}>{language === "ar" ? "اطلبي طبخة بيتية من أمهات الأردن" : "Order a home-cooked meal from Jordanian mothers"}</Text>
          <View style={styles.heroCta}><Text style={styles.heroCtaText}>{language === "ar" ? "تصفّحي اليوم" : "Browse today"}</Text><MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" /></View>
        </View>
        <View style={styles.heroArt}>
          <View style={styles.heroPlate}><MaterialIcons name="restaurant" size={34} color="#C2410C" /></View>
          <View style={styles.heroLeafOne} /><View style={styles.heroLeafTwo} />
        </View>
      </Pressable>

      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <MaterialIcons name="search" size={20} color="#78716C" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={language === "ar" ? "دوّري على طبخة أو مطبخ" : "Search meals or kitchens"}
            placeholderTextColor="#A8A29E"
            style={styles.searchInput}
            textAlign={language === "ar" ? "right" : "left"}
          />
        </View>
        <Pressable onPress={() => setFiltersOpen((value) => !value)} style={({ pressed }) => [styles.filterButton, pressed && styles.pressed, filtersOpen && styles.filterButtonActive]}>
          <MaterialIcons name="tune" size={19} color={filtersOpen ? "#FFFFFF" : "#C2410C"} />
        </Pressable>
      </View>

      {filtersOpen && (
        <View style={styles.filterPanel}>
          <Text style={styles.filterTitle}>{language === "ar" ? "اختاري منطقتك" : "Choose your region"}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {regions.map((item) => (
              <Chip key={item.id} label={getLocalized(item.label, language)} selected={selectedRegion === item.id} onPress={() => setSelectedRegion(item.id)} />
            ))}
          </ScrollView>
        </View>
      )}

      <SectionHeader title={language === "ar" ? "شو نفسِك اليوم؟" : "What are you craving?"} action={language === "ar" ? "الكل" : "See all"} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        <CategoryPill label={language === "ar" ? "الكل" : "All"} icon="apps" color="#C2410C" selected={selectedCategory === "all"} onPress={() => setSelectedCategory("all")} />
        {categories.map((category) => (
          <CategoryPill key={category.id} label={getLocalized(category.label, language)} icon={category.icon as IconName} color={category.color} selected={selectedCategory === category.id} onPress={() => setSelectedCategory(category.id)} />
        ))}
      </ScrollView>

      <SectionHeader title={language === "ar" ? `حول ${getLocalized(region.label, language)}` : `Around ${getLocalized(region.label, language)}`} action={language === "ar" ? "الخريطة" : "Map"} onAction={() => onNavigate("explore")} />
      <MapPreview compact onSelectRegion={setSelectedRegion} />

      {activeOrder && (
        <Pressable onPress={() => onNavigate("orders")} style={styles.activeOrderCard}>
          <View style={styles.activeOrderTop}><View style={styles.liveDot} /><Text style={styles.activeOrderEyebrow}>{language === "ar" ? "طلبك يتحضّر الآن" : "Your order is cooking"}</Text><Text style={styles.activeOrderId}>{activeOrder.id}</Text></View>
          <View style={styles.activeOrderBody}><View><Text style={styles.activeOrderTitle}>{getLocalized(activeOrder.kitchen.name, language)}</Text><Text style={styles.activeOrderMeta}>{getLocalized(activeOrder.eta, language)}</Text></View><MaterialIcons name="chevron-right" size={22} color="#C2410C" /></View>
        </Pressable>
      )}

      <SectionHeader title={language === "ar" ? "مطابخ بتحبّوها" : "Loved home kitchens"} action={language === "ar" ? "شوفي الكل" : "See all"} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kitchenRow}>
        {kitchens.map((kitchen) => (
          <Pressable key={kitchen.id} onPress={() => openKitchen(kitchen.id)} style={({ pressed }) => [styles.kitchenCard, pressed && styles.pressed]}>
            <View style={styles.kitchenImageWrap}><Image source={{ uri: kitchen.image }} style={styles.kitchenImage} /><View style={[styles.openPill, !kitchen.isOpen && styles.closedPill]}><View style={[styles.openDot, !kitchen.isOpen && styles.closedDot]} /><Text style={styles.openText}>{kitchen.isOpen ? (language === "ar" ? "مفتوح" : "Open") : (language === "ar" ? "مغلق" : "Closed")}</Text></View><View style={styles.ratingPill}><MaterialIcons name="star" size={12} color="#F59E0B" /><Text style={styles.ratingText}>{kitchen.rating}</Text></View></View>
            <View style={styles.kitchenCardCopy}><Text style={styles.kitchenName} numberOfLines={1}>{getLocalized(kitchen.name, language)}</Text><Text style={styles.kitchenNeighborhood}>{getLocalized(kitchen.neighborhood, language)}</Text><View style={styles.kitchenMeta}><Text style={styles.kitchenSpecialty}>{getLocalized(getCategory(kitchen.specialty).label, language)}</Text><Text style={styles.kitchenReviews}>· {kitchen.reviewCount} {language === "ar" ? "تقييم" : "reviews"}</Text></View></View>
          </Pressable>
        ))}
      </ScrollView>

      <SectionHeader title={language === "ar" ? "أكثر الأكلات طلباً" : "Most ordered today"} action={language === "ar" ? "أضيفي للسفرة" : "Add to table"} />
      <View style={styles.mealList}>
        {visibleMeals.map((meal) => (
          <MealRow key={meal.id} meal={meal} language={language} onPress={() => openKitchen(meal.kitchenId)} onAdd={() => addToCart(meal)} />
        ))}
      </View>
      {visibleMeals.length === 0 && <EmptyState language={language} />}

      {cartCount > 0 && <Pressable onPress={() => onNavigate("cart")} style={styles.floatingCart}><View><Text style={styles.floatingCartEyebrow}>{language === "ar" ? `${unitCount(useApp().cart)} أصناف` : `${cartCount} items`}</Text><Text style={styles.floatingCartPrice}>{formatJod(cartTotal + 1.25, language)}</Text></View><Text style={styles.floatingCartCta}>{language === "ar" ? "السفرة ←" : "View cart →"}</Text></Pressable>}
    </ScrollView>
  );
}

function KitchenProfile({ onBack, onCart }: { onBack: () => void; onCart: () => void }) {
  const { language, selectedKitchen, cartCount, addToCart } = useApp();
  const kitchenMeals = getKitchenMeals(selectedKitchen.id);
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#1C1917" /></Pressable><Text style={styles.pageTitle}>{language === "ar" ? "مطبخ بيت" : "Home kitchen"}</Text><Pressable onPress={onCart} style={styles.iconButton}><MaterialIcons name="shopping-basket" size={20} color="#1C1917" />{cartCount > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>}</Pressable></View>
      <View style={styles.profileHero}><Image source={{ uri: selectedKitchen.image }} style={styles.profileImage} /><View style={styles.profileOverlay} /><View style={styles.profileHeroText}><View style={styles.profileVerified}><MaterialIcons name="verified" size={14} color="#FFFFFF" /><Text style={styles.profileVerifiedText}>{language === "ar" ? "مطبخ موثوق" : "Verified kitchen"}</Text></View><Text style={styles.profileName}>{getLocalized(selectedKitchen.name, language)}</Text><Text style={styles.profileNeighborhood}>{getLocalized(selectedKitchen.neighborhood, language)} · {getLocalized(selectedKitchen.motherName, language)}</Text></View></View>
      <View style={styles.profileStats}><StatItem icon="star" value={`${selectedKitchen.rating}`} label={language === "ar" ? "التقييم" : "Rating"} /><StatItem icon="local-dining" value={`${selectedKitchen.reviewCount}+`} label={language === "ar" ? "تجربة" : "orders"} /><StatItem icon="schedule" value="45m" label={language === "ar" ? "التحضير" : "prep"} /></View>
      <View style={styles.storyCard}><View style={styles.storyIcon}><MaterialIcons name="favorite" size={20} color="#C2410C" /></View><View style={styles.storyCopy}><Text style={styles.storyTitle}>{language === "ar" ? "طبخته من وصفة أمها" : "A recipe passed down"}</Text><Text style={styles.storyBody}>{language === "ar" ? "كل طلب ينطبخ بنفس البيت وبنفس النفس الطيب." : "Every order is cooked in the same home with the same generous spirit."}</Text></View></View>
      <SectionHeader title={language === "ar" ? "قائمة اليوم" : "Today's menu"} action={language === "ar" ? "طلبات مسبقة" : "Advance order"} />
      <View style={styles.mealList}>{kitchenMeals.map((meal) => <MealRow key={meal.id} meal={meal} language={language} onAdd={() => addToCart(meal)} compact />)}</View>
    </ScrollView>
  );
}

function CartScreen({ onBack, onCheckout }: { onBack: () => void; onCheckout: () => void }) {
  const { language, cart, cartTotal, updateQuantity, clearCart, cartCount } = useApp();
  const deliveryFee = cart.length ? 1.25 : 0;
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#1C1917" /></Pressable><View><Text style={styles.pageTitle}>{language === "ar" ? "سفرتك" : "Your table"}</Text><Text style={styles.pageSubtitle}>{cartCount} {language === "ar" ? "أصناف من مطبخ البيت" : "items from home kitchen"}</Text></View><Pressable onPress={clearCart} style={styles.clearButton}><Text style={styles.clearText}>{language === "ar" ? "مسح" : "Clear"}</Text></Pressable></View>
      {cart.length === 0 ? <EmptyCart language={language} onBack={onBack} /> : <>
        <View style={styles.cartItems}>{cart.map((item) => <CartItemRow key={item.meal.id} item={item} language={language} onUpdate={updateQuantity} />)}</View>
        <View style={styles.deliveryCard}><View style={styles.deliveryIcon}><MaterialIcons name="two-wheeler" size={21} color="#4D7C0F" /></View><View style={styles.deliveryCopy}><Text style={styles.deliveryTitle}>{language === "ar" ? "توصيل لباب البيت" : "Doorstep delivery"}</Text><Text style={styles.deliveryBody}>{language === "ar" ? "خلدا، شارع وصفي التل" : "Khalda, Wasfi Al-Tal St."}</Text></View><MaterialIcons name="chevron-right" size={20} color="#78716C" /></View>
        <View style={styles.summaryCard}><SummaryRow label={language === "ar" ? "المجموع" : "Subtotal"} value={formatJod(cartTotal, language)} /><SummaryRow label={language === "ar" ? "التوصيل" : "Delivery"} value={formatJod(deliveryFee, language)} /><View style={styles.summaryDivider} /><SummaryRow label={language === "ar" ? "الإجمالي" : "Total"} value={formatJod(cartTotal + deliveryFee, language)} strong /></View>
        <Pressable onPress={onCheckout} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{language === "ar" ? "كمّلي الطلب" : "Continue to checkout"}</Text><MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" /></Pressable>
      </>}
    </ScrollView>
  );
}

function CheckoutModal({ visible, onClose, onComplete }: { visible: boolean; onClose: () => void; onComplete: () => void }) {
  const { language, placeOrder, cartTotal } = useApp();
  const [payment, setPayment] = useState<"cod" | "cliq" | "wallet">("cod");
  const [schedule, setSchedule] = useState<"now" | "scheduled">("now");
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}><View style={styles.checkoutSheet}>
        <View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={styles.sheetEyebrow}>{language === "ar" ? "آخر خطوة" : "One last step"}</Text><Text style={styles.sheetTitle}>{language === "ar" ? "تأكيد الطلب" : "Confirm order"}</Text></View><Pressable onPress={onClose} style={styles.closeButton}><MaterialIcons name="close" size={20} color="#1C1917" /></Pressable></View>
        <Text style={styles.optionLabel}>{language === "ar" ? "متى بتحبي يوصل؟" : "When should it arrive?"}</Text>
        <View style={styles.optionRow}>{(["now", "scheduled"] as const).map((item) => <OptionCard key={item} selected={schedule === item} onPress={() => setSchedule(item)} icon={item === "now" ? "bolt" : "event"} title={t(scheduleLabels[item], language)} subtitle={item === "now" ? (language === "ar" ? "٤٥ دقيقة تقريباً" : "About 45 min") : (language === "ar" ? "مناسب للعزائم" : "Great for gatherings")} />)}</View>
        <Text style={styles.optionLabel}>{language === "ar" ? "طريقة الدفع" : "Payment method"}</Text>
        <View style={styles.paymentList}>{(["cod", "cliq", "wallet"] as const).map((item) => <Pressable key={item} onPress={() => setPayment(item)} style={[styles.paymentOption, payment === item && styles.paymentOptionActive]}><View style={[styles.paymentIcon, payment === item && styles.paymentIconActive]}><MaterialIcons name={item === "cod" ? "payments" : item === "cliq" ? "account-balance" : "wallet"} size={18} color={payment === item ? "#FFFFFF" : "#C2410C"} /></View><View style={styles.paymentCopy}><Text style={styles.paymentTitle}>{t(paymentLabels[item], language)}</Text><Text style={styles.paymentSubtitle}>{item === "cod" ? (language === "ar" ? "ادفعي عند الباب" : "Pay at the door") : item === "cliq" ? (language === "ar" ? "تحويل فوري وآمن" : "Instant and secure transfer") : (language === "ar" ? "زين كاش، أورانج موني" : "Zain Cash, Orange Money")}</Text></View><MaterialIcons name={payment === item ? "radio-button-checked" : "radio-button-unchecked"} size={22} color={payment === item ? "#C2410C" : "#A8A29E"} /></Pressable>)}</View>
        <View style={styles.sheetTotal}><Text style={styles.sheetTotalLabel}>{language === "ar" ? "المجموع مع التوصيل" : "Total with delivery"}</Text><Text style={styles.sheetTotalValue}>{formatJod(cartTotal + 1.25, language)}</Text></View>
        <Pressable onPress={() => { placeOrder(payment, schedule); onComplete(); }} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{language === "ar" ? "أكّد واطلب" : "Confirm order"}</Text><MaterialIcons name="check" size={18} color="#FFFFFF" /></Pressable>
      </View></View>
    </Modal>
  );
}

function OrdersScreen({ onBack }: { onBack: () => void }) {
  const { language, activeOrder, advanceOrder } = useApp();
  const currentIndex = activeOrder ? orderStatuses.findIndex((item) => item.id === activeOrder.status) : -1;
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#1C1917" /></Pressable><View><Text style={styles.pageTitle}>{language === "ar" ? "طلباتي" : "My orders"}</Text><Text style={styles.pageSubtitle}>{language === "ar" ? "كل لقمة إلها حكاية" : "Every bite has a story"}</Text></View><View style={styles.statusPill}><View style={styles.liveDot} /><Text style={styles.statusPillText}>{language === "ar" ? "مباشر" : "Live"}</Text></View></View>
      {activeOrder ? <>
        <View style={styles.orderHero}><View><Text style={styles.orderHeroEyebrow}>{language === "ar" ? "رقم الطلب" : "Order number"}</Text><Text style={styles.orderHeroId}>{activeOrder.id}</Text></View><View style={styles.orderEta}><Text style={styles.orderEtaLabel}>{language === "ar" ? "الوصول المتوقع" : "Estimated arrival"}</Text><Text style={styles.orderEtaValue}>{getLocalized(activeOrder.eta, language)}</Text></View></View>
        <MapPreview />
        <View style={styles.trackingCard}><Text style={styles.trackingTitle}>{language === "ar" ? "وين وصل طلبك؟" : "Where is your order?"}</Text>{orderStatuses.map((status, index) => { const done = index <= currentIndex; const active = index === currentIndex; return <View key={status.id} style={styles.trackingRow}><View style={styles.trackRail}><View style={[styles.trackDot, done && styles.trackDotDone, active && styles.trackDotActive]}>{done && <MaterialIcons name="check" size={12} color="#FFFFFF" />}</View>{index < orderStatuses.length - 1 && <View style={[styles.trackLine, index < currentIndex && styles.trackLineDone]} />}</View><View style={styles.trackCopy}><Text style={[styles.trackLabel, active && styles.trackLabelActive]}>{getLocalized(status.label, language)}</Text><Text style={styles.trackCaption}>{getLocalized(status.caption, language)}</Text></View><MaterialIcons name={status.icon as IconName} size={19} color={done ? "#4D7C0F" : "#A8A29E"} /></View>; })}</View>
        {activeOrder.status !== "delivered" && <Pressable onPress={advanceOrder} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><MaterialIcons name="refresh" size={18} color="#C2410C" /><Text style={styles.secondaryButtonText}>{language === "ar" ? "تحديث حالة الطلب" : "Refresh order status"}</Text></Pressable>}
        {activeOrder.status === "delivered" && <View style={styles.deliveredCard}><MaterialIcons name="favorite" size={22} color="#C2410C" /><Text style={styles.deliveredText}>{language === "ar" ? "صحة وعافية! لا تنسي تقيّمي أم أحمد." : "Enjoy! Don't forget to review Umm Ahmad."}</Text></View>}
      </> : <EmptyOrders language={language} onBack={onBack} />}
    </ScrollView>
  );
}

function MotherDashboard({ onBack }: { onBack: () => void }) {
  const { language, kitchenOpen, toggleKitchen, incomingOrder, acceptIncomingOrder, rejectIncomingOrder, requestPayout, lastPayout, setRole } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageTopRow}><Pressable onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={21} color="#1C1917" /></Pressable><View><Text style={styles.eyebrow}>{language === "ar" ? "لوحة الأم" : "MOTHER'S TABLE"}</Text><Text style={styles.pageTitle}>{language === "ar" ? "صباح الخير يا أم أحمد" : "Good morning, Umm Ahmad"}</Text></View><Pressable onPress={() => { setRole("customer"); onBack(); }} style={styles.roleIcon}><MaterialIcons name="person" size={20} color="#C2410C" /></Pressable></View>
      <View style={styles.dashboardHero}><View><Text style={styles.dashboardOverline}>{language === "ar" ? "حالة المطبخ" : "Kitchen status"}</Text><Text style={styles.dashboardTitle}>{kitchenOpen ? (language === "ar" ? "مطبخك مفتوح" : "Your kitchen is open") : (language === "ar" ? "المطبخ مغلق" : "Kitchen is closed")}</Text><Text style={styles.dashboardBody}>{kitchenOpen ? (language === "ar" ? "جاهزة تستقبلي طلبات الجيران" : "Ready to welcome neighborhood orders") : (language === "ar" ? "افتحيه لما تكوني جاهزة" : "Open it when you're ready")}</Text></View><Switch value={kitchenOpen} onValueChange={toggleKitchen} trackColor={{ false: "#D6D3D1", true: "#A3C26B" }} thumbColor={kitchenOpen ? "#4D7C0F" : "#78716C"} /></View>
      <View style={styles.earningsRow}><DashboardMetric label={language === "ar" ? "طلبات اليوم" : "Today's orders"} value="12" icon="receipt-long" /><DashboardMetric label={language === "ar" ? "أرباح الشهر" : "This month"} value={language === "ar" ? "٤٨٦ د.أ" : "JOD 486"} icon="trending-up" /><DashboardMetric label={language === "ar" ? "التقييم" : "Rating"} value="4.9" icon="star" /></View>
      {incomingOrder && <View style={styles.incomingCard}><View style={styles.incomingTop}><View><Text style={styles.incomingEyebrow}>{language === "ar" ? "طلب جديد" : "New order"}</Text><Text style={styles.incomingId}>{incomingOrder.id}</Text></View><View style={styles.newPill}><Text style={styles.newPillText}>{language === "ar" ? "جديد" : "NEW"}</Text></View></View><Text style={styles.incomingTitle}>{incomingOrder.items.map((item) => `${item.quantity}× ${getLocalized(item.meal.name, language)}`).join("، ")}</Text><Text style={styles.incomingMeta}>{getLocalized(incomingOrder.eta, language)} · {formatJod(incomingOrder.total, language)} · {t(paymentLabels[incomingOrder.paymentMethod], language)}</Text>{incomingOrder.status === "received" ? <View style={styles.incomingActions}><Pressable onPress={rejectIncomingOrder} style={styles.rejectButton}><Text style={styles.rejectText}>{language === "ar" ? "رفض" : "Decline"}</Text></Pressable><Pressable onPress={acceptIncomingOrder} style={styles.acceptButton}><Text style={styles.acceptText}>{language === "ar" ? "قبول الطلب" : "Accept order"}</Text><MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" /></Pressable></View> : <View style={styles.prepNotice}><MaterialIcons name="soup-kitchen" size={18} color="#4D7C0F" /><Text style={styles.prepNoticeText}>{language === "ar" ? "الطلب قيد التحضير - وقت التسليم ٤٥ دقيقة" : "Preparing - ready in 45 minutes"}</Text></View>}</View>}
      <SectionHeader title={language === "ar" ? "إدارة مطبخك" : "Manage your kitchen"} action={language === "ar" ? "عرض القائمة" : "View menu"} onAction={() => setMenuOpen((value) => !value)} />
      <View style={styles.dashboardList}><DashboardAction icon="restaurant-menu" title={language === "ar" ? "قائمة الأكلات" : "Menu items"} detail={language === "ar" ? "٥ أكلات · ٤ متاحة" : "5 meals · 4 available"} onPress={() => setMenuOpen((value) => !value)} /><DashboardAction icon="event" title={language === "ar" ? "طلبات مسبقة" : "Advance orders"} detail={language === "ar" ? "مناسبات الجمعة" : "Friday gatherings"} onPress={() => undefined} /><DashboardAction icon="account-balance" title={language === "ar" ? "الأرباح و CliQ" : "Earnings & CliQ"} detail={lastPayout ? (language === "ar" ? "طلب التحويل قيد المعالجة" : "Payout processing") : (language === "ar" ? "٣٨٦ د.أ جاهزة للتحويل" : "JOD 386 ready to payout")} onPress={() => requestPayout(386)} /> </View>
      {menuOpen && <View style={styles.menuManager}>{getKitchenMeals("umm-ahmad").map((meal) => <View key={meal.id} style={styles.menuManagerRow}><Image source={{ uri: meal.image }} style={styles.menuThumb} /><View style={styles.menuManagerCopy}><Text style={styles.menuManagerName}>{getLocalized(meal.name, language)}</Text><Text style={styles.menuManagerMeta}>{formatJod(meal.price, language)} · {meal.prepMinutes} min</Text></View><View style={styles.menuStatus}><View style={styles.openDot} /><Text style={styles.menuStatusText}>{language === "ar" ? "متاحة" : "Live"}</Text></View></View>)}</View>}
      <View style={styles.cliqCard}><View style={styles.cliqBadge}><Text style={styles.cliqBadgeText}>CliQ</Text></View><View style={styles.cliqCopy}><Text style={styles.cliqTitle}>{language === "ar" ? "حوّلي أرباحك بسهولة" : "Move your earnings easily"}</Text><Text style={styles.cliqBody}>{language === "ar" ? "آخر تحويل إلى 079 ••• 6281" : "Last payout to 079 ••• 6281"}</Text></View><MaterialIcons name="chevron-right" size={20} color="#4D7C0F" /></View>
    </ScrollView>
  );
}

function ProfileScreen({ onRoleChange }: { onRoleChange: () => void }) {
  const { language, setLanguage, selectedRegion, setSelectedRegion } = useApp();
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}><View style={styles.profileHeader}><Image source={require("@/assets/images/icon.png")} style={styles.profileAvatar} /><View><Text style={styles.profileGreeting}>{language === "ar" ? "أهلاً سارة" : "Hi Sara"}</Text><Text style={styles.profileMuted}>{language === "ar" ? "خلدا، عمّان" : "Khalda, Amman"}</Text></View><Pressable onPress={onRoleChange} style={styles.switchRoleButton}><MaterialIcons name="swap-horiz" size={16} color="#C2410C" /><Text style={styles.switchRoleText}>{language === "ar" ? "وضع الأم" : "Mother mode"}</Text></Pressable></View><View style={styles.settingsCard}><SettingRow icon="language" label={language === "ar" ? "اللغة" : "Language"} value={language === "ar" ? "العربية" : "English"} onPress={() => setLanguage(language === "ar" ? "en" : "ar")} /><SettingRow icon="location-on" label={language === "ar" ? "منطقتي" : "My area"} value={getLocalized(getRegion(selectedRegion).label, language)} onPress={() => setSelectedRegion(selectedRegion === "amman" ? "irbid" : "amman")} /><SettingRow icon="notifications-none" label={language === "ar" ? "الإشعارات" : "Notifications"} value={language === "ar" ? "مفعّلة" : "On"} onPress={() => undefined} /><SettingRow icon="help-outline" label={language === "ar" ? "مساعدة سفرتي" : "Sufret Omi help"} value={language === "ar" ? "نحن معك" : "We are here"} onPress={() => undefined} /></View><View style={styles.aboutCard}><Text style={styles.aboutTitle}>{language === "ar" ? "من بيت أردني لكل بيت" : "From a Jordanian home to every home"}</Text><Text style={styles.aboutBody}>{language === "ar" ? "سفرة أمي تجمعك بأمهات يطبخوا بحب، عشان تضلّ لَمّة البيت على أحلى سفرة." : "Sufret Omi connects you with mothers who cook with care, keeping family time around a generous table."}</Text></View></ScrollView>;
}

function BottomNav({ active, onNavigate, role, language }: { active: ViewId; onNavigate: (view: ViewId) => void; role: "customer" | "mother"; language: "ar" | "en" }) {
  const items: { id: ViewId; label: string; icon: IconName }[] = [{ id: "home", label: language === "ar" ? "الرئيسية" : "Home", icon: "home" }, { id: "explore", label: language === "ar" ? "اكتشفي" : "Explore", icon: "explore" }, { id: "orders", label: language === "ar" ? "طلباتي" : "Orders", icon: "receipt-long" }, { id: "profile", label: language === "ar" ? "حسابي" : "Profile", icon: "person-outline" }];
  return <View style={styles.bottomNav}>{items.map((item) => <Pressable key={item.id} onPress={() => onNavigate(item.id)} style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}><MaterialIcons name={item.icon} size={21} color={active === item.id ? "#C2410C" : "#A8A29E"} /><Text style={[styles.navLabel, active === item.id && styles.navLabelActive]}>{item.label}</Text></Pressable>)}<View style={styles.navBrandDot}><MaterialIcons name={role === "mother" ? "storefront" : "restaurant"} size={18} color="#FFFFFF" /></View></View>;
}

function LanguageToggle() { const { language, setLanguage } = useApp(); return <Pressable onPress={() => setLanguage(language === "ar" ? "en" : "ar")} style={styles.languageToggle}><Text style={[styles.languageText, language === "ar" && styles.languageActive]}>ع</Text><Text style={styles.languageSlash}>/</Text><Text style={[styles.languageText, language === "en" && styles.languageActive]}>EN</Text></Pressable>; }

function SectionHeader({ title, action, onAction }: { title: string; action: string; onAction?: () => void }) { return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text><Pressable onPress={onAction} disabled={!onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable></View>; }

function CategoryPill({ label, icon, color, selected, onPress }: { label: string; icon: IconName; color: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.categoryPill, selected && { backgroundColor: color, borderColor: color }, pressed && styles.pressed]}><View style={[styles.categoryIcon, { backgroundColor: selected ? "rgba(255,255,255,0.18)" : `${color}18` }]}><MaterialIcons name={icon} size={18} color={selected ? "#FFFFFF" : color} /></View><Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{label}</Text></Pressable>; }

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>; }

function MealRow({ meal, language, onAdd, onPress, compact = false }: { meal: (typeof meals)[number]; language: "ar" | "en"; onAdd: () => void; onPress?: () => void; compact?: boolean }) { const category = getCategory(meal.category); return <Pressable onPress={onPress} style={({ pressed }) => [styles.mealRow, compact && styles.mealRowCompact, pressed && styles.pressed]}><Image source={{ uri: meal.image }} style={compact ? styles.mealImageCompact : styles.mealImage} /><View style={styles.mealCopy}><View style={styles.mealCategoryLine}><Text style={[styles.mealCategory, { color: category.color }]}>{getLocalized(category.label, language)}</Text><Text style={styles.mealPrep}>{meal.prepMinutes} min</Text></View><Text style={styles.mealName} numberOfLines={1}>{getLocalized(meal.name, language)}</Text><Text style={styles.mealDescription} numberOfLines={1}>{getLocalized(meal.description, language)}</Text><Text style={styles.mealPrice}>{formatJod(meal.price, language)}</Text></View><Pressable onPress={onAdd} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><MaterialIcons name="add" size={21} color="#FFFFFF" /></Pressable></Pressable>; }

function CartItemRow({ item, language, onUpdate }: { item: { meal: (typeof meals)[number]; quantity: number }; language: "ar" | "en"; onUpdate: (mealId: string, quantity: number) => void }) { return <View style={styles.cartItemRow}><Image source={{ uri: item.meal.image }} style={styles.cartItemImage} /><View style={styles.cartItemCopy}><Text style={styles.cartItemName}>{getLocalized(item.meal.name, language)}</Text><Text style={styles.cartItemPrice}>{formatJod(item.meal.price * item.quantity, language)}</Text><View style={styles.quantityControl}><Pressable onPress={() => onUpdate(item.meal.id, item.quantity - 1)} style={styles.quantityButton}><MaterialIcons name="remove" size={15} color="#C2410C" /></Pressable><Text style={styles.quantityText}>{item.quantity}</Text><Pressable onPress={() => onUpdate(item.meal.id, item.quantity + 1)} style={styles.quantityButton}><MaterialIcons name="add" size={15} color="#C2410C" /></Pressable></View></View></View>; }

function StatItem({ icon, value, label }: { icon: IconName; value: string; label: string }) { return <View style={styles.statItem}><MaterialIcons name={icon} size={16} color="#C2410C" /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <View style={styles.summaryRow}><Text style={[styles.summaryLabel, strong && styles.summaryStrong]}>{label}</Text><Text style={[styles.summaryValue, strong && styles.summaryStrong]}>{value}</Text></View>; }
function OptionCard({ selected, onPress, icon, title, subtitle }: { selected: boolean; onPress: () => void; icon: IconName; title: string; subtitle: string }) { return <Pressable onPress={onPress} style={[styles.optionCard, selected && styles.optionCardActive]}><MaterialIcons name={icon} size={19} color={selected ? "#FFFFFF" : "#C2410C"} /><Text style={[styles.optionCardTitle, selected && styles.optionCardTitleActive]}>{title}</Text><Text style={[styles.optionCardSubtitle, selected && styles.optionCardSubtitleActive]}>{subtitle}</Text></Pressable>; }
function DashboardMetric({ label, value, icon }: { label: string; value: string; icon: IconName }) { return <View style={styles.dashboardMetric}><MaterialIcons name={icon} size={17} color="#C2410C" /><Text style={styles.dashboardMetricValue}>{value}</Text><Text style={styles.dashboardMetricLabel}>{label}</Text></View>; }
function DashboardAction({ icon, title, detail, onPress }: { icon: IconName; title: string; detail: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.dashboardAction, pressed && styles.pressed]}><View style={styles.dashboardActionIcon}><MaterialIcons name={icon} size={19} color="#C2410C" /></View><View style={styles.dashboardActionCopy}><Text style={styles.dashboardActionTitle}>{title}</Text><Text style={styles.dashboardActionDetail}>{detail}</Text></View><MaterialIcons name="chevron-right" size={20} color="#A8A29E" /></Pressable>; }
function SettingRow({ icon, label, value, onPress }: { icon: IconName; label: string; value: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}><View style={styles.settingIcon}><MaterialIcons name={icon} size={19} color="#C2410C" /></View><Text style={styles.settingLabel}>{label}</Text><Text style={styles.settingValue}>{value}</Text><MaterialIcons name="chevron-right" size={19} color="#A8A29E" /></Pressable>; }
function EmptyState({ language }: { language: "ar" | "en" }) { return <View style={styles.emptyState}><MaterialIcons name="search-off" size={30} color="#C2410C" /><Text style={styles.emptyTitle}>{language === "ar" ? "ما لقينا هالطبخة" : "No meals found"}</Text><Text style={styles.emptyBody}>{language === "ar" ? "جرّبي كلمة ثانية أو شيلي الفلتر" : "Try another search or clear the filter"}</Text></View>; }
function EmptyCart({ language, onBack }: { language: "ar" | "en"; onBack: () => void }) { return <View style={styles.emptyState}><View style={styles.emptyBasket}><MaterialIcons name="shopping-basket" size={34} color="#C2410C" /></View><Text style={styles.emptyTitle}>{language === "ar" ? "السفرة فاضية" : "Your table is empty"}</Text><Text style={styles.emptyBody}>{language === "ar" ? "اختاري طبخة بيتية وخلي اللمة تبدأ" : "Pick a home-cooked meal and start the gathering"}</Text><Pressable onPress={onBack} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{language === "ar" ? "تصفّحي المطابخ" : "Browse kitchens"}</Text></Pressable></View>; }
function EmptyOrders({ language, onBack }: { language: "ar" | "en"; onBack: () => void }) { return <View style={styles.emptyState}><MaterialIcons name="receipt-long" size={34} color="#C2410C" /><Text style={styles.emptyTitle}>{language === "ar" ? "لسه ما في طلبات" : "No orders yet"}</Text><Text style={styles.emptyBody}>{language === "ar" ? "أول طلب بيبدأ من مطبخ بيت" : "Your first order starts at a home kitchen"}</Text><Pressable onPress={onBack} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{language === "ar" ? "اكتشفي الأكلات" : "Discover meals"}</Text></Pressable></View>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FDF8F6" },
  rtl: { direction: "rtl" },
  ltr: { direction: "ltr" },
  scrollContent: { padding: 18, paddingBottom: 116, gap: 18 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandCluster: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandIcon: { width: 42, height: 42, borderRadius: 13 },
  eyebrow: { fontSize: 10, letterSpacing: 1.2, color: "#C2410C", fontWeight: "900" },
  headerGreeting: { color: "#1C1917", fontSize: 19, fontWeight: "900", marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  languageToggle: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 18, backgroundColor: "#FFF1EC", borderWidth: 1, borderColor: "#F4C8B9" },
  languageText: { fontSize: 11, color: "#9C8F89", fontWeight: "800" },
  languageActive: { color: "#C2410C" },
  languageSlash: { color: "#D6B3A8", fontSize: 11 },
  iconButton: { width: 39, height: 39, borderRadius: 14, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#E7DCD6" },
  cartBadge: { position: "absolute", right: -3, top: -4, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: "#C2410C", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FDF8F6" },
  cartBadgeText: { fontSize: 9, color: "#FFFFFF", fontWeight: "900" },
  heroCard: { backgroundColor: "#C2410C", minHeight: 190, borderRadius: 28, padding: 20, flexDirection: "row", overflow: "hidden", position: "relative" },
  heroCopy: { flex: 1, zIndex: 2 },
  heroOverline: { color: "#FED7AA", fontSize: 12, fontWeight: "800", marginBottom: 9 },
  heroTitle: { color: "#FFFFFF", fontSize: 27, lineHeight: 32, fontWeight: "900", maxWidth: 220 },
  heroBody: { color: "#FFE4D6", fontSize: 12, lineHeight: 18, marginTop: 8, maxWidth: 210 },
  heroCta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16 },
  heroCtaText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  heroArt: { width: 120, alignItems: "center", justifyContent: "center", position: "relative" },
  heroPlate: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#FFF7F0", justifyContent: "center", alignItems: "center", borderWidth: 8, borderColor: "#FDBA74", transform: [{ rotate: "-10deg" }] },
  heroLeafOne: { width: 32, height: 15, borderRadius: 20, backgroundColor: "#A3C26B", position: "absolute", right: -1, top: 35, transform: [{ rotate: "34deg" }] },
  heroLeafTwo: { width: 28, height: 13, borderRadius: 20, backgroundColor: "#4D7C0F", position: "absolute", left: 7, bottom: 31, transform: [{ rotate: "-40deg" }] },
  searchRow: { flexDirection: "row", gap: 9 },
  searchField: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7DCD6", borderRadius: 16, height: 48, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, fontSize: 13, color: "#1C1917", paddingVertical: 0 },
  filterButton: { width: 48, height: 48, borderRadius: 16, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF1EC", borderWidth: 1, borderColor: "#F4C8B9" },
  filterButtonActive: { backgroundColor: "#C2410C", borderColor: "#C2410C" },
  filterPanel: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E7DCD6", padding: 12, gap: 8 },
  filterTitle: { fontSize: 12, fontWeight: "900", color: "#1C1917" },
  chipRow: { gap: 8 },
  chip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#F7F2EF", borderWidth: 1, borderColor: "#E7DCD6" },
  chipSelected: { backgroundColor: "#4D7C0F", borderColor: "#4D7C0F" },
  chipText: { fontSize: 11, fontWeight: "800", color: "#57534E" },
  chipTextSelected: { color: "#FFFFFF" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: "900", color: "#1C1917" },
  sectionAction: { color: "#C2410C", fontSize: 11, fontWeight: "900" },
  categoryRow: { gap: 9, paddingRight: 4 },
  categoryPill: { width: 75, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 20, alignItems: "center", gap: 7, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7DCD6" },
  categoryIcon: { width: 35, height: 35, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  categoryText: { fontSize: 11, color: "#57534E", fontWeight: "900" },
  categoryTextSelected: { color: "#FFFFFF" },
  activeOrderCard: { backgroundColor: "#EFF6E6", borderRadius: 20, padding: 14, borderWidth: 1, borderColor: "#D4E7B8", gap: 11 },
  activeOrderTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#65A30D" },
  activeOrderEyebrow: { fontSize: 10, color: "#4D7C0F", fontWeight: "900", flex: 1 },
  activeOrderId: { fontSize: 10, color: "#78716C", fontWeight: "800" },
  activeOrderBody: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  activeOrderTitle: { color: "#1C1917", fontSize: 14, fontWeight: "900" },
  activeOrderMeta: { color: "#78716C", fontSize: 11, marginTop: 3 },
  kitchenRow: { gap: 12, paddingRight: 4 },
  kitchenCard: { width: 208, backgroundColor: "#FFFFFF", borderRadius: 22, borderWidth: 1, borderColor: "#E7DCD6", overflow: "hidden" },
  kitchenImageWrap: { height: 132, position: "relative" },
  kitchenImage: { width: "100%", height: "100%" },
  openPill: { position: "absolute", top: 10, left: 10, backgroundColor: "#EFF6E6", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 4 },
  closedPill: { backgroundColor: "#F5F5F4" },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#65A30D" },
  closedDot: { backgroundColor: "#A8A29E" },
  openText: { fontSize: 10, color: "#4D7C0F", fontWeight: "900" },
  ratingPill: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 12, paddingHorizontal: 7, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 10, color: "#57534E", fontWeight: "900" },
  kitchenCardCopy: { padding: 13, gap: 3 },
  kitchenName: { fontSize: 14, color: "#1C1917", fontWeight: "900" },
  kitchenNeighborhood: { fontSize: 11, color: "#78716C" },
  kitchenMeta: { flexDirection: "row", gap: 5, alignItems: "center", marginTop: 4 },
  kitchenSpecialty: { fontSize: 10, color: "#C2410C", fontWeight: "900" },
  kitchenReviews: { color: "#A8A29E", fontSize: 10 },
  mealList: { gap: 10 },
  mealRow: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 10, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#E7DCD6" },
  mealRowCompact: { borderWidth: 0, padding: 0, borderRadius: 0 },
  mealImage: { width: 78, height: 78, borderRadius: 16 },
  mealImageCompact: { width: 84, height: 84, borderRadius: 16 },
  mealCopy: { flex: 1, gap: 3 },
  mealCategoryLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  mealCategory: { fontSize: 10, fontWeight: "900" },
  mealPrep: { color: "#A8A29E", fontSize: 10 },
  mealName: { fontSize: 14, color: "#1C1917", fontWeight: "900" },
  mealDescription: { fontSize: 10, color: "#78716C" },
  mealPrice: { color: "#C2410C", fontSize: 12, fontWeight: "900", marginTop: 2 },
  addButton: { width: 31, height: 31, borderRadius: 12, backgroundColor: "#C2410C", justifyContent: "center", alignItems: "center" },
  floatingCart: { position: "absolute", left: 18, right: 18, bottom: 24, borderRadius: 18, backgroundColor: "#1C1917", paddingHorizontal: 16, paddingVertical: 13, flexDirection: "row", justifyContent: "space-between", alignItems: "center", shadowColor: "#1C1917", shadowOpacity: 0.24, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  floatingCartEyebrow: { color: "#A8A29E", fontSize: 10, fontWeight: "700" },
  floatingCartPrice: { color: "#FFFFFF", fontSize: 15, fontWeight: "900", marginTop: 1 },
  floatingCartCta: { color: "#FED7AA", fontSize: 12, fontWeight: "900" },
  pageTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7DCD6", justifyContent: "center", alignItems: "center" },
  pageTitle: { color: "#1C1917", fontSize: 20, fontWeight: "900" },
  pageSubtitle: { color: "#78716C", fontSize: 11, marginTop: 2 },
  clearButton: { marginLeft: "auto", paddingHorizontal: 7, paddingVertical: 7 },
  clearText: { color: "#C2410C", fontSize: 11, fontWeight: "900" },
  profileHero: { height: 245, borderRadius: 26, overflow: "hidden", position: "relative" },
  profileImage: { width: "100%", height: "100%" },
  profileOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(28,25,23,0.35)" },
  profileHeroText: { position: "absolute", left: 18, right: 18, bottom: 18 },
  profileVerified: { alignSelf: "flex-start", backgroundColor: "rgba(77,124,15,0.9)", borderRadius: 11, paddingHorizontal: 8, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  profileVerifiedText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  profileName: { color: "#FFFFFF", fontSize: 26, fontWeight: "900" },
  profileNeighborhood: { color: "#F5F5F4", fontSize: 12, marginTop: 4 },
  profileStats: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 14, flexDirection: "row", justifyContent: "space-around", borderWidth: 1, borderColor: "#E7DCD6" },
  statItem: { alignItems: "center", gap: 3 },
  statValue: { color: "#1C1917", fontSize: 15, fontWeight: "900" },
  statLabel: { color: "#78716C", fontSize: 10 },
  storyCard: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 18, backgroundColor: "#FFF7ED", borderWidth: 1, borderColor: "#FED7AA" },
  storyIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" },
  storyCopy: { flex: 1 },
  storyTitle: { color: "#1C1917", fontSize: 13, fontWeight: "900" },
  storyBody: { color: "#78716C", fontSize: 11, lineHeight: 16, marginTop: 3 },
  cartItems: { gap: 10 },
  cartItemRow: { flexDirection: "row", gap: 11, padding: 10, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E7DCD6" },
  cartItemImage: { width: 75, height: 75, borderRadius: 15 },
  cartItemCopy: { flex: 1, justifyContent: "space-between", paddingVertical: 2 },
  cartItemName: { color: "#1C1917", fontSize: 13, fontWeight: "900" },
  cartItemPrice: { color: "#C2410C", fontSize: 12, fontWeight: "900" },
  quantityControl: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 13, backgroundColor: "#FFF1EC", paddingHorizontal: 5, paddingVertical: 3 },
  quantityButton: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  quantityText: { fontSize: 12, color: "#1C1917", fontWeight: "900" },
  deliveryCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: "#EFF6E6", borderRadius: 18, borderWidth: 1, borderColor: "#D4E7B8" },
  deliveryIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  deliveryCopy: { flex: 1 },
  deliveryTitle: { fontSize: 13, color: "#1C1917", fontWeight: "900" },
  deliveryBody: { fontSize: 11, color: "#4D7C0F", marginTop: 2 },
  summaryCard: { padding: 15, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E7DCD6", gap: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { fontSize: 12, color: "#78716C" },
  summaryValue: { fontSize: 12, color: "#57534E", fontWeight: "800" },
  summaryStrong: { color: "#1C1917", fontSize: 15, fontWeight: "900" },
  summaryDivider: { height: 1, backgroundColor: "#EEE8E3" },
  primaryButton: { minHeight: 52, borderRadius: 17, backgroundColor: "#C2410C", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  secondaryButton: { minHeight: 46, borderRadius: 15, backgroundColor: "#FFF1EC", borderWidth: 1, borderColor: "#F4C8B9", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 15 },
  secondaryButtonText: { color: "#C2410C", fontSize: 12, fontWeight: "900" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28,25,23,0.38)" },
  checkoutSheet: { backgroundColor: "#FDF8F6", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, paddingBottom: 28, gap: 13 },
  sheetHandle: { width: 38, height: 4, borderRadius: 3, backgroundColor: "#D6D3D1", alignSelf: "center" },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetEyebrow: { fontSize: 10, color: "#C2410C", fontWeight: "900", letterSpacing: 1 },
  sheetTitle: { fontSize: 22, fontWeight: "900", color: "#1C1917", marginTop: 2 },
  closeButton: { width: 35, height: 35, borderRadius: 12, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" },
  optionLabel: { color: "#1C1917", fontSize: 12, fontWeight: "900", marginTop: 4 },
  optionRow: { flexDirection: "row", gap: 8 },
  optionCard: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: "#E7DCD6", backgroundColor: "#FFFFFF", padding: 11, gap: 5 },
  optionCardActive: { backgroundColor: "#C2410C", borderColor: "#C2410C" },
  optionCardTitle: { fontSize: 11, color: "#1C1917", fontWeight: "900" },
  optionCardTitleActive: { color: "#FFFFFF" },
  optionCardSubtitle: { fontSize: 9, color: "#78716C" },
  optionCardSubtitleActive: { color: "#FFE4D6" },
  paymentList: { gap: 7 },
  paymentOption: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7DCD6" },
  paymentOptionActive: { borderColor: "#F4C8B9", backgroundColor: "#FFF7F0" },
  paymentIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#FFF1EC", justifyContent: "center", alignItems: "center" },
  paymentIconActive: { backgroundColor: "#C2410C" },
  paymentCopy: { flex: 1 },
  paymentTitle: { color: "#1C1917", fontSize: 12, fontWeight: "900" },
  paymentSubtitle: { color: "#78716C", fontSize: 10, marginTop: 2 },
  sheetTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 2 },
  sheetTotalLabel: { color: "#78716C", fontSize: 12 },
  sheetTotalValue: { color: "#1C1917", fontSize: 18, fontWeight: "900" },
  orderHero: { padding: 16, backgroundColor: "#1C1917", borderRadius: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderHeroEyebrow: { color: "#A8A29E", fontSize: 10, fontWeight: "800" },
  orderHeroId: { color: "#FFFFFF", fontSize: 21, fontWeight: "900", marginTop: 3 },
  orderEta: { alignItems: "flex-end" },
  orderEtaLabel: { color: "#A8A29E", fontSize: 10 },
  orderEtaValue: { color: "#FED7AA", fontSize: 12, fontWeight: "900", marginTop: 3 },
  statusPill: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EFF6E6", borderRadius: 15, paddingHorizontal: 9, paddingVertical: 7 },
  statusPillText: { color: "#4D7C0F", fontSize: 10, fontWeight: "900" },
  trackingCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#E7DCD6" },
  trackingTitle: { color: "#1C1917", fontSize: 16, fontWeight: "900", marginBottom: 15 },
  trackingRow: { minHeight: 53, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  trackRail: { width: 18, alignItems: "center" },
  trackDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#E7E5E4", justifyContent: "center", alignItems: "center" },
  trackDotDone: { backgroundColor: "#4D7C0F" },
  trackDotActive: { borderWidth: 3, borderColor: "#D4E7B8" },
  trackLine: { width: 2, height: 32, backgroundColor: "#E7E5E4" },
  trackLineDone: { backgroundColor: "#A3C26B" },
  trackCopy: { flex: 1 },
  trackLabel: { color: "#78716C", fontSize: 12, fontWeight: "800" },
  trackLabelActive: { color: "#1C1917", fontWeight: "900" },
  trackCaption: { color: "#A8A29E", fontSize: 10, marginTop: 2 },
  deliveredCard: { flexDirection: "row", gap: 9, alignItems: "center", backgroundColor: "#FFF7ED", borderRadius: 16, padding: 13 },
  deliveredText: { color: "#9A3412", fontSize: 11, fontWeight: "800", flex: 1 },
  dashboardHero: { backgroundColor: "#4D7C0F", borderRadius: 23, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dashboardOverline: { color: "#D9F99D", fontSize: 10, fontWeight: "900" },
  dashboardTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", marginTop: 5 },
  dashboardBody: { color: "#E2F3C5", fontSize: 11, marginTop: 4 },
  earningsRow: { flexDirection: "row", gap: 8 },
  dashboardMetric: { flex: 1, borderRadius: 16, padding: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7DCD6", gap: 4 },
  dashboardMetricValue: { color: "#1C1917", fontSize: 15, fontWeight: "900" },
  dashboardMetricLabel: { color: "#78716C", fontSize: 9 },
  incomingCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 15, borderWidth: 1, borderColor: "#FED7AA", gap: 9 },
  incomingTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  incomingEyebrow: { color: "#C2410C", fontSize: 10, fontWeight: "900" },
  incomingId: { color: "#1C1917", fontSize: 17, fontWeight: "900", marginTop: 2 },
  newPill: { backgroundColor: "#FFF1EC", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  newPillText: { color: "#C2410C", fontSize: 9, fontWeight: "900" },
  incomingTitle: { color: "#1C1917", fontSize: 14, fontWeight: "900" },
  incomingMeta: { color: "#78716C", fontSize: 11 },
  incomingActions: { flexDirection: "row", gap: 8 },
  rejectButton: { flex: 0.32, height: 44, borderRadius: 14, backgroundColor: "#F5F5F4", alignItems: "center", justifyContent: "center" },
  rejectText: { color: "#78716C", fontSize: 12, fontWeight: "900" },
  acceptButton: { flex: 1, height: 44, borderRadius: 14, backgroundColor: "#C2410C", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  acceptText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  prepNotice: { backgroundColor: "#EFF6E6", borderRadius: 13, padding: 10, flexDirection: "row", alignItems: "center", gap: 7 },
  prepNoticeText: { color: "#4D7C0F", fontSize: 11, fontWeight: "800" },
  dashboardList: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E7DCD6", overflow: "hidden" },
  dashboardAction: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: "#F2EFED" },
  dashboardActionIcon: { width: 36, height: 36, borderRadius: 13, backgroundColor: "#FFF1EC", alignItems: "center", justifyContent: "center" },
  dashboardActionCopy: { flex: 1 },
  dashboardActionTitle: { color: "#1C1917", fontSize: 12, fontWeight: "900" },
  dashboardActionDetail: { color: "#78716C", fontSize: 10, marginTop: 3 },
  menuManager: { backgroundColor: "#FFF7F0", padding: 12, borderRadius: 18, gap: 9 },
  menuManagerRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  menuThumb: { width: 42, height: 42, borderRadius: 12 },
  menuManagerCopy: { flex: 1 },
  menuManagerName: { color: "#1C1917", fontSize: 11, fontWeight: "900" },
  menuManagerMeta: { color: "#78716C", fontSize: 10, marginTop: 2 },
  menuStatus: { flexDirection: "row", alignItems: "center", gap: 4 },
  menuStatusText: { fontSize: 9, color: "#4D7C0F", fontWeight: "900" },
  cliqCard: { backgroundColor: "#EFF6E6", borderRadius: 18, padding: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  cliqBadge: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#4D7C0F", justifyContent: "center", alignItems: "center" },
  cliqBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  cliqCopy: { flex: 1 },
  cliqTitle: { color: "#1C1917", fontSize: 12, fontWeight: "900" },
  cliqBody: { color: "#4D7C0F", fontSize: 10, marginTop: 3 },
  profileHeader: { flexDirection: "row", alignItems: "center", gap: 11, paddingBottom: 4 },
  profileAvatar: { width: 50, height: 50, borderRadius: 17 },
  profileGreeting: { color: "#1C1917", fontSize: 17, fontWeight: "900" },
  profileMuted: { color: "#78716C", fontSize: 11, marginTop: 3 },
  switchRoleButton: { marginLeft: "auto", backgroundColor: "#FFF1EC", borderRadius: 14, paddingHorizontal: 9, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  switchRoleText: { color: "#C2410C", fontSize: 10, fontWeight: "900" },
  roleIcon: { marginLeft: "auto", width: 39, height: 39, borderRadius: 13, backgroundColor: "#FFF1EC", justifyContent: "center", alignItems: "center" },
  settingsCard: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E7DCD6", overflow: "hidden" },
  settingRow: { flexDirection: "row", alignItems: "center", padding: 13, gap: 10, borderBottomWidth: 1, borderBottomColor: "#F2EFED" },
  settingIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#FFF1EC", alignItems: "center", justifyContent: "center" },
  settingLabel: { color: "#1C1917", fontSize: 12, fontWeight: "800", flex: 1 },
  settingValue: { color: "#78716C", fontSize: 11 },
  aboutCard: { borderRadius: 20, padding: 16, backgroundColor: "#1C1917" },
  aboutTitle: { color: "#FED7AA", fontSize: 15, fontWeight: "900" },
  aboutBody: { color: "#D6D3D1", fontSize: 11, lineHeight: 17, marginTop: 7 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 8 },
  emptyBasket: { width: 66, height: 66, borderRadius: 24, backgroundColor: "#FFF1EC", justifyContent: "center", alignItems: "center", marginBottom: 5 },
  emptyTitle: { color: "#1C1917", fontSize: 17, fontWeight: "900" },
  emptyBody: { color: "#78716C", fontSize: 11, textAlign: "center", maxWidth: 220, lineHeight: 17 },
  bottomNav: { position: "absolute", left: 14, right: 14, bottom: 13, height: 69, backgroundColor: "rgba(255,255,255,0.97)", borderRadius: 23, borderWidth: 1, borderColor: "#E7DCD6", flexDirection: "row", alignItems: "center", justifyContent: "space-around", shadowColor: "#1C1917", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 7 },
  navItem: { alignItems: "center", justifyContent: "center", gap: 4, minWidth: 55, paddingVertical: 7 },
  navLabel: { color: "#A8A29E", fontSize: 9, fontWeight: "800" },
  navLabelActive: { color: "#C2410C" },
  navBrandDot: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#C2410C", alignItems: "center", justifyContent: "center", marginTop: -26, borderWidth: 4, borderColor: "#FDF8F6" },
  toast: { position: "absolute", left: 24, right: 24, bottom: 98, borderRadius: 15, backgroundColor: "#1C1917", paddingHorizontal: 13, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8, shadowColor: "#1C1917", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  toastText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", flex: 1 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
});
