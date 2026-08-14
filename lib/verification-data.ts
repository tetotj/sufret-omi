import type { CategoryId, DriverVehicleType, LoadCapacity, Localized, MealSize, RegionId } from "@/lib/food-data";

export type ApprovalStatus = "not_started" | "draft" | "pending" | "approved" | "rejected";
export type VerificationDocumentType =
  | "identity"
  | "criminal_record"
  | "kitchen_photo"
  | "equipment_photo"
  | "driver_license"
  | "vehicle_photo";

export type VerificationDocument = {
  type: VerificationDocumentType;
  label: Localized;
  uri: string | null;
  uploadedAt: string | null;
};

export type MotherVerificationProfile = {
  approvalStatus: ApprovalStatus;
  fullName: string;
  phone: string;
  address: string;
  region: RegionId;
  foodTypes: CategoryId[];
  mealSize: MealSize | null;
  deliveryCapacity: LoadCapacity | null;
  hasPets: "yes" | "no" | "unknown";
  allergyPrecautions: string;
  termsAccepted: boolean;
  documents: VerificationDocument[];
};

export type DriverVerificationProfile = {
  approvalStatus: ApprovalStatus;
  fullName: string;
  phone: string;
  address: string;
  region: RegionId;
  vehicleType: DriverVehicleType | null;
  cargoCapacity: LoadCapacity | null;
  termsAccepted: boolean;
  documents: VerificationDocument[];
};

export const mealSizeLabels: Record<MealSize, Localized> = {
  small: { ar: "صغير", en: "Small" },
  medium: { ar: "متوسط", en: "Medium" },
  large: { ar: "كبير / عائلي", en: "Large / family" },
};

export const loadCapacityLabels: Record<LoadCapacity, Localized> = {
  small: { ar: "حمولة صغيرة", en: "Small load" },
  medium: { ar: "حمولة متوسطة", en: "Medium load" },
  large: { ar: "حمولة كبيرة", en: "Large load" },
};

export const driverVehicleLabels: Record<DriverVehicleType, Localized> = {
  motorcycle: { ar: "دراجة نارية", en: "Motorcycle" },
  car: { ar: "سيارة", en: "Car" },
  van: { ar: "فان / مركبة كبيرة", en: "Van / large vehicle" },
};

export const motherDocumentTemplates: VerificationDocument[] = [
  { type: "identity", label: { ar: "صورة الهوية الشخصية", en: "Identity card photo" }, uri: null, uploadedAt: null },
  { type: "criminal_record", label: { ar: "شهادة عدم محكومية", en: "Non-criminal record" }, uri: null, uploadedAt: null },
  { type: "kitchen_photo", label: { ar: "صورة المطبخ", en: "Kitchen photo" }, uri: null, uploadedAt: null },
  { type: "equipment_photo", label: { ar: "صورة المعدات", en: "Equipment photo" }, uri: null, uploadedAt: null },
];

export const driverDocumentTemplates: VerificationDocument[] = [
  { type: "driver_license", label: { ar: "صورة رخصة القيادة", en: "Driver license photo" }, uri: null, uploadedAt: null },
  { type: "vehicle_photo", label: { ar: "صورة المركبة", en: "Vehicle photo" }, uri: null, uploadedAt: null },
  { type: "criminal_record", label: { ar: "شهادة عدم محكومية", en: "Non-criminal record" }, uri: null, uploadedAt: null },
];

export const createMotherVerification = (region: RegionId): MotherVerificationProfile => ({
  approvalStatus: "not_started",
  fullName: "",
  phone: "",
  address: "",
  region,
  foodTypes: [],
  mealSize: null,
  deliveryCapacity: null,
  hasPets: "unknown",
  allergyPrecautions: "",
  termsAccepted: false,
  documents: motherDocumentTemplates.map((document) => ({ ...document })),
});

export const createDriverVerification = (region: RegionId): DriverVerificationProfile => ({
  approvalStatus: "not_started",
  fullName: "",
  phone: "",
  address: "",
  region,
  vehicleType: null,
  cargoCapacity: null,
  termsAccepted: false,
  documents: driverDocumentTemplates.map((document) => ({ ...document })),
});

export const isVerificationReady = (profile: MotherVerificationProfile | DriverVerificationProfile) =>
  profile.termsAccepted &&
  Boolean(profile.fullName.trim()) &&
  Boolean(profile.phone.trim()) &&
  Boolean(profile.address.trim()) &&
  profile.documents.every((document) => Boolean(document.uri));

export const isMotherVerificationReady = (profile: MotherVerificationProfile) =>
  isVerificationReady(profile) &&
  profile.foodTypes.length > 0 &&
  Boolean(profile.allergyPrecautions.trim()) &&
  profile.hasPets !== "unknown" &&
  profile.mealSize !== null &&
  profile.deliveryCapacity !== null;

export const isDriverVerificationReady = (profile: DriverVerificationProfile) =>
  isVerificationReady(profile) &&
  profile.vehicleType !== null &&
  profile.cargoCapacity !== null;

export const verificationStatusLabel = (status: ApprovalStatus): Localized => ({
  not_started: { ar: "لم يبدأ بعد", en: "Not started" },
  draft: { ar: "مسودة غير مكتملة", en: "Draft" },
  pending: { ar: "بانتظار مراجعة الفريق", en: "Pending supervisor review" },
  approved: { ar: "تمت الموافقة", en: "Approved" },
  rejected: { ar: "تحتاج إلى تعديل", en: "Needs changes" },
}[status]);
