"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AuthApi, LoginResponse } from "@/lib/api/auth.api";
import { setSession, clearSession, getStoredUser, ApiError } from "@/lib/api/client";

type AuthUser = LoginResponse["user"];

// Where each role lands after a successful login.
// Update these two paths if your route names differ.
const ADMIN_HOME = "/home";
const USER_HOME = "/home";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  isApprover: boolean;
  isAgent: boolean;
  isManager: boolean;
  isServiceDesk: boolean;
  isRequester: boolean;
  isAnalyst: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Rehydrate from storage on first mount (checks localStorage, then sessionStorage)
  useEffect(() => {
    const stored = getStoredUser<AuthUser>();
    if (stored) setUser(stored);
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (username: string, password: string, rememberMe = true) => {
      const res = await AuthApi.login(username, password);
      setSession(res.accessToken, res.user, rememberMe);
      setUser(res.user);

      if (res.user.isFirstLogin) {
        router.push("/reset-password");
      } else {
        const destination = res.user.roles.some((role) => ["Admin", "Administrator"].includes(role))
          ? ADMIN_HOME
          : USER_HOME;
        router.push(destination);
      }
    },
    [router]
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    router.push("/login");
  }, [router]);

  const isAdmin = user?.roles.some((role) => ["Admin", "Administrator"].includes(role)) ?? false;
  const isApprover =
    user?.roles.some((role) => ["Approver", "Admin", "Administrator"].includes(role)) ?? false;
  const isAgent = user?.roles.some((role) => ["IT Agent", "Engineer"].includes(role)) ?? false;
  const isManager = user?.roles.some((role) => ["IT Manager"].includes(role)) ?? false;
  const isServiceDesk = user?.roles.some((role) => ["Service Desk"].includes(role)) ?? false;
  const isEndUser = user?.roles.some((role) => ["End User", "Requester"].includes(role)) ?? false;
  // "Analyst workspace" (queue, analyst dashboard, resolve actions) applies to anyone who
  // works tickets rather than just raising them.
  const isAnalyst = isAgent || isManager || isServiceDesk || isApprover;
  const isRequester = !isAnalyst && !isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAdmin,
        isApprover,
        isAgent,
        isManager,
        isServiceDesk,
        isRequester,
        isAnalyst,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export { ApiError };
