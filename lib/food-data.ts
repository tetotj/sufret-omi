export type Language = "ar" | "en";
export type Role = "customer" | "mother" | "driver";
export type Localized = { ar: string; en: string };
export type CategoryId = "mansaf" | "maqluba" | "mahshi" | "bakery" | "moona";
export type RegionId = "amman" | "irbid" | "zarqa" | "salt" | "madaba";

export type Category = {
  id: CategoryId;
  label: Localized;
  icon: string;
  color: string;
};

export type Region = {
  id: RegionId;
  label: Localized;
  subtitle: Localized;
  latitude: number;
  longitude: number;
};

export type Meal = {
  id: string;
  kitchenId: string;
  name: Localized;
  description: Localized;
  category: CategoryId;
  price: number;
  prepMinutes: number;
  dailyLimit: number;
  available: boolean;
  image: string;
};

export type Kitchen = {
  id: string;
  name: Localized;
  motherName: Localized;
  region: RegionId;
  neighborhood: Localized;
  rating: number;
  reviewCount: number;
  prepLabel: Localized;
  isOpen: boolean;
  specialty: CategoryId;
  image: string;
  accent: string;
};

export type CartItem = {
  meal: Meal;
  quantity: number;
};

export type OrderStatus = "received" | "preparing" | "ready" | "on_the_way" | "delivered";

export type Order = {
  id: string;
  kitchen: Kitchen;
  items: CartItem[];
  total: number;
  paymentMethod: "cod" | "cliq" | "wallet";
  schedule: "now" | "scheduled";
  status: OrderStatus;
  eta: Localized;
};

export const categories: Category[] = [
  { id: "mansaf", label: { ar: "منسف", en: "Mansaf" }, icon: "restaurant", color: "#C2410C" },
  { id: "maqluba", label: { ar: "مقلوبة", en: "Maqluba" }, icon: "layers", color: "#B45309" },
  { id: "mahshi", label: { ar: "محاشي", en: "Mahshi" }, icon: "eco", color: "#4D7C0F" },
  { id: "bakery", label: { ar: "مخبوزات", en: "Bakery" }, icon: "bakery-dining", color: "#92400E" },
  { id: "moona", label: { ar: "مونة", en: "Moona" }, icon: "inventory-2", color: "#6B7280" },
];

export const regions: Region[] = [
  { id: "amman", label: { ar: "عمّان", en: "Amman" }, subtitle: { ar: "غرب عمّان", en: "West Amman" }, latitude: 31.963, longitude: 35.91 },
  { id: "irbid", label: { ar: "إربد", en: "Irbid" }, subtitle: { ar: "شمال الأردن", en: "North Jordan" }, latitude: 32.556, longitude: 35.85 },
  { id: "zarqa", label: { ar: "الزرقاء", en: "Zarqa" }, subtitle: { ar: "قريب منك", en: "Near you" }, latitude: 32.06, longitude: 36.09 },
  { id: "salt", label: { ar: "السلط", en: "Salt" }, subtitle: { ar: "بيوت الجبل", en: "Mountain homes" }, latitude: 32.04, longitude: 35.73 },
  { id: "madaba", label: { ar: "مادبا", en: "Madaba" }, subtitle: { ar: "أهل الكرم", en: "Generous homes" }, latitude: 31.72, longitude: 35.79 },
];

export const kitchens: Kitchen[] = [
  {
    id: "umm-ahmad",
    name: { ar: "مطبخ أم أحمد", en: "Umm Ahmad's Kitchen" },
    motherName: { ar: "أم أحمد", en: "Umm Ahmad" },
    region: "amman",
    neighborhood: { ar: "خلدا، عمّان", en: "Khalda, Amman" },
    rating: 4.9,
    reviewCount: 128,
    prepLabel: { ar: "جاهز خلال ٤٥ دقيقة", en: "Ready in 45 min" },
    isOpen: true,
    specialty: "mansaf",
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=84",
    accent: "#C2410C",
  },
  {
    id: "teta-sawsan",
    name: { ar: "سفرة ستي سوسن", en: "Teta Sawsan's Table" },
    motherName: { ar: "ستي سوسن", en: "Teta Sawsan" },
    region: "irbid",
    neighborhood: { ar: "الحصن، إربد", en: "Al-Husn, Irbid" },
    rating: 4.8,
    reviewCount: 91,
    prepLabel: { ar: "طلبات مسبقة", en: "Advance orders" },
    isOpen: true,
    specialty: "maqluba",
    image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=84",
    accent: "#4D7C0F",
  },
  {
    id: "kitchen-ward",
    name: { ar: "مونة ورد", en: "Ward's Homemade Moona" },
    motherName: { ar: "ورد", en: "Ward" },
    region: "salt",
    neighborhood: { ar: "السلط القديمة", en: "Old Salt" },
    rating: 4.7,
    reviewCount: 64,
    prepLabel: { ar: "توصيل غداً", en: "Delivery tomorrow" },
    isOpen: false,
    specialty: "moona",
    image: "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=900&q=84",
    accent: "#B45309",
  },
];

export const meals: Meal[] = [
  {
    id: "mansaf-family",
    kitchenId: "umm-ahmad",
    name: { ar: "منسف جميد كركي", en: "Karak Jameed Mansaf" },
    description: { ar: "لحم بلدي، جميد كركي، شراك ولوز محمّص", en: "Local lamb, Karak jameed, shrak and toasted almonds" },
    category: "mansaf",
    price: 8.5,
    prepMinutes: 45,
    dailyLimit: 18,
    available: true,
    image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=84",
  },
  {
    id: "maqluba-chicken",
    kitchenId: "teta-sawsan",
    name: { ar: "مقلوبة الدار", en: "Homestyle Maqluba" },
    description: { ar: "رز، باذنجان، زهرة ودجاج متبّل", en: "Rice, eggplant, cauliflower and spiced chicken" },
    category: "maqluba",
    price: 6.75,
    prepMinutes: 55,
    dailyLimit: 12,
    available: true,
    image: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=900&q=84",
  },
  {
    id: "grape-leaves",
    kitchenId: "umm-ahmad",
    name: { ar: "ورق دوالي بزيت الزيتون", en: "Olive Oil Grape Leaves" },
    description: { ar: "لفّات صغيرة بحشوة الأرز والأعشاب الطازجة", en: "Hand-rolled grape leaves with herbed rice" },
    category: "mahshi",
    price: 5.25,
    prepMinutes: 40,
    dailyLimit: 20,
    available: true,
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=84",
  },
  {
    id: "zaatar-bakery",
    kitchenId: "teta-sawsan",
    name: { ar: "مناقيش زعتر بلدي", en: "Village Zaatar Manakish" },
    description: { ar: "عجينة طرية، زعتر أخضر وزيت زيتون", en: "Soft dough, wild zaatar and olive oil" },
    category: "bakery",
    price: 2.25,
    prepMinutes: 25,
    dailyLimit: 30,
    available: true,
    image: "https://images.unsplash.com/photo-1573140401552-3fab0b24306f?auto=format&fit=crop&w=900&q=84",
  },
  {
    id: "jameed-balls",
    kitchenId: "kitchen-ward",
    name: { ar: "كرات الجميد البلدي", en: "Homemade Jameed Balls" },
    description: { ar: "مونة البيت مجففة بعناية لمذاق أصيل", en: "Carefully dried homemade pantry staple" },
    category: "moona",
    price: 4.9,
    prepMinutes: 15,
    dailyLimit: 16,
    available: true,
    image: "https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=900&q=84",
  },
];

export const orderStatuses: { id: OrderStatus; label: Localized; caption: Localized; icon: string }[] = [
  { id: "received", label: { ar: "تم الاستلام", en: "Order received" }, caption: { ar: "المطبخ استلم طلبك", en: "The kitchen received your order" }, icon: "receipt-long" },
  { id: "preparing", label: { ar: "قيد التحضير", en: "Preparing" }, caption: { ar: "أم أحمد تطبخ لك بحب", en: "Umm Ahmad is cooking with care" }, icon: "soup-kitchen" },
  { id: "ready", label: { ar: "جاهز للاستلام", en: "Ready for pickup" }, caption: { ar: "طلبك جاهز عند الباب", en: "Your order is ready at the door" }, icon: "check-circle" },
  { id: "on_the_way", label: { ar: "في الطريق", en: "On the way" }, caption: { ar: "السائق قريب منك", en: "Your driver is nearby" }, icon: "two-wheeler" },
  { id: "delivered", label: { ar: "تم التوصيل", en: "Delivered" }, caption: { ar: "صحة وعافية", en: "Enjoy your meal" }, icon: "favorite" },
];

export const jordanMapPoints = [
  { id: "amman", latitude: 31.963, longitude: 35.91, label: { ar: "عمّان", en: "Amman" }, color: "#C2410C" },
  { id: "irbid", latitude: 32.556, longitude: 35.85, label: { ar: "إربد", en: "Irbid" }, color: "#4D7C0F" },
  { id: "zarqa", latitude: 32.06, longitude: 36.09, label: { ar: "الزرقاء", en: "Zarqa" }, color: "#B45309" },
  { id: "salt", latitude: 32.04, longitude: 35.73, label: { ar: "السلط", en: "Salt" }, color: "#92400E" },
];

export const formatJod = (amount: number, language: Language) =>
  language === "ar" ? `${amount.toFixed(2)} د.أ` : `JOD ${amount.toFixed(2)}`;

export const getLocalized = (value: Localized, language: Language) => value[language];

export const getKitchenMeals = (kitchenId: string) => meals.filter((meal) => meal.kitchenId === kitchenId);

export const getKitchen = (kitchenId: string) => kitchens.find((kitchen) => kitchen.id === kitchenId) ?? kitchens[0];

export const getMeal = (mealId: string) => meals.find((meal) => meal.id === mealId) ?? meals[0];

export const getCategory = (categoryId: CategoryId) => categories.find((category) => category.id === categoryId) ?? categories[0];

export const getRegion = (regionId: RegionId) => regions.find((region) => region.id === regionId) ?? regions[0];

export const totalCart = (items: CartItem[]) => items.reduce((sum, item) => sum + item.meal.price * item.quantity, 0);

export const unitCount = (items: CartItem[]) => items.reduce((sum, item) => sum + item.quantity, 0);

export const paymentLabels: Record<Order["paymentMethod"], Localized> = {
  cod: { ar: "الدفع عند الاستلام", en: "Cash on delivery" },
  cliq: { ar: "CliQ", en: "CliQ" },
  wallet: { ar: "محفظة إلكترونية", en: "Local e-wallet" },
};

export const scheduleLabels: Record<Order["schedule"], Localized> = {
  now: { ar: "أقرب وقت ممكن", en: "As soon as possible" },
  scheduled: { ar: "طلب مسبق - الجمعة ١:٣٠ م", en: "Scheduled - Friday 1:30 PM" },
};

export const t = (value: Localized, language: Language) => value[language];

export const primaryKitchen = kitchens[0];
export const primaryMeal = meals[0];
export const sampleDriverOrder: Order = {
  id: "SO-2408",
  kitchen: primaryKitchen,
  items: [{ meal: primaryMeal, quantity: 2 }],
  total: 17,
  paymentMethod: "cliq",
  schedule: "now",
  status: "ready",
  eta: { ar: "خلال ٢٥ دقيقة", en: "Within 25 minutes" },
};

export const sampleIncomingOrder: Order = {
  id: "SO-2408",
  kitchen: primaryKitchen,
  items: [{ meal: primaryMeal, quantity: 2 }],
  total: 17,
  paymentMethod: "cliq",
  schedule: "scheduled",
  status: "received",
  eta: { ar: "غداً، ١:٣٠ م", en: "Tomorrow, 1:30 PM" },
};
