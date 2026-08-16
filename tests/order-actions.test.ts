import { describe, expect, it } from "vitest";

import { canRequestOrderAction } from "../server/db";

describe("order action availability", () => {
  it("allows cancellation only before the kitchen is ready", () => {
    expect(canRequestOrderAction("received", "cancellation_requested")).toBe(true);
    expect(canRequestOrderAction("preparing", "cancellation_requested")).toBe(true);
    expect(canRequestOrderAction("ready", "cancellation_requested")).toBe(false);
    expect(canRequestOrderAction("on_the_way", "cancellation_requested")).toBe(false);
  });

  it("allows replacement after delivery progress begins", () => {
    expect(canRequestOrderAction("received", "replacement_requested")).toBe(false);
    expect(canRequestOrderAction("preparing", "replacement_requested")).toBe(false);
    expect(canRequestOrderAction("on_the_way", "replacement_requested")).toBe(true);
    expect(canRequestOrderAction("delivered", "replacement_requested")).toBe(true);
  });
});
