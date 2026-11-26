"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuthApi } from "@/lib/api/auth.api";
import { useAuth } from "@/lib/hooks/use-auth";

export default function SsoCallbackPage() {
  const { completeLogin } = useAuth();
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

    AuthApi.exchangeSsoCode(code)
      .then((response) => {
        completeLogin(response);
      })
      .catch(() => {
        setError("We couldn't complete your sign-in. Please return to login and try again.");
      });
  }, [completeLogin]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
        {error ? (
          <>
            <h1 className="text-xl font-bold text-slate-900">Sign-in unsuccessful</h1>
            <p role="alert" className="mt-3 text-sm text-slate-600">{error}</p>
            <Link
              href="/login"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Back to login
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto size-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <h1 className="mt-5 text-xl font-bold text-slate-900">Signing you in</h1>
            <p className="mt-2 text-sm text-slate-600">Please wait while we finish verifying your account.</p>
          </>
        )}
      </section>
    </main>
  );
}