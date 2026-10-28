import { ApiError } from "@/lib/api/errors";

const DEFAULT_API_BASE_URL = "http://localhost:8000/api/v1";

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

/**
 * Public frontend origin for absolute ticket URLs (QR codes, share links).
 * Defaults to http://localhost:3000 in development. Set NEXT_PUBLIC_FRONTEND_URL
 * in production (e.g. https://ticevent.example.com).
 */
export function frontendBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000";
}

let productionMockWarned = false;

/**
 * Single source of truth for mock mode. Mock data is a development/test
 * opt-in: it requires the exact string "true" and is never available in a
 * production build, even if the flag is set there. Absent or invalid values
 * mean real API mode — we never fall back to mock silently.
 */
export function isMockMode(): boolean {
  const flag = process.env.NEXT_PUBLIC_USE_MOCK;
  if (process.env.NODE_ENV === "production") {
    if (flag === "true" && !productionMockWarned) {
      productionMockWarned = true;
      console.error(
        "[TideEvent] NEXT_PUBLIC_USE_MOCK=true is set but ignored in this production build. " +
          "Mock data is development-only; the app is using the real API.",
      );
    }
    return false;
  }
  return flag === "true";
}

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; fields?: unknown };
}

function flattenFieldErrors(raw: unknown): Record<string, string> | undefined {
  if (raw === null || typeof raw !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
    else if (Array.isArray(value)) {
      const joined = value.filter((v): v is string => typeof v === "string").join(" ");
      out[key] = joined || JSON.stringify(value);
    } else if (value && typeof value === "object") out[key] = JSON.stringify(value);
    else out[key] = String(value);
  }
  return Object.keys(out).length ? out : undefined;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const chunk of document.cookie.split(";")) {
    const part = chunk.trim();
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return null;
}

async function readCsrfToken(): Promise<string | null> {
  const existing = readCookie("csrftoken");
  if (existing) return existing;
  if (typeof document === "undefined") return null;
  try {
    // /auth/me is decorated with @ensure_csrf_cookie and sets the cookie.
    await fetch(`${apiBaseUrl()}/auth/me`, {
      method: "GET",
      credentials: "include",
    });
  } catch {
    return null;
  }
  return readCookie("csrftoken");
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Central JSON/error handling for all HTTP calls.
 * Throws ApiError with machine-readable code + human message.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (UNSAFE_METHODS.has(method)) {
    const token = await readCsrfToken();
    if (token) headers.set("X-CSRFToken", token);
  }

  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      method,
      credentials: "include",
      headers,
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", "Cannot reach the server. Check your connection and retry.", 0);
  }

  const body = await parseBody(res);

  if (!res.ok) {
    const errBody = body as ApiErrorBody | null;
    throw new ApiError(
      errBody?.error?.code ?? "REQUEST_FAILED",
      errBody?.error?.message ?? `Request failed (${res.status}).`,
      res.status,
      flattenFieldErrors(errBody?.error?.fields),
    );
  }

  // Keep envelopes for paginated/list endpoints; unwrap for single-object endpoints.
  if (body !== null && typeof body === "object") {
    if ("data" in body && "meta" in body) {
      return body as T;
    }
    if ("data" in body && !("meta" in body)) {
      return (body as ApiEnvelope<T>).data;
    }
  }
  return body as T;
}
