import { apiFetch, isMockMode } from "@/lib/api/client";
import { mockLogin, mockLogout, mockRegister, mockSessionUser } from "@/lib/api/mock/store";
import type { User } from "@/types/domain";

interface SessionEnvelope {
  user: User | null;
}

interface UserEnvelope {
  user: User;
}

export async function me(): Promise<User | null> {
  if (isMockMode()) return mockSessionUser();
  try {
    const body = await apiFetch<SessionEnvelope>("/auth/me");
    return body.user ?? null;
  } catch (err) {
    void err;
    return null;
  }
}

export async function login(email: string, password: string): Promise<User> {
  if (isMockMode()) return mockLogin(email, password);
  const body = await apiFetch<UserEnvelope>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return body.user;
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
  role: "ATTENDEE" | "ORGANIZER";
}): Promise<User> {
  if (isMockMode()) return mockRegister(input);
  const body = await apiFetch<UserEnvelope>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.user;
}

export async function logout(): Promise<void> {
  if (isMockMode()) return mockLogout();
  await apiFetch<null>("/auth/logout", { method: "POST" });
}
