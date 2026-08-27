export type Language = "ar" | "en";
export type Role = "customer" | "mother" | "driver";
export type MealSize = "small" | "medium" | "large";
export type LoadCapacity = "small" | "medium" | "large";
export type DriverVehicleType = "motorcycle" | "car" | "van";
export type Localized = { ar: string; en: string };
export type Coordinate = { latitude: number; longitude: number };
export type DeliveryAddressDetails = {
  street: string;
  building: string;
  floor: string;
  apartment: string;
  landmark: string;
};
export type DeliverySelection = {
  coordinates: Coordinate;
  address: Localized;
  details?: DeliveryAddressDetails;
  scheduledDay?: string;
  scheduledHour?: string;
};
export type CategoryId = "mansaf" | "maqluba" | "mahshi" | "bakery" | "moona" | "desserts" | "dairy" | "cheese";
export type RegionId = "amman" | "irbid" | "zarqa" | "balqa" | "salt" | "madaba" | "jerash" | "ajloun" | "mafraq" | "karak" | "tafila" | "maan" | "aqaba";

export type CategorySubfilter = {
  id: string;
  label: Localized;
};

export type Category = {
  id: CategoryId;
  label: Localized;
  icon: string;
  color: string;
  subfilters?: CategorySubfilter[];
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
  calories: number;
  subcategory?: string;
  customizationOptions?: {
    additions?: { id: string; label: Localized; price?: number }[];
    removals?: { id: string; label: Localized }[];
  };
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
  description?: Localized;
};

export type CartItem = {
  meal: Meal;
  quantity: number;
  specialRequests?: string;
  selectedAdditions?: { id: string; label: Localized; price?: number }[];
  selectedRemovals?: { id: string; label: Localized }[];
};

export type OrderStatus = "received" | "preparing" | "ready" | "on_the_way" | "delivered";
export type OrderCustomerAction = "none" | "cancellation_requested" | "replacement_requested";
export const PLATFORM_COMMISSION_RATE = 0.05;

export type DriverDetails = {
  name: Localized;
  phone: string;
  vehicle: Localized;
  plate: string;
  vehicleType: DriverVehicleType;
  cargoCapacity: LoadCapacity;
};

export type OrderMessage = {
  id: string;
  orderId: string;
  senderRole: Role;
  senderName: string;
  body: string;
  createdAt: string;
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
  scheduledDay?: string;
  scheduledHour?: string;
  status: OrderStatus;
  customerAction?: OrderCustomerAction;
  customerActionNote?: string;
  customerActionAt?: string;
  eta: Localized;
  pickupCoordinates: Coordinate;
  dropoffCoordinates: Coordinate;
  driverCoordinates?: Coordinate;
  driverLocationUpdatedAt?: string;
  pickupAddress: Localized;
  dropoffAddress: Localized;
  dropoffAddressDetails?: DeliveryAddressDetails;
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
  { id: "desserts", label: { ar: "حلويات", en: "Desserts" }, icon: "cake", color: "#D76545", subfilters: [{ id: "baklava", label: { ar: "بقلاوة", en: "Baklava" } }, { id: "basbousa", label: { ar: "هريسة ونمورة", en: "Basbousa" } }, { id: "kunafa", label: { ar: "كنافة", en: "Kunafa" } }] },
  { id: "dairy", label: { ar: "ألبان", en: "Dairy" }, icon: "local-drink", color: "#6D9FB0", subfilters: [{ id: "labneh", label: { ar: "لبنة", en: "Labneh" } }, { id: "shaneeneh", label: { ar: "شنينة ولبن", en: "Shaneeneh & yoghurt" } }, { id: "yogurt", label: { ar: "لبن زبادي", en: "Yoghurt" } }] },
  { id: "cheese", label: { ar: "أجبان", en: "Cheese" }, icon: "lunch-dining", color: "#D6A33A", subfilters: [{ id: "white-cheese", label: { ar: "جبنة بيضاء", en: "White cheese" } }, { id: "halloumi", label: { ar: "حلوم", en: "Halloumi" } }, { id: "jameed", label: { ar: "جميد", en: "Jameed" } }] },
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
    description: { ar: "أكلات بيتية طازجة بطابع أردني أصيل، نحضرها يومياً بحب لأهل الحي.", en: "Fresh home-cooked Jordanian dishes prepared daily with care for the neighborhood." },
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
    image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=84", portionSize: "medium", calories: 980,
    customizationOptions: {
      additions: [
        { id: "extra-jameed", label: { ar: "مرق جميد إضافي", en: "Extra Jameed broth" }, price: 1.00 },
        { id: "extra-ghee", label: { ar: "سمنة بلدية عالعين", en: "Country ghee drizzle" }, price: 0.50 }
      ],
      removals: [
        { id: "no-nuts", label: { ar: "بدون لوز", en: "Without almonds" } },
        { id: "no-parsley", label: { ar: "بدون بقدونس", en: "Without parsley" } }
      ]
    }
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
    image: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=900&q=84", portionSize: "medium", calories: 760,
    customizationOptions: {
      additions: [
        { id: "extra-chicken", label: { ar: "قطعة دجاج إضافية", en: "Extra chicken piece" }, price: 2.00 },
        { id: "fried-nuts", label: { ar: "مكسرات مقلية", en: "Fried nuts" }, price: 0.75 }
      ],
      removals: [
        { id: "no-cauliflower", label: { ar: "بدون زهرة", en: "Without cauliflower" } },
        { id: "no-eggplant", label: { ar: "بدون باذنجان", en: "Without eggplant" } }
      ]
    }
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
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=84", portionSize: "small", calories: 430,
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
    image: "https://images.unsplash.com/photo-1573140401552-3fab0b24306f?auto=format&fit=crop&w=900&q=84", portionSize: "small", calories: 360,
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
    image: "https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=900&q=84", portionSize: "medium", calories: 290,
  },
  { id: "zarqa-maqluba", kitchenId: "kitchen-zarqa", name: { ar: "مقلوبة الزرقاء", en: "Zarqa Maqluba" }, description: { ar: "رز متبّل مع باذنجان ودجاج بلدي", en: "Spiced rice with eggplant and local chicken" }, category: "maqluba", price: 6.5, prepMinutes: 50, dailyLimit: 15, available: true, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=84", portionSize: "medium", calories: 740 },
  { id: "balqa-mansaf", kitchenId: "kitchen-balqa", name: { ar: "منسف البلقاء", en: "Balqa Mansaf" }, description: { ar: "جميد كريمي ولحمة بلدية وخبز شراك", en: "Creamy jameed, local lamb and shrak bread" }, category: "mansaf", price: 9.25, prepMinutes: 60, dailyLimit: 12, available: true, image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=84", portionSize: "large", calories: 1120 },
  { id: "madaba-mahshi", kitchenId: "kitchen-madaba", name: { ar: "محاشي مادبا", en: "Madaba Stuffed Vegetables" }, description: { ar: "كوسا وورق دوالي بحشوة بيتية", en: "Zucchini and grape leaves with homestyle filling" }, category: "mahshi", price: 5.75, prepMinutes: 45, dailyLimit: 18, available: true, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=84", portionSize: "medium", calories: 510 },
  { id: "jerash-olive", kitchenId: "kitchen-jerash", name: { ar: "زيتون جرشي مكبوس", en: "Jerash Pressed Olives" }, description: { ar: "زيتون أخضر من موسم جرش مع الأعشاب", en: "Green Jerash olives with local herbs" }, category: "moona", price: 6.25, prepMinutes: 10, dailyLimit: 20, available: true, image: "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=900&q=84", portionSize: "small", calories: 160 },
  { id: "ajloun-manakish", kitchenId: "kitchen-ajloun", name: { ar: "مناقيش عجلون", en: "Ajloun Manakish" }, description: { ar: "زعتر جبلي وزيت زيتون على عجينة طرية", en: "Mountain zaatar and olive oil on soft dough" }, category: "bakery", price: 3.5, prepMinutes: 25, dailyLimit: 24, available: true, image: "https://images.unsplash.com/photo-1573140401552-3fab0b24306f?auto=format&fit=crop&w=900&q=84", portionSize: "small", calories: 390 },
  { id: "mafraq-mansaf", kitchenId: "kitchen-mafraq", name: { ar: "ثريد البادية", en: "Badia Thareed" }, description: { ar: "خبز رقيق مع مرق ولحم وتوابل بدوية", en: "Thin bread with broth, meat and Bedouin spices" }, category: "mansaf", price: 7.75, prepMinutes: 55, dailyLimit: 14, available: true, image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=84", portionSize: "large", calories: 870 },
  { id: "karak-mansaf", kitchenId: "kitchen-karak", name: { ar: "منسف الكرك الكبير", en: "Karak Family Mansaf" }, description: { ar: "سفرة جنوبية تكفي اللمة مع جميد كركي", en: "A southern family feast with Karak jameed" }, category: "mansaf", price: 12.5, prepMinutes: 70, dailyLimit: 10, available: true, image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=84", portionSize: "large", calories: 1280 },
  { id: "tafila-mahshi", kitchenId: "kitchen-tafila", name: { ar: "دوالي الطفيلة", en: "Tafilah Grape Leaves" }, description: { ar: "دوالي صغيرة بطعم زيت الزيتون الجبلي", en: "Tender grape leaves with highland olive oil" }, category: "mahshi", price: 5.5, prepMinutes: 50, dailyLimit: 16, available: true, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=84", portionSize: "medium", calories: 470 },
  { id: "maan-maqluba", kitchenId: "kitchen-maan", name: { ar: "مقلوبة معان باللحم", en: "Ma'an Meat Maqluba" }, description: { ar: "مقلوبة جنوبية بلحم طري وباذنجان", en: "Southern maqluba with tender meat and eggplant" }, category: "maqluba", price: 8.75, prepMinutes: 65, dailyLimit: 12, available: true, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=84", portionSize: "large", calories: 940 },
  { id: "aqaba-bakery", kitchenId: "kitchen-aqaba", name: { ar: "خبز العقبة بالسمسم", en: "Aqaba Sesame Bread" }, description: { ar: "خبز طازج بالسمسم يقدم مع لبنة وزيت", en: "Fresh sesame bread with labneh and olive oil" }, category: "bakery", price: 2.75, prepMinutes: 20, dailyLimit: 30, available: true, image: "https://images.unsplash.com/photo-1573140401552-3fab0b24306f?auto=format&fit=crop&w=900&q=84", portionSize: "small", calories: 410 },
  { id: "umm-ahmad-baklava", kitchenId: "umm-ahmad", name: { ar: "بقلاوة بالفستق الحلبي", en: "Pistachio Baklava" }, description: { ar: "رقائق عجين مقرمشة محشوة بالفستق الحلبي الفاخر", en: "Crisp pastry layers filled with premium pistachios" }, category: "desserts", price: 4.5, prepMinutes: 25, dailyLimit: 20, available: true, image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=900&q=84", portionSize: "small", calories: 320, subcategory: "baklava" },
  { id: "teta-hareesa", kitchenId: "teta-sawsan", name: { ar: "هريسة النمورة البيتية", en: "Homestyle Basbousa Hareesa" }, description: { ar: "سميد ناعم مع زبدة بلدية وجوز الهند المحمّص", en: "Fine semolina with country butter and toasted coconut" }, category: "desserts", price: 3.8, prepMinutes: 20, dailyLimit: 25, available: true, image: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=900&q=84", portionSize: "medium", calories: 380, subcategory: "basbousa" },
  { id: "ward-labneh", kitchenId: "kitchen-ward", name: { ar: "لبنة غنم بلدية مصفاة", en: "Strained Sheep Labneh" }, description: { ar: "لبنة بلدية أصيلة مصفاة بعناية مع زيت الزيتون البكر", en: "Authentic country labneh strained with extra virgin olive oil" }, category: "dairy", price: 3.75, prepMinutes: 15, dailyLimit: 24, available: true, image: "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=900&q=84", portionSize: "medium", calories: 210, subcategory: "labneh" },
  { id: "irbid-shaneeneh", kitchenId: "kitchen-irbid", name: { ar: "شنينة إربد الحامضة", en: "Irbid Sour Shaneeneh" }, description: { ar: "مشروب لبن العيران البلدي المنعش والمحضّر يومياً", en: "Refreshing traditional country buttermilk prepared daily" }, category: "dairy", price: 2.25, prepMinutes: 10, dailyLimit: 30, available: true, image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=900&q=84", portionSize: "small", calories: 120, subcategory: "shaneeneh" },
  { id: "ajloun-white-cheese", kitchenId: "kitchen-ajloun", name: { ar: "جبنة عجلونية بيضاء بالبركة", en: "Ajloun White Cheese with Nigella" }, description: { ar: "جبنة حليب غنم طبيعي مع حبة البركة الطازجة", en: "Natural sheep milk cheese with fresh nigella seeds" }, category: "cheese", price: 5.25, prepMinutes: 20, dailyLimit: 18, available: true, image: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=900&q=84", portionSize: "medium", calories: 260, subcategory: "white-cheese" },
  { id: "karak-halloumi", kitchenId: "kitchen-karak", name: { ar: "جبنة حلوم كركية مشوية", en: "Karak Grilled Halloumi" }, description: { ar: "أقراص حلوم بلدية ممتازة للشوي والتقديم الساخن", en: "Country halloumi disks perfect for grilling and serving hot" }, category: "cheese", price: 6.0, prepMinutes: 20, dailyLimit: 15, available: true, image: "https://images.unsplash.com/photo-1552767059-ce182ead6c1b?auto=format&fit=crop&w=900&q=84", portionSize: "medium", calories: 340, subcategory: "halloumi" },
  { id: "amman-kunafa", kitchenId: "kitchen-amman", name: { ar: "كنافة نابلسية بالسمنة البلدية", en: "Nabulsi Kunafa with Ghee" }, description: { ar: "كنافة ساخنة بجبنة نابلسية وقطر خفيف", en: "Warm kunafa with Nabulsi cheese and light syrup" }, category: "desserts", price: 5.75, prepMinutes: 30, dailyLimit: 18, available: true, image: "https://images.unsplash.com/photo-1579888944880-d98341245702?auto=format&fit=crop&w=900&q=84", portionSize: "medium", calories: 540, subcategory: "kunafa" },
  { id: "salt-yogurt", kitchenId: "kitchen-salt", name: { ar: "لبن زبادي بلدي", en: "Traditional Homemade Yoghurt" }, description: { ar: "لبن زبادي كثيف محضّر بحليب طازج من المزرعة", en: "Thick homemade yoghurt made with fresh farm milk" }, category: "dairy", price: 2.9, prepMinutes: 15, dailyLimit: 22, available: true, image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=84", portionSize: "medium", calories: 180, subcategory: "yogurt" },
  { id: "karak-jameed", kitchenId: "kitchen-karak", name: { ar: "جميد كركي سائل", en: "Liquid Karak Jameed" }, description: { ar: "جميد كركي أصيل جاهز للمنسف والطبخ البيتي", en: "Authentic Karak jameed ready for mansaf and home cooking" }, category: "cheese", price: 7.5, prepMinutes: 20, dailyLimit: 14, available: true, image: "https://images.unsplash.com/photo-1559561853-08451507cbe7?auto=format&fit=crop&w=900&q=84", portionSize: "large", calories: 230, subcategory: "jameed" },
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

export const totalCart = (items: CartItem[]) => items.reduce((sum, item) => {
  const additionsSum = (item.selectedAdditions ?? []).reduce((sub, add) => sub + (typeof add.price === "number" ? add.price : 0), 0);
  return sum + (item.meal.price + additionsSum) * item.quantity;
}, 0);

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

export type MultiOrderPricing = {
  groups: Array<{ kitchenId: string; items: CartItem[]; pricing: ReturnType<typeof getOrderPricing> }>;
  subtotal: number;
  deliveryFee: number;
  commission: number;
  grandTotal: number;
};

export const splitCartByKitchen = (items: CartItem[]) => {
  const grouped = new Map<string, CartItem[]>();
  for (const item of items) grouped.set(item.meal.kitchenId, [...(grouped.get(item.meal.kitchenId) ?? []), item]);
  return Array.from(grouped.entries()).map(([kitchenId, groupedItems]) => ({ kitchenId, items: groupedItems }));
};

export const getMultiOrderPricing = (items: CartItem[], deliveryFee = 1.25): MultiOrderPricing => {
  const groups = splitCartByKitchen(items).map((group) => ({ ...group, pricing: getOrderPricing(totalCart(group.items), deliveryFee) }));
  return {
    groups,
    subtotal: roundCurrency(groups.reduce((sum, group) => sum + group.pricing.subtotal, 0)),
    deliveryFee: roundCurrency(groups.reduce((sum, group) => sum + group.pricing.deliveryFee, 0)),
    commission: roundCurrency(groups.reduce((sum, group) => sum + group.pricing.commission, 0)),
    grandTotal: roundCurrency(groups.reduce((sum, group) => sum + group.pricing.grandTotal, 0)),
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
