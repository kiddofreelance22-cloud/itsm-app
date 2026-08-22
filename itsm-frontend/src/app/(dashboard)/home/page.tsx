"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, FilePlus2, ClipboardList, BookOpen, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { QuickActionCard } from "@/components/dashboard/quick-action-card";
import { AnnouncementsPanel } from "@/components/dashboard/announcements-panel";
import { KnowledgeBasePanel } from "@/components/dashboard/knowledge-base-panel";
import { QuickLinks } from "@/components/dashboard/quick-links";
import { Pagination } from "@/components/ui/pagination";

import { useAuth } from "@/lib/hooks/use-auth";
import { useIncidents } from "@/lib/hooks/use-incidents";
import { PageSpinner } from "@/components/ui/spinner";
import { AnalystDashboard } from "@/components/dashboard/analyst-dashboard";

const PAGE_SIZE = 5;

export default function HomePage() {
  const router = useRouter();
  const { user, isAnalyst } = useAuth();
  const { incidents, isLoading } = useIncidents("mine");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(incidents.length / PAGE_SIZE);
  const pageItems = useMemo(
    () => incidents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [page, incidents]
  );

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/incidents?q=${encodeURIComponent(query.trim())}`);
  }

  // Everyone sees the requester-oriented home page by default.

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold text-slate-900">
        Hi, {user?.fullName ?? "there"}! <span aria-hidden="true">👋</span>
      </h1>
      <p className="mt-1 text-sm text-slate-500">How can we help you today?</p>

      <form onSubmit={handleSearch} className="mt-6">
        <Input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search incidents, knowledge base articles..." leadingIcon={<Search />}
          aria-label="Search" className="h-12" />
      </form>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <QuickActionCard href="/incidents/create" icon={FilePlus2} title="Create Incident" description="Report an issue" iconBgClass="bg-blue-600" />
        <QuickActionCard href="/incidents" icon={ClipboardList} title="My Incidents" description="View your incidents" iconBgClass="bg-amber-500" />
        <QuickActionCard href="/knowledge-base" icon={BookOpen} title="Knowledge Base" description="Find helpful articles" iconBgClass="bg-green-600" />
        <QuickActionCard href="/service-requests" icon={ShoppingCart} title="Service Request" description="Raise a request" iconBgClass="bg-purple-500" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Incidents</CardTitle>
              <Link href="/incidents" className="text-sm font-medium text-blue-600 hover:underline">View all</Link>
            </CardHeader>
            {isLoading ? (
              <PageSpinner />
            ) : incidents.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-slate-400">No incidents yet.</p>
            ) : (
              <>
                <div className="divide-y">
                  {pageItems.map((inc) => (
                    <Link key={inc.incidentId} href={`/incidents/${inc.incidentId}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-slate-800 truncate max-w-xs">{inc.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{inc.category?.categoryName ?? "—"}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        inc.status === "Open" ? "bg-red-100 text-red-700" :
                        inc.status === "In Progress" ? "bg-yellow-100 text-yellow-700" :
                        "bg-green-100 text-green-700"}`}>
                        {inc.status}
                      </span>
                    </Link>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
                  <p className="text-sm text-slate-500">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, incidents.length)} of {incidents.length}
                  </p>
                  <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
              </>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <AnnouncementsPanel announcements={[]} />
          <KnowledgeBasePanel articles={[]} />
        </div>
      </div>

      <div className="mt-6"><QuickLinks /></div>
    </div>
  );
}
