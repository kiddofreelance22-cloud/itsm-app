import React, { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Headphones, LockKeyhole, UserRound } from "lucide-react";
import { useAuth } from "../AuthContext";
import { useRouter } from "../router";
import { API_BASE_URL } from "../api";
import { incidentApi } from "../incidentApi";

export function LoginPage() {
  const { login, ssoLogin, resetTemporaryPassword, clearError, error } = useAuth();
  const { navigate } = useRouter();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ssoOn, setSsoOn] = useState(false);
  const [ssoError, setSsoError] = useState("");

  // Is Microsoft sign-in configured? And are we returning from Microsoft with a one-time code (or an error)?
  useEffect(() => {
    void incidentApi.ssoEnabled().then(setSsoOn);
    const q = new URLSearchParams(window.location.search);
    const code = q.get("sso_code"), err = q.get("sso_error");
    if (code || err) window.history.replaceState({}, "", window.location.pathname);   // never leave the code in the address bar
    if (err) setSsoError(err);
    if (code) {
      setSubmitting(true);
      ssoLogin(code).then(() => navigate("/")).catch(() => undefined).finally(() => setSubmitting(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          {mode === "login" && ssoOn && (
            <>
              <div style={{ textAlign: "center", color: "#98A2B3", fontSize: 12, margin: "14px 0 10px" }}>or</div>
              <a className="auth-submit" href={`${API_BASE_URL}/auth/sso/azure/start`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#fff", color: "#344054", border: "1px solid #D0D5DD", textDecoration: "none" }}>
                <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true"><rect x="1" y="1" width="10" height="10" fill="#F25022" /><rect x="12" y="1" width="10" height="10" fill="#7FBA00" /><rect x="1" y="12" width="10" height="10" fill="#00A4EF" /><rect x="12" y="12" width="10" height="10" fill="#FFB900" /></svg>
                Sign in with Microsoft
              </a>
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
