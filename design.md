# Sufret Omi (سفرة أمي) - Mobile App Interface Design Plan

## 1. Brand Identity & Color Palette
- **Primary / Terracotta Warm Orange**: `#C2410C` (Warm Jordanian heritage, terracotta pottery, hearth cooking)
- **Secondary / Olive Green**: `#4D7C0F` (Olive groves of Jordan, fresh herbs, natural ingredients)
- **Background / Cream Beige**: `#FDF8F6` (Warm home atmosphere, traditional tablecloths)
- **Surface / Card White**: `#FFFFFF` with warm stone border `#E7DCD6`
- **Text / Dark Charcoal**: `#1C1917` for primary contrast, `#78716C` for muted metadata
- **Typography & Localization**: Arabic-first UI (with seamless English toggle), right-to-left (RTL) layout support for Arabic text, featuring classic Jordanian culinary terminology.

## 2. Screen Architecture & Navigation
- **Role Switcher Header**: Instant toggle between **Customer View** (تصفح الأكلات) and **Mother's Kitchen Dashboard** (لوحة تحكم الأم).
- **Tab Bar (Customer)**:
  1. **Home / Explore**: Featured Jordanian kitchens, category pills (Mansaf, Maqluba, Moona, Bakery), regional filter (Amman, Irbid, Zarqa, Salt, Madaba).
  2. **Search & Map**: Interactive map preview of nearby home kitchens across Jordanian neighborhoods.
  3. **Orders**: Active multi-step order tracking & past family orders.
  4. **Profile & Settings**: Dual language toggle (AR/EN), saved addresses, CliQ wallet details.
- **Mother's Dashboard (Seller)**:
  1. **Overview & Kitchen Toggle**: Master Open/Closed switch with prep lead-time setter.
  2. **Live Orders**: Incoming orders requiring acceptance, prep confirmation, or dispatch.
  3. **Menu Manager**: Add/edit home-cooked meals, set daily portions limit & advance prep notice.
  4. **Earnings & CliQ**: Revenue breakdown and instant CliQ payout requests.

## 3. Key User Flows
1. **Customer Discovery & Order Flow**:
   - Customer opens app → Selects region (e.g., Khalda, Amman) → Browsers "Umm Ahmad's Kitchen" → Selects authentic Jameed Mansaf with local ghee → Chooses Instant or Scheduled Advance Ordering (e.g., Friday family gathering) → Selects payment (CliQ transfer or Cash on Delivery) → Real-time multi-step tracking from "Kitchen Prep" to "Driver on the Way".
2. **Mother's Kitchen Management Flow**:
   - Mother toggles kitchen status to **Open** → Receives instant notification for incoming Maqluba order → Taps **Accept & Set Prep Time (45 mins)** → Updates menu item stock when daily limit is reached → Requests weekly earnings payout via CliQ (`079XXXXXXX`).

## 4. Jordanian Culinary Categories
- **Mansaf (المنسف الأردني)**: Traditional lamb cooked in dried fermented yogurt (Jameed) with shrak bread and almonds.
- **Maqluba (المقلوبة)**: Upside-down layered rice, eggplant/cauliflower, and tender chicken or meat.
- **Stuffed Grape Leaves & Cabbage (محاشي وورق عنف)**: Hand-rolled vine leaves with spiced rice and minced meat.
- **Homestyle Bakery & Pastries (معجنات ومخبوزات)**: Taboon bread, Zaatar manakish, and Ka'ak.
- **Homemade Moona (مونه منزلية)**: Jameed balls, olive oil, fig jam, and wild thyme.
