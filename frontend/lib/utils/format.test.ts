import { describe, expect, it } from "vitest";
import { isSoldOut, priceLabel, seatsLeft } from "@/lib/utils/format";

describe("priceLabel", () => {
  it("labels zero price as Free", () => {
    expect(priceLabel(0)).toBe("Free");
  });
  it("formats INR with Indian grouping", () => {
    expect(priceLabel(499)).toBe("₹499");
    expect(priceLabel(10000)).toBe("₹10,000");
  });
});

describe("availability", () => {
  it("computes seats left", () => {
    expect(seatsLeft(500, 212)).toBe(288);
  });
  it("never goes negative", () => {
    expect(seatsLeft(200, 250)).toBe(0);
  });
  it("flags sold out at and above capacity", () => {
    expect(isSoldOut(200, 200)).toBe(true);
    expect(isSoldOut(200, 199)).toBe(false);
  });
});
