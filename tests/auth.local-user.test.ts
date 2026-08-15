import { describe, expect, it } from "vitest";

import { getLocalDatabaseRole } from "../server/db";

describe("local account persistence", () => {
  it("uses the platform users role accepted by the live auth table", () => {
    expect(getLocalDatabaseRole()).toBe("user");
  });
});

