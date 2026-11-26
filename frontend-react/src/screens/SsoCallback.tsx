"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../AuthContext";
import { useRouter } from "../router";

export function SsoCallbackPage() {
  const { ssoLogin } = useAuth();
  const { navigate } = useRouter();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = new URLSearchParams(window.location.search).get("code");
    window.history.replaceState({}, "", window.location.pathname);
    if (!code) {
      setError("This sign-in link is missing its code. Please try signing in again.");
      return;
    }

    ssoLogin(code)
      .then(() => navigate("/"))
      .catch(() => {
        setError("We couldn't complete your sign-in. Please return to login and try again.");
      });
  }, [navigate, ssoLogin]);

  return (
    <main className="auth-page">
      <section className="auth-card" style={{ textAlign: "center" }}>
        {error ? (
          <>
            <h1 className="auth-form-title" style={{ marginTop: 0 }}>Sign-in unsuccessful</h1>
            <p className="auth-error" role="alert">{error}</p>
            <a className="auth-submit" href="/login" style={{ display: "grid", placeItems: "center", marginTop: 20 }}>
              Back to login
            </a>
          </>
        ) : (
          <>
            <div className="spinner-row">Loading…</div>
            <h1 className="auth-form-title" style={{ marginBottom: 8 }}>Signing you in</h1>
            <p>Please wait while we finish verifying your account.</p>
          </>
        )}
      </section>
    </main>
  );
}
