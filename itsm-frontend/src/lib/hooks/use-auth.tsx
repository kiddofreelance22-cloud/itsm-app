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
import { setSession, clearSession, getStoredUser, getToken, ApiError } from "@/lib/api/client";

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
  /** Holds the literal "Engineer" role — same analyst workspace, but with
   *  restricted field-level edit rights (e.g. cannot edit Description). */
  isEngineer: boolean;
  /** Check if user has a specific permission (format: "module:action") */
  hasPermission: (permission: string) => boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  completeLogin: (response: LoginResponse, rememberMe?: boolean) => void;
  updateUser: (updates: Partial<AuthUser>) => void;
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

  const completeLogin = useCallback(
    (res: LoginResponse, rememberMe = true) => {
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

  const login = useCallback(
    async (username: string, password: string, rememberMe = true) => {
      const res = await AuthApi.login(username, password);
      completeLogin(res, rememberMe);
    },
    [completeLogin]
  );

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    const token = getToken();
    if (token) {
      setSession(token, updatedUser, localStorage.getItem("itsm_token") !== null);
    }
    setUser(updatedUser);
  }, [user]);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    router.push("/login");
  }, [router]);

  const isAdmin = user?.roles.some((role) => ["Admin", "Administrator"].includes(role)) ?? false;
  const isApprover =
    user?.roles.some((role) => ["Approver", "Admin", "Administrator"].includes(role)) ?? false;

  // Role-level capability check: instead of only matching hardcoded role
  // display names, also look at what the user's role(s) were actually
  // granted on the Roles Management > Module Permissions screen. Any role
  // with Update/Delete/Administer rights on a ticket-working module
  // (Incidents, Service Requests, Problems, Changes) is treated as an
  // "agent" that works tickets — a plain Read/Create-only role (like the
  // default End User role) is not. This means a brand-new custom role
  // (e.g. "Analyst Role Ver1") automatically gets analyst workspace access
  // once an admin grants it the right module permissions, with no code
  // change required.
  const WORK_MODULES = ["incidents", "service requests", "problems", "changes"];
  const ELEVATED_ACTIONS = ["update", "delete", "administer"];
  const hasElevatedWorkPermission = (user?.permissions ?? []).some((perm) => {
    const [module, action] = perm.split(":");
    return WORK_MODULES.includes(module) && ELEVATED_ACTIONS.includes(action);
  });

  const isAgent =
    hasElevatedWorkPermission ||
    (user?.roles.some((role) => ["IT Agent", "Engineer", "Analyst"].includes(role)) ?? false);
  const isManager = user?.roles.some((role) => ["IT Manager"].includes(role)) ?? false;
  const isServiceDesk = user?.roles.some((role) => ["Service Desk"].includes(role)) ?? false;
  const isEndUser = user?.roles.some((role) => ["End User", "Requester"].includes(role)) ?? false;
  // Literal "Engineer" role — same analyst workspace access as any other agent,
  // but with restricted field-level edit rights on incident detail (see
  // IncidentDetailPage: Description stays read-only for Engineers).
  const isEngineer = user?.roles.some((role) => ["Engineer"].includes(role)) ?? false;
  // "Analyst workspace" (queue, analyst dashboard, resolve actions) applies to anyone who
  // works tickets rather than just raising them.
  const isAnalyst = isAgent || isManager || isServiceDesk || isApprover;
  const isRequester = !isAnalyst && !isAdmin;

  // Permission checking function
  const hasPermission = useCallback((permission: string): boolean => {
    if (!user?.permissions) return false;
    // Check exact permission match (e.g., "incidents:read")
    return user.permissions.includes(permission.toLowerCase());
  }, [user?.permissions]);

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
        isEngineer,
        hasPermission,
        login,
        completeLogin,
        updateUser,
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
