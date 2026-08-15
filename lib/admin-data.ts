import type { Localized } from "@/lib/food-data";
import type { Complaint } from "@/lib/complaint-data";

export type AdminRole = "owner" | "supervisor" | "support";
export type UserAccountStatus = "active" | "pending_approval" | "suspended" | "rejected";
export type UserProfileRole = "customer" | "mother" | "driver";

export type ManagedUser = {
  id: string;
  name: string;
  phone: string;
  role: UserProfileRole;
  status: UserAccountStatus;
  region: string;
  rating: number;
  ordersCount: number;
  joinedDate: string;
  documents?: { label: Localized; uri: string }[];
  details?: {
    kitchenName?: string;
    vehicleType?: string;
    plate?: string;
    capacity?: string;
    hasPets?: string;
  };
};

export const sampleManagedUsers: ManagedUser[] = [
  {
    id: "USR-1001",
    name: "أم أحمد (توليب خلدا)",
    phone: "0795551234",
    role: "mother",
    status: "active",
    region: "خلدا، عمّان",
    rating: 4.9,
    ordersCount: 342,
    joinedDate: "2026-01-12",
    documents: [
      { label: { ar: "صورة الهوية", en: "ID photo" }, uri: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400" },
      { label: { ar: "صورة عدم محكومية", en: "Police clearance" }, uri: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400" },
      { label: { ar: "صورة المطبخ", en: "Kitchen photo" }, uri: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400" },
    ],
    details: { kitchenName: "مطبخ أم أحمد للبلدي", hasPets: "لا يوجد" },
  },
  {
    id: "USR-1002",
    name: "محمد العبدالله",
    phone: "0791234567",
    role: "driver",
    status: "active",
    region: "عبدون، عمّان",
    rating: 4.8,
    ordersCount: 512,
    joinedDate: "2026-02-04",
    documents: [
      { label: { ar: "رخصة القيادة", en: "Driver license" }, uri: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400" },
      { label: { ar: "صورة المركبة", en: "Vehicle photo" }, uri: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=400" },
    ],
    details: { vehicleType: "دراجة نارية", plate: "32-9184", capacity: "متوسطة" },
  },
  {
    id: "USR-1003",
    name: "سارة خالد",
    phone: "0788889900",
    role: "customer",
    status: "active",
    region: "دابوق، عمّان",
    rating: 5.0,
    ordersCount: 18,
    joinedDate: "2026-03-01",
  },
  {
    id: "USR-1004",
    name: "أم يوسف (مطبخ البركة)",
    phone: "0771112233",
    role: "mother",
    status: "pending_approval",
    region: "إربد - الحي الشرقي",
    rating: 0,
    ordersCount: 0,
    joinedDate: "2026-08-14",
    documents: [
      { label: { ar: "صورة الهوية", en: "ID photo" }, uri: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400" },
      { label: { ar: "صورة عدم محكومية", en: "Police clearance" }, uri: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400" },
    ],
    details: { kitchenName: "مطبخ البركة للحلويات البيتية", hasPets: "لا يوجد" },
  },
  {
    id: "USR-1005",
    name: "رامي التميمي",
    phone: "0799988776",
    role: "driver",
    status: "pending_approval",
    region: "الزرقاء - الجديدة",
    rating: 0,
    ordersCount: 0,
    joinedDate: "2026-08-14",
    documents: [
      { label: { ar: "رخصة القيادة", en: "Driver license" }, uri: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400" },
      { label: { ar: "صورة المركبة", en: "Vehicle photo" }, uri: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=400" },
    ],
    details: { vehicleType: "سيارة سيدان", plate: "11-4452", capacity: "كبيرة" },
  },
];
