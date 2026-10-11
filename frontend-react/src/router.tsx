// A small hash-based router — react-router isn't installable in this build
// environment (see README). Supports static routes and ":param" segments,
// which covers what this app needs (list pages + /incidents/:id).
"use client";

import React, { createContext, useContext, useMemo } from "react";
import NextLink from "next/link";
import { usePathname, useRouter as useNextRouter } from "next/navigation";

interface RouteMatch {
  path: string;
  params: Record<string, string>;
}

interface RouterState {
  path: string;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterState | undefined>(undefined);

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/";
  const nextRouter = useNextRouter();
  const navigate = (to: string) => nextRouter.push(to);

  return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterState {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used within RouterProvider");
  return ctx;
}

function matchPath(pattern: string, actual: string): RouteMatch | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const actualParts = actual.split("/").filter(Boolean);
  if (patternParts.length !== actualParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    const a = actualParts[i];
    if (p.startsWith(":")) {
      params[p.slice(1)] = decodeURIComponent(a);
    } else if (p !== a) {
      return null;
    }
  }
  return { path: pattern, params };
}

export function useRouteParams(pattern: string): Record<string, string> | null {
  const { path } = useRouter();
  return useMemo(() => matchPath(pattern, path)?.params ?? null, [path]);
}

export function Route({ path, children }: { path: string; children: React.ReactNode }) {
  const { path: current } = useRouter();
  const match = matchPath(path, current);
  return match ? <>{children}</> : null;
}

export function Link({ to, className, children, onClick, style }: {
  to: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <NextLink
      href={to}
      className={className}
      style={style}
      onClick={(e) => {
        onClick?.();
      }}
    >
      {children}
    </NextLink>
  );
}
