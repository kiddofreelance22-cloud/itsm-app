"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Sidebar } from "@/components/layout/sidebar";
import { CatalogSubSidebar } from "@/components/layout/catalog-sub-sidebar";

function DashboardSubSidebar() {
  const pathname = usePathname();
  // Show catalog sub-sidebar on the service-requests (catalog) pages
  if (pathname.startsWith("/service-requests")) return <CatalogSubSidebar />;
  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f7f8fa] flex flex-col">
      <Navbar onMenuClick={() => setMobileNavOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <DashboardSubSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto p-3 sm:px-5 sm:py-3">
          {children}
        </main>
      </div>
    </div>
  );
}
