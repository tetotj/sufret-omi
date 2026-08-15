import { describe, expect, it } from "vitest";

import { getMultiOrderPricing, getOrderPricing, meals } from "../lib/food-data";

describe("platform commission pricing", () => {
  it("adds a 5% commission to the food subtotal and keeps the mother payout transparent", () => {
    expect(getOrderPricing(17, 1.25)).toEqual({
      subtotal: 17,
      deliveryFee: 1.25,
      commission: 0.85,
      grandTotal: 19.1,
      motherPayout: 16.15,
    });
  });

  it("does not charge commission when the order subtotal is empty", () => {
    expect(getOrderPricing(0, 0).commission).toBe(0);
    expect(getOrderPricing(0, 0).grandTotal).toBe(0);
  });

  it("splits a mixed-kitchen cart and charges delivery once per kitchen", () => {
    const firstMeal = meals[0];
    const secondMeal = meals.find((meal) => meal.kitchenId !== firstMeal.kitchenId);
    expect(secondMeal).toBeDefined();
    const pricing = getMultiOrderPricing([{ meal: firstMeal, quantity: 1 }, { meal: secondMeal!, quantity: 2 }], 1.25);
    expect(pricing.groups).toHaveLength(2);
    expect(pricing.deliveryFee).toBe(2.5);
    expect(pricing.grandTotal).toBe(pricing.groups.reduce((sum, group) => sum + group.pricing.grandTotal, 0));
  });
});
