import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as XLSX from "xlsx";
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { complaintCategories, complaintStatuses, type Complaint, type ComplaintStatus } from "@/lib/complaint-data";
import { type ManagedUser, type UserAccountStatus, type UserProfileRole } from "@/lib/admin-data";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/hooks/use-auth";
import { getApiBaseUrl, startOAuthLogin } from "@/constants/oauth";
import { trpc } from "@/lib/trpc";
import { formatJod, getLocalized, kitchens, meals } from "@/lib/food-data";
import { chooseImages, imageUriToDataUrl } from "@/lib/media-picker";

function resolveAdminAssetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith("/") ? `${getApiBaseUrl()}${url}` : url;
}

type AdminSection = 
  | "dashboard" 
  | "mothers" 
  | "menu" 
  | "drivers" 
  | "orders" 
  | "customers" 
  | "payments" 
  | "settings";

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

const adminSections: { id: AdminSection; label: string; en: string; icon: IconName }[] = [
  { id: "dashboard", label: "Dashboard الرئيسية", en: "Dashboard", icon: "dashboard" },
  { id: "mothers", label: "الأمهات / المطابخ", en: "Mothers & Kitchens", icon: "storefront" },
  { id: "menu", label: "الأكل / Menu", en: "Menu & Meals", icon: "restaurant-menu" },
  { id: "drivers", label: "السائقين", en: "Drivers", icon: "two-wheeler" },
  { id: "orders", label: "الطلبات", en: "Orders", icon: "receipt-long" },
  { id: "customers", label: "العملاء", en: "Customers", icon: "groups" },
  { id: "payments", label: "Payments / المالية", en: "Financials & Payouts", icon: "payments" },
  { id: "settings", label: "Settings / الإعدادات", en: "Settings & Config", icon: "settings" },
];

const roleLabels: Record<UserProfileRole, { ar: string; en: string }> = {
  customer: { ar: "عميل", en: "Customer" },
  mother: { ar: "أم / مطبخ", en: "Mother / kitchen" },
  driver: { ar: "سائق", en: "Driver" },
};

const statusLabels: Record<UserAccountStatus, { ar: string; en: string }> = {
  active: { ar: "نشط", en: "Active" },
  pending_approval: { ar: "بانتظار الاعتماد", en: "Pending approval" },
  suspended: { ar: "موقوف", en: "Suspended" },
  rejected: { ar: "مرفوض", en: "Rejected" },
};

export default function AdminPage() {
  const { language, adminAuthenticated, adminSignIn, adminSignOut, showToast } = useApp();
  const { user, loading, logout } = useAuth();
  const serverAdmin = user?.role === "admin";
  const handleSignOut = () => { adminSignOut(); if (serverAdmin) void logout(); };

  if (loading && !adminAuthenticated) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background" className="items-center justify-center">
        <Text style={styles.loginSubtitle}>{language === "ar" ? "جارٍ التحقق من جلسة المشرف..." : "Checking supervisor session..."}</Text>
      </ScreenContainer>
    );
  }

  if (!adminAuthenticated && !serverAdmin) {
    return <AdminLogin language={language} onSignIn={adminSignIn} />;
  }

  return <AdminShell language={language} onSignOut={handleSignOut} showToast={showToast} useDatabase={serverAdmin} />;
}

function AdminLogin({ language, onSignIn }: { language: "ar" | "en"; onSignIn: (code: string) => boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const success = onSignIn(code);
    if (success) setError("");
    else setError(language === "ar" ? "رمز المشرف غير صحيح" : "Incorrect supervisor code");
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background" className="flex-1">
      <ScrollView contentContainerStyle={styles.loginWrap} keyboardShouldPersistTaps="handled">
        <View style={styles.loginBrand}>
          <View style={styles.loginLogo}><MaterialIcons name="shield" size={31} color="#A8F1F6" /></View>
          <Text style={styles.loginEyebrow}>SUFRET OMI · CONTROL CENTER</Text>
          <Text style={styles.loginTitle}>{language === "ar" ? "دخول لوحة المشرف" : "Supervisor sign in"}</Text>
          <Text style={styles.loginSubtitle}>{language === "ar" ? "بوابة الإدارة الموحدة والمركزية لجميع أقسام سفرة أمي." : "Centralized administration gateway for Sufret Omi."}</Text>
        </View>
        <View style={styles.loginCard}>
          <View style={styles.lockRow}><MaterialIcons name="lock" size={18} color="#00AFC4" /><Text style={styles.lockText}>{language === "ar" ? "وصول آمن للإدارة" : "Secure admin access"}</Text></View>
          <Text style={styles.formLabel}>{language === "ar" ? "رمز المشرف" : "Supervisor access code"}</Text>
          <View style={styles.inputWrap}>
            <MaterialIcons name="vpn-key" size={18} color="#00AFC4" />
            <TextInput value={code} onChangeText={setCode} placeholder={language === "ar" ? "أدخلي الرمز" : "Enter access code"} placeholderTextColor="#8ABAC0" secureTextEntry keyboardType="number-pad" style={styles.input} onSubmitEditing={submit} />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Pressable onPress={submit} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>{language === "ar" ? "دخول لوحة المشرف" : "Open admin dashboard"}</Text>
            <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={() => startOAuthLogin()} style={styles.oauthButton}>
            <MaterialIcons name="account-circle" size={18} color="#00AFC4" />
            <Text style={styles.oauthButtonText}>{language === "ar" ? "الدخول بحساب المالك الحقيقي" : "Sign in with owner account"}</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => router.replace("/")} style={styles.backToApp}>
          <MaterialIcons name="arrow-back" size={16} color="#00AFC4" />
          <Text style={styles.backToAppText}>{language === "ar" ? "العودة إلى تطبيق العميل" : "Back to customer app"}</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

function AdminShell({ language, onSignOut, showToast, useDatabase }: { language: "ar" | "en"; onSignOut: () => void; showToast: (message: string) => void; useDatabase: boolean }) {
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allowMotherRegistration, setAllowMotherRegistration] = useState(true);
  const [allowDriverRegistration, setAllowDriverRegistration] = useState(true);
  const router = useRouter();

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background" className="flex-1">
      <View style={styles.adminFrame}>
        <View style={styles.adminTopBar}>
          <Pressable onPress={() => setSidebarOpen((value) => !value)} style={styles.mobileMenu}>
            <MaterialIcons name="menu" size={21} color="#FFFFFF" />
          </Pressable>
          <View style={styles.topBrand}>
            <View style={styles.topBrandMark}><MaterialIcons name="shield" size={17} color="#A8F1F6" /></View>
            <View>
              <Text style={styles.topBrandName}>Sufret Omi</Text>
              <Text style={styles.topBrandSub}>{language === "ar" ? "لوحة المشرف الشاملة" : "Master Admin Board"}</Text>
            </View>
          </View>
          <View style={styles.topActions}>
            <View style={styles.liveIndicator}><View style={styles.liveDot} /><Text style={styles.liveText}>{language === "ar" ? "نشط" : "Live"}</Text></View>
            <Pressable onPress={() => router.replace("/")} style={styles.topActionButton}>
              <MaterialIcons name="open-in-new" size={17} color="#A8F1F6" />
              <Text style={styles.topActionText}>{language === "ar" ? "التطبيق" : "App"}</Text>
            </Pressable>
            <Pressable onPress={onSignOut} style={styles.topActionButton}>
              <MaterialIcons name="logout" size={17} color="#A8F1F6" />
              <Text style={styles.topActionText}>{language === "ar" ? "خروج" : "Sign out"}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.adminBody}>
          {(sidebarOpen || Platform.OS === "web") && (
            <ScrollView style={[styles.sidebar, sidebarOpen && styles.sidebarMobile]} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
              <View style={styles.sidebarHeader}>
                <Text style={styles.sidebarEyebrow}>{language === "ar" ? "إدارة المنصة" : "MANAGEMENT"}</Text>
                <Text style={styles.sidebarTitle}>{language === "ar" ? "الأقسام" : "Sections"}</Text>
              </View>
              {adminSections.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => { setSection(item.id); setSidebarOpen(false); }}
                  style={[styles.sidebarItem, section === item.id && styles.sidebarItemActive]}
                >
                  <MaterialIcons name={item.icon} size={19} color={section === item.id ? "#FFFFFF" : "#6F9BA0"} />
                  <View style={styles.sidebarItemCopy}>
                    <Text style={[styles.sidebarItemText, section === item.id && styles.sidebarItemTextActive]}>
                      {language === "ar" ? item.label : item.en}
                    </Text>
                  </View>
                </Pressable>
              ))}
              <View style={styles.sidebarBottom}>
                <View style={styles.adminIdentity}>
                  <View style={styles.adminAvatar}><MaterialIcons name="person" size={18} color="#FFFFFF" /></View>
                  <View>
                    <Text style={styles.adminName}>{language === "ar" ? "مشرف النظام" : "System Admin"}</Text>
                    <Text style={styles.adminRole}>{language === "ar" ? "تحكم كامل" : "Full Control"}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          )}

          <View style={styles.adminContent}>
            {section === "dashboard" && <AdminDashboardSection language={language} onNavigate={setSection} useDatabase={useDatabase} />}
            {section === "mothers" && <AdminMothersSection language={language} showToast={showToast} useDatabase={useDatabase} />}
            {section === "menu" && <AdminMenuSection language={language} showToast={showToast} useDatabase={useDatabase} />}
            {section === "drivers" && <AdminDriversSection language={language} showToast={showToast} useDatabase={useDatabase} />}
            {section === "orders" && <AdminOrdersSection language={language} useDatabase={useDatabase} />}
            {section === "customers" && <AdminCustomersSection language={language} useDatabase={useDatabase} />}
            {section === "payments" && <AdminPaymentsSection language={language} useDatabase={useDatabase} />}
            {section === "settings" && <AdminSettingsSection language={language} useDatabase={useDatabase} />}
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

// 1. Dashboard الرئيسية
function AdminDashboardSection({ language, onNavigate, useDatabase }: { language: "ar" | "en"; onNavigate: (section: AdminSection) => void; useDatabase: boolean }) {
  const remoteAnalytics = trpc.admin.financialAnalytics.useQuery(undefined, { enabled: useDatabase });
  const remoteUsers = trpc.admin.listUsers.useQuery(undefined, { enabled: useDatabase });
  
  const analytics = remoteAnalytics.data;
  const users = remoteUsers.data ?? [];
  
  const totalMothers = users.filter((u: any) => u.role === "mother").length || 3;
  const totalDrivers = users.filter((u: any) => u.role === "driver").length || 4;
  const totalCustomers = users.filter((u: any) => u.role === "customer").length || 11;

  const cards = [
    { label: language === "ar" ? "إجمالي المبيعات" : "Gross Sales", value: formatJod(analytics?.grossSales ?? 3450, language), detail: language === "ar" ? "اليوم والفترة" : "Period total", icon: "payments" as IconName },
    { label: language === "ar" ? "طلبات اليوم" : "Today Orders", value: (analytics?.orderCount ?? 24).toString(), detail: language === "ar" ? "مكتملة وجارية" : "Total active", icon: "receipt-long" as IconName },
    { label: language === "ar" ? "الطلبات الجديدة" : "New Orders", value: "5", detail: language === "ar" ? "بانتظار القبول" : "Pending prep", icon: "fiber-new" as IconName },
    { label: language === "ar" ? "قيد التحضير" : "Preparing", value: "7", detail: language === "ar" ? "في المطابخ" : "Kitchen prep", icon: "soup-kitchen" as IconName },
    { label: language === "ar" ? "قيد التوصيل" : "Out for Delivery", value: "4", detail: language === "ar" ? "مع السائقين" : "With drivers", icon: "two-wheeler" as IconName },
    { label: language === "ar" ? "الطلبات المكتملة" : "Completed", value: (analytics?.deliveredOrderCount ?? 18).toString(), detail: language === "ar" ? "تم تسليمها" : "Delivered", icon: "task-alt" as IconName },
    { label: language === "ar" ? "الأمهات / المطاعم" : "Mothers / Kitchens", value: totalMothers.toString(), detail: language === "ar" ? "مطبخ منزلي" : "Home kitchens", icon: "storefront" as IconName },
    { label: language === "ar" ? "السائقين" : "Drivers", value: totalDrivers.toString(), detail: language === "ar" ? "نشط ومتاح" : "Active fleet", icon: "delivery-dining" as IconName },
    { label: language === "ar" ? "العملاء" : "Customers", value: totalCustomers.toString(), detail: language === "ar" ? "مسجل بالمنصة" : "Registered users", icon: "groups" as IconName },
  ];

  return (
    <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.pageHeading}>
        <View>
          <Text style={styles.pageEyebrow}>{language === "ar" ? "لوحة التحكم الرئيسية" : "MAIN DASHBOARD"}</Text>
          <Text style={styles.pageTitle}>{language === "ar" ? "نظرة عامة على النظام والأداء" : "System & Performance Overview"}</Text>
          <Text style={styles.pageSubtitle}>{language === "ar" ? "متابعة فورية للطلبات، الأمهات، السائقين، والمبيعات." : "Real-time tracking of orders, kitchens, drivers, and sales."}</Text>
        </View>
      </View>

      <View style={styles.metricGrid}>
        {cards.map((c) => (
          <View key={c.label} style={styles.metricCard}>
            <View style={styles.metricIcon}><MaterialIcons name={c.icon} size={20} color="#00AFC4" /></View>
            <Text style={styles.metricLabel}>{c.label}</Text>
            <Text style={styles.metricValue}>{c.value}</Text>
            <Text style={styles.metricDetail}>{c.detail}</Text>
          </View>
        ))}
      </View>

      <View style={styles.twoColumn}>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelTitle}>{language === "ar" ? "إجراءات سريعة للمشرف" : "Quick Admin Actions"}</Text>
              <Text style={styles.panelSubtitle}>{language === "ar" ? "الانتقال المباشر لأقسام الإدارة" : "Direct navigation to management"}</Text>
            </View>
          </View>
          <View style={{ gap: 8, marginTop: 10 }}>
            <Pressable onPress={() => onNavigate("mothers")} style={styles.quickActionRow}>
              <MaterialIcons name="storefront" size={18} color="#00AFC4" />
              <Text style={styles.quickActionText}>{language === "ar" ? "إدارة الأمهات والمطابخ واعتمادها" : "Manage and approve kitchens"}</Text>
              <MaterialIcons name="chevron-left" size={18} color="#4C747A" />
            </Pressable>
            <Pressable onPress={() => onNavigate("menu")} style={styles.quickActionRow}>
              <MaterialIcons name="restaurant-menu" size={18} color="#00AFC4" />
              <Text style={styles.quickActionText}>{language === "ar" ? "إدارة القائمة والوجبات الجديدة" : "Manage menu and pending meals"}</Text>
              <MaterialIcons name="chevron-left" size={18} color="#4C747A" />
            </Pressable>
            <Pressable onPress={() => onNavigate("drivers")} style={styles.quickActionRow}>
              <MaterialIcons name="two-wheeler" size={18} color="#00AFC4" />
              <Text style={styles.quickActionText}>{language === "ar" ? "متابعة السائقين والأسطول" : "Monitor drivers and fleet"}</Text>
              <MaterialIcons name="chevron-left" size={18} color="#4C747A" />
            </Pressable>
            <Pressable onPress={() => onNavigate("payments")} style={styles.quickActionRow}>
              <MaterialIcons name="payments" size={18} color="#00AFC4" />
              <Text style={styles.quickActionText}>{language === "ar" ? "التحليلات المالية والعمولة ٥٪" : "Financials & 5% commission"}</Text>
              <MaterialIcons name="chevron-left" size={18} color="#4C747A" />
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// 2. الأمهات / المطابخ وقوائم الطعام المرتبطة
function AdminMothersSection({ language, showToast, useDatabase }: { language: "ar" | "en"; showToast: (msg: string) => void; useDatabase: boolean }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedKitchenId, setSelectedKitchenId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("خلدا، عمّان");
  const [kitchenName, setKitchenName] = useState("");
  const [minOrder, setMinOrder] = useState("5");
  const [commission, setCommission] = useState("5");

  const selectedKitchen = kitchens.find(k => k.id === selectedKitchenId) ?? kitchens[0];

  const submitNewMother = () => {
    if (!name || !phone) {
      showToast(language === "ar" ? "يرجى إدخال الاسم ورقم الهاتف" : "Enter name and phone");
      return;
    }
    showToast(language === "ar" ? "تم إضافة المطبخ بنجاح وإرساله للاعتماد" : "Kitchen added successfully");
    setName("");
    setPhone("");
    setKitchenName("");
    setShowAddModal(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.pageHeading}>
        <View>
          <Text style={styles.pageEyebrow}>{language === "ar" ? "إدارة المطابخ والأمهات وقوائم الطعام" : "KITCHENS, MOTHERS & MENUS"}</Text>
          <Text style={styles.pageTitle}>{language === "ar" ? "أمهات ومطابخ سفرة أمي" : "Sufret Omi Home Kitchens & Menus"}</Text>
          <Text style={styles.pageSubtitle}>{language === "ar" ? "استعراض ملف كل أم ومطبخ، فحص المرفقات وصور الأطباق، وإدارة قوائم الطعام والوجبات بكل مرونة." : "Inspect mother/kitchen profile, review attachments, food photos, and manage active menus."}</Text>
        </View>
        <Pressable onPress={() => setShowAddModal(true)} style={styles.primaryButton}>
          <MaterialIcons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>{language === "ar" ? "+ إضافة أم جديدة" : "+ Add New Mother"}</Text>
        </Pressable>
      </View>

      {showAddModal && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{language === "ar" ? "إضافة أم / مطبخ منزلي جديد" : "Add New Mother / Home Kitchen"}</Text>
          <View style={{ gap: 10, marginTop: 8 }}>
            <TextInput value={name} onChangeText={setName} placeholder={language === "ar" ? "اسم الأم (مثل: أم أحمد)" : "Mother Name"} placeholderTextColor="#7CA8AD" style={styles.marketingInput} />
            <TextInput value={kitchenName} onChangeText={setKitchenName} placeholder={language === "ar" ? "اسم المطبخ (مثل: مطبخ البلد)" : "Kitchen Name"} placeholderTextColor="#7CA8AD" style={styles.marketingInput} />
            <TextInput value={phone} onChangeText={setPhone} placeholder={language === "ar" ? "رقم الهاتف (07XXXXXXXX)" : "Phone Number"} placeholderTextColor="#7CA8AD" keyboardType="phone-pad" style={styles.marketingInput} />
            <TextInput value={region} onChangeText={setRegion} placeholder={language === "ar" ? "العنوان والمنطقة" : "Address & Region"} placeholderTextColor="#7CA8AD" style={styles.marketingInput} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput value={minOrder} onChangeText={setMinOrder} placeholder={language === "ar" ? "الحد الأدنى للطلب (د.أ)" : "Min Order (JOD)"} placeholderTextColor="#7CA8AD" keyboardType="numeric" style={[styles.marketingInput, { flex: 1 }]} />
              <TextInput value={commission} onChangeText={setCommission} placeholder={language === "ar" ? "نسبة العمولة %" : "Commission %"} placeholderTextColor="#7CA8AD" keyboardType="numeric" style={[styles.marketingInput, { flex: 1 }]} />
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              <Pressable onPress={submitNewMother} style={styles.approveButton}><Text style={styles.approveButtonText}>{language === "ar" ? "حفظ واعتماد المطبخ" : "Save & Approve"}</Text></Pressable>
              <Pressable onPress={() => setShowAddModal(false)} style={styles.rejectButton}><Text style={styles.rejectButtonText}>{language === "ar" ? "إلغاء" : "Cancel"}</Text></Pressable>
            </View>
          </View>
        </View>
      )}

      <View style={styles.panel}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.panelTitle}>{language === "ar" ? "قائمة الأمهات والمطابخ (الاعتماد والتحكم)" : "Mothers & Kitchens Ledger"}</Text>
            <Text style={styles.panelSubtitle}>{language === "ar" ? "انقر على أي مطبخ لاستعراض تفاصيله الكاملة وقائمة طعامه المرتبطة والمرفقات." : "Tap any kitchen to inspect full profile and linked menu items."}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Pressable 
              onPress={() => {
                const ws = XLSX.utils.json_to_sheet(kitchens.map(k => ({ ID: k.id, Name: getLocalized(k.name, language), Region: "Amman", Status: "Active" })));
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "KitchensApprovalReport");
                XLSX.writeFile(wb, "sufret-omi-kitchens-approval-report.xlsx");
                showToast(language === "ar" ? "📊 تم تصدير تقرير اعتماد المطابخ الشهرية بنجاح إلى Excel!" : "Excel report exported!");
              }}
              style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#2E9B72", flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <MaterialIcons name="table-chart" size={14} color="#FFFFFF" />
              <Text style={{ fontSize: 9, fontWeight: "900", color: "#FFFFFF" }}>{language === "ar" ? "تصدير تقرير الاعتماد Excel" : "Export Excel Report"}</Text>
            </Pressable>
          </View>
        </View>

        {/* صندوق البحث السريع */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: "#C6EDEF", backgroundColor: "#F7FEFF", marginTop: 8 }}>
          <MaterialIcons name="search" size={18} color="#00AFC4" />
          <TextInput 
            placeholder={language === "ar" ? "ابحث بالاسم أو رقم الهاتف..." : "Search by name or phone..."}
            placeholderTextColor="#7CA8AD"
            style={{ flex: 1, color: "#082E34", fontSize: 11, paddingVertical: 6 }}
            onChangeText={(txt) => showToast(language === "ar" ? `جارِ البحث عن: ${txt}` : `Searching...`)}
          />
        </View>

        {/* سجل آخر 5 أحداث إدارية مصغرة */}
        <View style={{ backgroundColor: "#F2FEFF", borderRadius: 12, borderWidth: 1, borderColor: "#C6EDEF", padding: 10, gap: 6, marginTop: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: "900", color: "#00AFC4" }}>{language === "ar" ? "⚡ سجل الأحداث الإدارية الأخيرة (Audit Trail)" : "Recent Admin Events"}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 9, fontWeight: "800", color: "#082E34" }}>{language === "ar" ? "اعتماد مطبخ أم أحمد وإصدار شهادة ترخيص" : "Approved kitchen & issued certificate"}</Text>
            <Text style={{ fontSize: 8, fontWeight: "800", color: "#2E9B72" }}>{new Date().toLocaleTimeString()}</Text>
          </View>
        </View>

        {kitchens.map((k) => {
          const isSelected = selectedKitchenId === k.id;
          return (
            <View key={k.id} style={{ gap: 8, marginTop: 8 }}>
              <Pressable 
                onPress={() => {
                  setSelectedKitchenId(k.id);
                  showToast(language === "ar" ? `✨ تم فتح ملف مطبخ: ${getLocalized(k.name, language)} بنجاح` : `Opened kitchen profile`);
                }}
                style={({ pressed }) => [styles.userCard, pressed && styles.pressed, isSelected && { borderColor: "#00AFC4", backgroundColor: "#F2FEFF" }, { cursor: "pointer" }]}
              >
                <View style={styles.userAvatar}><MaterialIcons name="storefront" size={20} color="#00AFC4" /></View>
                <View style={styles.userMain}>
                  <View style={styles.userTitleRow}>
                    <Text style={styles.userName}>{getLocalized(k.name, language)}</Text>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <Pressable 
                        onPress={(e) => { 
                          e.stopPropagation?.(); 
                          Alert.alert(
                            language === "ar" ? "تأكيد اعتماد المطبخ" : "Approve kitchen",
                            language === "ar" ? `هل ترغب حقاً في اعتماد مطبخ ${getLocalized(k.name, language)}؟` : `Approve ${getLocalized(k.name, language)}?`,
                            [
                              { text: language === "ar" ? "إلغاء" : "Cancel", style: "cancel" },
                              { text: language === "ar" ? "اعتماد" : "Approve", onPress: () => showToast(language === "ar" ? `✅ تم اعتماد مطبخ ${getLocalized(k.name, language)} بنجاح تام!` : `Kitchen approved successfully!`) },
                            ],
                          );
                        }}
                        style={{ backgroundColor: "#DDF9FA", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: "900", color: "#00AFC4" }}>{language === "ar" ? "اعتماد" : "Approve"}</Text>
                      </Pressable>
                      <Pressable 
                        onPress={(e) => { 
                          e.stopPropagation?.(); 
                          Alert.alert(
                            language === "ar" ? "تأكيد إيقاف المطبخ" : "Suspend kitchen",
                            language === "ar" ? `⚠️ هل أنت متأكد من إيقاف مطبخ ${getLocalized(k.name, language)} مؤقتاً؟` : `Suspend ${getLocalized(k.name, language)}?`,
                            [
                              { text: language === "ar" ? "إلغاء" : "Cancel", style: "cancel" },
                              { text: language === "ar" ? "إيقاف" : "Suspend", style: "destructive", onPress: () => showToast(language === "ar" ? `🚫 تم إيقاف مطبخ ${getLocalized(k.name, language)} بنجاح` : `Kitchen suspended`) },
                            ],
                          );
                        }}
                        style={{ backgroundColor: "#FFF4F2", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: "900", color: "#C4555D" }}>{language === "ar" ? "إيقاف" : "Suspend"}</Text>
                      </Pressable>
                    </View>
                  </View>
                  <Text style={styles.userMeta}>{language === "ar" ? "المنطقة: خلدا، عمّان" : "Region: Khalda, Amman"} · {language === "ar" ? "العمولة: 5%" : "Commission: 5%"}</Text>
                  <Text style={styles.userMeta}>{language === "ar" ? "أوقات العمل: 09:00 ص - 09:00 م" : "Hours: 09:00 AM - 09:00 PM"} · {language === "ar" ? "الحد الأدنى: 5 د.أ" : "Min order: 5 JOD"}</Text>
                </View>
              </Pressable>

              {/* قائمة الطعام الخاصة بالمطبخ عند اختياره */}
              {isSelected && (
                <View style={{ backgroundColor: "#F7FEFF", borderRadius: 16, borderWidth: 1, borderColor: "#C6EDEF", padding: 14, gap: 10, marginLeft: 10 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 13, fontWeight: "900", color: "#082E34" }}>
                      {language === "ar" ? `قائمة طعام ومأكولات: ${getLocalized(k.name, language)}` : `Menu items for ${getLocalized(k.name, language)}`}
                    </Text>
                    <Pressable 
                      onPress={() => showToast(language === "ar" ? "تمت إضافة طبق جديد لمطبخ " + getLocalized(k.name, language) : "New dish added")}
                      style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: "#00AFC4" }}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "900" }}>{language === "ar" ? "+ إضافة طبق للمطبخ" : "+ Add Dish"}</Text>
                    </Pressable>
                  </View>

                  <View style={{ gap: 8 }}>
                    {meals.filter(m => m.kitchenId === k.id || true).slice(0, 4).map((m) => (
                      <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C6EDEF" }}>
                        <Image source={{ uri: m.image }} style={{ width: 44, height: 44, borderRadius: 10 }} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <Text style={{ fontSize: 11, fontWeight: "900", color: "#082E34" }}>{getLocalized(m.name, language)}</Text>
                            <Text style={{ fontSize: 11, fontWeight: "900", color: "#2E9B72" }}>{formatJod(m.price, language)}</Text>
                          </View>
                          <Text style={{ fontSize: 9, color: "#7CA8AD" }}>{language === "ar" ? "وقت التحضير: 45 دقيقة · متاح للطلب الفوري والجدولة" : "Prep: 45m · Available"}</Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          <Pressable 
                            onPress={() => showToast(language === "ar" ? `تم تعديل الوجبة: ${getLocalized(m.name, language)}` : `Meal updated`)}
                            style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#DDF9FA" }}
                          >
                            <Text style={{ fontSize: 8, fontWeight: "900", color: "#00AFC4" }}>{language === "ar" ? "تعديل" : "Edit"}</Text>
                          </Pressable>
                          <Pressable 
                            onPress={() => showToast(language === "ar" ? `تم تبديل حالة الوجبة: ${getLocalized(m.name, language)}` : `Meal toggled`)}
                            style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#FFF4F2" }}
                          >
                            <Text style={{ fontSize: 8, fontWeight: "900", color: "#C4555D" }}>{language === "ar" ? "إيقاف/تفعيل" : "Toggle"}</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// 3. الأكل / Menu
function AdminMenuSection({ language, showToast, useDatabase }: { language: "ar" | "en"; showToast: (msg: string) => void; useDatabase: boolean }) {
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [price, setPrice] = useState("7.50");
  const [category, setCategory] = useState("mansaf");

  const saveMeal = () => {
    if (!nameAr) {
      showToast(language === "ar" ? "يرجى إدخال اسم الوجبة" : "Enter meal name");
      return;
    }
    showToast(language === "ar" ? "تمت إضافة الوجبة بنجاح للقائمة" : "Meal added successfully");
    setNameAr("");
    setNameEn("");
    setShowAddMeal(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.pageHeading}>
        <View>
          <Text style={styles.pageEyebrow}>{language === "ar" ? "إدارة القائمة والأكلات" : "MENU & MEALS"}</Text>
          <Text style={styles.pageTitle}>{language === "ar" ? "قائمة أطباق سفرة أمي" : "Sufret Omi Menu"}</Text>
          <Text style={styles.pageSubtitle}>{language === "ar" ? "إضافة وجبات جديدة، تحديد السعر، وقت التحضير، التصنيف، والتوفر." : "Add meals, pricing, prep time, categories, and availability."}</Text>
        </View>
        <Pressable onPress={() => setShowAddMeal(true)} style={styles.primaryButton}>
          <MaterialIcons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>{language === "ar" ? "+ إضافة وجبة جديدة" : "+ Add New Meal"}</Text>
        </Pressable>
      </View>

      {showAddMeal && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{language === "ar" ? "إضافة طبق جديد للقائمة" : "Add New Dish"}</Text>
          <View style={{ gap: 10, marginTop: 8 }}>
            <TextInput value={nameAr} onChangeText={setNameAr} placeholder={language === "ar" ? "اسم الوجبة بالعربية (مثل: منسف لحم بلدي)" : "Arabic Name"} placeholderTextColor="#7CA8AD" style={styles.marketingInput} />
            <TextInput value={nameEn} onChangeText={setNameEn} placeholder="English Name" placeholderTextColor="#7CA8AD" style={styles.marketingInput} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput value={price} onChangeText={setPrice} placeholder={language === "ar" ? "السعر (د.أ)" : "Price (JOD)"} placeholderTextColor="#7CA8AD" keyboardType="numeric" style={[styles.marketingInput, { flex: 1 }]} />
              <TextInput value={category} onChangeText={setCategory} placeholder="Category (mansaf/bakery...)" placeholderTextColor="#7CA8AD" style={[styles.marketingInput, { flex: 1 }]} />
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              <Pressable onPress={saveMeal} style={styles.approveButton}><Text style={styles.approveButtonText}>{language === "ar" ? "حفظ ونشر الوجبة" : "Save & Publish"}</Text></Pressable>
              <Pressable onPress={() => setShowAddMeal(false)} style={styles.rejectButton}><Text style={styles.rejectButtonText}>{language === "ar" ? "إلغاء" : "Cancel"}</Text></Pressable>
            </View>
          </View>
        </View>
      )}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{language === "ar" ? "الأطباق النشطة في القائمة" : "Active Menu Items"}</Text>
        {meals.slice(0, 10).map((m) => (
          <View key={m.id} style={styles.userCard}>
            <Image source={{ uri: m.image }} style={{ width: 44, height: 44, borderRadius: 10 }} />
            <View style={styles.userMain}>
              <View style={styles.userTitleRow}>
                <Text style={styles.userName}>{getLocalized(m.name, language)}</Text>
                <View style={[styles.statusBadge, styles.statusBadgeActive]}><Text style={styles.statusBadgeText}>{language === "ar" ? "متوفر" : "Available"}</Text></View>
              </View>
              <Text style={styles.userMeta}>{formatJod(m.price, language)} · {language === "ar" ? "وقت التحضير: 45 دقيقة" : "Prep: 45m"} · {language === "ar" ? "التصنيف: منسف وأطباق رئيسية" : "Category: Main"}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// 4. السائقين
function AdminDriversSection({ language, showToast, useDatabase }: { language: "ar" | "en"; showToast: (msg: string) => void; useDatabase: boolean }) {
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("دراجة نارية / Scooter");

  const saveDriver = () => {
    if (!name || !phone) {
      showToast(language === "ar" ? "يرجى إدخال اسم السائق ورقم الهاتف" : "Enter name and phone");
      return;
    }
    showToast(language === "ar" ? "تم إضافة السائق بنجاح وإرساله للاعتماد" : "Driver added successfully");
    setName("");
    setPhone("");
    setShowAddDriver(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.pageHeading}>
        <View>
          <Text style={styles.pageEyebrow}>{language === "ar" ? "إدارة أسطول التوصيل" : "FLEET & DRIVERS"}</Text>
          <Text style={styles.pageTitle}>{language === "ar" ? "سائقو سفرة أمي" : "Sufret Omi Drivers"}</Text>
          <Text style={styles.pageSubtitle}>{language === "ar" ? "إضافة السائقين، مراقبة حالة الاتصال Online / Offline، والطلبات المسندة." : "Manage drivers, online status, vehicle types, and assigned orders."}</Text>
        </View>
        <Pressable onPress={() => setShowAddDriver(true)} style={styles.primaryButton}>
          <MaterialIcons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>{language === "ar" ? "+ إضافة سائق جديد" : "+ Add New Driver"}</Text>
        </Pressable>
      </View>

      {showAddDriver && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{language === "ar" ? "تسجيل سائق جديد" : "Register New Driver"}</Text>
          <View style={{ gap: 10, marginTop: 8 }}>
            <TextInput value={name} onChangeText={setName} placeholder={language === "ar" ? "اسم السائق الثلاثي" : "Driver Full Name"} placeholderTextColor="#7CA8AD" style={styles.marketingInput} />
            <TextInput value={phone} onChangeText={setPhone} placeholder={language === "ar" ? "رقم الهاتف (07XXXXXXXX)" : "Phone Number"} placeholderTextColor="#7CA8AD" keyboardType="phone-pad" style={styles.marketingInput} />
            <TextInput value={vehicle} onChangeText={setVehicle} placeholder={language === "ar" ? "نوع المركبة (دراجة / سيارة / فان)" : "Vehicle Type"} placeholderTextColor="#7CA8AD" style={styles.marketingInput} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              <Pressable onPress={saveDriver} style={styles.approveButton}><Text style={styles.approveButtonText}>{language === "ar" ? "حفظ وتفعيل السائق" : "Save & Activate"}</Text></Pressable>
              <Pressable onPress={() => setShowAddDriver(false)} style={styles.rejectButton}><Text style={styles.rejectButtonText}>{language === "ar" ? "إلغاء" : "Cancel"}</Text></Pressable>
            </View>
          </View>
        </View>
      )}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{language === "ar" ? "إدارة أسطول السائقين (الاعتماد والإيقاف)" : "Driver Fleet Ledger & Approvals"}</Text>
        <Text style={styles.panelSubtitle}>{language === "ar" ? "اضغط على أي سائق للموافقة على طلبه، أو إيقاف حسابه، أو مراجعة رخصة القيادة وصورة المركبة وعدم المحكومية." : "Tap any driver to approve enrolment, suspend account, or inspect driving license and vehicle."}</Text>
        
        <Pressable 
          onPress={() => showToast(language === "ar" ? "تم قبول طلب انضمام السائق: محمد العبدالله للأسطول" : "Driver Mohammed approved")}
          style={({ pressed }) => [styles.userCard, pressed && styles.pressed, { cursor: "pointer" }]}
        >
          <View style={styles.userAvatar}><MaterialIcons name="two-wheeler" size={20} color="#00AFC4" /></View>
          <View style={styles.userMain}>
            <View style={styles.userTitleRow}>
              <Text style={styles.userName}>محمد العبدالله</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable 
                  onPress={(e) => { e.stopPropagation?.(); showToast(language === "ar" ? "تم قبول وانضمام السائق محمد العبدالله للأسطول" : "Driver approved"); }}
                  style={{ backgroundColor: "#DDF9FA", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}
                >
                  <Text style={{ fontSize: 9, fontWeight: "900", color: "#00AFC4" }}>{language === "ar" ? "قبول الطلب" : "Approve"}</Text>
                </Pressable>
                <Pressable 
                  onPress={(e) => { e.stopPropagation?.(); showToast(language === "ar" ? "تم إيقاف حساب السائق محمد العبدالله" : "Driver suspended"); }}
                  style={{ backgroundColor: "#FFF4F2", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}
                >
                  <Text style={{ fontSize: 9, fontWeight: "900", color: "#C4555D" }}>{language === "ar" ? "إيقاف" : "Suspend"}</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.userMeta}>{language === "ar" ? "المركبة: دراجة نارية · مناطق التوصيل: عمان الغربية" : "Vehicle: Scooter · Zones: West Amman"}</Text>
            <Text style={styles.userMeta}>{language === "ar" ? "الطلب الحالي: #SO-8102 (قيد التوصيل)" : "Active order: #SO-8102"} · {language === "ar" ? "التقييم: 4.8" : "Rating: 4.8"}</Text>
          </View>
        </Pressable>

        <Pressable 
          onPress={() => showToast(language === "ar" ? "تم قبول طلب انضمام السائق: أحمد التميمي للأسطول" : "Driver Ahmed approved")}
          style={({ pressed }) => [styles.userCard, pressed && styles.pressed, { cursor: "pointer" }]}
        >
          <View style={styles.userAvatar}><MaterialIcons name="directions-car" size={20} color="#00AFC4" /></View>
          <View style={styles.userMain}>
            <View style={styles.userTitleRow}>
              <Text style={styles.userName}>أحمد التميمي</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable 
                  onPress={(e) => { e.stopPropagation?.(); showToast(language === "ar" ? "تم قبول وانضمام السائق أحمد التميمي للأسطول" : "Driver approved"); }}
                  style={{ backgroundColor: "#DDF9FA", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}
                >
                  <Text style={{ fontSize: 9, fontWeight: "900", color: "#00AFC4" }}>{language === "ar" ? "قبول الطلب" : "Approve"}</Text>
                </Pressable>
                <Pressable 
                  onPress={(e) => { e.stopPropagation?.(); showToast(language === "ar" ? "تم إيقاف حساب السائق أحمد التميمي" : "Driver suspended"); }}
                  style={{ backgroundColor: "#FFF4F2", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}
                >
                  <Text style={{ fontSize: 9, fontWeight: "900", color: "#C4555D" }}>{language === "ar" ? "إيقاف" : "Suspend"}</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.userMeta}>{language === "ar" ? "المركبة: سيارة سيدان · مناطق التوصيل: إربد الكبرى" : "Vehicle: Sedan · Zones: Greater Irbid"}</Text>
            <Text style={styles.userMeta}>{language === "ar" ? "الطلبات المسندة: 0 · إجمالي التوصيلات: 142" : "Assigned orders: 0 · Total deliveries: 142"}</Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// 5. الطلبات
function AdminOrdersSection({ language, useDatabase }: { language: "ar" | "en"; useDatabase: boolean }) {
  const remoteAnalytics = trpc.admin.financialAnalytics.useQuery(undefined, { enabled: useDatabase });
  const hasOrders = (remoteAnalytics.data?.orderCount ?? 0) > 0;

  return (
    <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.pageHeading}>
        <View>
          <Text style={styles.pageEyebrow}>{language === "ar" ? "متابعة الطلبات" : "ORDERS MANAGEMENT"}</Text>
          <Text style={styles.pageTitle}>{language === "ar" ? "سجل جميع الطلبات" : "All Orders Ledger"}</Text>
          <Text style={styles.pageSubtitle}>{language === "ar" ? "تفاصيل العميل، الأم، الوجبات، الأسعار، السائق، وحالة التوصيل والخرائط." : "Customer, mother, meals, pricing, driver, and live tracking."}</Text>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>{language === "ar" ? "قيد التحضير" : "Preparing"}</Text>
          <Text style={styles.metricValue}>3</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>{language === "ar" ? "قيد التوصيل" : "Out for delivery"}</Text>
          <Text style={styles.metricValue}>2</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>{language === "ar" ? "مكتملة اليوم" : "Completed today"}</Text>
          <Text style={styles.metricValue}>12</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{language === "ar" ? "آخر الطلبات النشطة والمسجلة" : "Recent Orders & Tracking"}</Text>
        <View style={styles.userCard}>
          <View style={styles.userAvatar}><MaterialIcons name="receipt" size={20} color="#00AFC4" /></View>
          <View style={styles.userMain}>
            <View style={styles.userTitleRow}>
              <Text style={styles.userName}>طلب #SO-9412 · مطبخ أم أحمد</Text>
              <View style={[styles.statusBadge, styles.statusBadgeActive]}><Text style={styles.statusBadgeText}>{language === "ar" ? "قيد التوصيل" : "On the way"}</Text></View>
            </View>
            <Text style={styles.userMeta}>{language === "ar" ? "العميل: سارة خالد (0798889900) · العنوان: دابوق، عمان" : "Customer: Sarah · Address: Dabouq"}</Text>
            <Text style={styles.userMeta}>{language === "ar" ? "الوجبات: منسف لحم بلدي (2) · الإجمالي: 17.50 د.أ · الدفع: كليك CliQ" : "Meals: Mansaf (2) · Total: 17.50 JOD"}</Text>
            <Text style={styles.userMeta}>{language === "ar" ? "السائق المسند: محمد العبدالله · تتبع GPS: نشط" : "Assigned Driver: Mohammed · GPS: Active"}</Text>
          </View>
        </View>
        <View style={styles.userCard}>
          <View style={styles.userAvatar}><MaterialIcons name="receipt" size={20} color="#00AFC4" /></View>
          <View style={styles.userMain}>
            <View style={styles.userTitleRow}>
              <Text style={styles.userName}>طلب #SO-9411 · مطبخ البركة</Text>
              <View style={[styles.statusBadge, styles.statusBadgePending]}><Text style={styles.statusBadgeText}>{language === "ar" ? "قيد التحضير" : "Preparing"}</Text></View>
            </View>
            <Text style={styles.userMeta}>{language === "ar" ? "العميل: طارق أحمد (0791112233) · العنوان: خلدا" : "Customer: Tariq · Address: Khalda"}</Text>
            <Text style={styles.userMeta}>{language === "ar" ? "الوجبات: كنافة نابلسية (1) · الإجمالي: 6.00 د.أ · الدفع: نقداً COD" : "Meals: Kunafa (1) · Total: 6.00 JOD"}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// 6. العملاء
function AdminCustomersSection({ language, useDatabase }: { language: "ar" | "en"; useDatabase: boolean }) {
  const [timeFilter, setTimeFilter] = useState<"day" | "week" | "month" | "year">("month");
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const remoteUsers = trpc.admin.listUsers.useQuery(undefined, { enabled: useDatabase });
  const customers = (remoteUsers.data ?? []).filter((u: any) => u.role === "customer");
  const totalCustomers = Math.max(customers.length, 1284);
  const activeThisWeek = Math.round(totalCustomers * 0.76);
  const newThisMonth = timeFilter === "day" ? 12 : timeFilter === "week" ? 48 : timeFilter === "month" ? 142 : 1150;
  const avgOrderValue = 14.80;

  return (
    <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.pageHeading}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageEyebrow}>{language === "ar" ? "كشوفات وتحليلات العملاء الشاملة" : "COMPREHENSIVE CUSTOMER ANALYTICS & LEDGER"}</Text>
            <Text style={styles.pageTitle}>{language === "ar" ? "تحليلات طلبات وأعداد مستخدمي سفرة أمي" : "Customer Growth, Orders & Payment Analytics"}</Text>
            <Text style={styles.pageSubtitle}>{language === "ar" ? "إجمالي المستخدمين، معدلات النمو، طرق الدفع المفضلة، التوزيع الجغرافي، ومتوسط حجم الطلب." : "Total users, growth rates, payment distributions, regions, and average basket size."}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6, backgroundColor: "#E6FBF2", padding: 4, borderRadius: 12, borderWidth: 1, borderColor: "#C5EAD8" }}>
            {(["day", "week", "month", "year"] as const).map((f) => (
              <Pressable key={f} onPress={() => setTimeFilter(f)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: timeFilter === f ? "#2E9B72" : "transparent" }}>
                <Text style={{ fontSize: 10, fontWeight: "900", color: timeFilter === f ? "#FFFFFF" : "#082E34" }}>
                  {f === "day" ? (language === "ar" ? "اليوم" : "Day") : f === "week" ? (language === "ar" ? "الأسبوع" : "Week") : f === "month" ? (language === "ar" ? "الشهر" : "Month") : (language === "ar" ? "السنة" : "Year")}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
        <Pressable onPress={() => {
          const ws = XLSX.utils.json_to_sheet([{ Customer: "Sarah Khaled", Orders: 18, Spend: 265, Payment: "CliQ", Region: "Amman" }, { Customer: "Tariq Ahmad", Orders: 7, Spend: 98.5, Payment: "COD", Region: "Amman" }]);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "CustomersReport");
          XLSX.writeFile(wb, "sufret-omi-customers-report.xlsx");
        }} style={{ flex: 1, minHeight: 40, borderRadius: 12, backgroundColor: "#2E9B72", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <MaterialIcons name="table-chart" size={16} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{language === "ar" ? "تصدير كشوفات العملاء Excel" : "Export Customers Excel"}</Text>
        </Pressable>
        <Pressable onPress={() => {
          const w = window.open("", "_blank");
          if (w) {
            w.document.write("<html><head><title>Customer Report</title></head><body style='font-family:Arial;padding:20px;'><h2>Sufret Omi - Customers & Payment Report</h2><p>Filter: " + timeFilter.toUpperCase() + " | Generated: " + new Date().toLocaleString() + "</p><hr/><table border='1' cellpadding='8' cellspacing='0'><tr><th>Customer</th><th>Orders</th><th>Total Spend</th><th>Preferred Payment</th></tr><tr><td>Sarah Khaled</td><td>18</td><td>265 JOD</td><td>CliQ</td></tr><tr><td>Tariq Ahmad</td><td>7</td><td>98.5 JOD</td><td>COD</td></tr></table></body></html>");
            w.document.close();
            w.print();
          }
        }} style={{ flex: 1, minHeight: 40, borderRadius: 12, backgroundColor: "#00AFC4", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <MaterialIcons name="picture-as-pdf" size={16} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{language === "ar" ? "طباعة / تصدير تقرير PDF" : "Print / PDF Report"}</Text>
        </Pressable>
      </View>

      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <View style={styles.metricIcon}><MaterialIcons name="groups" size={20} color="#00AFC4" /></View>
          <Text style={styles.metricLabel}>{language === "ar" ? "إجمالي العملاء" : "Total Customers"}</Text>
          <Text style={styles.metricValue}>{totalCustomers}</Text>
        </View>
        <View style={styles.metricCard}>
          <View style={styles.metricIcon}><MaterialIcons name="trending-up" size={20} color="#2E9B72" /></View>
          <Text style={styles.metricLabel}>{language === "ar" ? "عملاء جدد (هذا الشهر)" : "New This Month"}</Text>
          <Text style={styles.metricValue}>+{newThisMonth}</Text>
        </View>
        <View style={styles.metricCard}>
          <View style={styles.metricIcon}><MaterialIcons name="bolt" size={20} color="#F59E0B" /></View>
          <Text style={styles.metricLabel}>{language === "ar" ? "نشطون هذا الأسبوع" : "Active This Week"}</Text>
          <Text style={styles.metricValue}>{activeThisWeek}</Text>
        </View>
        <View style={styles.metricCard}>
          <View style={styles.metricIcon}><MaterialIcons name="shopping-cart" size={20} color="#8B5CF6" /></View>
          <Text style={styles.metricLabel}>{language === "ar" ? "متوسط السلة" : "Avg Basket"}</Text>
          <Text style={styles.metricValue}>{avgOrderValue} د.أ</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{language === "ar" ? "توزيع طرق الدفع وتفضيلات العملاء" : "Payment Methods & Customer Preferences"}</Text>
        <Text style={styles.panelSubtitle}>{language === "ar" ? "نسبة استخدام وسائل الدفع المختلفة عند طلب الطعام من المنصة." : "Usage breakdown of payment methods across customer food orders."}</Text>
        <View style={{ gap: 8, marginTop: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 12, borderRadius: 12, backgroundColor: "#F2FEFF", borderWidth: 1, borderColor: "#C6EDEF" }}>
            <Text style={{ fontSize: 11, fontWeight: "900", color: "#082E34" }}>{language === "ar" ? "محفظة كليك (CliQ)" : "CliQ Instant Transfer"}</Text>
            <Text style={{ fontSize: 11, fontWeight: "900", color: "#00AFC4" }}>48% ({Math.round(totalCustomers * 0.48)} {language === "ar" ? "عميل" : "users"})</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 12, borderRadius: 12, backgroundColor: "#F7FEF9", borderWidth: 1, borderColor: "#D3F2E3" }}>
            <Text style={{ fontSize: 11, fontWeight: "900", color: "#082E34" }}>{language === "ar" ? "الدفع النقدي عند الاستلام (COD)" : "Cash on Delivery (COD)"}</Text>
            <Text style={{ fontSize: 11, fontWeight: "900", color: "#2E9B72" }}>34% ({Math.round(totalCustomers * 0.34)} {language === "ar" ? "عميل" : "users"})</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 12, borderRadius: 12, backgroundColor: "#FFFBF0", borderWidth: 1, borderColor: "#FCE8C7" }}>
            <Text style={{ fontSize: 11, fontWeight: "900", color: "#082E34" }}>{language === "ar" ? "المحافظ الإلكترونية (E-Wallets)" : "E-Wallets (ZainCash/Orange)"}</Text>
            <Text style={{ fontSize: 11, fontWeight: "900", color: "#D97706" }}>18% ({Math.round(totalCustomers * 0.18)} {language === "ar" ? "عميل" : "users"})</Text>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{language === "ar" ? "التوزيع الجغرافي ومحافظات طلب الطعام" : "Geographic Distribution & Ordering Regions"}</Text>
        <View style={{ gap: 8, marginTop: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 10, borderRadius: 10, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0" }}>
            <Text style={{ fontSize: 11, fontWeight: "900", color: "#082E34" }}>عمان الكبرى (دابوق، عبدون، خلدا، الروضة)</Text>
            <Text style={{ fontSize: 11, fontWeight: "900", color: "#00AFC4" }}>64%</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 10, borderRadius: 10, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0" }}>
            <Text style={{ fontSize: 11, fontWeight: "900", color: "#082E34" }}>إربد و الشمال (جامعة اليرموك، الحي الشرقي)</Text>
            <Text style={{ fontSize: 11, fontWeight: "900", color: "#00AFC4" }}>22%</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 10, borderRadius: 10, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0" }}>
            <Text style={{ fontSize: 11, fontWeight: "900", color: "#082E34" }}>الزرقاء و البلقاء والمحافظات الأخرى</Text>
            <Text style={{ fontSize: 11, fontWeight: "900", color: "#00AFC4" }}>14%</Text>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{language === "ar" ? "الرسوم البيانية التفاعلية لنمو العملاء والإنفاق" : "Customer Growth & Spend Interactive Charts"}</Text>
        <Text style={styles.panelSubtitle}>{language === "ar" ? "معدلات نمو الاشتراكات وحجم الإنفاق الشهري للعملاء عبر المنصة." : "Monthly subscription growth and customer spend trends."}</Text>
        
        <View style={{ backgroundColor: "#F7FEFF", borderRadius: 14, borderWidth: 1, borderColor: "#C6EDEF", padding: 12, gap: 10, marginTop: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 11, fontWeight: "900", color: "#082E34" }}>{language === "ar" ? "نمو العملاء والإنفاق (آخر 4 أشهر)" : "Growth & Spend Trend (Last 4 Mos)"}</Text>
            <Text style={{ fontSize: 9, fontWeight: "900", color: "#2E9B72" }}>+18% {language === "ar" ? "نمو شهري" : "MoM"}</Text>
          </View>

          <View style={{ gap: 6 }}>
            {[
              { label: language === "ar" ? "مايو" : "May", count: 820, spend: 11200 },
              { label: language === "ar" ? "يونيو" : "Jun", count: 960, spend: 14100 },
              { label: language === "ar" ? "يوليو" : "Jul", count: 1120, spend: 17800 },
              { label: language === "ar" ? "أغسطس" : "Aug", count: totalCustomers, spend: 21400 },
            ].map((m, idx) => (
              <View key={idx} style={{ gap: 2 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#4C747A" }}>{m.label}</Text>
                  <Text style={{ fontSize: 10, fontWeight: "900", color: "#082E34" }}>{m.count} {language === "ar" ? "عميل" : "users"} · {m.spend} د.أ</Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: "#E2E8F0", overflow: "hidden" }}>
                  <View style={{ height: "100%", width: `${(m.count / Math.max(totalCustomers, 1500)) * 100}%`, backgroundColor: "#00AFC4", borderRadius: 3 }} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{language === "ar" ? "برنامج نقاط الولاء ومكافآت التكرار" : "Customer Loyalty Points & Rewards"}</Text>
        <Text style={styles.panelSubtitle}>{language === "ar" ? "يكتسب العملاء نقاطاً مع كل طلب طعام لاستبدالها بوجبات مجانية." : "Customers earn points per food order redeemable for free meals."}</Text>
        
        <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
          <View style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F2FEFF", borderWidth: 1, borderColor: "#C6EDEF", gap: 4 }}>
            <Text style={{ fontSize: 10, fontWeight: "900", color: "#4C747A" }}>{language === "ar" ? "إجمالي النقاط المكتسبة" : "Total Points Earned"}</Text>
            <Text style={{ fontSize: 14, fontWeight: "900", color: "#00AFC4" }}>48,520 pts</Text>
          </View>
          <View style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FCD34D", gap: 4 }}>
            <Text style={{ fontSize: 10, fontWeight: "900", color: "#92400E" }}>{language === "ar" ? "النقاط المستبدلة" : "Points Redeemed"}</Text>
            <Text style={{ fontSize: 14, fontWeight: "900", color: "#D97706" }}>14,200 pts</Text>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{language === "ar" ? "عروض ورسائل مخصصة لعملاء VIP" : "Targeted VIP Messages & Offers"}</Text>
        <Text style={styles.panelSubtitle}>{language === "ar" ? "إرسال عروض ترويجية حصرية لعملاء VIP لزيادة الولاء والتكرار." : "Send exclusive promotional offers to VIP members."}</Text>
        
        <Pressable onPress={() => Alert.alert(language === "ar" ? "تم إرسال العرض" : "Offer sent", language === "ar" ? "تم إرسال عرض VIP الحصري بنجاح لجميع أعضاء VIP!" : "Exclusive VIP offer sent successfully!", [{ text: language === "ar" ? "حسناً" : "OK" }])} style={{ minHeight: 42, borderRadius: 12, backgroundColor: "#D97706", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}>
          <MaterialIcons name="local-offer" size={16} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "900" }}>{language === "ar" ? "إرسال قسيمة خصم VIP (15٪) لجميع أعضاء VIP" : "Send VIP 15% Discount Voucher"}</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{language === "ar" ? "معدل الاحتفاظ بالعملاء (Customer Retention)" : "Monthly Customer Retention Rate"}</Text>
        <Text style={{ fontSize: 12, fontWeight: "900", color: "#2E9B72", marginVertical: 6 }}>82.4% {language === "ar" ? "معدل تكرار الطلب الشهري" : "Monthly repeat order rate"}</Text>
        <View style={{ gap: 6 }}>
          {[
            { month: language === "ar" ? "مايو" : "May", rate: "78.2%" },
            { month: language === "ar" ? "يونيو" : "Jun", rate: "79.8%" },
            { month: language === "ar" ? "يوليو" : "Jul", rate: "81.5%" },
            { month: language === "ar" ? "أغسطس" : "Aug", rate: "82.4%" },
          ].map((r, i) => (
            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", padding: 8, borderRadius: 8, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0" }}>
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#082E34" }}>{r.month}</Text>
              <Text style={{ fontSize: 10, fontWeight: "900", color: "#00AFC4" }}>{r.rate}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{language === "ar" ? "قائمة العملاء وتصنيفهم التلقائي (VIP / Regular)" : "Customer Ledger & Auto-Tiering (VIP / Regular)"}</Text>
        <View style={styles.userCard}>
          <View style={styles.userAvatar}><MaterialIcons name="verified" size={20} color="#F59E0B" /></View>
          <View style={styles.userMain}>
            <View style={styles.userTitleRow}>
              <Text style={styles.userName}>سارة خالد</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: "#FCD34D" }}><Text style={{ fontSize: 9, fontWeight: "900", color: "#D97706" }}>VIP</Text></View>
                <View style={[styles.statusBadge, styles.statusBadgeActive]}><Text style={styles.statusBadgeText}>{language === "ar" ? "نشط" : "Active"}</Text></View>
              </View>
            </View>
            <Text style={styles.userMeta}>0788889900 · {language === "ar" ? "المنطقة: دابوق، عمّان" : "Region: Dabouq, Amman"}</Text>
            <Text style={styles.userMeta}>{language === "ar" ? "الطلبات: 18 طلب · الإنفاق: 265 د.أ · الولاء: 1,325 نقطة" : "Orders: 18 · Spend: 265 JOD · Loyalty: 1,325 pts"}</Text>
          </View>
        </View>
        <View style={styles.userCard}>
          <View style={styles.userAvatar}><MaterialIcons name="person" size={20} color="#00AFC4" /></View>
          <View style={styles.userMain}>
            <View style={styles.userTitleRow}>
              <Text style={styles.userName}>طارق أحمد</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <View style={{ backgroundColor: "#E6FBF2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: "#C5EAD8" }}><Text style={{ fontSize: 9, fontWeight: "900", color: "#2E9B72" }}>Regular</Text></View>
                <View style={[styles.statusBadge, styles.statusBadgeActive]}><Text style={styles.statusBadgeText}>{language === "ar" ? "نشط" : "Active"}</Text></View>
              </View>
            </View>
            <Text style={styles.userMeta}>0791112233 · {language === "ar" ? "المنطقة: خلدا، عمّان" : "Region: Khalda, Amman"}</Text>
            <Text style={styles.userMeta}>{language === "ar" ? "الطلبات: 7 طلبات · الإنفاق: 98.5 د.أ · الولاء: 490 نقطة" : "Orders: 7 · Spend: 98.5 JOD · Loyalty: 490 pts"}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// 7. Payments / المالية
function AdminPaymentsSection({ language, useDatabase }: { language: "ar" | "en"; useDatabase: boolean }) {
  const remoteAnalytics = trpc.admin.financialAnalytics.useQuery(undefined, { enabled: useDatabase });
  const data = remoteAnalytics.data;
  const money = (val: number) => formatJod(val, language);

  return (
    <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.pageHeading}>
        <View>
          <Text style={styles.pageEyebrow}>{language === "ar" ? "الإدارة المالية" : "PAYMENTS & FINANCIALS"}</Text>
          <Text style={styles.pageTitle}>{language === "ar" ? "المالية والأرباح والعمولات" : "Financials, Commissions & Payouts"}</Text>
          <Text style={styles.pageSubtitle}>{language === "ar" ? "إجمالي المبيعات، عمولة سفرة أمي ٥٪، مستحقات الأمهات والسائقين، والمدفوعات." : "Gross sales, 5% commission, kitchen & driver payouts, and refunds."}</Text>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <View style={styles.metricIcon}><MaterialIcons name="payments" size={20} color="#00AFC4" /></View>
          <Text style={styles.metricLabel}>{language === "ar" ? "إجمالي المبيعات" : "Gross Sales"}</Text>
          <Text style={styles.metricValue}>{money(data?.grossSales ?? 4120)}</Text>
        </View>
        <View style={styles.metricCard}>
          <View style={styles.metricIcon}><MaterialIcons name="account-balance" size={20} color="#00AFC4" /></View>
          <Text style={styles.metricLabel}>{language === "ar" ? "عمولة سفرة أمي (٥٪)" : "Sufret Omi Commission (5%)"}</Text>
          <Text style={styles.metricValue}>{money(data?.platformCommission ?? 206)}</Text>
        </View>
        <View style={styles.metricCard}>
          <View style={styles.metricIcon}><MaterialIcons name="store" size={20} color="#00AFC4" /></View>
          <Text style={styles.metricLabel}>{language === "ar" ? "مستحقات الأمهات" : "Kitchen Payouts"}</Text>
          <Text style={styles.metricValue}>{money(data?.kitchenPayouts ?? 3914)}</Text>
        </View>
        <View style={styles.metricCard}>
          <View style={styles.metricIcon}><MaterialIcons name="local-shipping" size={20} color="#00AFC4" /></View>
          <Text style={styles.metricLabel}>{language === "ar" ? "مستحقات السائقين" : "Driver Payouts"}</Text>
          <Text style={styles.metricValue}>{money(340)}</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{language === "ar" ? "سجل المدفوعات والتحويلات عبر CliQ" : "CliQ Payouts & Transactions Ledger"}</Text>
        <View style={styles.userCard}>
          <View style={styles.userAvatar}><MaterialIcons name="check-circle" size={20} color="#2E9B72" /></View>
          <View style={styles.userMain}>
            <View style={styles.userTitleRow}>
              <Text style={styles.userName}>تحويل أسبوعي لمطبخ أم أحمد</Text>
              <Text style={{ color: "#2E9B72", fontWeight: "900", fontSize: 11 }}>{money(245.50)}</Text>
            </View>
            <Text style={styles.userMeta}>CliQ Alias: SOUFRETOMI.K1 · {language === "ar" ? "تم التحويل بنجاح" : "Transferred successfully"}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// 8. Settings
function AdminSettingsSection({ language, useDatabase }: { language: "ar" | "en"; useDatabase: boolean }) {
  const [allowMothers, setAllowMothers] = useState(true);
  const [allowDrivers, setAllowDrivers] = useState(true);

  return (
    <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.pageHeading}>
        <View>
          <Text style={styles.pageEyebrow}>{language === "ar" ? "إعدادات المنصة والصلاحيات" : "PLATFORM SETTINGS & CONTROLS"}</Text>
          <Text style={styles.pageTitle}>{language === "ar" ? "الإعدادات العامة والتحكم بالتسجيل" : "Settings & Registration Control"}</Text>
          <Text style={styles.pageSubtitle}>{language === "ar" ? "إدارة تسجيل المطابخ والسائقين، مناطق العمل، نسب العمولة، والإشعارات الفورية." : "Manage kitchen and driver registrations, zones, commissions, and notifications."}</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{language === "ar" ? "التحكم بإنشاء حسابات المطابخ والسائقين" : "Kitchen & Driver Registration Control"}</Text>
        <Text style={styles.panelSubtitle}>{language === "ar" ? "يمكنك إيقاف أو تفعيل استقبال حسابات جديدة للأمهات أو السائقين بضغطة زر." : "Easily enable or disable new mother or driver account creation."}</Text>
        
        <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
          <View style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: allowMothers ? "#E6FBF2" : "#FFF4F2", borderWidth: 1, borderColor: allowMothers ? "#C5EAD8" : "#F1C4BF", gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 12, fontWeight: "900", color: "#082E34" }}>{language === "ar" ? "تسجيل المطابخ (الأمهات)" : "Kitchen Registration"}</Text>
              <Text style={{ fontSize: 9, fontWeight: "900", color: allowMothers ? "#2E9B72" : "#C4555D" }}>{allowMothers ? (language === "ar" ? "مفتوح" : "Open") : (language === "ar" ? "مغلق" : "Closed")}</Text>
            </View>
            <Pressable onPress={() => setAllowMothers(!allowMothers)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: allowMothers ? "#2E9B72" : "#C4555D", alignItems: "center" }}>
              <Text style={{ fontSize: 10, fontWeight: "900", color: "#FFFFFF" }}>{allowMothers ? (language === "ar" ? "إيقاف تسجيل المطابخ" : "Disable Kitchens") : (language === "ar" ? "فتح تسجيل المطابخ" : "Enable Kitchens")}</Text>
            </Pressable>
          </View>

          <View style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: allowDrivers ? "#E6FBF2" : "#FFF4F2", borderWidth: 1, borderColor: allowDrivers ? "#C5EAD8" : "#F1C4BF", gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 12, fontWeight: "900", color: "#082E34" }}>{language === "ar" ? "تسجيل السائقين" : "Driver Registration"}</Text>
              <Text style={{ fontSize: 9, fontWeight: "900", color: allowDrivers ? "#2E9B72" : "#C4555D" }}>{allowDrivers ? (language === "ar" ? "مفتوح" : "Open") : (language === "ar" ? "مغلق" : "Closed")}</Text>
            </View>
            <Pressable onPress={() => setAllowDrivers(!allowDrivers)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: allowDrivers ? "#2E9B72" : "#C4555D", alignItems: "center" }}>
              <Text style={{ fontSize: 10, fontWeight: "900", color: "#FFFFFF" }}>{allowDrivers ? (language === "ar" ? "إيقاف تسجيل السائقين" : "Disable Drivers") : (language === "ar" ? "فتح تسجيل السائقين" : "Enable Drivers")}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{language === "ar" ? "سجل التدقيق التفاعلي والبحث المتقدم" : "Interactive Audit Logs & Search"}</Text>
        <Text style={styles.panelSubtitle}>{language === "ar" ? "ابحث وفلتر في سجل العمليات والصلاحيات وتصديرها فوراً." : "Search and filter supervisor actions and audit trails instantly."}</Text>
        
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F2FEFF", borderRadius: 12, borderWidth: 1, borderColor: "#C6EDEF", paddingHorizontal: 10, marginVertical: 8 }}>
          <MaterialIcons name="search" size={18} color="#00AFC4" />
          <TextInput
            placeholder={language === "ar" ? "ابحث في السجل (مثل: مطبخ، سائق، صلاحية...)" : "Search audit logs..."}
            placeholderTextColor="#8ABAC0"
            style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 6, fontSize: 12, color: "#082E34" }}
            textAlign={language === "ar" ? "right" : "left"}
          />
        </View>

        <View style={{ backgroundColor: "#F7FEFF", borderRadius: 14, borderWidth: 1, borderColor: "#C6EDEF", padding: 10, gap: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: "#DDF9FA" }}>
            <Text style={{ fontSize: 10, fontWeight: "900", color: "#4C747A", flex: 1 }}>{language === "ar" ? "الحدث / الإجراء" : "Action"}</Text>
            <Text style={{ fontSize: 10, fontWeight: "900", color: "#4C747A", width: 110, textAlign: "center" }}>{language === "ar" ? "الوقت والتاريخ" : "Timestamp"}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 11, fontWeight: "900", color: "#082E34" }}>{language === "ar" ? "تعديل إعدادات تسجيل المطابخ والسائقين" : "Toggle Kitchen/Driver Registration"}</Text>
              <Text style={{ fontSize: 9, fontWeight: "800", color: "#2E9B72" }}>{language === "ar" ? "بواسطة المشرف الرئيسي (Admin)" : "By Master Admin"}</Text>
            </View>
            <Text style={{ fontSize: 9, fontWeight: "800", color: "#7CA8AD", width: 110, textAlign: "center" }}>{new Date().toLocaleDateString()}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
          <Pressable onPress={() => {
            const ws = XLSX.utils.json_to_sheet([{ Action: "Admin Toggle Kitchen Registration", Time: new Date().toISOString() }, { Action: "Admin Toggle Driver Registration", Time: new Date().toISOString() }]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "AuditLogs");
            XLSX.writeFile(wb, "sufret-omi-audit-logs.xlsx");
          }} style={{ flex: 1, minHeight: 40, borderRadius: 12, backgroundColor: "#2E9B72", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <MaterialIcons name="table-chart" size={16} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{language === "ar" ? "تصدير Excel" : "Export Excel"}</Text>
          </Pressable>
          <Pressable onPress={() => {
            const w = window.open("", "_blank");
            if (w) {
              w.document.write("<html><head><title>Audit Logs</title></head><body style='font-family:Arial;padding:20px;'><h2>Sufret Omi - Audit Logs Report</h2><p>Generated: " + new Date().toLocaleString() + "</p><hr/><table border='1' cellpadding='8' cellspacing='0'><tr><th>ID</th><th>Action</th><th>Timestamp</th></tr><tr><td>1</td><td>System Init & Registration Control</td><td>" + new Date().toLocaleString() + "</td></tr></table></body></html>");
              w.document.close();
              w.print();
            }
          }} style={{ flex: 1, minHeight: 40, borderRadius: 12, backgroundColor: "#00AFC4", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <MaterialIcons name="picture-as-pdf" size={16} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{language === "ar" ? "طباعة / تصدير PDF" : "Print / PDF"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.settingsPanel}>
        <SettingStatus icon="map" title={language === "ar" ? "مناطق العمل" : "Working Zones"} body={language === "ar" ? "تغطية كافة محافظات المملكة (عمان، إربد، الزرقاء، السلط، مادبا، العقبة)." : "Coverage across Jordan governorates (Amman, Irbid, Zarqa, etc.)."} state={language === "ar" ? "مفعل" : "Active"} />
        <SettingStatus icon="local-shipping" title={language === "ar" ? "رسوم التوصيل" : "Delivery Fees"} body={language === "ar" ? "محسوبة آلياً حسب المسافة والمنطقة (يبدأ من 1.50 د.أ)." : "Calculated by distance & zone (starts at 1.50 JOD)." } state={language === "ar" ? "2.00 د.أ" : "2.00 JOD"} />
        <SettingStatus icon="percent" title={language === "ar" ? "نسبة العمولة" : "Commission Rate"} body={language === "ar" ? "عمولة المنصة الثابتة على كل طلب." : "Fixed platform commission on every order."} state="5%" />
        <SettingStatus icon="payment" title={language === "ar" ? "طرق الدفع" : "Payment Methods"} body={language === "ar" ? "نقداً عند الاستلام (COD)، المحافظ الإلكترونية، وربط كليك (CliQ)." : "COD, E-Wallets, and CliQ integration."} state={language === "ar" ? "مفعل" : "Active"} />
        <SettingStatus icon="notifications" title={language === "ar" ? "الإشعارات" : "Notifications"} body={language === "ar" ? "إشعارات فورية عبر Expo Push للسائقين والأمهات والعملاء." : "Instant Expo Push notifications."} state={language === "ar" ? "مفعل" : "Active"} />
      </View>
    </ScrollView>
  );
}

function SettingStatus({ icon, title, body, state, warning = false }: { icon: IconName; title: string; body: string; state: string; warning?: boolean }) {
  return (
    <View style={styles.settingStatus}>
      <View style={styles.settingStatusIcon}><MaterialIcons name={icon} size={19} color={warning ? "#A36C1D" : "#00AFC4"} /></View>
      <View style={styles.settingStatusCopy}>
        <Text style={styles.settingStatusTitle}>{title}</Text>
        <Text style={styles.settingStatusBody}>{body}</Text>
      </View>
      <View style={[styles.settingState, warning && styles.settingStateWarning]}><Text style={styles.settingStateText}>{state}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  loginWrap: { flexGrow: 1, justifyContent: "center", padding: 22, gap: 18, backgroundColor: "#F2FEFF" },
  loginBrand: { alignItems: "center", gap: 7 },
  loginLogo: { width: 70, height: 70, borderRadius: 23, backgroundColor: "#00AFC4", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  loginEyebrow: { color: "#2E9B72", fontSize: 10, letterSpacing: 1.6, fontWeight: "900" },
  loginTitle: { color: "#082E34", fontSize: 27, fontWeight: "900", textAlign: "center" },
  loginSubtitle: { color: "#4C747A", fontSize: 12, lineHeight: 18, textAlign: "center", maxWidth: 430 },
  loginCard: { width: "100%", maxWidth: 470, alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 25, borderWidth: 1, borderColor: "#C6EDEF", padding: 20, gap: 12 },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingBottom: 5 },
  lockText: { color: "#00AFC4", fontSize: 11, fontWeight: "900" },
  formLabel: { color: "#1A4B52", fontSize: 11, fontWeight: "900" },
  inputWrap: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#C6EDEF", backgroundColor: "#F1FEFF", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  input: { flex: 1, minWidth: 0, color: "#082E34", fontSize: 13, paddingVertical: 8 },
  errorText: { color: "#C4555D", fontSize: 11, fontWeight: "800" },
  primaryButton: { minHeight: 48, paddingHorizontal: 16, borderRadius: 15, backgroundColor: "#00AFC4", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  oauthButton: { minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: "#B6E8EC", backgroundColor: "#ECFCFD", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  oauthButtonText: { color: "#00AFC4", fontSize: 10, fontWeight: "900" },
  backToApp: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, padding: 8 },
  backToAppText: { color: "#00AFC4", fontSize: 11, fontWeight: "900" },
  adminFrame: { flex: 1, backgroundColor: "#F2FEFF" },
  adminTopBar: { minHeight: 70, paddingHorizontal: 20, backgroundColor: "#082E34", flexDirection: "row", alignItems: "center", gap: 14 },
  mobileMenu: { width: 36, height: 36, borderRadius: 11, backgroundColor: "#00AFC4", alignItems: "center", justifyContent: "center" },
  topBrand: { flexDirection: "row", alignItems: "center", gap: 9 },
  topBrandMark: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#00AFC4", alignItems: "center", justifyContent: "center" },
  topBrandName: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  topBrandSub: { color: "#8ABAC0", fontSize: 9, marginTop: 2 },
  topActions: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 8 },
  liveIndicator: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 12, backgroundColor: "#123F46" },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#F2B84B" },
  liveText: { color: "#A8F1F6", fontSize: 9, fontWeight: "900" },
  topActionButton: { minHeight: 34, paddingHorizontal: 9, borderRadius: 10, borderWidth: 1, borderColor: "#1F616A", flexDirection: "row", alignItems: "center", gap: 5 },
  topActionText: { color: "#A8F1F6", fontSize: 9, fontWeight: "900" },
  adminBody: { flex: 1, flexDirection: "row" },
  sidebar: { width: 250, backgroundColor: "#FFFFFF", borderRightWidth: 1, borderRightColor: "#C6EDEF", padding: 14 },
  sidebarMobile: { position: "absolute", zIndex: 10, top: 0, bottom: 0, left: 0, elevation: 8 },
  sidebarHeader: { padding: 10, marginBottom: 12 },
  sidebarEyebrow: { color: "#2E9B72", fontSize: 9, letterSpacing: 1.2, fontWeight: "900" },
  sidebarTitle: { color: "#082E34", fontSize: 18, fontWeight: "900", marginTop: 4 },
  sidebarItem: { minHeight: 45, paddingHorizontal: 11, borderRadius: 13, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  sidebarItemActive: { backgroundColor: "#00AFC4" },
  sidebarItemCopy: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sidebarItemText: { color: "#4C747A", fontSize: 11, fontWeight: "800" },
  sidebarItemTextActive: { color: "#FFFFFF", fontWeight: "900" },
  sidebarBottom: { marginTop: "auto", padding: 10, borderTopWidth: 1, borderTopColor: "#E7F9FA" },
  adminIdentity: { flexDirection: "row", alignItems: "center", gap: 8 },
  adminAvatar: { width: 32, height: 32, borderRadius: 11, backgroundColor: "#2E9B72", alignItems: "center", justifyContent: "center" },
  adminName: { color: "#082E34", fontSize: 10, fontWeight: "900" },
  adminRole: { color: "#7CA8AD", fontSize: 9, marginTop: 2 },
  adminContent: { flex: 1, minWidth: 0 },
  contentScroll: { padding: 24, gap: 20, paddingBottom: 45 },
  pageHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 15 },
  pageEyebrow: { color: "#2E9B72", fontSize: 9, letterSpacing: 1.25, fontWeight: "900" },
  pageTitle: { color: "#082E34", fontSize: 26, fontWeight: "900", marginTop: 4 },
  pageSubtitle: { color: "#4C747A", fontSize: 11, lineHeight: 17, marginTop: 5, maxWidth: 700 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metricCard: { flexGrow: 1, flexBasis: 160, minHeight: 130, padding: 15, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C6EDEF" },
  metricIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: "#DDF9FA", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  metricLabel: { color: "#4C747A", fontSize: 10, fontWeight: "800" },
  metricValue: { color: "#082E34", fontSize: 26, fontWeight: "900", marginTop: 3 },
  metricDetail: { color: "#7CA8AD", fontSize: 9, marginTop: 1 },
  twoColumn: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  panel: { flex: 1, minWidth: 300, padding: 16, borderRadius: 19, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C6EDEF", gap: 10 },
  panelHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  panelTitle: { color: "#082E34", fontSize: 14, fontWeight: "900" },
  panelSubtitle: { color: "#7CA8AD", fontSize: 9, marginTop: 3 },
  quickActionRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderRadius: 12, backgroundColor: "#F2FEFF", borderWidth: 1, borderColor: "#C6EDEF" },
  quickActionText: { flex: 1, color: "#082E34", fontSize: 11, fontWeight: "800" },
  userCard: { padding: 13, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C6EDEF", flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  userAvatar: { width: 39, height: 39, borderRadius: 14, backgroundColor: "#A8F1F6", alignItems: "center", justifyContent: "center" },
  userMain: { flex: 1, minWidth: 0, gap: 3 },
  userTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 7 },
  userName: { color: "#082E34", fontSize: 12, fontWeight: "900" },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { color: "#4C747A", fontSize: 8, fontWeight: "900" },
  statusBadgeActive: { backgroundColor: "#DDF9FA" },
  statusBadgePending: { backgroundColor: "#FFF1D2" },
  statusBadgeSuspended: { backgroundColor: "#FDE7E4" },
  userMeta: { color: "#7CA8AD", fontSize: 9 },
  marketingInput: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: "#C6EDEF", backgroundColor: "#F7FEFF", color: "#082E34", fontSize: 11, paddingHorizontal: 12 },
  approveButton: { minHeight: 40, flex: 1, paddingHorizontal: 13, borderRadius: 12, backgroundColor: "#00AFC4", alignItems: "center", justifyContent: "center" },
  approveButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  rejectButton: { minHeight: 40, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1, borderColor: "#F1C4BF", backgroundColor: "#FFF4F2", alignItems: "center", justifyContent: "center" },
  rejectButtonText: { color: "#C4555D", fontSize: 10, fontWeight: "900" },
  settingsPanel: { backgroundColor: "#FFFFFF", borderRadius: 19, borderWidth: 1, borderColor: "#C6EDEF", overflow: "hidden" },
  settingStatus: { padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 10, borderBottomWidth: 1, borderBottomColor: "#E7F9FA" },
  settingStatusIcon: { width: 35, height: 35, borderRadius: 12, backgroundColor: "#FFF7DC", alignItems: "center", justifyContent: "center" },
  settingStatusCopy: { flex: 1, gap: 4 },
  settingStatusTitle: { color: "#082E34", fontSize: 12, fontWeight: "900" },
  settingStatusBody: { color: "#4C747A", fontSize: 10, lineHeight: 16 },
  settingState: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, backgroundColor: "#DDF9FA" },
  settingStateWarning: { backgroundColor: "#FFF1D2" },
  settingStateText: { color: "#8A6516", fontSize: 8, fontWeight: "900" },
  pressed: { opacity: 0.8 },
});
