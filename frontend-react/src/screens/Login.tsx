import React, { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Headphones, LockKeyhole, UserRound } from "lucide-react";
import { useAuth } from "../AuthContext";
import { useRouter } from "../router";
import { API_BASE_URL } from "../api";
import { incidentApi, type SsoProvider } from "../incidentApi";

const ssoErrorMessages: Record<string, string> = {
  sso_failed: "Single sign-on could not be completed. Please try again.",
  sso_user_not_found: "Your account was not found. Contact your administrator.",
  sso_user_inactive: "Your account is inactive. Contact your administrator.",
  sso_domain_not_allowed: "Your organization does not allow sign-in from this email domain.",
  sso_email_unverified: "Verify your email address with your identity provider, then try again.",
};

export function LoginPage() {
  const { login, resetTemporaryPassword, clearError, error } = useAuth();
  const { navigate } = useRouter();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ssoProviders, setSsoProviders] = useState<SsoProvider[]>([]);
  const [ssoError, setSsoError] = useState("");

  useEffect(() => {
    const errorCode = new URLSearchParams(window.location.search).get("error");
    if (errorCode) {
      setSsoError(ssoErrorMessages[errorCode] ?? ssoErrorMessages.sso_failed);
      window.history.replaceState({}, "", window.location.pathname);
    }

    let active = true;
    incidentApi.ssoProviders().then((providers) => {
      if (active) setSsoProviders(providers);
    }).catch(() => {
      if (active) setSsoProviders([]);
    });

    return () => {
      active = false;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") await login(username, password, remember);
      else await resetTemporaryPassword(email, password, newPassword);
      navigate("/");
    } catch {
      // error surfaced via context
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand-mark"><Headphones size={32} strokeWidth={2.2} aria-hidden="true" /></div>
        <div className="auth-brand-title">ITSM</div>
        <div className="auth-brand-subtitle">Incident Management System</div>

        <h1 className="auth-form-title">{mode === "login" ? "Sign in to your account" : "Reset your password"}</h1>
        {mode === "reset" && (
          <p className="auth-reset-copy">Enter the email and temporary password supplied by your administrator.</p>
        )}

        <form onSubmit={onSubmit} className="auth-form">
          {mode === "login" ? (
            <div className="auth-field">
              <label htmlFor="auth-username">Username</label>
              <div className="auth-input-wrap">
                <UserRound size={18} aria-hidden="true" />
                <input
                  id="auth-username"
                  type="text"
                  autoComplete="username"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>
          ) : (
            <div className="auth-field">
              <label htmlFor="auth-email">Email</label>
              <div className="auth-input-wrap">
                <UserRound size={18} aria-hidden="true" />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-password">{mode === "reset" ? "Temporary Password" : "Password"}</label>
            <div className="auth-input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "reset" ? "current-password" : "current-password"}
                placeholder={mode === "reset" ? "Enter temporary password" : "Enter password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                className="auth-password-toggle"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((shown) => !shown)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {mode === "reset" && (
            <div className="auth-field">
              <label htmlFor="auth-new-password">New Password</label>
              <div className="auth-input-wrap">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  id="auth-new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Choose a new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
            </div>
          )}

          {mode === "login" ? (
            <div className="auth-options">
              <label className="auth-remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span>Remember me</span>
              </label>
              <button
                className="auth-link"
                type="button"
                onClick={() => { clearError(); setMode("reset"); }}
              >
                Forgot Password?
              </button>
            </div>
          ) : null}

          {(error || ssoError) && <div className="auth-error" role="alert">{error || ssoError}</div>}
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : mode === "login" ? "Login" : "Reset Password"}
          </button>
          {mode === "login" && ssoProviders.length > 0 && (
            <>
              <div style={{ textAlign: "center", color: "#98A2B3", fontSize: 12, margin: "14px 0 10px" }}>or</div>
              <div style={{ display: "grid", gap: 10 }}>
                {ssoProviders.includes("google") && (
                  <a className="auth-submit" href={`${API_BASE_URL}/auth/google/login`}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#fff", color: "#344054", border: "1px solid #D0D5DD", textDecoration: "none", boxShadow: "none" }}>
                    <GoogleIcon />
                    Continue with Google
                  </a>
                )}
                {ssoProviders.includes("microsoft") && (
                  <a className="auth-submit" href={`${API_BASE_URL}/auth/microsoft/login`}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#fff", color: "#344054", border: "1px solid #D0D5DD", textDecoration: "none", boxShadow: "none" }}>
                    <MicrosoftIcon />
                    Continue with Microsoft
                  </a>
                )}
              </div>
            </>
          )}
        </form>

        {mode === "reset" && (
          <button className="auth-back" type="button" onClick={() => { clearError(); setMode("login"); }}>
            <ArrowLeft size={16} aria-hidden="true" /> Back to sign in
          </button>
        )}

        <footer className="auth-footer">© 2026 ITSM Inc. All rights reserved.</footer>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94a11.05 11.05 0 0 1-4.8 7.24l7.73 5.99c4.51-4.17 7.11-10.31 7.11-17.7Z" />
      <path fill="#FBBC05" d="M10.53 28.59a14.39 14.39 0 0 1 0-9.18l-7.98-6.19a23.95 23.95 0 0 0 0 21.56l7.98-6.19Z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.76l-7.73-5.99c-2.14 1.44-4.89 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  );
}
