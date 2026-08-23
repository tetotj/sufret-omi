import { describe, expect, it } from "vitest";

import { createMotherVerification, isMotherVerificationReady } from "../lib/verification-data";

describe("mother verification submission readiness", () => {
  it("rejects an incomplete mother profile", () => {
    expect(isMotherVerificationReady(createMotherVerification("amman"))).toBe(false);
  });

  it("accepts a complete mother profile with every required document", () => {
    const profile = createMotherVerification("amman");
    profile.fullName = "أم أحمد";
    profile.phone = "0790000000";
    profile.address = "خلدا، عمّان";
    profile.foodTypes = ["mansaf"];
    profile.mealSize = "large";
    profile.deliveryCapacity = "large";
    profile.hasPets = "no";
    profile.allergyPrecautions = "لا توجد";
    profile.termsAccepted = true;
    profile.documents = profile.documents.map((document) => ({ ...document, uri: `file://${document.type}.jpg` }));
    expect(isMotherVerificationReady(profile)).toBe(true);
  });
});
