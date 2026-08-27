import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { categories, getCategory, regions, type CategoryId, type RegionId } from "@/lib/food-data";

export type UnifiedFilterSort = "recommended" | "distance" | "rating" | "fast" | "high" | "low";
export type KitchenStatusFilter = "open" | "closed";
export type CalorieRangeId = "under500" | "500to800" | "over800";

type Language = "ar" | "en";

type UnifiedFiltersProps = {
  visible: boolean;
  language: Language;
  regionScope: RegionId | "all";
  category: CategoryId | "all";
  subcategory: string | "all";
  sort: UnifiedFilterSort;
  kitchenStatuses: KitchenStatusFilter[];
  calorieRanges: CalorieRangeId[];
  onRegionChange: (region: RegionId | "all") => void;
  onCategoryChange: (category: CategoryId | "all") => void;
  onSubcategoryChange: (subcategory: string | "all") => void;
  onSortChange: (sort: UnifiedFilterSort) => void;
  onKitchenStatusesChange: (statuses: KitchenStatusFilter[]) => void;
  onCalorieRangesChange: (ranges: CalorieRangeId[]) => void;
  onClose: () => void;
};

const sortOptions: { id: UnifiedFilterSort; ar: string; en: string; icon: React.ComponentProps<typeof MaterialIcons>["name"] }[] = [
  { id: "recommended", ar: "موصى به", en: "Recommended", icon: "trending-up" },
  { id: "distance", ar: "الأقرب أولاً", en: "Nearest first", icon: "near-me" },
  { id: "rating", ar: "الأعلى تقييماً", en: "Top rated", icon: "star" },
  { id: "fast", ar: "الأسرع تحضيراً", en: "Fastest prep", icon: "schedule" },
  { id: "high", ar: "الأغلى أولاً", en: "Price: high to low", icon: "arrow-downward" },
  { id: "low", ar: "الأرخص أولاً", en: "Price: low to high", icon: "arrow-upward" },
];

const kitchenStatusOptions: { id: KitchenStatusFilter; ar: string; en: string; icon: React.ComponentProps<typeof MaterialIcons>["name"] }[] = [
  { id: "open", ar: "المطابخ المفتوحة", en: "Open kitchens", icon: "storefront" },
  { id: "closed", ar: "المطابخ المغلقة", en: "Closed kitchens", icon: "store" },
];

const calorieOptions: { id: CalorieRangeId; ar: string; en: string }[] = [
  { id: "under500", ar: "أقل من ٥٠٠ سعرة", en: "Under 500 kcal" },
  { id: "500to800", ar: "من ٥٠٠ إلى ٨٠٠", en: "500–800 kcal" },
  { id: "over800", ar: "أكثر من ٨٠٠", en: "Over 800 kcal" },
];

export function UnifiedFilters({ visible, language, regionScope, category, subcategory, sort, kitchenStatuses, calorieRanges, onRegionChange, onCategoryChange, onSubcategoryChange, onSortChange, onKitchenStatusesChange, onCalorieRangesChange, onClose }: UnifiedFiltersProps) {
  if (!visible) return null;
  const isArabic = language === "ar";
  const subfilters = category === "all" ? [] : getCategory(category).subfilters ?? [];
  const activeFilterCount = (regionScope !== "all" ? 1 : 0) + (category !== "all" ? 1 : 0) + (subcategory !== "all" ? 1 : 0) + (sort !== "recommended" ? 1 : 0) + kitchenStatuses.length + calorieRanges.length;
  const toggleStatus = (value: KitchenStatusFilter) => onKitchenStatusesChange(kitchenStatuses.includes(value) ? kitchenStatuses.filter((item) => item !== value) : [...kitchenStatuses, value]);
  const toggleCalories = (value: CalorieRangeId) => onCalorieRangesChange(calorieRanges.includes(value) ? calorieRanges.filter((item) => item !== value) : [...calorieRanges, value]);
  return (
    <View style={styles.panel}>
      <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.title}>{isArabic ? "الفلاتر" : "Filters"}</Text><Text style={styles.subtitle}>{isArabic ? "يمكنك اختيار أكثر من فلتر معاً" : "Combine multiple filters together"}</Text></View><Pressable onPress={onClose} style={styles.closeButton}><MaterialIcons name="close" size={19} color="#082E34" /></Pressable></View>
      <Text style={styles.sectionTitle}>{isArabic ? "حالة المطابخ (اختيار متعدد)" : "Kitchen status (multi-select)"}</Text>
      <View style={styles.optionGrid}>{kitchenStatusOptions.map((option) => <Pressable key={option.id} onPress={() => toggleStatus(option.id)} style={[styles.statusOption, kitchenStatuses.includes(option.id) && styles.statusOptionActive]}><MaterialIcons name={option.icon} size={15} color={kitchenStatuses.includes(option.id) ? "#FFFFFF" : option.id === "open" ? "#2E9B72" : "#A55A40"} /><Text style={[styles.optionText, kitchenStatuses.includes(option.id) && styles.optionTextActive]}>{isArabic ? option.ar : option.en}</Text></Pressable>)}</View>
      <Text style={styles.sectionTitle}>{isArabic ? "المنطقة" : "Region"}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}><FilterChip label={isArabic ? "كل المملكة" : "All Jordan"} selected={regionScope === "all"} onPress={() => onRegionChange("all")} />{regions.map((region) => <FilterChip key={region.id} label={region.label[language]} selected={regionScope === region.id} onPress={() => onRegionChange(region.id)} />)}</ScrollView>
      <Text style={styles.sectionTitle}>{isArabic ? "نوع الطعام" : "Food type"}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}><FilterChip label={isArabic ? "الكل" : "All types"} selected={category === "all"} onPress={() => onCategoryChange("all")} />{categories.map((item) => <FilterChip key={item.id} label={item.label[language]} selected={category === item.id} onPress={() => onCategoryChange(item.id)} />)}</ScrollView>
      {subfilters.length > 0 && <><Text style={styles.sectionTitle}>{isArabic ? "التصنيف الفرعي" : "Subcategory"}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}><FilterChip label={isArabic ? "الكل" : "All"} selected={subcategory === "all"} onPress={() => onSubcategoryChange("all")} />{subfilters.map((item) => <FilterChip key={item.id} label={item.label[language]} selected={subcategory === item.id} onPress={() => onSubcategoryChange(item.id)} />)}</ScrollView></>}
      <Text style={styles.sectionTitle}>{isArabic ? "السعرات الحرارية (اختيار متعدد)" : "Calories (multi-select)"}</Text>
      <View style={styles.optionGrid}>{calorieOptions.map((option) => <Pressable key={option.id} onPress={() => toggleCalories(option.id)} style={[styles.calorieOption, calorieRanges.includes(option.id) && styles.calorieOptionActive]}><MaterialIcons name="local-fire-department" size={15} color={calorieRanges.includes(option.id) ? "#FFFFFF" : "#C98A2E"} /><Text style={[styles.optionText, calorieRanges.includes(option.id) && styles.optionTextActive]}>{isArabic ? option.ar : option.en}</Text></Pressable>)}</View>
      <Text style={styles.sectionTitle}>{isArabic ? "ترتيب النتائج" : "Sort results"}</Text>
      <View style={styles.sortGrid}>{sortOptions.map((option) => <Pressable key={option.id} onPress={() => onSortChange(option.id)} style={[styles.sortOption, sort === option.id && styles.sortOptionActive]}><MaterialIcons name={option.icon} size={15} color={sort === option.id ? "#FFFFFF" : "#00AFC4"} /><Text style={[styles.sortOptionText, sort === option.id && styles.sortOptionTextActive]}>{isArabic ? option.ar : option.en}</Text></Pressable>)}</View>
      <Pressable onPress={() => { onRegionChange("all"); onCategoryChange("all"); onSubcategoryChange("all"); onSortChange("recommended"); onKitchenStatusesChange([]); onCalorieRangesChange([]); }} style={({ pressed }) => [styles.clearAllButton, activeFilterCount === 0 && styles.clearAllButtonIdle, pressed && styles.clearPressed]}><MaterialIcons name="restart-alt" size={18} color={activeFilterCount > 0 ? "#FFFFFF" : "#00AFC4"} /><Text style={[styles.clearAllText, activeFilterCount === 0 && styles.clearAllTextIdle]}>{isArabic ? `مسح جميع الفلاتر${activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}` : `Clear all filters${activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}`}</Text></Pressable>
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipActive]}><Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  panel: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#BCEFF4", padding: 13, gap: 8, shadowColor: "#00AFC4", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 }, headerCopy: { flex: 1, gap: 2 }, title: { color: "#082E34", fontSize: 16, fontWeight: "900" }, subtitle: { color: "#4C747A", fontSize: 10 }, closeButton: { width: 32, height: 32, borderRadius: 11, backgroundColor: "#F0FCFD", justifyContent: "center", alignItems: "center" },
  sectionTitle: { color: "#082E34", fontSize: 11, fontWeight: "900", marginTop: 4 }, chipRow: { gap: 7, paddingVertical: 1 }, chip: { borderWidth: 1, borderColor: "#D2EFF2", backgroundColor: "#F7FCFD", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }, chipActive: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" }, chipText: { color: "#4C747A", fontSize: 10, fontWeight: "800" }, chipTextActive: { color: "#FFFFFF" }, optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, statusOption: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "#D2EFF2", backgroundColor: "#F7FCFD", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 8 }, statusOptionActive: { backgroundColor: "#2E9B72", borderColor: "#2E9B72" }, calorieOption: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "#F0D6A0", backgroundColor: "#FFF9ED", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 8 }, calorieOptionActive: { backgroundColor: "#C98A2E", borderColor: "#C98A2E" }, optionText: { color: "#4C747A", fontSize: 10, fontWeight: "800" }, optionTextActive: { color: "#FFFFFF" }, sortGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, sortOption: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "#D2EFF2", backgroundColor: "#F7FCFD", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 8 }, sortOptionActive: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" }, sortOptionText: { color: "#4C747A", fontSize: 10, fontWeight: "800" }, sortOptionTextActive: { color: "#FFFFFF" },   clearButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingTop: 2 }, clearText: { color: "#00AFC4", fontSize: 10, fontWeight: "900" }, clearAllButton: { width: "100%", minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 13, backgroundColor: "#00AFC4", borderWidth: 1, borderColor: "#00AFC4", marginTop: 4 }, clearAllButtonIdle: { backgroundColor: "#F0FCFD", borderColor: "#BCEFF4" }, clearAllText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" }, clearAllTextIdle: { color: "#00AFC4" }, clearPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});

export default UnifiedFilters;
