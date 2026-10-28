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

function clearCsrfCookie() {
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
  clearCsrfCookie();
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
describe("apiFetch CSRF handling", () => {
  it("sends X-CSRFToken from the csrftoken cookie on unsafe requests", async () => {
    document.cookie = "csrftoken=token-from-cookie; path=/";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch } = await import("@/lib/api/client");
    await apiFetch("/bookings", { method: "POST", body: "{}" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("X-CSRFToken")).toBe("token-from-cookie");
    expect(init.credentials).toBe("include");
  });

  it("does not send X-CSRFToken on safe requests", async () => {
    document.cookie = "csrftoken=token-from-cookie; path=/";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch } = await import("@/lib/api/client");
    await apiFetch("/events");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).has("X-CSRFToken")).toBe(false);
  });

  it("bootstraps the cookie via GET /auth/me when it is missing", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith("/auth/me")) {
        document.cookie = "csrftoken=bootstrapped; path=/";
      }
      return jsonResponse({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch } = await import("@/lib/api/client");
    await apiFetch("/auth/login", { method: "POST", body: "{}" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/auth/me");
    const [, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("X-CSRFToken")).toBe("bootstrapped");
  });

  it("keeps field-level validation errors from the error envelope", async () => {
    document.cookie = "csrftoken=token-from-cookie; path=/";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () =>
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "Some fields are invalid.",
            fields: {
              booking_mode: ["This field is required."],
              ticket_types: ["At least one ticket type is required."],
            },
          },
        }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch } = await import("@/lib/api/client");
    const err = await apiFetch("/organizer/events", { method: "POST", body: "{}" }).catch(
      (e: unknown) => e,
    );

    expect(err).toMatchObject({ code: "VALIDATION_ERROR", status: 422 });
    expect((err as { fields?: Record<string, string> }).fields).toEqual({
      booking_mode: "This field is required.",
      ticket_types: "At least one ticket type is required.",
    });
  });
});
