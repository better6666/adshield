import { describe, expect, it } from "vitest";

describe("local-only configuration", () => {
  it("keeps AdShield independent from external API credentials", () => {
    expect(process.env.ADSHIELD_NO_EXTERNAL_SECRET).toBe("local-only");
  });
});
