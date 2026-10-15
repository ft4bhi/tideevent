import { ApiError } from "@/lib/api/errors";

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api/v1";
}

/** Mock mode is explicit (default ON until backend exists). Never silently fall back. */
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK !== "false";
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
