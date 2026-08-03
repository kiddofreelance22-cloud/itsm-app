"use client";

import { useState, type FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Headphones, Mail, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthApi } from "@/lib/api/auth.api";
import { setSession, getStoredUser } from "@/lib/api/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showTemp, setShowTemp] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Pre-fill email if user is already partially authenticated
  useEffect(() => {
    const stored = getStoredUser<{ email: string }>();
    if (stored?.email) setEmail(stored.email);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await AuthApi.resetTempPassword(email, tempPassword, newPassword);
      setSession(res.accessToken, res.user, true);
      setSuccess(true);
      // Redirect after a brief success animation
      setTimeout(() => {
        const destination = res.user.roles.some((role) => ["Admin", "Administrator"].includes(role))
          ? "/admin/users"
          : "/home";
        router.push(destination);
      }, 1200);
    } catch (err: unknown) {
      setError(
        (err instanceof Error ? err.message : String(err)) ??
          "Failed to reset password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 px-4 py-10">
      {/* Decorative dots */}
      <div className="pointer-events-none absolute right-8 top-8 grid grid-cols-5 gap-2 opacity-50" aria-hidden="true">
        {Array.from({ length: 20 }).map((_, i) => (
          <span key={i} className="size-1.5 rounded-full bg-indigo-400" />
        ))}
      </div>

      {/* Decorative wave */}
      <svg
        className="pointer-events-none absolute bottom-0 left-0 w-full opacity-30"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          fill="rgb(129,140,248)"
          d="M0,192L80,181.3C160,171,320,149,480,154.7C640,160,800,192,960,197.3C1120,203,1280,181,1360,170.7L1440,160L1440,320L0,320Z"
        />
      </svg>

      <div className="relative z-10 w-full max-w-md">
        {/* Glow card */}
        <div className="rounded-2xl bg-white/80 p-8 shadow-2xl ring-1 ring-indigo-100 backdrop-blur-sm sm:p-10">
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <div
              className={`mb-4 flex size-16 items-center justify-center rounded-full transition-all duration-500 ${
                success
                  ? "bg-green-100"
                  : "bg-gradient-to-br from-indigo-500 to-purple-600"
              }`}
            >
              {success ? (
                <ShieldCheck className="size-8 text-green-600" />
              ) : (
                <Headphones className="size-8 text-white" />
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              {success ? "Password Updated!" : "Set Your Password"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {success
                ? "Redirecting you to your dashboard…"
                : "You received a temporary password. Please set a new permanent password to continue."}
            </p>
          </div>

          {!success && (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="rp-email">Email address</Label>
                <Input
                  id="rp-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  leadingIcon={<Mail />}
                />
              </div>

              {/* Temporary password */}
              <div className="space-y-1.5">
                <Label htmlFor="rp-temp">Temporary Password</Label>
                <Input
                  id="rp-temp"
                  type={showTemp ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="From your welcome email"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  required
                  leadingIcon={<Lock />}
                  trailingIcon={
                    <button
                      type="button"
                      onClick={() => setShowTemp((s) => !s)}
                      className="pointer-events-auto rounded p-0.5 text-slate-400 hover:text-slate-600"
                    >
                      {showTemp ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                />
              </div>

              {/* Divider */}
              <div className="relative flex items-center py-1">
                <div className="flex-1 border-t border-slate-100" />
                <span className="mx-3 text-xs text-slate-400">New credentials</span>
                <div className="flex-1 border-t border-slate-100" />
              </div>

              {/* New password */}
              <div className="space-y-1.5">
                <Label htmlFor="rp-new">New Password</Label>
                <Input
                  id="rp-new"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  leadingIcon={<Lock />}
                  trailingIcon={
                    <button
                      type="button"
                      onClick={() => setShowNew((s) => !s)}
                      className="pointer-events-auto rounded p-0.5 text-slate-400 hover:text-slate-600"
                    >
                      {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                />
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="rp-confirm">Confirm New Password</Label>
                <Input
                  id="rp-confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  leadingIcon={<Lock />}
                  trailingIcon={
                    <button
                      type="button"
                      onClick={() => setShowConfirm((s) => !s)}
                      className="pointer-events-auto rounded p-0.5 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                />
              </div>

              {/* Password strength hint */}
              {newPassword.length > 0 && (
                <ul className="space-y-1 text-xs">
                  <li className={newPassword.length >= 6 ? "text-green-600" : "text-slate-400"}>
                    {newPassword.length >= 6 ? "✓" : "○"} At least 6 characters
                  </li>
                  <li className={/[A-Z]/.test(newPassword) ? "text-green-600" : "text-slate-400"}>
                    {/[A-Z]/.test(newPassword) ? "✓" : "○"} One uppercase letter
                  </li>
                  <li className={/[0-9]/.test(newPassword) ? "text-green-600" : "text-slate-400"}>
                    {/[0-9]/.test(newPassword) ? "✓" : "○"} One number
                  </li>
                </ul>
              )}

              {/* Error */}
              {error && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700"
                disabled={loading}
              >
                {loading ? "Updating password…" : "Set New Password"}
              </Button>

              <p className="text-center text-xs text-slate-400">
                Already changed your password?{" "}
                <a href="/login" className="font-medium text-indigo-600 hover:underline">
                  Sign in
                </a>
              </p>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-400">
          © 2026 ITSM Inc. All rights reserved.
        </p>
      </div>
    </div>
  );
}
