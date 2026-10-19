import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type EnvCombo = {
  nodeEnv: string | undefined;
  flag: string | undefined;
  expected: boolean;
  label: string;
};

const MATRIX: EnvCombo[] = [
  { label: "development + explicit true", nodeEnv: "development", flag: "true", expected: true },
  { label: "development + absent flag", nodeEnv: "development", flag: undefined, expected: false },
  { label: "development + false", nodeEnv: "development", flag: "false", expected: false },
  { label: "development + invalid value", nodeEnv: "development", flag: "yes", expected: false },
  { label: "development + empty string", nodeEnv: "development", flag: "", expected: false },
  { label: "test + explicit true", nodeEnv: "test", flag: "true", expected: true },
  { label: "test + absent flag", nodeEnv: "test", flag: undefined, expected: false },
  { label: "production + true", nodeEnv: "production", flag: "true", expected: false },
  { label: "production + absent flag", nodeEnv: "production", flag: undefined, expected: false },
  { label: "production + false", nodeEnv: "production", flag: "false", expected: false },
];

async function loadIsMockMode(nodeEnv: string | undefined, flag: string | undefined) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv ?? "");
  vi.stubEnv("NEXT_PUBLIC_USE_MOCK", flag);
  const mod = await import("@/lib/api/client");
  return mod.isMockMode;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("isMockMode environment matrix", () => {
  for (const combo of MATRIX) {
    it(`${combo.label} → ${combo.expected ? "mock" : "real API"}`, async () => {
      const isMockMode = await loadIsMockMode(combo.nodeEnv, combo.flag);
      expect(isMockMode()).toBe(combo.expected);
    });
  }

  it("warns once on the console when production tries to enable mock mode", async () => {
    const isMockMode = await loadIsMockMode("production", "true");
    expect(isMockMode()).toBe(false);
    expect(isMockMode()).toBe(false);
    const error = vi.mocked(console.error);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]?.[0])).toContain("NEXT_PUBLIC_USE_MOCK");
  });

  it("does not warn in production when the flag is absent", async () => {
    const isMockMode = await loadIsMockMode("production", undefined);
    expect(isMockMode()).toBe(false);
    expect(vi.mocked(console.error)).not.toHaveBeenCalled();
  });
});

describe("apiBaseUrl", () => {
  it("defaults to the Django dev server", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", undefined);
    const { apiBaseUrl } = await import("@/lib/api/client");
    expect(apiBaseUrl()).toBe("http://localhost:8000/api/v1");
  });

  it("uses NEXT_PUBLIC_API_BASE_URL when set", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://example.test/api/v1");
    const { apiBaseUrl } = await import("@/lib/api/client");
    expect(apiBaseUrl()).toBe("http://example.test/api/v1");
  });
});
