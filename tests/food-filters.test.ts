import { describe, expect, it } from "vitest";

import { kitchens, meals } from "../lib/food-data";

type KitchenStatus = "open" | "closed";
type CalorieRange = "under500" | "500to800" | "over800";

function matchesCalories(calories: number, ranges: CalorieRange[]) {
  return ranges.length === 0 || ranges.some((range) => range === "under500" ? calories < 500 : range === "500to800" ? calories >= 500 && calories <= 800 : calories > 800);
}

describe("food filters", () => {
  it("provides calories for every catalog meal", () => {
    expect(meals.length).toBeGreaterThan(0);
    expect(meals.every((meal) => Number.isFinite(meal.calories) && meal.calories > 0)).toBe(true);
  });

  it("combines multiple calorie ranges with OR semantics", () => {
    expect(matchesCalories(320, ["under500"])).toBe(true);
    expect(matchesCalories(760, ["under500"])).toBe(false);
    expect(matchesCalories(320, ["under500", "500to800"])).toBe(true);
    expect(matchesCalories(760, ["under500", "500to800"])).toBe(true);
    expect(matchesCalories(980, ["under500", "500to800"])).toBe(false);
    expect(matchesCalories(980, [])).toBe(true);
  });

  it("combines multiple kitchen statuses without hiding either selected status", () => {
    const selected: KitchenStatus[] = ["open", "closed"];
    const matching = kitchens.filter((kitchen) => selected.includes(kitchen.isOpen ? "open" : "closed"));
    expect(matching.length).toBe(kitchens.length);
    expect(kitchens.some((kitchen) => kitchen.isOpen)).toBe(true);
    expect(kitchens.some((kitchen) => !kitchen.isOpen)).toBe(true);
  });
});
