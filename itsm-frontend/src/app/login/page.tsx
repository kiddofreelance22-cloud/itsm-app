"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Headphones, User, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AuthApi, type SsoProvider } from "@/lib/api/auth.api";
import { getApiBaseUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/hooks/use-auth";

const ssoErrorMessages: Record<string, string> = {
  sso_failed: "Single sign-on could not be completed. Please try again.",
  sso_user_not_found: "Your account was not found. Contact your administrator.",
  sso_user_inactive: "Your account is inactive. Contact your administrator.",
  sso_domain_not_allowed: "Your organization does not allow sign-in from this email domain.",
  sso_email_unverified: "Verify your email address with your identity provider, then try again.",
};

export default function LoginPage() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ssoProviders, setSsoProviders] = useState<SsoProvider[]>([]);
  const [ssoUnavailable, setSsoUnavailable] = useState(false);

  useEffect(() => {
    const errorCode = new URLSearchParams(window.location.search).get("error");
    if (errorCode) {
      setError(ssoErrorMessages[errorCode] ?? ssoErrorMessages.sso_failed);
    }

    let active = true;
    AuthApi.ssoProviders()
      .then(({ providers }) => {
        if (active) setSsoProviders(providers);
      })
      .catch(() => {
        if (active) setSsoUnavailable(true);
      });

    return () => {
      active = false;
    };
  }, []);


  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) ?? "Invalid username or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 px-4 py-10">
      <div className="pointer-events-none absolute left-6 top-6 grid grid-cols-6 gap-2 opacity-60" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (<span key={i} className="size-1.5 rounded-full bg-[rgb(96,165,250)]" />))}
      </div>
      <svg className="pointer-events-none absolute bottom-0 left-0 w-full opacity-40" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true">
        <path fill="rgb(96,165,250)" d="M0,224L60,213.3C120,203,240,181,360,181.3C480,181,600,203,720,224C840,245,960,267,1080,250.7C1200,235,1320,181,1380,154.7L1440,128L1440,320L0,320Z" />
      </svg>
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-8 shadow-xl sm:p-10">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-blue-50">
            <Headphones className="size-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">ITSM</h1>
          <p className="mt-1 text-sm font-semibold text-slate-600">Incident Management System</p>
          <h2 className="mt-6 text-lg font-bold text-slate-900">Sign in to your account</h2>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          <div>
            <Label htmlFor="username">Username</Label>
            <Input id="username" autoComplete="username" placeholder="Enter username" value={username} onChange={(e) => setUsername(e.target.value)} leadingIcon={<User />} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} leadingIcon={<Lock />}
              trailingIcon={<button type="button" onClick={() => setShowPassword((s) => !s)} className="pointer-events-auto -mr-1 rounded p-0.5 text-slate-400 hover:text-slate-600">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>}
            />
          </div>
          {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox id="remember" />
              <Label htmlFor="remember" className="mb-0 cursor-pointer font-normal text-slate-700">Remember me</Label>
            </div>
            <a href="#" className="text-sm font-medium text-blue-600 hover:underline">Forgot Password?</a>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? "Signing in..." : "Login"}</Button>
        </form>
        {(ssoProviders.length > 0 || ssoUnavailable) && (
          <div className="mt-5 space-y-3">
            {ssoProviders.length > 0 ? (
              <>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                {ssoProviders.includes("google") && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="w-full"
                    onClick={() => window.location.assign(`${getApiBaseUrl()}/auth/google/login`)}
                  >
                    <GoogleIcon />
                    Continue with Google
                  </Button>
                )}
                {ssoProviders.includes("microsoft") && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="w-full"
                    onClick={() => window.location.assign(`${getApiBaseUrl()}/auth/microsoft/login`)}
                  >
                    <MicrosoftIcon />
                    Continue with Microsoft
                  </Button>
                )}
              </>
            ) : (
              <p role="status" className="text-center text-xs text-slate-500">
                Single sign-on options are temporarily unavailable.
              </p>
            )}
          </div>
        )}
        <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">© 2026 ITSM Inc. All rights reserved.</div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-4">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94a11.05 11.05 0 0 1-4.8 7.24l7.73 5.99c4.51-4.17 7.11-10.31 7.11-17.7Z" />
      <path fill="#FBBC05" d="M10.53 28.59a14.39 14.39 0 0 1 0-9.18l-7.98-6.19a23.95 23.95 0 0 0 0 21.56l7.98-6.19Z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.76l-7.73-5.99c-2.14 1.44-4.89 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 23 23" aria-hidden="true" className="size-4">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  );
}
