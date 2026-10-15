"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { logout as apiLogout, me } from "@/lib/api/endpoints/auth";
import type { SessionUser } from "@/types/domain";

interface Session {
  user: SessionUser;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Session>({
  user: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const u = await me();
    // Id-stable update: StrictMode double-effects resolve the same user;
    // keeping the reference avoids a second commit that could detach nodes.
    setUser((prev) => ((prev?.id ?? null) === (u?.id ?? null) ? prev : u));
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    me().then((u) => {
      if (cancelled) return;
      setUser((prev) => ((prev?.id ?? null) === (u?.id ?? null) ? prev : u));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SessionContext.Provider value={{ user, loading, refresh, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  return useContext(SessionContext);
}
