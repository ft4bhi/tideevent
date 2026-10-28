import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function clearCsrfCookie() {
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
}

const USER = {
  id: "u1",
  name: "Attendee",
  email: "att@example.com",
  role: "ATTENDEE" as const,
};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_USE_MOCK", "false");
  document.cookie = "csrftoken=test-token; path=/";
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
  clearCsrfCookie();
});

describe("auth endpoint envelopes", () => {
  it("me() returns null for the anonymous { user: null } envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ user: null })));

    const { me } = await import("@/lib/api/endpoints/auth");
    await expect(me()).resolves.toBeNull();
  });

  it("me() unwraps { user } for an authenticated session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ user: USER })));

    const { me } = await import("@/lib/api/endpoints/auth");
    await expect(me()).resolves.toEqual(USER);
  });

  it("login() unwraps { user } and sends the CSRF header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ user: USER }));
    vi.stubGlobal("fetch", fetchMock);

    const { login } = await import("@/lib/api/endpoints/auth");
    await expect(login(USER.email, "secret")).resolves.toEqual(USER);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/auth/login");
    expect(init.credentials).toBe("include");
    expect(new Headers(init.headers).get("X-CSRFToken")).toBe("test-token");
  });

  it("register() unwraps { user }", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ user: USER }, 201)));

    const { register } = await import("@/lib/api/endpoints/auth");
    await expect(
      register({ name: "Attendee", email: USER.email, password: "password123", role: "ATTENDEE" }),
    ).resolves.toEqual(USER);
  });
});
