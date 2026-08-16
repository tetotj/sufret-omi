import { useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { categories, getLocalized, regions, type CategoryId, type Role } from "@/lib/food-data";
import { useApp } from "@/lib/app-context";
import { driverVehicleLabels, loadCapacityLabels, mealSizeLabels, verificationStatusLabel, type VerificationDocumentType } from "@/lib/verification-data";
import { pickVerificationImage, takeVerificationPhoto } from "@/lib/verification-image-picker";

type VerificationScreenProps = { role: Extract<Role, "mother" | "driver"> };

export function VerificationScreen({ role }: VerificationScreenProps) {
  const [cameraDocumentType, setCameraDocumentType] = useState<VerificationDocumentType | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const {
    language,
    motherVerification,
    driverVerification,
    updateMotherVerification,
    updateDriverVerification,
    attachVerificationDocument,
    submitVerification,
    signOut,
    showToast,
  } = useApp();
  const isMother = role === "mother";
  const profile = isMother ? motherVerification : driverVerification;
  const status = getLocalized(verificationStatusLabel(profile.approvalStatus), language);
  const documentTypes = profile.documents;
  const selectedFoodTypes = isMother ? motherVerification.foodTypes : [];
  const mealSizes = ["small", "medium", "large"] as const;
  const loadCapacities = ["small", "medium", "large"] as const;
  const vehicleTypes = ["motorcycle", "car", "van"] as const;
  const title = isMother ? (language === "ar" ? "ملف الأم والمطبخ" : "Mother & kitchen profile") : language === "ar" ? "ملف مندوب التوصيل" : "Delivery driver profile";
  const subtitle = isMother ? (language === "ar" ? "أرفقي بياناتك ووثائقك ليتم اعتمادك من فريق سفرة أمي." : "Add your details and documents for the Sufret Omi supervisor team to review.") : language === "ar" ? "أرفق وثائقك حتى يتم اعتمادك لاستلام الطلبات." : "Attach your documents so you can be approved to receive deliveries.";
  const updateProfile = (patch: Partial<typeof profile>) => {
    if (isMother) updateMotherVerification(patch);
    else updateDriverVerification(patch);
  };

  const attachSelectedDocument = (documentType: VerificationDocumentType, uri: string | null) => {
    if (uri) {
      attachVerificationDocument(role, documentType, uri);
    } else {
      showToast(language === "ar" ? "لم يتم اختيار صورة" : "No photo was selected");
    }
  };

  const captureDocument = async (documentType: VerificationDocumentType) => {
    if (Platform.OS === "web") {
      try {
        const uri = await takeVerificationPhoto();
        attachSelectedDocument(documentType, uri);
      } catch (error) {
        const permissionDenied = error instanceof Error && error.message === "CAMERA_PERMISSION_DENIED";
        showToast(permissionDenied
          ? language === "ar" ? "اسمحي للمتصفح باستخدام الكاميرا ثم حاولي مرة أخرى" : "Allow camera access in the browser, then try again"
          : language === "ar" ? "تعذّر فتح الكاميرا" : "Could not open the camera");
      }
      return;
    }

    setCameraDocumentType(documentType);
    if (!cameraPermission?.granted) await requestCameraPermission();
  };

  const closeCamera = () => setCameraDocumentType(null);

  const takePhotoFromCamera = async () => {
    if (!cameraDocumentType || !cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      attachSelectedDocument(cameraDocumentType, photo?.uri ?? null);
      closeCamera();
    } catch {
      showToast(language === "ar" ? "تعذّر التقاط الصورة، حاولي مرة أخرى" : "Could not capture the photo. Please try again.");
    }
  };

  const pickDocument = async (documentType: VerificationDocumentType) => {
    try {
      const uri = await pickVerificationImage();
      attachSelectedDocument(documentType, uri);
    } catch (error) {
      const permissionDenied = error instanceof Error && error.message === "PHOTO_PERMISSION_DENIED";
      showToast(permissionDenied
        ? language === "ar" ? "اسمحي للتطبيق بالوصول إلى الصور من إعدادات الهاتف ثم حاولي مرة أخرى" : "Allow photo access in your phone settings, then try again"
        : language === "ar" ? "تعذّر فتح معرض الصور" : "Could not open the photo library");
    }
  };

  const toggleFoodType = (categoryId: CategoryId) => {
    if (!isMother) return;
    const next = selectedFoodTypes.includes(categoryId) ? selectedFoodTypes.filter((item) => item !== categoryId) : [...selectedFoodTypes, categoryId];
    updateMotherVerification({ foodTypes: next });
  };

  const statusStyle = profile.approvalStatus === "pending" ? styles.statusPending : profile.approvalStatus === "approved" ? styles.statusApproved : profile.approvalStatus === "rejected" ? styles.statusRejected : styles.statusDraft;

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} containerClassName="bg-background" className="flex-1">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}><View style={styles.brandLockup}><Image source={require("@/assets/images/icon.png")} style={styles.logo} /><View><Text style={styles.eyebrow}>{language === "ar" ? "سفرة أمي" : "SUFRET OMI"}</Text><Text style={styles.screenTitle}>{title}</Text></View></View><Pressable onPress={signOut} style={styles.signOut}><MaterialIcons name="logout" size={16} color="#236B45" /><Text style={styles.signOutText}>{language === "ar" ? "خروج" : "Log out"}</Text></Pressable></View>
        <View style={styles.intro}><Text style={styles.introTitle}>{language === "ar" ? "قبل ما نفتح لك اللوحة" : "Before we open your dashboard"}</Text><Text style={styles.introBody}>{subtitle}</Text></View>
        <View style={[styles.statusCard, statusStyle]}><MaterialIcons name={profile.approvalStatus === "pending" ? "hourglass-top" : profile.approvalStatus === "approved" ? "verified" : profile.approvalStatus === "rejected" ? "edit-document" : "shield"} size={20} color={profile.approvalStatus === "pending" ? "#C88A16" : profile.approvalStatus === "approved" ? "#4F8F3B" : profile.approvalStatus === "rejected" ? "#C44545" : "#236B45"} /><View style={styles.statusCopy}><Text style={styles.statusLabel}>{language === "ar" ? "حالة الاعتماد" : "Approval status"}</Text><Text style={styles.statusValue}>{status}</Text></View></View>

        <Text style={styles.sectionTitle}>{language === "ar" ? "البيانات الأساسية" : "Basic details"}</Text>
        <Text style={styles.inputLabel}>{language === "ar" ? "الاسم الكامل" : "Full name"}</Text>
        <View style={styles.inputWrap}><MaterialIcons name="person-outline" size={18} color="#236B45" /><TextInput value={profile.fullName} onChangeText={(fullName) => updateProfile({ fullName })} placeholder={language === "ar" ? "الاسم كما يظهر في الهوية" : "Name as shown on ID"} placeholderTextColor="#A4BDA7" style={styles.input} textAlign={language === "ar" ? "right" : "left"} /></View>
        <Text style={styles.inputLabel}>{language === "ar" ? "رقم الهاتف" : "Phone number"}</Text>
        <View style={styles.inputWrap}><MaterialIcons name="phone-iphone" size={18} color="#236B45" /><TextInput value={profile.phone} onChangeText={(phone) => updateProfile({ phone })} placeholder="07X XXX XXXX" placeholderTextColor="#A4BDA7" keyboardType="phone-pad" style={styles.input} textAlign={language === "ar" ? "right" : "left"} /></View>
        <Text style={styles.inputLabel}>{language === "ar" ? "العنوان" : "Address"}</Text>
        <View style={styles.inputWrap}><MaterialIcons name="home" size={18} color="#236B45" /><TextInput value={profile.address} onChangeText={(address) => updateProfile({ address })} placeholder={language === "ar" ? "الحي، الشارع، رقم البناء" : "Neighborhood, street, building"} placeholderTextColor="#A4BDA7" style={styles.input} textAlign={language === "ar" ? "right" : "left"} /></View>
        <Text style={styles.inputLabel}>{language === "ar" ? "المنطقة" : "Region"}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{regions.slice(0, 13).map((region) => <Pressable key={region.id} onPress={() => updateProfile({ region: region.id })} style={[styles.chip, profile.region === region.id && styles.chipActive]}><Text style={[styles.chipText, profile.region === region.id && styles.chipTextActive]}>{getLocalized(region.label, language)}</Text></Pressable>)}</ScrollView>

        {isMother && <>
          <Text style={styles.sectionTitle}>{language === "ar" ? "المطبخ والسلامة الغذائية" : "Kitchen & food safety"}</Text>
          <Text style={styles.inputLabel}>{language === "ar" ? "أنواع الأكل التي تقدمينها" : "Food types you offer"}</Text>
          <View style={styles.foodGrid}>{categories.map((category) => <Pressable key={category.id} onPress={() => toggleFoodType(category.id)} style={[styles.foodChip, selectedFoodTypes.includes(category.id) && { backgroundColor: category.color, borderColor: category.color }]}><MaterialIcons name={category.icon as React.ComponentProps<typeof MaterialIcons>["name"]} size={16} color={selectedFoodTypes.includes(category.id) ? "#FFFFFF" : category.color} /><Text style={[styles.foodChipText, selectedFoodTypes.includes(category.id) && styles.foodChipTextActive]}>{getLocalized(category.label, language)}</Text></Pressable>)}</View>
          <Text style={styles.inputLabel}>{language === "ar" ? "حجم الوجبات التي تحضّرينها" : "Typical meal size"}</Text>
          <View style={styles.optionRow}>{mealSizes.map((size) => <Pressable key={size} onPress={() => updateMotherVerification({ mealSize: size })} style={[styles.option, motherVerification.mealSize === size && styles.optionActive]}><Text style={[styles.optionText, motherVerification.mealSize === size && styles.optionTextActive]}>{getLocalized(mealSizeLabels[size], language)}</Text></Pressable>)}</View>
          <Text style={styles.helperText}>{language === "ar" ? "نستخدم الحجم لتجهيز مركبة مناسبة للطلب." : "We use this to assign a vehicle that fits the order."}</Text>
          <Text style={styles.inputLabel}>{language === "ar" ? "أكبر حمولة توصيل تقبلينها" : "Largest delivery load you accept"}</Text>
          <View style={styles.optionRow}>{loadCapacities.map((capacity) => <Pressable key={capacity} onPress={() => updateMotherVerification({ deliveryCapacity: capacity })} style={[styles.option, motherVerification.deliveryCapacity === capacity && styles.optionActive]}><Text style={[styles.optionText, motherVerification.deliveryCapacity === capacity && styles.optionTextActive]}>{getLocalized(loadCapacityLabels[capacity], language)}</Text></Pressable>)}</View>
          <Text style={styles.inputLabel}>{language === "ar" ? "هل يوجد حيوانات في المنزل؟" : "Are there pets at home?"}</Text>
          <View style={styles.optionRow}>{(["yes", "no"] as const).map((value) => <Pressable key={value} onPress={() => updateMotherVerification({ hasPets: value })} style={[styles.option, motherVerification.hasPets === value && styles.optionActive]}><Text style={[styles.optionText, motherVerification.hasPets === value && styles.optionTextActive]}>{value === "yes" ? (language === "ar" ? "نعم" : "Yes") : language === "ar" ? "لا" : "No"}</Text></Pressable>)}</View>
          <Text style={styles.inputLabel}>{language === "ar" ? "مواد الحساسية واحتياطات التحضير" : "Allergens and preparation precautions"}</Text>
          <View style={[styles.inputWrap, styles.textAreaWrap]}><MaterialIcons name="warning-amber" size={18} color="#236B45" /><TextInput value={motherVerification.allergyPrecautions} onChangeText={(allergyPrecautions) => updateMotherVerification({ allergyPrecautions })} placeholder={language === "ar" ? "مثال: يحتوي على مكسرات، نستخدم أدوات منفصلة..." : "Example: contains nuts, separate utensils..."} placeholderTextColor="#A4BDA7" multiline style={[styles.input, styles.textArea]} textAlign={language === "ar" ? "right" : "left"} /></View>
        </>}

        {!isMother && <>
          <Text style={styles.sectionTitle}>{language === "ar" ? "المركبة والحمولة" : "Vehicle & capacity"}</Text>
          <Text style={styles.inputLabel}>{language === "ar" ? "ما نوع المركبة التي تمتلكها؟" : "What vehicle do you use?"}</Text>
          <View style={styles.optionRow}>{vehicleTypes.map((vehicleType) => <Pressable key={vehicleType} onPress={() => updateDriverVerification({ vehicleType })} style={[styles.option, driverVerification.vehicleType === vehicleType && styles.optionActive]}><MaterialIcons name={vehicleType === "motorcycle" ? "two-wheeler" : vehicleType === "car" ? "directions-car" : "airport-shuttle"} size={18} color={driverVerification.vehicleType === vehicleType ? "#4F8F3B" : "#236B45"} /><Text style={[styles.optionText, driverVerification.vehicleType === vehicleType && styles.optionTextActive]}>{getLocalized(driverVehicleLabels[vehicleType], language)}</Text></Pressable>)}</View>
          <Text style={styles.inputLabel}>{language === "ar" ? "سعة الحمولة الفعلية" : "Available cargo capacity"}</Text>
          <View style={styles.optionRow}>{loadCapacities.map((capacity) => <Pressable key={capacity} onPress={() => updateDriverVerification({ cargoCapacity: capacity })} style={[styles.option, driverVerification.cargoCapacity === capacity && styles.optionActive]}><Text style={[styles.optionText, driverVerification.cargoCapacity === capacity && styles.optionTextActive]}>{getLocalized(loadCapacityLabels[capacity], language)}</Text></Pressable>)}</View>
          <Text style={styles.helperText}>{language === "ar" ? "سيظهر لك الطلب إذا كانت مركبتك مناسبة لحجمه." : "You will only receive orders that fit your vehicle capacity."}</Text>
        </>}

        <Text style={styles.sectionTitle}>{language === "ar" ? "الوثائق المطلوبة" : "Required documents"}</Text>
        <Text style={styles.helperText}>{language === "ar" ? "تُعرض هذه الصور لفريق الإشراف فقط، ولا تظهر للعميلات." : "These photos are visible only to the supervisor team, never to customers."}</Text>
        <View style={styles.documents}>{documentTypes.map((document) => <Pressable key={document.type} accessibilityRole="button" accessibilityLabel={language === "ar" ? `فتح كاميرا ${getLocalized(document.label, language)}` : `Open camera for ${getLocalized(document.label, language)}`} onPress={() => void captureDocument(document.type)} style={({ pressed }) => [styles.documentRow, pressed && styles.pressed]}><View style={styles.documentMain}>{document.uri ? <Image source={{ uri: document.uri }} style={styles.documentThumb} /> : <View style={styles.documentIcon}><MaterialIcons name="add-a-photo" size={19} color="#236B45" /></View>}<View style={styles.documentCopy}><Text style={styles.documentTitle}>{getLocalized(document.label, language)}</Text><Text style={styles.documentStatus}>{document.uri ? (language === "ar" ? "تم إرفاق الصورة — اضغطي للتصوير من جديد" : "Photo attached — tap to retake") : (language === "ar" ? "اضغطي لفتح الكاميرا" : "Tap to open camera")}</Text></View></View><Pressable accessibilityRole="button" accessibilityLabel={language === "ar" ? "اختيار صورة من المعرض" : "Choose a photo from the library"} onPress={(event) => { event.stopPropagation(); void pickDocument(document.type); }} style={({ pressed }) => [styles.documentAction, pressed && styles.pressed]}><MaterialIcons name="photo-library" size={19} color="#236B45" /></Pressable></Pressable>)}</View>

        <Pressable onPress={() => updateProfile({ termsAccepted: !profile.termsAccepted })} style={styles.termsRow}><MaterialIcons name={profile.termsAccepted ? "check-box" : "check-box-outline-blank"} size={22} color={profile.termsAccepted ? "#4F8F3B" : "#A4BDA7"} /><Text style={styles.termsText}>{language === "ar" ? "أوافق على شروط منصة سفرة أمي وسياسة السلامة والخصوصية." : "I agree to Sufret Omi platform terms, safety, and privacy policy."}</Text></Pressable>
        <Pressable disabled={profile.approvalStatus === "pending"} onPress={() => submitVerification(role)} style={({ pressed }) => [styles.submitButton, profile.approvalStatus === "pending" && styles.submitDisabled, pressed && styles.pressed]}><Text style={styles.submitText}>{profile.approvalStatus === "pending" ? (language === "ar" ? "بانتظار موافقة الفريق" : "Waiting for supervisor approval") : language === "ar" ? "إرسال للمراجعة" : "Submit for review"}</Text><MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" /></Pressable>
        <Text style={styles.privacyNote}>{language === "ar" ? "نستخدم الوثائق للتحقق والامتثال فقط، وتبقى محمية ولا تُشارك مع العملاء." : "Documents are used for verification and compliance only, kept private, and never shared with customers."}</Text>
      </ScrollView>
      <Modal visible={Platform.OS !== "web" && cameraDocumentType !== null} animationType="slide" onRequestClose={closeCamera} presentationStyle="fullScreen">
        <View style={styles.cameraModal}>
          {cameraPermission?.granted ? <CameraView ref={cameraRef} style={styles.cameraPreview} facing="back" /> : <View style={styles.cameraPermissionCard}><MaterialIcons name="no-photography" size={48} color="#D76545" /><Text style={styles.cameraPermissionTitle}>{language === "ar" ? "نحتاج إلى الكاميرا" : "Camera access required"}</Text><Text style={styles.cameraPermissionText}>{language === "ar" ? "اسمحي بالكاميرا لتصوير الوثيقة مباشرة." : "Allow camera access to photograph this document directly."}</Text><Pressable onPress={() => void requestCameraPermission()} style={styles.cameraPermissionButton}><Text style={styles.cameraPermissionButtonText}>{language === "ar" ? "السماح بالكاميرا" : "Allow camera"}</Text></Pressable></View>}
          <View style={styles.cameraControls}><Pressable onPress={closeCamera} style={styles.cameraCloseButton}><MaterialIcons name="close" size={24} color="#FFFFFF" /></Pressable>{cameraPermission?.granted && <Pressable accessibilityLabel={language === "ar" ? "التقاط صورة" : "Take photo"} onPress={() => void takePhotoFromCamera()} style={styles.cameraCaptureButton}><MaterialIcons name="photo-camera" size={28} color="#38231C" /></Pressable>}<View style={styles.cameraControlSpacer} /></View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 34, gap: 10 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1 },
  logo: { width: 40, height: 40, borderRadius: 13 },
  eyebrow: { color: "#236B45", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  screenTitle: { color: "#132218", fontSize: 17, fontWeight: "900", marginTop: 2 },
  signOut: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F0FBEA", borderRadius: 14, paddingHorizontal: 9, paddingVertical: 8 },
  signOutText: { color: "#236B45", fontSize: 10, fontWeight: "900" },
  intro: { borderRadius: 20, padding: 15, backgroundColor: "#F0FBEA", borderWidth: 1, borderColor: "#C7E8C8", gap: 4 },
  introTitle: { color: "#132218", fontSize: 18, fontWeight: "900" },
  introBody: { color: "#1B5E3A", fontSize: 11, lineHeight: 17 },
  statusCard: { flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 15, padding: 12, borderWidth: 1 },
  statusDraft: { backgroundColor: "#F3FFE6", borderColor: "#D9F99D" },
  statusPending: { backgroundColor: "#FBFCE9", borderColor: "#F5D34A" },
  statusApproved: { backgroundColor: "#EEF9DB", borderColor: "#D9F99D" },
  statusRejected: { backgroundColor: "#FFF0F0", borderColor: "#FFCACA" },
  statusCopy: { flex: 1 },
  statusLabel: { color: "#5E7665", fontSize: 10, fontWeight: "800" },
  statusValue: { color: "#132218", fontSize: 13, fontWeight: "900", marginTop: 2 },
  sectionTitle: { color: "#132218", fontSize: 16, fontWeight: "900", marginTop: 9 },
  inputLabel: { color: "#2B4933", fontSize: 10, fontWeight: "900", marginTop: 4 },
  inputWrap: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#DDEAD8", backgroundColor: "#FFFFFF", paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, color: "#132218", fontSize: 12, paddingVertical: 0 },
  textAreaWrap: { alignItems: "flex-start", paddingVertical: 10 },
  textArea: { minHeight: 56, lineHeight: 18 },
  chips: { gap: 7, paddingVertical: 2 },
  chip: { borderRadius: 16, borderWidth: 1, borderColor: "#DDEAD8", backgroundColor: "#FFFFFF", paddingHorizontal: 11, paddingVertical: 8 },
  chipActive: { backgroundColor: "#236B45", borderColor: "#236B45" },
  chipText: { color: "#5E7665", fontSize: 10, fontWeight: "800" },
  chipTextActive: { color: "#FFFFFF" },
  foodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  foodChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 15, borderWidth: 1, borderColor: "#DDEAD8", backgroundColor: "#FFFFFF", paddingHorizontal: 10, paddingVertical: 9 },
  foodChipText: { color: "#2B4933", fontSize: 10, fontWeight: "800" },
  foodChipTextActive: { color: "#FFFFFF" },
  optionRow: { flexDirection: "row", gap: 8 },
  option: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 13, borderWidth: 1, borderColor: "#DDEAD8", backgroundColor: "#FFFFFF", paddingVertical: 9, gap: 3 },
  optionActive: { backgroundColor: "#EEF9DB", borderColor: "#B8F000" },
  optionText: { color: "#5E7665", fontSize: 11, fontWeight: "900" },
  optionTextActive: { color: "#4F8F3B" },
  helperText: { color: "#5E7665", fontSize: 10, lineHeight: 15 },
  documents: { gap: 8 },
  documentRow: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#DDEAD8", padding: 10 },
  documentMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9, minHeight: 42 },
  documentIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#F0FBEA", alignItems: "center", justifyContent: "center" },
  documentThumb: { width: 40, height: 40, borderRadius: 12 },
  documentCopy: { flex: 1, minHeight: 40, justifyContent: "center" },
  documentAction: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#F0FBEA", alignItems: "center", justifyContent: "center" },
  documentTitle: { color: "#132218", fontSize: 11, fontWeight: "900" },
  documentStatus: { color: "#5E7665", fontSize: 10, marginTop: 3 },
  termsRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  termsText: { flex: 1, color: "#2B4933", fontSize: 10, lineHeight: 15 },
  submitButton: { minHeight: 50, borderRadius: 17, backgroundColor: "#236B45", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  submitDisabled: { backgroundColor: "#A4BDA7" },
  submitText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  privacyNote: { color: "#4F8F3B", fontSize: 10, lineHeight: 15, textAlign: "center", paddingHorizontal: 7 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  cameraModal: { flex: 1, backgroundColor: "#06181B", justifyContent: "space-between" },
  cameraPreview: { flex: 1 },
  cameraPermissionCard: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
  cameraPermissionTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", textAlign: "center" },
  cameraPermissionText: { color: "#F1D8C8", fontSize: 13, lineHeight: 20, textAlign: "center" },
  cameraPermissionButton: { backgroundColor: "#F2B84B", borderRadius: 16, paddingHorizontal: 22, paddingVertical: 13, marginTop: 8 },
  cameraPermissionButtonText: { color: "#38231C", fontSize: 13, fontWeight: "900" },
  cameraControls: { minHeight: 110, paddingHorizontal: 24, paddingBottom: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cameraCloseButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  cameraCaptureButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#FFFFFF", borderWidth: 5, borderColor: "#F2B84B", alignItems: "center", justifyContent: "center" },
  cameraControlSpacer: { width: 48, height: 48 },
});
