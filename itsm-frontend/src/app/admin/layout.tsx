"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { PageSpinner } from "@/components/ui/spinner";
import { AdminNavbar } from "@/components/layout/admin-navbar";
import { AdminSidebar } from "@/components/layout/admin-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && user && !isAdmin) {
      router.replace("/home");
    }
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, isAdmin, router]);

  if (isLoading || !user || !isAdmin) return <PageSpinner />;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <AdminNavbar onMenuClick={() => setMobileNavOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
        <main className="flex-1 w-full min-w-0 overflow-y-auto scrollbar-hide p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
