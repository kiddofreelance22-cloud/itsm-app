"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "../AuthContext";
import { RouterProvider } from "../router";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RouterProvider>{children}</RouterProvider>
    </AuthProvider>
  );
}