import { describe, expect, it } from "vitest";

import { getMultiOrderPricing, meals } from "../lib/food-data";
import { isJordanPhone } from "../server/sms";

describe("recommendation integrations", () => {
  it("accepts Jordan mobile numbers and rejects malformed values", () => {
    expect(isJordanPhone("0791234567")).toBe(true);
    expect(isJordanPhone("+962791234567")).toBe(true);
    expect(isJordanPhone("00962791234567")).toBe(true);
    expect(isJordanPhone("12345")).toBe(false);
  });

  it("keeps the five percent platform commission in split-order totals", () => {
    const pricing = getMultiOrderPricing([
      { meal: meals[0], quantity: 1 },
      { meal: meals.find((meal) => meal.kitchenId !== meals[0].kitchenId) ?? meals[1], quantity: 1 },
    ], 1.25);
    expect(pricing.groups.length).toBeGreaterThanOrEqual(2);
    expect(pricing.groups.every((group) => group.pricing.commission === Number((group.pricing.subtotal * 0.05).toFixed(2)))).toBe(true);
    expect(pricing.grandTotal).toBeGreaterThan(pricing.subtotal);
  });
});
