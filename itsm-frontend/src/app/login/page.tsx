"use client";

import { useState, type FormEvent } from "react";
import { Headphones, User, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/hooks/use-auth";

export default function LoginPage() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

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
        <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">© 2026 ITSM Inc. All rights reserved.</div>
      </div>
    </div>
  );
}
