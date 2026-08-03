"use client";

import { useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageSpinner } from "@/components/ui/spinner";
import { useIncidents } from "@/lib/hooks/use-incidents";
import { useAuth } from "@/lib/hooks/use-auth";
import { Incident } from "@/lib/api/incidents.api";

const PAGE_SIZE = 10;
const STATUS_OPTIONS = ["Open", "In Progress", "Resolved", "Closed"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"];

function priorityColor(p: string) {
  return p === "Critical" ? "bg-red-100 text-red-700"
    : p === "High" ? "bg-orange-100 text-orange-700"
    : p === "Medium" ? "bg-yellow-100 text-yellow-700"
    : "bg-slate-100 text-slate-600";
}
function statusColor(s: string) {
  return s === "Open" ? "bg-red-100 text-red-700"
    : s === "In Progress" ? "bg-yellow-100 text-yellow-700"
    : s === "Resolved" ? "bg-green-100 text-green-700"
    : "bg-slate-100 text-slate-500";
}

function IncidentRow({ inc }: { inc: Incident }) {
  return (
    <Link href={`/incidents/${inc.incidentId}`}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50 transition-colors border-b last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-slate-400">#{inc.incidentId}</span>
          <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${priorityColor(inc.priority)}`}>
            {inc.priority}
          </span>
        </div>
        <p className="text-sm font-medium text-slate-800 mt-0.5 truncate">{inc.title}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {inc.category?.categoryName ?? "—"} · {new Date(inc.createdAt).toLocaleDateString()}
        </p>
      </div>
      <span className={`shrink-0 text-xs rounded-full px-2.5 py-1 font-medium ${statusColor(inc.status)}`}>
        {inc.status}
      </span>
    </Link>
  );
}

function MyIncidentsContent() {
  const searchParams = useSearchParams();
  const { isAdmin } = useAuth();
  const { incidents, isLoading } = useIncidents(isAdmin ? "all" : "mine");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return incidents.filter((inc) => {
      const q = query.toLowerCase();
      const matchQ = !q || inc.title.toLowerCase().includes(q) || String(inc.incidentId).includes(q);
      const matchS = status === "All" || inc.status === status;
      const matchP = priority === "All" || inc.priority === priority;
      return matchQ && matchS && matchP;
    });
  }, [incidents, query, status, priority]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "My Incidents" }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Incidents</h1>
          <p className="mt-1 text-sm text-slate-500">View and track all your raised incidents.</p>
        </div>
        <Button asChild className="gap-1.5">
          <Link href="/incidents/create"><Plus className="size-4" /> New Incident</Link>
        </Button>
      </div>

      <Card className="mt-6 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search by title or ID..." leadingIcon={<Search />} />
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Status</span>
              <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-36">
                <option>All</option>
                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Priority</span>
              <Select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className="w-36">
                <option>All</option>
                {PRIORITY_OPTIONS.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        {isLoading ? <PageSpinner /> : (
          <>
            {pageItems.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">No incidents found.</p>
            ) : (
              <div className="divide-y">{pageItems.map((inc) => <IncidentRow key={inc.incidentId} inc={inc} />)}</div>
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

export default function MyIncidentsPage() {
  return <Suspense fallback={null}><MyIncidentsContent /></Suspense>;
}
