import { ApiError } from "@/lib/api/errors";

const DEFAULT_API_BASE_URL = "http://localhost:8000/api/v1";

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
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
  error?: { code?: string; message?: string };
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
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
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
    );
  }

  // Unwrap Flask envelope { data } when present, else return body as T.
  if (body !== null && typeof body === "object" && "data" in body) {
    return (body as ApiEnvelope<T>).data;
  }
  return body as T;
}
