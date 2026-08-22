"use client";

import { useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Plus } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageSpinner } from "@/components/ui/spinner";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { useRequests } from "@/lib/hooks/use-requests";
import { ServiceRequest, RequestStatus } from "@/types/request";

const PAGE_SIZE = 10;
const STATUS_OPTIONS: RequestStatus[] = ["Submitted", "In Progress", "Approved", "Rejected", "Closed"];

function requestNumber(id: number): string {
  return `REQ${String(id).padStart(8, "0")}`;
}

function RequestRow({ req }: { req: ServiceRequest }) {
  return (
    <Link href={`/service-requests/my-requests/${req.requestId}`}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50 transition-colors border-b last:border-0">
      <div className="min-w-0">
        <span className="text-xs font-mono text-slate-400">{requestNumber(req.requestId)}</span>
        <p className="text-sm font-medium text-slate-800 mt-0.5 truncate">{req.catalog?.catalogName ?? "—"}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {new Date(req.createdAt).toLocaleDateString()}
          {req.currentStep ? ` · ${req.currentStep.stepName}` : ""}
        </p>
      </div>
      <div className="shrink-0">
        <RequestStatusBadge status={req.status} />
      </div>
    </Link>
  );
}

function MyRequestsContent() {
  const searchParams = useSearchParams();
  const { requests, isLoading } = useRequests("mine");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const q = query.toLowerCase();
      const matchQ = !q
        || (r.catalog?.catalogName ?? "").toLowerCase().includes(q)
        || requestNumber(r.requestId).toLowerCase().includes(q);
      const matchS = status === "All" || r.status === status;
      return matchQ && matchS;
    });
  }, [requests, query, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="w-full">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "My Service Requests" }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Service Requests</h1>
          <p className="mt-1 text-sm text-slate-500">View and track all the requests you&apos;ve raised.</p>
        </div>
        <Button asChild className="gap-1.5">
          <Link href="/service-requests"><Plus className="size-4" /> New Request</Link>
        </Button>
      </div>

      <Card className="mt-6 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search by catalog item or request number..." leadingIcon={<Search />} />
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Status</span>
              <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-40">
                <option>All</option>
                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        {isLoading ? <PageSpinner /> : (
          <>
            {pageItems.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">No service requests found.</p>
            ) : (
              <div className="divide-y">{pageItems.map((r) => <RequestRow key={r.requestId} req={r} />)}</div>
            )}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row">
              <p className="text-sm text-slate-500">
                {filtered.length === 0 ? "No results" :
                  `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
              </p>
              <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export default function MyRequestsPage() {
  return <Suspense fallback={null}><MyRequestsContent /></Suspense>;
}
