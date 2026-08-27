import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("complaint access guard", () => {
  it("requires authentication and uses the authenticated customer id", () => {
    const source = readFileSync("server/routers.ts", "utf8");
    const complaintsBlock = source.slice(source.indexOf("  complaints: router({"), source.indexOf("  }),\n});", source.indexOf("  complaints: router({")));
    expect(complaintsBlock).toContain("create: protectedProcedure");
    expect(complaintsBlock).toContain("customerId: ctx.user.id");
    expect(complaintsBlock).not.toContain('ctx.user?.id ?? "guest"');
  });
});
