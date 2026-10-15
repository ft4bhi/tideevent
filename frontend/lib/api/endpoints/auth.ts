import { apiFetch, isMockMode } from "@/lib/api/client";
import { mockLogin, mockLogout, mockRegister, mockSessionUser } from "@/lib/api/mock/store";
import type { User } from "@/types/domain";

export async function me(): Promise<User | null> {
  if (isMockMode()) return mockSessionUser();
  try {
    return await apiFetch<User>("/auth/me");
  } catch (err) {
    void err;
    return null;
  }
}

export async function login(email: string, password: string): Promise<User> {
  if (isMockMode()) return mockLogin(email, password);
  return apiFetch<User>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
  role: "ATTENDEE" | "ORGANIZER";
}): Promise<User> {
  if (isMockMode()) return mockRegister(input);
  return apiFetch<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<void> {
  if (isMockMode()) return mockLogout();
  await apiFetch<null>("/auth/logout", { method: "POST" });
}
