"use client";

import { LayoutGrid } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { RequestTable } from "@/components/requests/request-table";
import { useRequests } from "@/lib/hooks/use-requests";
import Link from "next/link";

export default function MyRequestsPage() {
  const { requests, isLoading } = useRequests("mine");

  return (
    <div className="mx-auto max-w-5xl">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "My Requests" }]} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="size-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">My Requests</h1>
        </div>
        <Link href="/service-requests"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          New Request
        </Link>
      </div>
      <p className="mt-1 mb-6 text-sm text-slate-500">Track all your submitted service requests.</p>
      <RequestTable requests={requests} isLoading={isLoading} />
    </div>
  );
}
