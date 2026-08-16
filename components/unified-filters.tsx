import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { categories, regions, type CategoryId, type RegionId } from "@/lib/food-data";

export type UnifiedFilterSort = "recommended" | "distance" | "rating" | "fast" | "high" | "low";

type Language = "ar" | "en";

type UnifiedFiltersProps = {
  visible: boolean;
  language: Language;
  regionScope: RegionId | "all";
  category: CategoryId | "all";
  sort: UnifiedFilterSort;
  onRegionChange: (region: RegionId | "all") => void;
  onCategoryChange: (category: CategoryId | "all") => void;
  onSortChange: (sort: UnifiedFilterSort) => void;
  onClose: () => void;
};

const sortOptions: Array<{ id: UnifiedFilterSort; ar: string; en: string; icon: React.ComponentProps<typeof MaterialIcons>["name"] }> = [
  { id: "recommended", ar: "موصى به", en: "Recommended", icon: "trending-up" },
  { id: "distance", ar: "الأقرب أولاً", en: "Nearest first", icon: "near-me" },
  { id: "rating", ar: "الأعلى تقييماً", en: "Top rated", icon: "star" },
  { id: "fast", ar: "الأسرع تحضيراً", en: "Fastest prep", icon: "schedule" },
  { id: "high", ar: "الأغلى أولاً", en: "Price: high to low", icon: "arrow-downward" },
  { id: "low", ar: "الأرخص أولاً", en: "Price: low to high", icon: "arrow-upward" },
];

export function UnifiedFilters({ visible, language, regionScope, category, sort, onRegionChange, onCategoryChange, onSortChange, onClose }: UnifiedFiltersProps) {
  if (!visible) return null;
  const isArabic = language === "ar";
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerCopy}><Text style={styles.title}>{isArabic ? "الفلاتر" : "Filters"}</Text><Text style={styles.subtitle}>{isArabic ? "اختاري بنفس الطريقة في كل الصفحات" : "Use the same filters across every page"}</Text></View>
        <Pressable onPress={onClose} style={styles.closeButton}><MaterialIcons name="close" size={19} color="#082E34" /></Pressable>
      </View>
      <Text style={styles.sectionTitle}>{isArabic ? "المنطقة" : "Region"}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <FilterChip label={isArabic ? "كل المملكة" : "All Jordan"} selected={regionScope === "all"} onPress={() => onRegionChange("all")} />
        {regions.map((region) => <FilterChip key={region.id} label={region.label[language]} selected={regionScope === region.id} onPress={() => onRegionChange(region.id)} />)}
      </ScrollView>
      <Text style={styles.sectionTitle}>{isArabic ? "نوع الطعام" : "Food type"}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <FilterChip label={isArabic ? "الكل" : "All types"} selected={category === "all"} onPress={() => onCategoryChange("all")} />
        {categories.map((item) => <FilterChip key={item.id} label={item.label[language]} selected={category === item.id} onPress={() => onCategoryChange(item.id)} />)}
      </ScrollView>
      <Text style={styles.sectionTitle}>{isArabic ? "ترتيب النتائج" : "Sort results"}</Text>
      <View style={styles.sortGrid}>{sortOptions.map((option) => <Pressable key={option.id} onPress={() => onSortChange(option.id)} style={[styles.sortOption, sort === option.id && styles.sortOptionActive]}><MaterialIcons name={option.icon} size={15} color={sort === option.id ? "#FFFFFF" : "#00AFC4"} /><Text style={[styles.sortOptionText, sort === option.id && styles.sortOptionTextActive]}>{isArabic ? option.ar : option.en}</Text></Pressable>)}</View>
      <Pressable onPress={() => { onRegionChange("all"); onCategoryChange("all"); onSortChange("recommended"); }} style={styles.clearButton}><MaterialIcons name="restart-alt" size={16} color="#00AFC4" /><Text style={styles.clearText}>{isArabic ? "مسح الفلاتر" : "Clear filters"}</Text></Pressable>
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipActive]}><Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#BCEFF4", padding: 13, gap: 8, shadowColor: "#00AFC4", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerCopy: { flex: 1, gap: 2 },
  title: { color: "#082E34", fontSize: 16, fontWeight: "900" },
  subtitle: { color: "#4C747A", fontSize: 10 },
  closeButton: { width: 32, height: 32, borderRadius: 11, backgroundColor: "#F0FCFD", justifyContent: "center", alignItems: "center" },
  sectionTitle: { color: "#082E34", fontSize: 11, fontWeight: "900", marginTop: 4 },
  chipRow: { gap: 7, paddingVertical: 1 },
  chip: { borderWidth: 1, borderColor: "#D2EFF2", backgroundColor: "#F7FCFD", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  chipActive: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" },
  chipText: { color: "#4C747A", fontSize: 10, fontWeight: "800" },
  chipTextActive: { color: "#FFFFFF" },
  sortGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  sortOption: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "#D2EFF2", backgroundColor: "#F7FCFD", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 8 },
  sortOptionActive: { backgroundColor: "#00AFC4", borderColor: "#00AFC4" },
  sortOptionText: { color: "#4C747A", fontSize: 10, fontWeight: "800" },
  sortOptionTextActive: { color: "#FFFFFF" },
  clearButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingTop: 2 },
  clearText: { color: "#00AFC4", fontSize: 10, fontWeight: "900" },
});

export default UnifiedFilters;
