export type Language = "ar" | "en";
export type Role = "customer" | "mother" | "driver";
export type MealSize = "small" | "medium" | "large";
export type LoadCapacity = "small" | "medium" | "large";
export type DriverVehicleType = "motorcycle" | "car" | "van";
export type Localized = { ar: string; en: string };
export type Coordinate = { latitude: number; longitude: number };
export type CategoryId = "mansaf" | "maqluba" | "mahshi" | "bakery" | "moona";
export type RegionId = "amman" | "irbid" | "zarqa" | "balqa" | "salt" | "madaba" | "jerash" | "ajloun" | "mafraq" | "karak" | "tafila" | "maan" | "aqaba";

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
  portionSize: MealSize;
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
  specialRequests?: string;
};

export type OrderStatus = "received" | "preparing" | "ready" | "on_the_way" | "delivered";
export const PLATFORM_COMMISSION_RATE = 0.05;

export type DriverDetails = {
  name: Localized;
  phone: string;
  vehicle: Localized;
  plate: string;
  vehicleType: DriverVehicleType;
  cargoCapacity: LoadCapacity;
};

export type Order = {
  id: string;
  kitchen: Kitchen;
  items: CartItem[];
  total: number;
  commission?: number;
  deliveryFee?: number;
  specialRequests?: string;
  restaurantRating?: number;
  restaurantReview?: string;
  paymentMethod: "cod" | "cliq" | "wallet";
  schedule: "now" | "scheduled";
  status: OrderStatus;
  eta: Localized;
  pickupCoordinates: Coordinate;
  dropoffCoordinates: Coordinate;
  driverCoordinates?: Coordinate;
  pickupAddress: Localized;
  dropoffAddress: Localized;
  driverRating?: number;
  requiredCapacity?: LoadCapacity;
  driver?: DriverDetails;
};

export const categories: Category[] = [
  { id: "mansaf", label: { ar: "منسف", en: "Mansaf" }, icon: "restaurant", color: "#236B45" },
  { id: "maqluba", label: { ar: "مقلوبة", en: "Maqluba" }, icon: "layers", color: "#C88A16" },
  { id: "mahshi", label: { ar: "محاشي", en: "Mahshi" }, icon: "eco", color: "#4F8F3B" },
  { id: "bakery", label: { ar: "مخبوزات", en: "Bakery" }, icon: "bakery-dining", color: "#1B5E3A" },
  { id: "moona", label: { ar: "مونة", en: "Moona" }, icon: "inventory-2", color: "#6B7280" },
];

export const regions: Region[] = [
  { id: "amman", label: { ar: "عمّان", en: "Amman" }, subtitle: { ar: "العاصمة", en: "The capital" }, latitude: 31.963, longitude: 35.91 },
  { id: "irbid", label: { ar: "إربد", en: "Irbid" }, subtitle: { ar: "شمال الأردن", en: "North Jordan" }, latitude: 32.556, longitude: 35.85 },
  { id: "zarqa", label: { ar: "الزرقاء", en: "Zarqa" }, subtitle: { ar: "قلب الشمال الشرقي", en: "Northeast Jordan" }, latitude: 32.06, longitude: 36.09 },
  { id: "balqa", label: { ar: "البلقاء", en: "Balqa" }, subtitle: { ar: "سهول البلقاء", en: "Balqa plains" }, latitude: 32.06, longitude: 35.72 },
  { id: "salt", label: { ar: "السلط", en: "Salt" }, subtitle: { ar: "بيوت الجبل", en: "Mountain homes" }, latitude: 32.04, longitude: 35.73 },
  { id: "madaba", label: { ar: "مادبا", en: "Madaba" }, subtitle: { ar: "أهل الكرم", en: "Generous homes" }, latitude: 31.72, longitude: 35.79 },
  { id: "jerash", label: { ar: "جرش", en: "Jerash" }, subtitle: { ar: "غابات الزيتون", en: "Olive groves" }, latitude: 32.275, longitude: 35.89 },
  { id: "ajloun", label: { ar: "عجلون", en: "Ajloun" }, subtitle: { ar: "مونة الجبل", en: "Mountain pantry" }, latitude: 32.333, longitude: 35.75 },
  { id: "mafraq", label: { ar: "المفرق", en: "Mafraq" }, subtitle: { ar: "بوابة البادية", en: "Badia gateway" }, latitude: 32.34, longitude: 36.21 },
  { id: "karak", label: { ar: "الكرك", en: "Karak" }, subtitle: { ar: "طعم الجنوب", en: "Southern flavors" }, latitude: 31.18, longitude: 35.70 },
  { id: "tafila", label: { ar: "الطفيلة", en: "Tafilah" }, subtitle: { ar: "دفء الجبل", en: "Highland warmth" }, latitude: 30.84, longitude: 35.60 },
  { id: "maan", label: { ar: "معان", en: "Ma'an" }, subtitle: { ar: "بوابة وادي رم", en: "Wadi Rum gateway" }, latitude: 30.19, longitude: 35.73 },
  { id: "aqaba", label: { ar: "العقبة", en: "Aqaba" }, subtitle: { ar: "سفرة البحر", en: "Red Sea table" }, latitude: 29.53, longitude: 35.00 },
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
    accent: "#236B45",
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
    accent: "#4F8F3B",
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
    accent: "#C88A16",
  },
  { id: "kitchen-zarqa", name: { ar: "بيت أم يزن", en: "Umm Yazan's Home" }, motherName: { ar: "أم يزن", en: "Umm Yazan" }, region: "zarqa", neighborhood: { ar: "الزرقاء الجديدة", en: "New Zarqa" }, rating: 4.8, reviewCount: 75, prepLabel: { ar: "جاهز خلال ٥٠ دقيقة", en: "Ready in 50 min" }, isOpen: true, specialty: "maqluba", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=84", accent: "#C88A16" },
  { id: "kitchen-balqa", name: { ar: "مطبخ أم يزن", en: "Umm Yazan's Kitchen" }, motherName: { ar: "أم يزن", en: "Umm Yazan" }, region: "balqa", neighborhood: { ar: "الفحيص، البلقاء", en: "Fuheis, Balqa" }, rating: 4.9, reviewCount: 82, prepLabel: { ar: "طلبات اليوم", en: "Today's orders" }, isOpen: true, specialty: "mansaf", image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=84", accent: "#236B45" },
  { id: "kitchen-madaba", name: { ar: "سفرة أم لؤي", en: "Umm Loay's Table" }, motherName: { ar: "أم لؤي", en: "Umm Loay" }, region: "madaba", neighborhood: { ar: "وسط مادبا", en: "Madaba Center" }, rating: 4.8, reviewCount: 58, prepLabel: { ar: "جاهز خلال ٣٥ دقيقة", en: "Ready in 35 min" }, isOpen: true, specialty: "mahshi", image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=84", accent: "#4F8F3B" },
  { id: "kitchen-jerash", name: { ar: "دار الزيتون", en: "Olive Grove Kitchen" }, motherName: { ar: "أم رامي", en: "Umm Rami" }, region: "jerash", neighborhood: { ar: "سوف، جرش", en: "Souf, Jerash" }, rating: 4.7, reviewCount: 44, prepLabel: { ar: "مونة الموسم", en: "Seasonal pantry" }, isOpen: true, specialty: "moona", image: "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=900&q=84", accent: "#6B7280" },
  { id: "kitchen-ajloun", name: { ar: "مونة عجلون", en: "Ajloun Pantry" }, motherName: { ar: "أم نور", en: "Umm Noor" }, region: "ajloun", neighborhood: { ar: "عنجره، عجلون", en: "Anjara, Ajloun" }, rating: 4.9, reviewCount: 61, prepLabel: { ar: "خبز ومونة", en: "Bread & pantry" }, isOpen: true, specialty: "bakery", image: "https://images.unsplash.com/photo-1573140401552-3fab0b24306f?auto=format&fit=crop&w=900&q=84", accent: "#1B5E3A" },
  { id: "kitchen-mafraq", name: { ar: "طبخات البادية", en: "Badia Home Cooking" }, motherName: { ar: "أم خالد", en: "Umm Khaled" }, region: "mafraq", neighborhood: { ar: "وسط المفرق", en: "Mafraq Center" }, rating: 4.6, reviewCount: 39, prepLabel: { ar: "طلب مسبق", en: "Advance order" }, isOpen: false, specialty: "mansaf", image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=84", accent: "#236B45" },
  { id: "kitchen-karak", name: { ar: "مطبخ الكرك", en: "Karak Kitchen" }, motherName: { ar: "أم حمزة", en: "Umm Hamza" }, region: "karak", neighborhood: { ar: "الثنية، الكرك", en: "Al-Thaniyeh, Karak" }, rating: 4.9, reviewCount: 97, prepLabel: { ar: "منسف كركي أصيل", en: "Authentic Karak mansaf" }, isOpen: true, specialty: "mansaf", image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=84", accent: "#236B45" },
  { id: "kitchen-tafila", name: { ar: "بيت الطفيلة", en: "Tafilah Home" }, motherName: { ar: "أم سائد", en: "Umm Saed" }, region: "tafila", neighborhood: { ar: "العيص، الطفيلة", en: "Al-Ais, Tafilah" }, rating: 4.7, reviewCount: 31, prepLabel: { ar: "نكهة الجبل", en: "Highland flavor" }, isOpen: true, specialty: "mahshi", image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=84", accent: "#4F8F3B" },
  { id: "kitchen-maan", name: { ar: "سفرة معان", en: "Ma'an Table" }, motherName: { ar: "أم عادل", en: "Umm Adel" }, region: "maan", neighborhood: { ar: "حي الأمير حسن، معان", en: "Prince Hasan, Ma'an" }, rating: 4.6, reviewCount: 28, prepLabel: { ar: "طبخات جنوبية", en: "Southern dishes" }, isOpen: true, specialty: "maqluba", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=84", accent: "#C88A16" },
  { id: "kitchen-aqaba", name: { ar: "مطبخ البحر", en: "Sea Breeze Kitchen" }, motherName: { ar: "أم يارا", en: "Umm Yara" }, region: "aqaba", neighborhood: { ar: "الشاطئ الجنوبي، العقبة", en: "South Beach, Aqaba" }, rating: 4.8, reviewCount: 53, prepLabel: { ar: "سفرة البحر", en: "Red Sea table" }, isOpen: true, specialty: "bakery", image: "https://images.unsplash.com/photo-1573140401552-3fab0b24306f?auto=format&fit=crop&w=900&q=84", accent: "#1B5E3A" },
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
    image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=84", portionSize: "medium",
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
    image: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=900&q=84", portionSize: "medium",
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
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=84", portionSize: "small",
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
    image: "https://images.unsplash.com/photo-1573140401552-3fab0b24306f?auto=format&fit=crop&w=900&q=84", portionSize: "small",
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
    image: "https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=900&q=84", portionSize: "medium",
  },
  { id: "zarqa-maqluba", kitchenId: "kitchen-zarqa", name: { ar: "مقلوبة الزرقاء", en: "Zarqa Maqluba" }, description: { ar: "رز متبّل مع باذنجان ودجاج بلدي", en: "Spiced rice with eggplant and local chicken" }, category: "maqluba", price: 6.5, prepMinutes: 50, dailyLimit: 15, available: true, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=84", portionSize: "medium" },
  { id: "balqa-mansaf", kitchenId: "kitchen-balqa", name: { ar: "منسف البلقاء", en: "Balqa Mansaf" }, description: { ar: "جميد كريمي ولحمة بلدية وخبز شراك", en: "Creamy jameed, local lamb and shrak bread" }, category: "mansaf", price: 9.25, prepMinutes: 60, dailyLimit: 12, available: true, image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=84", portionSize: "large" },
  { id: "madaba-mahshi", kitchenId: "kitchen-madaba", name: { ar: "محاشي مادبا", en: "Madaba Stuffed Vegetables" }, description: { ar: "كوسا وورق دوالي بحشوة بيتية", en: "Zucchini and grape leaves with homestyle filling" }, category: "mahshi", price: 5.75, prepMinutes: 45, dailyLimit: 18, available: true, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=84", portionSize: "medium" },
  { id: "jerash-olive", kitchenId: "kitchen-jerash", name: { ar: "زيتون جرشي مكبوس", en: "Jerash Pressed Olives" }, description: { ar: "زيتون أخضر من موسم جرش مع الأعشاب", en: "Green Jerash olives with local herbs" }, category: "moona", price: 6.25, prepMinutes: 10, dailyLimit: 20, available: true, image: "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=900&q=84", portionSize: "small" },
  { id: "ajloun-manakish", kitchenId: "kitchen-ajloun", name: { ar: "مناقيش عجلون", en: "Ajloun Manakish" }, description: { ar: "زعتر جبلي وزيت زيتون على عجينة طرية", en: "Mountain zaatar and olive oil on soft dough" }, category: "bakery", price: 3.5, prepMinutes: 25, dailyLimit: 24, available: true, image: "https://images.unsplash.com/photo-1573140401552-3fab0b24306f?auto=format&fit=crop&w=900&q=84", portionSize: "small" },
  { id: "mafraq-mansaf", kitchenId: "kitchen-mafraq", name: { ar: "ثريد البادية", en: "Badia Thareed" }, description: { ar: "خبز رقيق مع مرق ولحم وتوابل بدوية", en: "Thin bread with broth, meat and Bedouin spices" }, category: "mansaf", price: 7.75, prepMinutes: 55, dailyLimit: 14, available: true, image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=84", portionSize: "large" },
  { id: "karak-mansaf", kitchenId: "kitchen-karak", name: { ar: "منسف الكرك الكبير", en: "Karak Family Mansaf" }, description: { ar: "سفرة جنوبية تكفي اللمة مع جميد كركي", en: "A southern family feast with Karak jameed" }, category: "mansaf", price: 12.5, prepMinutes: 70, dailyLimit: 10, available: true, image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=84", portionSize: "large" },
  { id: "tafila-mahshi", kitchenId: "kitchen-tafila", name: { ar: "دوالي الطفيلة", en: "Tafilah Grape Leaves" }, description: { ar: "دوالي صغيرة بطعم زيت الزيتون الجبلي", en: "Tender grape leaves with highland olive oil" }, category: "mahshi", price: 5.5, prepMinutes: 50, dailyLimit: 16, available: true, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=84", portionSize: "medium" },
  { id: "maan-maqluba", kitchenId: "kitchen-maan", name: { ar: "مقلوبة معان باللحم", en: "Ma'an Meat Maqluba" }, description: { ar: "مقلوبة جنوبية بلحم طري وباذنجان", en: "Southern maqluba with tender meat and eggplant" }, category: "maqluba", price: 8.75, prepMinutes: 65, dailyLimit: 12, available: true, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=84", portionSize: "large" },
  { id: "aqaba-bakery", kitchenId: "kitchen-aqaba", name: { ar: "خبز العقبة بالسمسم", en: "Aqaba Sesame Bread" }, description: { ar: "خبز طازج بالسمسم يقدم مع لبنة وزيت", en: "Fresh sesame bread with labneh and olive oil" }, category: "bakery", price: 2.75, prepMinutes: 20, dailyLimit: 30, available: true, image: "https://images.unsplash.com/photo-1573140401552-3fab0b24306f?auto=format&fit=crop&w=900&q=84", portionSize: "small" },
];

export const orderStatuses: { id: OrderStatus; label: Localized; caption: Localized; icon: string }[] = [
  { id: "received", label: { ar: "تم الاستلام", en: "Order received" }, caption: { ar: "المطبخ استلم طلبك", en: "The kitchen received your order" }, icon: "receipt-long" },
  { id: "preparing", label: { ar: "قيد التحضير", en: "Preparing" }, caption: { ar: "أم أحمد تطبخ لك بحب", en: "Umm Ahmad is cooking with care" }, icon: "soup-kitchen" },
  { id: "ready", label: { ar: "جاهز للاستلام", en: "Ready for pickup" }, caption: { ar: "طلبك جاهز عند الباب", en: "Your order is ready at the door" }, icon: "check-circle" },
  { id: "on_the_way", label: { ar: "في الطريق", en: "On the way" }, caption: { ar: "السائق قريب منك", en: "Your driver is nearby" }, icon: "two-wheeler" },
  { id: "delivered", label: { ar: "تم التوصيل", en: "Delivered" }, caption: { ar: "صحة وعافية", en: "Enjoy your meal" }, icon: "favorite" },
];

export const jordanMapPoints = regions.map((region, index) => ({
  id: region.id,
  latitude: region.latitude,
  longitude: region.longitude,
  label: region.label,
  color: ["#236B45", "#4F8F3B", "#C88A16", "#1B5E3A", "#6B7280"][index % 5],
}));

export const formatJod = (amount: number, language: Language) =>
  language === "ar" ? `${amount.toFixed(2)} د.أ` : `JOD ${amount.toFixed(2)}`;

export const getLocalized = (value: Localized | null | undefined, language: Language) => value?.[language] ?? value?.ar ?? value?.en ?? "";

export const getKitchenMeals = (kitchenId: string) => meals.filter((meal) => meal.kitchenId === kitchenId);

export const getKitchen = (kitchenId: string) => kitchens.find((kitchen) => kitchen.id === kitchenId) ?? kitchens[0];

export const getMeal = (mealId: string) => meals.find((meal) => meal.id === mealId) ?? meals[0];

export const getCategory = (categoryId: CategoryId) => categories.find((category) => category.id === categoryId) ?? categories[0];

export const getRegion = (regionId: RegionId) => regions.find((region) => region.id === regionId) ?? regions[0];

export const distanceKm = (from: Coordinate, to: Coordinate) => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const getKitchenDistanceKm = (kitchen: Kitchen, origin: Region) => distanceKm(origin, getRegion(kitchen.region));

export const totalCart = (items: CartItem[]) => items.reduce((sum, item) => sum + item.meal.price * item.quantity, 0);

const roundCurrency = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

export const getOrderPricing = (subtotal: number, deliveryFee = 1.25) => {
  const safeSubtotal = roundCurrency(Math.max(0, subtotal));
  const safeDeliveryFee = roundCurrency(Math.max(0, deliveryFee));
  const commission = roundCurrency(safeSubtotal * PLATFORM_COMMISSION_RATE);
  return {
    subtotal: safeSubtotal,
    deliveryFee: safeDeliveryFee,
    commission,
    grandTotal: roundCurrency(safeSubtotal + safeDeliveryFee + commission),
    motherPayout: roundCurrency(Math.max(0, safeSubtotal - commission)),
  };
};

export const unitCount = (items: CartItem[]) => items.reduce((sum, item) => sum + item.quantity, 0);

const capacityRank: Record<LoadCapacity, number> = { small: 1, medium: 2, large: 3 };

export const getRequiredLoadCapacity = (items: CartItem[]): LoadCapacity => {
  const quantity = unitCount(items);
  const largestMeal = items.reduce<MealSize>((largest, item) => capacityRank[item.meal.portionSize] > capacityRank[largest] ? item.meal.portionSize : largest, "small");
  if (largestMeal === "large" || quantity >= 6) return "large";
  if (largestMeal === "medium" || quantity >= 3) return "medium";
  return "small";
};

export const canCarryLoad = (capacity: LoadCapacity | null | undefined, required: LoadCapacity | null | undefined) =>
  Boolean(capacity && required && capacityRank[capacity] >= capacityRank[required]);

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
  total: 19.1,
  commission: 0.85,
  deliveryFee: 1.25,
  paymentMethod: "cliq",
  schedule: "now",
  status: "ready",
  eta: { ar: "خلال ٢٥ دقيقة", en: "Within 25 minutes" },
  pickupCoordinates: { latitude: 31.963, longitude: 35.91 },
  dropoffCoordinates: { latitude: 31.951, longitude: 35.884 },
  driverCoordinates: { latitude: 31.978, longitude: 35.897 },
  pickupAddress: { ar: "مطبخ أم أحمد، خلدا، عمّان", en: "Umm Ahmad's Kitchen, Khalda, Amman" },
  dropoffAddress: { ar: "عبدون، شارع الأمير هاشم", en: "Abdoun, Prince Hashem St." },
  driverRating: 4.9,
  driver: { name: { ar: "محمد العبدالله", en: "Mohammad Al-Abdallah" }, phone: "0791234567", vehicle: { ar: "دراجة نارية سوداء", en: "Black motorcycle" }, plate: "32-9184", vehicleType: "motorcycle", cargoCapacity: "medium" },
};

export const sampleIncomingOrder: Order = {
  id: "SO-2408",
  kitchen: primaryKitchen,
  items: [{ meal: primaryMeal, quantity: 2 }],
  total: 19.1,
  commission: 0.85,
  deliveryFee: 1.25,
  paymentMethod: "cliq",
  schedule: "scheduled",
  status: "received",
  eta: { ar: "غداً، ١:٣٠ م", en: "Tomorrow, 1:30 PM" },
  pickupCoordinates: { latitude: 31.963, longitude: 35.91 },
  dropoffCoordinates: { latitude: 31.951, longitude: 35.884 },
  driverCoordinates: { latitude: 31.978, longitude: 35.897 },
  pickupAddress: { ar: "مطبخ أم أحمد، خلدا، عمّان", en: "Umm Ahmad's Kitchen, Khalda, Amman" },
  dropoffAddress: { ar: "عبدون، شارع الأمير هاشم", en: "Abdoun, Prince Hashem St." },
  driverRating: 4.9,
  driver: { name: { ar: "محمد العبدالله", en: "Mohammad Al-Abdallah" }, phone: "0791234567", vehicle: { ar: "دراجة نارية سوداء", en: "Black motorcycle" }, plate: "32-9184", vehicleType: "motorcycle", cargoCapacity: "medium" },
};
