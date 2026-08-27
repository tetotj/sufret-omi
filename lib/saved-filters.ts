import type { CategoryId, RegionId } from "@/lib/food-data";

export type SavedFilterSort = "recommended" | "distance" | "rating" | "fast" | "high" | "low";
export type SavedKitchenStatus = "open" | "closed";
export type SavedCalorieRange = "under500" | "500to800" | "over800";

export type SavedFilter = {
  id: string;
  name: string;
  regionScope: RegionId | "all";
  category: CategoryId | "all";
  subcategory: string | "all";
  sort: SavedFilterSort;
  kitchenStatuses: SavedKitchenStatus[];
  calorieRanges: SavedCalorieRange[];
};

export const SAVED_FILTERS_KEY = "sufret-omi-saved-filters-v1";
export const MAX_SAVED_FILTERS = 10;

export function capSavedFilters(filters: SavedFilter[]) {
  return filters.slice(0, MAX_SAVED_FILTERS);
}

export function serializeSavedFilters(filters: SavedFilter[]) {
  return JSON.stringify(capSavedFilters(filters));
}

export function parseSavedFilters(value: string | null): SavedFilter[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SavedFilter => Boolean(item && typeof item === "object" && typeof (item as SavedFilter).id === "string" && typeof (item as SavedFilter).name === "string")).slice(0, MAX_SAVED_FILTERS);
  } catch {
    return [];
  }
}
