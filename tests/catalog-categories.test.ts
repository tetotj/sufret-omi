import { describe, expect, it } from "vitest";

import { categories, meals } from "../lib/food-data";

describe("catalog categories", () => {
  it("includes dessert, dairy, and cheese categories with discoverable meals", () => {
    const categoryIds = new Set(categories.map((category) => category.id));

    expect(categoryIds.has("desserts")).toBe(true);
    expect(categoryIds.has("dairy")).toBe(true);
    expect(categoryIds.has("cheese")).toBe(true);
    expect(meals.some((meal) => meal.category === "desserts")).toBe(true);
    expect(meals.some((meal) => meal.category === "dairy")).toBe(true);
    expect(meals.some((meal) => meal.category === "cheese")).toBe(true);
  });
});
