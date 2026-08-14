import { describe, expect, it } from "vitest";

import { getOrderPricing } from "../lib/food-data";

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
});
