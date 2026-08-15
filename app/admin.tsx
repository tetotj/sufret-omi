import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { complaintCategories, complaintStatuses, type Complaint, type ComplaintStatus } from "@/lib/complaint-data";
import { type ManagedUser, type UserAccountStatus, type UserProfileRole } from "@/lib/admin-data";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/hooks/use-auth";
import { startOAuthLogin } from "@/constants/oauth";
import { trpc } from "@/lib/trpc";


type AdminSection = "overview" | "users" | "approvals" | "complaints" | "settings";
type UserFilter = "all" | UserProfileRole | "pending_approval" | "suspended";

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

const adminSections: Array<{ id: AdminSection; label: string; en: string; icon: IconName }> = [
  { id: "overview", label: "نظرة عامة", en: "Overview", icon: "dashboard" },
  { id: "users", label: "كل المستخدمين", en: "All users", icon: "groups" },
  { id: "approvals", label: "طلبات الاعتماد", en: "Approvals", icon: "verified-user" },
  { id: "complaints", label: "الشكاوى والصور", en: "Complaints & photos", icon: "support-agent" },
  { id: "settings", label: "إعدادات الإدارة", en: "Admin settings", icon: "settings" },
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
  if (loading && !adminAuthenticated) return <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background" className="items-center justify-center"><Text style={styles.loginSubtitle}>{language === "ar" ? "جارٍ التحقق من جلسة المشرف..." : "Checking supervisor session..."}</Text></ScreenContainer>;
  if (!adminAuthenticated && !serverAdmin) return <AdminLogin language={language} onSignIn={adminSignIn} />;
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
        <View style={styles.loginBrand}><View style={styles.loginLogo}><MaterialIcons name="shield" size={31} color="#D9F99D" /></View><Text style={styles.loginEyebrow}>SUFRET OMI · CONTROL CENTER</Text><Text style={styles.loginTitle}>{language === "ar" ? "دخول لوحة المشرف" : "Supervisor sign in"}</Text><Text style={styles.loginSubtitle}>{language === "ar" ? "هذه بوابة الإدارة المنفصلة. لا تظهر للعملاء أو السائقين." : "This is the separate administration portal. It is not shown to customers or drivers."}</Text></View>
        <View style={styles.loginCard}><View style={styles.lockRow}><MaterialIcons name="lock" size={18} color="#236B45" /><Text style={styles.lockText}>{language === "ar" ? "وصول آمن للإدارة" : "Secure admin access"}</Text></View><Text style={styles.formLabel}>{language === "ar" ? "رمز المشرف" : "Supervisor access code"}</Text><View style={styles.inputWrap}><MaterialIcons name="vpn-key" size={18} color="#236B45" /><TextInput value={code} onChangeText={setCode} placeholder={language === "ar" ? "أدخلي الرمز" : "Enter access code"} placeholderTextColor="#9CB3A0" secureTextEntry keyboardType="number-pad" style={styles.input} onSubmitEditing={submit} /></View>{error ? <Text style={styles.errorText}>{error}</Text> : null}<Pressable onPress={submit} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{language === "ar" ? "دخول لوحة المشرف" : "Open admin dashboard"}</Text><MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" /></Pressable><View style={styles.demoNote}><MaterialIcons name="info-outline" size={16} color="#8A6516" /><Text style={styles.demoNoteText}>{language === "ar" ? "هذه نسخة واجهة أولية. قبل النشر، يجب استبدال الرمز التجريبي بمصادقة الخادم وحسابات مشرف حقيقية." : "This is an initial UI build. Before publishing, replace the demo code with server authentication and real supervisor accounts."}</Text></View><Pressable onPress={() => startOAuthLogin()} style={styles.oauthButton}><MaterialIcons name="account-circle" size={18} color="#236B45" /><Text style={styles.oauthButtonText}>{language === "ar" ? "الدخول بحساب المالك الحقيقي" : "Sign in with owner account"}</Text></Pressable></View><Pressable onPress={() => router.replace("/")} style={styles.backToApp}>
<MaterialIcons name="arrow-back" size={16} color="#236B45" /><Text style={styles.backToAppText}>{language === "ar" ? "العودة إلى تطبيق العميل" : "Back to customer app"}</Text></Pressable></ScrollView>
    </ScreenContainer>
  );
}

function AdminShell({ language, onSignOut, showToast, useDatabase }: { language: "ar" | "en"; onSignOut: () => void; showToast: (message: string) => void; useDatabase: boolean }) {
  const [section, setSection] = useState<AdminSection>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background" className="flex-1">
      <View style={styles.adminFrame}>
        <View style={styles.adminTopBar}><Pressable onPress={() => setSidebarOpen((value) => !value)} style={styles.mobileMenu}><MaterialIcons name="menu" size={21} color="#FFFFFF" /></Pressable><View style={styles.topBrand}><View style={styles.topBrandMark}><MaterialIcons name="shield" size={17} color="#D9F99D" /></View><View><Text style={styles.topBrandName}>Sufret Omi</Text><Text style={styles.topBrandSub}>{language === "ar" ? "مركز التحكم" : "Control center"}</Text></View></View><View style={styles.topActions}><View style={styles.liveIndicator}><View style={styles.liveDot} /><Text style={styles.liveText}>{language === "ar" ? "النظام يعمل" : "System live"}</Text></View><Pressable onPress={() => router.replace("/")} style={styles.topActionButton}><MaterialIcons name="open-in-new" size={17} color="#D9F99D" /><Text style={styles.topActionText}>{language === "ar" ? "التطبيق" : "App"}</Text></Pressable><Pressable onPress={onSignOut} style={styles.topActionButton}><MaterialIcons name="logout" size={17} color="#D9F99D" /><Text style={styles.topActionText}>{language === "ar" ? "خروج" : "Sign out"}</Text></Pressable></View></View>
        <View style={styles.adminBody}>{(sidebarOpen || true) && <View style={[styles.sidebar, sidebarOpen && styles.sidebarMobile]}><View style={styles.sidebarHeader}><Text style={styles.sidebarEyebrow}>{language === "ar" ? "الإدارة" : "ADMIN"}</Text><Text style={styles.sidebarTitle}>{language === "ar" ? "لوحة المشرف" : "Supervisor board"}</Text></View>{adminSections.map((item) => <Pressable key={item.id} onPress={() => { setSection(item.id); setSidebarOpen(false); }} style={[styles.sidebarItem, section === item.id && styles.sidebarItemActive]}><MaterialIcons name={item.icon} size={19} color={section === item.id ? "#FFFFFF" : "#6F8975"} /><View style={styles.sidebarItemCopy}><Text style={[styles.sidebarItemText, section === item.id && styles.sidebarItemTextActive]}>{language === "ar" ? item.label : item.en}</Text>{item.id === "approvals" && <View style={styles.sidebarCount}><Text style={styles.sidebarCountText}>2</Text></View>}</View></Pressable>)}<View style={styles.sidebarBottom}><View style={styles.adminIdentity}><View style={styles.adminAvatar}><MaterialIcons name="person" size={18} color="#FFFFFF" /></View><View><Text style={styles.adminName}>{language === "ar" ? "مدير سفرة أمي" : "Sufret Omi admin"}</Text><Text style={styles.adminRole}>{language === "ar" ? "مالك النظام" : "System owner"}</Text></View></View><Text style={styles.sidebarVersion}>v1.0 · {language === "ar" ? "بيئة تجريبية" : "Demo environment"}</Text></View></View>}<View style={styles.adminContent}>{section === "overview" && <AdminOverview language={language} onNavigate={setSection} useDatabase={useDatabase} />}{section === "users" && <AdminUsers language={language} showToast={showToast} useDatabase={useDatabase} />}{section === "approvals" && <AdminApprovals language={language} showToast={showToast} useDatabase={useDatabase} />}{section === "complaints" && <AdminComplaints language={language} useDatabase={useDatabase} />}{section === "settings" && <AdminSettings language={language} useDatabase={useDatabase} />}
</View></View>
      </View>
    </ScreenContainer>
  );
}

function AdminOverview({ language, onNavigate, useDatabase }: { language: "ar" | "en"; onNavigate: (section: AdminSection) => void; useDatabase: boolean }) {
  const { managedUsers: localUsers, complaints: localComplaints } = useApp();
  const remoteUsersQuery = trpc.admin.listUsers.useQuery(undefined, { enabled: useDatabase });
  const remoteComplaintsQuery = trpc.admin.listComplaints.useQuery(undefined, { enabled: useDatabase });
  const managedUsers = useDatabase ? ((remoteUsersQuery.data ?? []) as unknown as ManagedUser[]) : localUsers;
  const complaints = useDatabase ? ((remoteComplaintsQuery.data ?? []) as unknown as Complaint[]) : localComplaints;
  const pending = managedUsers.filter((user) => user.status === "pending_approval").length;
  const active = managedUsers.filter((user) => user.status === "active").length;
  const suspended = managedUsers.filter((user) => user.status === "suspended").length;
  const cards = [
    { label: language === "ar" ? "إجمالي المستخدمين" : "Total users", value: managedUsers.length.toString(), detail: language === "ar" ? "ضمن كل الأدوار" : "Across all roles", icon: "groups" as IconName, tone: "green" },
    { label: language === "ar" ? "طلبات اعتماد" : "Pending approvals", value: pending.toString(), detail: language === "ar" ? "تحتاج قراراً" : "Need your decision", icon: "pending-actions" as IconName, tone: "lime" },
    { label: language === "ar" ? "شكاوى مفتوحة" : "Open complaints", value: complaints.filter((item) => item.status !== "resolved" && item.status !== "closed").length.toString(), detail: language === "ar" ? "مع الصور والطلبات" : "With photos and orders", icon: "support-agent" as IconName, tone: "orange" },
    { label: language === "ar" ? "حسابات موقوفة" : "Suspended accounts", value: suspended.toString(), detail: language === "ar" ? "تحت السيطرة" : "Under control", icon: "block" as IconName, tone: "red" },
  ];
  return <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}><View style={styles.pageHeading}><View><Text style={styles.pageEyebrow}>{language === "ar" ? "مركز القيادة" : "COMMAND CENTER"}</Text><Text style={styles.pageTitle}>{language === "ar" ? "صباح الخير، مديرتنا" : "Good morning, admin"}</Text><Text style={styles.pageSubtitle}>{language === "ar" ? "من هنا تراقبين سفرة أمي وتقررين من يدخل ومن يستمر." : "Monitor Sufret Omi and decide who can join and continue."}</Text></View><View style={styles.dateBadge}><MaterialIcons name="calendar-today" size={15} color="#236B45" /><Text style={styles.dateBadgeText}>{language === "ar" ? "١٥ آب ٢٠٢٦" : "15 Aug 2026"}</Text></View></View><View style={styles.metricGrid}>{cards.map((card) => <View key={card.label} style={styles.metricCard}><View style={[styles.metricIcon, card.tone === "lime" && styles.metricIconLime, card.tone === "orange" && styles.metricIconOrange, card.tone === "red" && styles.metricIconRed]}><MaterialIcons name={card.icon} size={20} color={card.tone === "orange" ? "#B57808" : card.tone === "red" ? "#C44545" : "#236B45"} /></View><Text style={styles.metricLabel}>{card.label}</Text><Text style={styles.metricValue}>{card.value}</Text><Text style={styles.metricDetail}>{card.detail}</Text></View>)}</View><View style={styles.twoColumn}><View style={styles.panel}><View style={styles.panelHeader}><View><Text style={styles.panelTitle}>{language === "ar" ? "تحتاج قرارك الآن" : "Needs your decision"}</Text><Text style={styles.panelSubtitle}>{language === "ar" ? "طلبات اعتماد جديدة" : "New approval requests"}</Text></View><Pressable onPress={() => onNavigate("approvals")}><Text style={styles.panelLink}>{language === "ar" ? "عرض الكل" : "View all"}</Text></Pressable></View>{managedUsers.filter((user) => user.status === "pending_approval").map((user) => <ApprovalPreview key={user.id} user={user} language={language} onPress={() => onNavigate("approvals")} />)}{pending === 0 && <EmptyPanel icon="verified" text={language === "ar" ? "لا توجد طلبات بانتظار الاعتماد" : "No pending approvals"} />}</View><View style={styles.panel}><View style={styles.panelHeader}><View><Text style={styles.panelTitle}>{language === "ar" ? "آخر الشكاوى" : "Latest complaints"}</Text><Text style={styles.panelSubtitle}>{language === "ar" ? "تحتاج متابعة فريق الدعم" : "Need support follow-up"}</Text></View><Pressable onPress={() => onNavigate("complaints")}><Text style={styles.panelLink}>{language === "ar" ? "فتح الشكاوى" : "Open complaints"}</Text></Pressable></View>{complaints.slice(0, 3).map((complaint) => <View key={complaint.id} style={styles.miniComplaint}><View style={styles.miniComplaintIcon}><MaterialIcons name="support-agent" size={17} color="#236B45" /></View><View style={styles.miniComplaintCopy}><Text style={styles.miniComplaintTitle}>{complaint.subject}</Text><Text style={styles.miniComplaintMeta}>{complaint.id} · {language === "ar" ? complaintStatuses[complaint.status].ar : complaintStatuses[complaint.status].en}</Text></View><MaterialIcons name="chevron-right" size={19} color="#A7BEAA" /></View>)}{complaints.length === 0 && <EmptyPanel icon="forum" text={language === "ar" ? "لا توجد شكاوى مسجلة بعد" : "No complaints recorded yet"} />}</View></View><View style={styles.activityPanel}><View style={styles.panelHeader}><View><Text style={styles.panelTitle}>{language === "ar" ? "حالة المنصة" : "Platform health"}</Text><Text style={styles.panelSubtitle}>{language === "ar" ? "ملخص سريع للسلامة التشغيلية" : "Quick operational safety summary"}</Text></View><View style={styles.healthPill}><View style={styles.liveDot} /><Text style={styles.healthText}>{language === "ar" ? "كل شيء مستقر" : "All systems stable"}</Text></View></View><View style={styles.healthRows}><HealthRow icon="people" label={language === "ar" ? "المستخدمون النشطون" : "Active users"} value={`${active} ${language === "ar" ? "حساب" : "accounts"}`} /><HealthRow icon="receipt-long" label={language === "ar" ? "الطلبات اليوم" : "Orders today"} value="12" /><HealthRow icon="photo-library" label={language === "ar" ? "صور بانتظار المراجعة" : "Photos awaiting review"} value={pending > 0 ? `${pending * 2}` : "0"} /></View></View></ScrollView>;
}

function AdminUsers({ language, showToast, useDatabase }: { language: "ar" | "en"; showToast: (message: string) => void; useDatabase: boolean }) {
  const { managedUsers: localManagedUsers, updateUserStatus } = useApp();
  const remoteQuery = trpc.admin.listUsers.useQuery(undefined, { enabled: useDatabase });
  const updateMutation = trpc.admin.updateUserStatus.useMutation();
  const managedUsers = useDatabase ? ((remoteQuery.data ?? []) as unknown as ManagedUser[]) : localManagedUsers;
  const [filter, setFilter] = useState<UserFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const filtered = useMemo(() => managedUsers.filter((user) => (filter === "all" || user.role === filter || user.status === filter) && `${user.name} ${user.phone} ${user.region}`.toLowerCase().includes(query.toLowerCase())), [filter, managedUsers, query]);
  const update = (user: ManagedUser, status: UserAccountStatus) => {
    if (useDatabase) {
      updateMutation.mutate({ userId: user.id, status }, { onSuccess: () => { remoteQuery.refetch(); setSelected(null); showToast(language === "ar" ? `تم تغيير حالة ${user.name} في قاعدة البيانات` : `${user.name}'s database status changed`); }, onError: () => showToast(language === "ar" ? "تعذر تحديث المستخدم من الخادم" : "Could not update user on the server") });
      return;
    }
    updateUserStatus(user.id, status); setSelected(null); showToast(language === "ar" ? `تم تغيير حالة ${user.name}` : `${user.name}'s status changed`);
  };
  return <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}><View style={styles.pageHeading}><View><Text style={styles.pageEyebrow}>{language === "ar" ? "إدارة الوصول" : "ACCESS MANAGEMENT"}</Text><Text style={styles.pageTitle}>{language === "ar" ? "المستخدمون" : "Users"}</Text><Text style={styles.pageSubtitle}>{language === "ar" ? "ابحثي، افتحي الملف، وقرري من يدخل إلى أي لوحة." : "Search, open a profile, and decide who can enter each dashboard."}</Text></View><View style={styles.pageCount}><Text style={styles.pageCountValue}>{filtered.length}</Text><Text style={styles.pageCountLabel}>{language === "ar" ? "نتيجة" : "results"}</Text></View></View><View style={styles.filterBar}><View style={styles.adminSearch}><MaterialIcons name="search" size={18} color="#6F8975" /><TextInput value={query} onChangeText={setQuery} placeholder={language === "ar" ? "ابحثي بالاسم أو الهاتف..." : "Search name or phone..."} placeholderTextColor="#9CB3A0" style={styles.adminSearchInput} /></View><View style={styles.filterChips}>{(["all", "pending_approval", "mother", "driver", "customer", "suspended"] as UserFilter[]).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filterChip, filter === item && styles.filterChipActive]}><Text style={[styles.filterChipText, filter === item && styles.filterChipTextActive]}>{item === "all" ? (language === "ar" ? "الكل" : "All") : item === "pending_approval" ? (language === "ar" ? "بانتظار الاعتماد" : "Pending") : item === "suspended" ? (language === "ar" ? "موقوف" : "Suspended") : language === "ar" ? roleLabels[item as UserProfileRole].ar : roleLabels[item as UserProfileRole].en}</Text></Pressable>)}</View></View><View style={styles.userList}>{filtered.map((user) => <Pressable key={user.id} onPress={() => setSelected(user)} style={({ pressed }) => [styles.userCard, pressed && styles.pressed]}><View style={styles.userAvatar}><Text style={styles.userAvatarText}>{user.name.slice(0, 1)}</Text></View><View style={styles.userMain}><View style={styles.userTitleRow}><Text style={styles.userName}>{user.name}</Text><View style={[styles.statusBadge, statusBadgeStyle(user.status)]}><Text style={styles.statusBadgeText}>{language === "ar" ? statusLabels[user.status].ar : statusLabels[user.status].en}</Text></View></View><Text style={styles.userMeta}>{user.phone} · {user.region}</Text><View style={styles.userRoleRow}><Text style={styles.userRole}>{language === "ar" ? roleLabels[user.role].ar : roleLabels[user.role].en}</Text>{user.role !== "customer" && <Text style={styles.userDetail}>{user.details?.kitchenName ?? user.details?.vehicleType ?? ""}</Text>}<Text style={styles.userOrders}>{user.ordersCount} {language === "ar" ? "طلب" : "orders"}</Text></View></View><MaterialIcons name="chevron-right" size={22} color="#A7BEAA" /></Pressable>)}{filtered.length === 0 && <EmptyPanel icon="person-search" text={language === "ar" ? "لا توجد نتائج مطابقة" : "No matching users"} />}</View>{selected && <View style={styles.detailSheet}><View style={styles.detailSheetHeader}><View><Text style={styles.panelTitle}>{selected.name}</Text><Text style={styles.panelSubtitle}>{selected.id} · {language === "ar" ? roleLabels[selected.role].ar : roleLabels[selected.role].en}</Text></View><Pressable onPress={() => setSelected(null)}><MaterialIcons name="close" size={22} color="#405C48" /></Pressable></View><View style={styles.detailGrid}><DetailItem label={language === "ar" ? "الهاتف" : "Phone"} value={selected.phone} /><DetailItem label={language === "ar" ? "المنطقة" : "Region"} value={selected.region} /><DetailItem label={language === "ar" ? "التقييم" : "Rating"} value={selected.rating ? `${selected.rating} ★` : "—"} /><DetailItem label={language === "ar" ? "تاريخ الانضمام" : "Joined"} value={selected.joinedDate} /></View>{selected.details && <View style={styles.detailBox}><Text style={styles.detailBoxTitle}>{language === "ar" ? "تفاصيل الامتثال" : "Compliance details"}</Text>{Object.entries(selected.details).map(([key, value]) => <Text key={key} style={styles.detailBoxText}>{key}: {value}</Text>)}</View>}{selected.documents && <View style={styles.documentsPanel}><Text style={styles.detailBoxTitle}>{language === "ar" ? "الوثائق والصور" : "Documents & photos"}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.docsRow}>{selected.documents.map((document) => <View key={document.uri} style={styles.docCard}><Image source={{ uri: document.uri }} style={styles.docImage} /><Text style={styles.docLabel}>{language === "ar" ? document.label.ar : document.label.en}</Text></View>)}</ScrollView></View>}<View style={styles.detailActions}>{selected.status === "pending_approval" && <><Pressable onPress={() => update(selected, "rejected")} style={styles.rejectButton}><Text style={styles.rejectButtonText}>{language === "ar" ? "رفض" : "Reject"}</Text></Pressable><Pressable onPress={() => update(selected, "active")} style={styles.approveButton}><MaterialIcons name="verified" size={16} color="#FFFFFF" /><Text style={styles.approveButtonText}>{language === "ar" ? "اعتماد وفتح الدخول" : "Approve & allow access"}</Text></Pressable></>}{selected.status === "active" && <Pressable onPress={() => update(selected, "suspended")} style={styles.suspendButton}><MaterialIcons name="block" size={16} color="#C44545" /><Text style={styles.suspendButtonText}>{language === "ar" ? "إيقاف الحساب" : "Suspend account"}</Text></Pressable>}{selected.status === "suspended" && <Pressable onPress={() => update(selected, "active")} style={styles.approveButton}><MaterialIcons name="restore" size={16} color="#FFFFFF" /><Text style={styles.approveButtonText}>{language === "ar" ? "إعادة التفعيل" : "Reactivate"}</Text></Pressable>}</View></View>}</ScrollView>;
}

function AdminApprovals({ language, showToast, useDatabase }: { language: "ar" | "en"; showToast: (message: string) => void; useDatabase: boolean }) {
  const { managedUsers: localManagedUsers, updateUserStatus } = useApp();
  const remoteQuery = trpc.admin.listUsers.useQuery(undefined, { enabled: useDatabase });
  const updateMutation = trpc.admin.updateUserStatus.useMutation();
  const managedUsers = useDatabase ? ((remoteQuery.data ?? []) as unknown as ManagedUser[]) : localManagedUsers;
  const pending = managedUsers.filter((user) => user.status === "pending_approval");
  const decide = (user: ManagedUser, status: UserAccountStatus) => {
    if (useDatabase) { updateMutation.mutate({ userId: user.id, status }, { onSuccess: () => { remoteQuery.refetch(); showToast(language === "ar" ? `تم تحديث طلب ${user.name} في قاعدة البيانات` : `${user.name}'s database request updated`); }, onError: () => showToast(language === "ar" ? "تعذر تحديث طلب الاعتماد" : "Could not update approval") }); return; }
    updateUserStatus(user.id, status); showToast(language === "ar" ? `تم تحديث طلب ${user.name}` : `${user.name}'s request updated`);
  };
  return <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}><View style={styles.pageHeading}><View><Text style={styles.pageEyebrow}>{language === "ar" ? "بوابة الامتثال" : "COMPLIANCE GATE"}</Text><Text style={styles.pageTitle}>{language === "ar" ? "طلبات الاعتماد" : "Approval queue"}</Text><Text style={styles.pageSubtitle}>{language === "ar" ? "لا تفتحي لوحة الأم أو السائق قبل مراجعة الوثائق." : "Do not unlock a mother or driver dashboard before reviewing documents."}</Text></View><View style={styles.pendingCounter}><Text style={styles.pendingCounterValue}>{pending.length}</Text><Text style={styles.pendingCounterLabel}>{language === "ar" ? "معلّق" : "pending"}</Text></View></View>{pending.length === 0 ? <EmptyPanel icon="verified" text={language === "ar" ? "كل الحسابات تمت مراجعتها" : "All accounts have been reviewed"} /> : <View style={styles.approvalList}>{pending.map((user) => <View key={user.id} style={styles.approvalCard}><View style={styles.approvalHeader}><View style={styles.userAvatar}><Text style={styles.userAvatarText}>{user.name.slice(0, 1)}</Text></View><View style={styles.approvalCopy}><Text style={styles.userName}>{user.name}</Text><Text style={styles.userMeta}>{user.phone} · {user.region}</Text><Text style={styles.approvalRole}>{language === "ar" ? roleLabels[user.role].ar : roleLabels[user.role].en}</Text></View><View style={styles.newFlag}><Text style={styles.newFlagText}>{language === "ar" ? "جديد" : "NEW"}</Text></View></View><View style={styles.approvalInfo}><DetailItem label={language === "ar" ? "الملف" : "Profile"} value={user.details?.kitchenName ?? user.details?.vehicleType ?? "—"} /><DetailItem label={language === "ar" ? "الوثائق" : "Documents"} value={`${user.documents?.length ?? 0} ${language === "ar" ? "صور" : "photos"}`} /><DetailItem label={language === "ar" ? "تاريخ الطلب" : "Requested"} value={user.joinedDate} /></View>{user.documents && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.docsRow}>{user.documents.map((document) => <View key={document.uri} style={styles.docCard}><Image source={{ uri: document.uri }} style={styles.docImage} /><Text style={styles.docLabel}>{language === "ar" ? document.label.ar : document.label.en}</Text></View>)}</ScrollView>}<View style={styles.detailActions}><Pressable onPress={() => decide(user, "rejected")} style={styles.rejectButton}><Text style={styles.rejectButtonText}>{language === "ar" ? "رفض وطلب تعديل" : "Reject & request changes"}</Text></Pressable><Pressable onPress={() => decide(user, "active")} style={styles.approveButton}><MaterialIcons name="verified" size={16} color="#FFFFFF" /><Text style={styles.approveButtonText}>{language === "ar" ? "اعتماد الحساب" : "Approve account"}</Text></Pressable></View></View>)}</View>}</ScrollView>;
}

function AdminComplaints({ language, useDatabase }: { language: "ar" | "en"; useDatabase: boolean }) {
  const { complaints: localComplaints, updateComplaintStatus } = useApp();
  const remoteQuery = trpc.admin.listComplaints.useQuery(undefined, { enabled: useDatabase });
  const updateMutation = trpc.admin.updateComplaint.useMutation();
  const complaints = useDatabase ? ((remoteQuery.data ?? []) as unknown as Complaint[]) : localComplaints;
  const [responses, setResponses] = useState<Record<string, string>>({});
  const changeStatus = (id: string, status: ComplaintStatus) => {
    const response = responses[id] ?? "";
    if (useDatabase) { updateMutation.mutate({ complaintId: id, status, response }, { onSuccess: () => { remoteQuery.refetch(); }, onError: () => undefined }); return; }
    updateComplaintStatus(id, status, response);
  };
  return <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}><View style={styles.pageHeading}><View><Text style={styles.pageEyebrow}>{language === "ar" ? "دعم العملاء" : "CUSTOMER CARE"}</Text><Text style={styles.pageTitle}>{language === "ar" ? "الشكاوى والصور" : "Complaints & photos"}</Text><Text style={styles.pageSubtitle}>{language === "ar" ? "راجعي ما أرسله العميل، رقم الطلب، والصور المرفقة." : "Review what the customer sent, the order number, and attachments."}</Text></View><View style={styles.pageCount}><Text style={styles.pageCountValue}>{complaints.length}</Text><Text style={styles.pageCountLabel}>{language === "ar" ? "شكوى" : "complaints"}</Text></View></View>{complaints.length === 0 ? <View style={styles.emptyComplaints}><MaterialIcons name="inbox" size={40} color="#4F8F3B" /><Text style={styles.emptyTitle}>{language === "ar" ? "لا توجد شكاوى في هذه البيئة بعد" : "No complaints in this environment yet"}</Text><Text style={styles.emptyBody}>{language === "ar" ? "عند إرسال العميل شكوى ستظهر هنا مع الصور." : "When a customer sends a complaint, it will appear here with photos."}</Text></View> : <View style={styles.complaintsAdminList}>{complaints.map((complaint) => { const category = complaintCategories.find((item) => item.id === complaint.category); return <View key={complaint.id} style={styles.adminComplaintCard}><View style={styles.adminComplaintTop}><View style={styles.complaintBadge}><MaterialIcons name={(category?.icon ?? "help-outline") as IconName} size={17} color="#236B45" /></View><View style={styles.adminComplaintCopy}><Text style={styles.adminComplaintCategory}>{category ? (language === "ar" ? category.label.ar : category.label.en) : complaint.category}</Text><Text style={styles.adminComplaintTitle}>{complaint.subject}</Text><Text style={styles.adminComplaintMeta}>{complaint.id}{complaint.orderId ? ` · ${complaint.orderId}` : ""} · {language === "ar" ? complaintStatuses[complaint.status].ar : complaintStatuses[complaint.status].en}</Text></View><View style={styles.statusBadge}><Text style={styles.statusBadgeText}>{language === "ar" ? complaintStatuses[complaint.status].ar : complaintStatuses[complaint.status].en}</Text></View></View><Text style={styles.adminComplaintDescription}>{complaint.description}</Text>{complaint.imageUris.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.docsRow}>{complaint.imageUris.map((uri, index) => <Image key={`${complaint.id}-${index}`} source={{ uri }} style={styles.complaintAdminImage} />)}</ScrollView>}{complaint.response && <View style={styles.responseBox}><MaterialIcons name="reply" size={16} color="#236B45" /><Text style={styles.responseText}>{complaint.response}</Text></View>}<View style={styles.adminComplaintActions}><TextInput value={responses[complaint.id] ?? ""} onChangeText={(value) => setResponses((current) => ({ ...current, [complaint.id]: value }))} placeholder={language === "ar" ? "اكتبي رداً داخلياً أو للعميل..." : "Write an internal or customer response..."} placeholderTextColor="#9CB3A0" style={styles.complaintResponseInput} multiline /><View style={styles.complaintActionRow}><Pressable onPress={() => changeStatus(complaint.id, "in_review")} style={styles.complaintActionButton}><MaterialIcons name="visibility" size={15} color="#B57808" /><Text style={styles.complaintActionText}>{language === "ar" ? "قيد المراجعة" : "In review"}</Text></Pressable><Pressable onPress={() => changeStatus(complaint.id, "resolved")} style={styles.complaintResolveButton}><MaterialIcons name="check-circle" size={15} color="#FFFFFF" /><Text style={styles.complaintResolveText}>{language === "ar" ? "حل الشكوى" : "Resolve"}</Text></Pressable></View></View></View>; })}</View>}</ScrollView>;
}

function AdminSettings({ language, useDatabase }: { language: "ar" | "en"; useDatabase: boolean }) {
  return <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}><View style={styles.pageHeading}><View><Text style={styles.pageEyebrow}>{language === "ar" ? "الحماية والتكوين" : "SECURITY & CONFIG"}</Text><Text style={styles.pageTitle}>{language === "ar" ? "إعدادات الإدارة" : "Admin settings"}</Text><Text style={styles.pageSubtitle}>{language === "ar" ? "هذه الصفحة توضّح ما يجب ربطه بالخادم قبل النشر التجاري." : "This page describes what must be server-connected before commercial launch."}</Text></View></View><View style={styles.settingsPanel}><SettingStatus icon="lock" title={language === "ar" ? "مصادقة المشرف" : "Supervisor authentication"} body={useDatabase ? (language === "ar" ? "تم التحقق من جلسة مالك النظام عبر OAuth وadminProcedure." : "Owner OAuth session is verified through adminProcedure.") : (language === "ar" ? "وضع المعاينة يستخدم رمزاً محلياً فقط. استخدمي OAuth للإدارة الحقيقية." : "Preview mode uses a local code only. Use OAuth for real administration.")} state={useDatabase ? (language === "ar" ? "متصل" : "Connected") : (language === "ar" ? "معاينة" : "Preview")} warning={!useDatabase} />
<SettingStatus icon="storage" title={language === "ar" ? "قاعدة البيانات" : "Database"} body={useDatabase ? (language === "ar" ? "المستخدمون والشكاوى تُقرأ وتُحدّث عبر Drizzle من قاعدة البيانات." : "Users and complaints are read and updated through Drizzle from the database.") : (language === "ar" ? "سجلي الدخول بحساب مشرف الخادم لعرض بيانات MySQL/Drizzle." : "Sign in with a server admin account to view MySQL/Drizzle data.")} state={useDatabase ? (language === "ar" ? "متصل" : "Connected") : (language === "ar" ? "غير متصل" : "Not connected")} warning={!useDatabase} />
<SettingStatus icon="cloud-upload" title={language === "ar" ? "تخزين الصور" : "Photo storage"} body={language === "ar" ? "صور الشكاوى تُرفع إلى Manus Storage وتُحفظ روابطها في complaintImages." : "Complaint photos are uploaded to Manus Storage and their URLs are saved in complaintImages."} state={language === "ar" ? "متصل" : "Connected"} />
<SettingStatus icon="history" title={language === "ar" ? "سجل القرارات" : "Audit log"} body={language === "ar" ? "سجلي من وافق أو رفض أو أوقف الحساب مع الوقت والسبب." : "Record who approved, rejected, or suspended an account, with time and reason."} state={language === "ar" ? "مطلوب" : "Required"} warning /></View><View style={styles.securityNote}><MaterialIcons name="verified-user" size={20} color="#236B45" /><View style={styles.securityNoteCopy}><Text style={styles.securityNoteTitle}>{language === "ar" ? "قاعدة أمان مهمة" : "Important security rule"}</Text><Text style={styles.securityNoteBody}>{language === "ar" ? "لا تعتمدي على الدور المحفوظ في الهاتف لمنح الصلاحيات. القرار النهائي يجب أن يصدر من الخادم بعد التحقق من جلسة المشرف." : "Never rely on a role stored on the device to grant access. The server must make the final decision after validating the supervisor session."}</Text></View></View></ScrollView>;
}

function ApprovalPreview({ user, language, onPress }: { user: ManagedUser; language: "ar" | "en"; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.approvalPreview, pressed && styles.pressed]}><View style={styles.approvalPreviewIcon}><MaterialIcons name={user.role === "mother" ? "storefront" : "two-wheeler"} size={18} color="#236B45" /></View><View style={styles.approvalPreviewCopy}><Text style={styles.approvalPreviewTitle}>{user.name}</Text><Text style={styles.approvalPreviewMeta}>{language === "ar" ? roleLabels[user.role].ar : roleLabels[user.role].en} · {user.region}</Text></View><MaterialIcons name="chevron-right" size={20} color="#A7BEAA" /></Pressable>; }
function HealthRow({ icon, label, value }: { icon: IconName; label: string; value: string }) { return <View style={styles.healthRow}><View style={styles.healthIcon}><MaterialIcons name={icon} size={16} color="#236B45" /></View><Text style={styles.healthLabel}>{label}</Text><Text style={styles.healthValue}>{value}</Text><View style={styles.healthCheck}><MaterialIcons name="check" size={13} color="#4F8F3B" /></View></View>; }
function EmptyPanel({ icon, text }: { icon: IconName; text: string }) { return <View style={styles.emptyPanel}><MaterialIcons name={icon} size={27} color="#4F8F3B" /><Text style={styles.emptyPanelText}>{text}</Text></View>; }
function DetailItem({ label, value }: { label: string; value: string }) { return <View style={styles.detailItem}><Text style={styles.detailItemLabel}>{label}</Text><Text style={styles.detailItemValue}>{value}</Text></View>; }
function SettingStatus({ icon, title, body, state, warning = false }: { icon: IconName; title: string; body: string; state: string; warning?: boolean }) { return <View style={styles.settingStatus}><View style={styles.settingStatusIcon}><MaterialIcons name={icon} size={19} color={warning ? "#B57808" : "#236B45"} /></View><View style={styles.settingStatusCopy}><Text style={styles.settingStatusTitle}>{title}</Text><Text style={styles.settingStatusBody}>{body}</Text></View><View style={[styles.settingState, warning && styles.settingStateWarning]}><Text style={styles.settingStateText}>{state}</Text></View></View>; }

function statusBadgeStyle(status: UserAccountStatus) { return status === "active" ? styles.statusBadgeActive : status === "pending_approval" ? styles.statusBadgePending : status === "suspended" ? styles.statusBadgeSuspended : styles.statusBadgeRejected; }

const styles = StyleSheet.create({
  loginWrap: { flexGrow: 1, justifyContent: "center", padding: 22, gap: 18, backgroundColor: "#F6FBF3" },
  loginBrand: { alignItems: "center", gap: 7 },
  loginLogo: { width: 70, height: 70, borderRadius: 23, backgroundColor: "#236B45", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  loginEyebrow: { color: "#4F8F3B", fontSize: 10, letterSpacing: 1.6, fontWeight: "900" },
  loginTitle: { color: "#132218", fontSize: 27, fontWeight: "900", textAlign: "center" },
  loginSubtitle: { color: "#5E7665", fontSize: 12, lineHeight: 18, textAlign: "center", maxWidth: 430 },
  loginCard: { width: "100%", maxWidth: 470, alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 25, borderWidth: 1, borderColor: "#DDEAD8", padding: 20, gap: 12 },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingBottom: 5 },
  lockText: { color: "#236B45", fontSize: 11, fontWeight: "900" },
  formLabel: { color: "#2B4933", fontSize: 11, fontWeight: "900" },
  inputWrap: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#DDEAD8", backgroundColor: "#F7FFF0", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  input: { flex: 1, minWidth: 0, color: "#132218", fontSize: 13, paddingVertical: 8 },
  errorText: { color: "#C44545", fontSize: 11, fontWeight: "800" },
  primaryButton: { minHeight: 48, borderRadius: 15, backgroundColor: "#236B45", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  demoNote: { flexDirection: "row", gap: 7, padding: 11, borderRadius: 13, backgroundColor: "#FFF7DC" },
  demoNoteText: { flex: 1, color: "#8A6516", fontSize: 10, lineHeight: 15 },
  backToApp: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, padding: 8 },
  oauthButton: { minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: "#B8D6B9", backgroundColor: "#F0FBEA", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  oauthButtonText: { color: "#236B45", fontSize: 10, fontWeight: "900" },
  backToAppText: { color: "#236B45", fontSize: 11, fontWeight: "900" },
  adminFrame: { flex: 1, backgroundColor: "#F6FBF3" },
  adminTopBar: { minHeight: 70, paddingHorizontal: 20, backgroundColor: "#132218", flexDirection: "row", alignItems: "center", gap: 14 },
  mobileMenu: { width: 36, height: 36, borderRadius: 11, backgroundColor: "#236B45", alignItems: "center", justifyContent: "center" },
  topBrand: { flexDirection: "row", alignItems: "center", gap: 9 },
  topBrandMark: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#236B45", alignItems: "center", justifyContent: "center" },
  topBrandName: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  topBrandSub: { color: "#A7BEAA", fontSize: 9, marginTop: 2 },
  topActions: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 8 },
  liveIndicator: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 12, backgroundColor: "#203B2A" },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#B8F000" },
  liveText: { color: "#D9F99D", fontSize: 9, fontWeight: "900" },
  topActionButton: { minHeight: 34, paddingHorizontal: 9, borderRadius: 10, borderWidth: 1, borderColor: "#2F573D", flexDirection: "row", alignItems: "center", gap: 5 },
  topActionText: { color: "#D9F99D", fontSize: 9, fontWeight: "900" },
  adminBody: { flex: 1, flexDirection: "row" },
  sidebar: { width: 238, backgroundColor: "#FFFFFF", borderRightWidth: 1, borderRightColor: "#DDEAD8", padding: 14 },
  sidebarMobile: { position: "absolute", zIndex: 10, top: 0, bottom: 0, left: 0, elevation: 8, shadowColor: "#132218", shadowOpacity: 0.15, shadowRadius: 12 },
  sidebarHeader: { padding: 10, marginBottom: 12 },
  sidebarEyebrow: { color: "#4F8F3B", fontSize: 9, letterSpacing: 1.2, fontWeight: "900" },
  sidebarTitle: { color: "#132218", fontSize: 18, fontWeight: "900", marginTop: 4 },
  sidebarItem: { minHeight: 45, paddingHorizontal: 11, borderRadius: 13, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  sidebarItemActive: { backgroundColor: "#236B45" },
  sidebarItemCopy: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sidebarItemText: { color: "#5E7665", fontSize: 11, fontWeight: "800" },
  sidebarItemTextActive: { color: "#FFFFFF", fontWeight: "900" },
  sidebarCount: { minWidth: 19, height: 19, borderRadius: 10, backgroundColor: "#B8F000", alignItems: "center", justifyContent: "center" },
  sidebarCountText: { color: "#132218", fontSize: 9, fontWeight: "900" },
  sidebarBottom: { marginTop: "auto", padding: 10, borderTopWidth: 1, borderTopColor: "#EEF4EC", gap: 12 },
  adminIdentity: { flexDirection: "row", alignItems: "center", gap: 8 },
  adminAvatar: { width: 32, height: 32, borderRadius: 11, backgroundColor: "#4F8F3B", alignItems: "center", justifyContent: "center" },
  adminName: { color: "#132218", fontSize: 10, fontWeight: "900" },
  adminRole: { color: "#8AA08D", fontSize: 9, marginTop: 2 },
  sidebarVersion: { color: "#A7BEAA", fontSize: 8 },
  adminContent: { flex: 1, minWidth: 0 },
  contentScroll: { padding: 24, gap: 20, paddingBottom: 45 },
  pageHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 15 },
  pageEyebrow: { color: "#4F8F3B", fontSize: 9, letterSpacing: 1.25, fontWeight: "900" },
  pageTitle: { color: "#132218", fontSize: 26, fontWeight: "900", marginTop: 4 },
  pageSubtitle: { color: "#5E7665", fontSize: 11, lineHeight: 17, marginTop: 5, maxWidth: 700 },
  dateBadge: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDEAD8", flexDirection: "row", alignItems: "center", gap: 6 },
  dateBadgeText: { color: "#236B45", fontSize: 9, fontWeight: "900" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metricCard: { flexGrow: 1, flexBasis: 180, minHeight: 140, padding: 15, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDEAD8" },
  metricIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: "#E8F7E5", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  metricIconLime: { backgroundColor: "#EFFFC4" },
  metricIconOrange: { backgroundColor: "#FFF3CF" },
  metricIconRed: { backgroundColor: "#FDE7E4" },
  metricLabel: { color: "#5E7665", fontSize: 10, fontWeight: "800" },
  metricValue: { color: "#132218", fontSize: 28, fontWeight: "900", marginTop: 3 },
  metricDetail: { color: "#8AA08D", fontSize: 9, marginTop: 1 },
  twoColumn: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  panel: { flex: 1, minWidth: 300, padding: 16, borderRadius: 19, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDEAD8", gap: 10 },
  panelHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  panelTitle: { color: "#132218", fontSize: 14, fontWeight: "900" },
  panelSubtitle: { color: "#8AA08D", fontSize: 9, marginTop: 3 },
  panelLink: { color: "#236B45", fontSize: 10, fontWeight: "900" },
  approvalPreview: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#EEF4EC" },
  approvalPreviewIcon: { width: 33, height: 33, borderRadius: 11, backgroundColor: "#F0FBEA", alignItems: "center", justifyContent: "center" },
  approvalPreviewCopy: { flex: 1 },
  approvalPreviewTitle: { color: "#132218", fontSize: 11, fontWeight: "900" },
  approvalPreviewMeta: { color: "#5E7665", fontSize: 9, marginTop: 2 },
  miniComplaint: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#EEF4EC" },
  miniComplaintIcon: { width: 33, height: 33, borderRadius: 11, backgroundColor: "#FFF7DC", alignItems: "center", justifyContent: "center" },
  miniComplaintCopy: { flex: 1 },
  miniComplaintTitle: { color: "#132218", fontSize: 10, fontWeight: "900" },
  miniComplaintMeta: { color: "#8AA08D", fontSize: 9, marginTop: 2 },
  emptyPanel: { minHeight: 100, alignItems: "center", justifyContent: "center", gap: 7 },
  emptyPanelText: { color: "#5E7665", fontSize: 10, textAlign: "center" },
  activityPanel: { padding: 16, borderRadius: 19, backgroundColor: "#132218", gap: 14 },
  healthPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, backgroundColor: "#203B2A" },
  healthText: { color: "#D9F99D", fontSize: 9, fontWeight: "900" },
  healthRows: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  healthRow: { flex: 1, minWidth: 170, padding: 11, borderRadius: 13, backgroundColor: "#1C3224", flexDirection: "row", alignItems: "center", gap: 7 },
  healthIcon: { width: 29, height: 29, borderRadius: 10, backgroundColor: "#2B5236", alignItems: "center", justifyContent: "center" },
  healthLabel: { flex: 1, color: "#B7D1B9", fontSize: 9 },
  healthValue: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  healthCheck: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#D9F99D", alignItems: "center", justifyContent: "center" },
  pageCount: { minWidth: 70, padding: 11, borderRadius: 13, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDEAD8", alignItems: "center" },
  pageCountValue: { color: "#236B45", fontSize: 22, fontWeight: "900" },
  pageCountLabel: { color: "#8AA08D", fontSize: 9, marginTop: 1 },
  filterBar: { gap: 12, padding: 14, backgroundColor: "#FFFFFF", borderRadius: 17, borderWidth: 1, borderColor: "#DDEAD8" },
  adminSearch: { height: 43, borderRadius: 13, borderWidth: 1, borderColor: "#DDEAD8", backgroundColor: "#F7FFF0", flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11 },
  adminSearchInput: { flex: 1, minWidth: 0, color: "#132218", fontSize: 11, paddingVertical: 0 },
  filterChips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: "#F7FFF0", borderWidth: 1, borderColor: "#DDEAD8" },
  filterChipActive: { backgroundColor: "#236B45", borderColor: "#236B45" },
  filterChipText: { color: "#5E7665", fontSize: 9, fontWeight: "800" },
  filterChipTextActive: { color: "#FFFFFF" },
  userList: { gap: 9 },
  userCard: { padding: 13, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDEAD8", flexDirection: "row", alignItems: "center", gap: 10 },
  userAvatar: { width: 39, height: 39, borderRadius: 14, backgroundColor: "#D9F99D", alignItems: "center", justifyContent: "center" },
  userAvatarText: { color: "#236B45", fontSize: 16, fontWeight: "900" },
  userMain: { flex: 1, minWidth: 0, gap: 3 },
  userTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  userName: { color: "#132218", fontSize: 12, fontWeight: "900" },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { color: "#5E7665", fontSize: 8, fontWeight: "900" },
  statusBadgeActive: { backgroundColor: "#E8F7E5" },
  statusBadgePending: { backgroundColor: "#FFF3CF" },
  statusBadgeSuspended: { backgroundColor: "#FDE7E4" },
  statusBadgeRejected: { backgroundColor: "#F1ECEC" },
  userMeta: { color: "#8AA08D", fontSize: 9 },
  userRoleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  userRole: { color: "#4F8F3B", fontSize: 9, fontWeight: "900" },
  userDetail: { color: "#5E7665", fontSize: 9 },
  userOrders: { color: "#8AA08D", fontSize: 9 },
  detailSheet: { padding: 17, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#B8D6B9", gap: 14 },
  detailSheetHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  detailItem: { flexGrow: 1, flexBasis: 120, padding: 9, borderRadius: 11, backgroundColor: "#F7FFF0" },
  detailItemLabel: { color: "#8AA08D", fontSize: 8 },
  detailItemValue: { color: "#132218", fontSize: 10, fontWeight: "900", marginTop: 4 },
  detailBox: { padding: 11, borderRadius: 13, backgroundColor: "#F0FBEA", gap: 4 },
  detailBoxTitle: { color: "#236B45", fontSize: 10, fontWeight: "900" },
  detailBoxText: { color: "#405C48", fontSize: 9 },
  documentsPanel: { gap: 8 },
  docsRow: { flexDirection: "row", gap: 8 },
  docCard: { width: 92, gap: 5 },
  docImage: { width: 92, height: 76, borderRadius: 12, backgroundColor: "#EEF4EC" },
  docLabel: { color: "#5E7665", fontSize: 8, lineHeight: 12 },
  detailActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rejectButton: { minHeight: 40, flex: 1, minWidth: 130, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: "#F1C4BF", backgroundColor: "#FFF4F2", alignItems: "center", justifyContent: "center" },
  rejectButtonText: { color: "#C44545", fontSize: 10, fontWeight: "900" },
  approveButton: { minHeight: 40, flex: 1, minWidth: 150, paddingHorizontal: 13, borderRadius: 12, backgroundColor: "#236B45", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  approveButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  suspendButton: { minHeight: 40, flex: 1, minWidth: 180, borderRadius: 12, borderWidth: 1, borderColor: "#F1C4BF", backgroundColor: "#FFF4F2", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  suspendButtonText: { color: "#C44545", fontSize: 10, fontWeight: "900" },
  pendingCounter: { minWidth: 70, padding: 11, borderRadius: 13, backgroundColor: "#FFF3CF", alignItems: "center" },
  pendingCounterValue: { color: "#B57808", fontSize: 22, fontWeight: "900" },
  pendingCounterLabel: { color: "#8A6516", fontSize: 9, marginTop: 1 },
  approvalList: { gap: 13 },
  approvalCard: { padding: 16, borderRadius: 19, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDEAD8", gap: 13 },
  approvalHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  approvalCopy: { flex: 1, gap: 3 },
  approvalRole: { color: "#4F8F3B", fontSize: 9, fontWeight: "900" },
  newFlag: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, backgroundColor: "#EFFFC4" },
  newFlagText: { color: "#236B45", fontSize: 8, fontWeight: "900" },
  approvalInfo: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emptyComplaints: { minHeight: 230, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDEAD8", alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  emptyTitle: { color: "#132218", fontSize: 14, fontWeight: "900", textAlign: "center" },
  emptyBody: { color: "#5E7665", fontSize: 10, lineHeight: 16, textAlign: "center", maxWidth: 360 },
  complaintsAdminList: { gap: 12 },
  adminComplaintCard: { padding: 16, borderRadius: 19, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDEAD8", gap: 10 },
  adminComplaintTop: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  complaintBadge: { width: 35, height: 35, borderRadius: 12, backgroundColor: "#F0FBEA", alignItems: "center", justifyContent: "center" },
  adminComplaintCopy: { flex: 1, gap: 3 },
  adminComplaintCategory: { color: "#4F8F3B", fontSize: 9, fontWeight: "900" },
  adminComplaintTitle: { color: "#132218", fontSize: 13, fontWeight: "900" },
  adminComplaintMeta: { color: "#8AA08D", fontSize: 9 },
  adminComplaintDescription: { color: "#405C48", fontSize: 11, lineHeight: 17 },
  complaintAdminImage: { width: 110, height: 92, borderRadius: 13, backgroundColor: "#EEF4EC" },
  responseBox: { flexDirection: "row", alignItems: "flex-start", gap: 7, padding: 10, borderRadius: 12, backgroundColor: "#F0FBEA" },
  responseText: { flex: 1, color: "#236B45", fontSize: 10, lineHeight: 15, fontWeight: "800" },
  adminComplaintActions: { gap: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: "#EEF4EC" },
  complaintResponseInput: { minHeight: 43, maxHeight: 80, borderRadius: 11, borderWidth: 1, borderColor: "#DDEAD8", backgroundColor: "#F7FFF0", color: "#132218", fontSize: 10, paddingHorizontal: 10, paddingVertical: 8, textAlignVertical: "top" },
  complaintActionRow: { flexDirection: "row", gap: 8 },
  complaintActionButton: { flex: 1, minHeight: 37, borderRadius: 11, borderWidth: 1, borderColor: "#F4DB97", backgroundColor: "#FFF7DC", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  complaintActionText: { color: "#8A6516", fontSize: 9, fontWeight: "900" },
  complaintResolveButton: { flex: 1, minHeight: 37, borderRadius: 11, backgroundColor: "#236B45", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  complaintResolveText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  settingsPanel: { backgroundColor: "#FFFFFF", borderRadius: 19, borderWidth: 1, borderColor: "#DDEAD8", overflow: "hidden" },
  settingStatus: { padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 10, borderBottomWidth: 1, borderBottomColor: "#EEF4EC" },
  settingStatusIcon: { width: 35, height: 35, borderRadius: 12, backgroundColor: "#FFF7DC", alignItems: "center", justifyContent: "center" },
  settingStatusCopy: { flex: 1, gap: 4 },
  settingStatusTitle: { color: "#132218", fontSize: 12, fontWeight: "900" },
  settingStatusBody: { color: "#5E7665", fontSize: 10, lineHeight: 16 },
  settingState: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, backgroundColor: "#E8F7E5" },
  settingStateWarning: { backgroundColor: "#FFF3CF" },
  settingStateText: { color: "#8A6516", fontSize: 8, fontWeight: "900" },
  securityNote: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 16, borderRadius: 17, backgroundColor: "#EEF9DB", borderWidth: 1, borderColor: "#D9F99D" },
  securityNoteCopy: { flex: 1, gap: 4 },
  securityNoteTitle: { color: "#236B45", fontSize: 12, fontWeight: "900" },
  securityNoteBody: { color: "#4F8F3B", fontSize: 10, lineHeight: 16 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
