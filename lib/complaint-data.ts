import type { Localized } from "@/lib/food-data";

export type ComplaintCategory = "order" | "food_quality" | "delivery" | "payment" | "kitchen" | "other";
export type ComplaintStatus = "new" | "in_review" | "resolved" | "closed";

export type Complaint = {
  id: string;
  category: ComplaintCategory;
  subject: string;
  description: string;
  orderId?: string;
  imageUris: string[];
  status: ComplaintStatus;
  response?: string;
  createdAt: string;
};

export type NewComplaint = Omit<Complaint, "id" | "status" | "createdAt">;

export const complaintCategories: Array<{ id: ComplaintCategory; label: Localized; icon: string }> = [
  { id: "order", label: { ar: "مشكلة بالطلب", en: "Order issue" }, icon: "receipt-long" },
  { id: "food_quality", label: { ar: "جودة الأكل", en: "Food quality" }, icon: "restaurant" },
  { id: "delivery", label: { ar: "التوصيل", en: "Delivery" }, icon: "two-wheeler" },
  { id: "payment", label: { ar: "الدفع أو المبلغ", en: "Payment or amount" }, icon: "payments" },
  { id: "kitchen", label: { ar: "المطبخ", en: "Kitchen" }, icon: "storefront" },
  { id: "other", label: { ar: "موضوع آخر", en: "Other" }, icon: "help-outline" },
];

export const complaintStatuses: Record<ComplaintStatus, Localized> = {
  new: { ar: "جديدة", en: "New" },
  in_review: { ar: "قيد المراجعة", en: "In review" },
  resolved: { ar: "تم الحل", en: "Resolved" },
  closed: { ar: "مغلقة", en: "Closed" },
};
