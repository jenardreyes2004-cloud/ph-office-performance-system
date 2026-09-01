import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { api } from "@/lib/api";
import type { AuthUser } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// DEV-ONLY BYPASS: since /api/auth/login isn't built yet, this fakes a signed-in
// Main Admin so protected pages/modules can be built and viewed. Set to false
// (or just delete this block and the check below) once real auth is wired up.
const DEV_BYPASS_AUTH = true;
const DEV_USER: AuthUser = {
  id: "dev-user",
  email: "dev@local",
  name: "Dev User",
  role: "MAIN_ADMIN",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(DEV_BYPASS_AUTH ? DEV_USER : null);
  const [isLoading, setIsLoading] = useState(!DEV_BYPASS_AUTH);

  useEffect(() => {
    if (DEV_BYPASS_AUTH) return;

    const token = localStorage.getItem("opmps_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    api
      .get<AuthUser>("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem("opmps_token"))
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string) {
    // Backend /api/auth/login isn't built yet — this is the shape it will return.
    const res = await api.post<{ token: string; user: AuthUser }>("/auth/login", {
      email,
      password,
    });
    localStorage.setItem("opmps_token", res.data.token);
    setUser(res.data.user);
  }

  function logout() {
    localStorage.removeItem("opmps_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
