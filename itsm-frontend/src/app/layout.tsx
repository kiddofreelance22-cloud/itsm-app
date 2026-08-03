import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/hooks/use-auth";
import { ToastProvider } from "@/lib/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "ITSM | Incident Management System",
  description: "Incident Management System — raise, track, and resolve IT incidents.",
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          href={
            'data:image/svg+xml;utf8,' +
            encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#2563eb"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#fff">IT</text>
</svg>`)
          }
        />
      </head>
      <body className="antialiased">
        <ToastProvider>
          <AuthProvider>
            {children}
            <ToastContainer />
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
