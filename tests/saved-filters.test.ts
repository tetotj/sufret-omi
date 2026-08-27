import { describe, expect, it } from "vitest";

import { capSavedFilters, parseSavedFilters, serializeSavedFilters } from "../lib/saved-filters";

const filter = (id: string, name: string) => ({
  id,
  name,
  regionScope: "all" as const,
  category: "all" as const,
  subcategory: "all",
  sort: "recommended" as const,
  kitchenStatuses: [],
  calorieRanges: [],
});

describe("saved filters", () => {
  it("round-trips a named filter", () => {
    const saved = filter("1", "أكل خفيف");
    expect(parseSavedFilters(serializeSavedFilters([saved]))).toEqual([saved]);
  });

  it("keeps only the ten most recent saved filters", () => {
    const saved = Array.from({ length: 12 }, (_, index) => filter(String(index), `Filter ${index}`));
    expect(capSavedFilters(saved)).toHaveLength(10);
    expect(parseSavedFilters(serializeSavedFilters(saved))).toHaveLength(10);
  });

  it("ignores malformed saved filter storage safely", () => {
    expect(parseSavedFilters("not-json")).toEqual([]);
    expect(parseSavedFilters(JSON.stringify({ id: "wrong" }))).toEqual([]);
    expect(parseSavedFilters(JSON.stringify([{ id: "1" }, { id: "2", name: "Valid" }]))).toEqual([{ id: "2", name: "Valid" }]);
  });
});
