import { beforeEach, describe, expect, it } from "vitest";
import { mockListEvents, mockStore } from "@/lib/api/mock/store";

beforeEach(() => {
  mockStore.reset();
});

describe("mockListEvents (T-01)", () => {
  it("lists only active upcoming events", async () => {
    const { data } = await mockListEvents();
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((e) => e.status === "ACTIVE")).toBe(true);
  });

  it("filters by keyword across title and description", async () => {
    const { data } = await mockListEvents({ q: "jazz" });
    expect(data.map((e) => e.title)).toContain("Monsoon Jazz Night");
    expect(data.every((e) => `${e.title} ${e.description}`.toLowerCase().includes("jazz"))).toBe(true);
  });

  it("filters by category and city combined", async () => {
    const { data } = await mockListEvents({ category: "COMEDY", city: "Bengaluru" });
    expect(data.length).toBe(1);
    expect(data[0].title).toBe("Stand-up: Laugh Riot");
  });

  it("returns empty for a non-matching combination", async () => {
    const { data } = await mockListEvents({ category: "SPORTS", city: "Mumbai" });
    expect(data).toHaveLength(0);
  });
});
