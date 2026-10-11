"use client";

import { useMemo, useState, Suspense, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Search, Plus, RotateCcw, CalendarDays } from "lucide-react";
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
import { IncidentsApi, Incident } from "@/lib/api/incidents.api";
import { apiFetch } from "@/lib/api/client";
import { CategoriesApi } from "@/lib/api/categories.api";
import { AssignmentGroupApi } from "@/lib/api/admin-modules.api";
import { Status, Priority, Category } from "@/types/admin";
import { AssignmentGroup } from "@/lib/api/incidents.api";

const PAGE_SIZE = 10;

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
  const pathname = usePathname();
  const href = pathname.startsWith("/admin/incident")
    ? `/admin/incident/${inc.incidentId}`
    : `/incidents/${inc.incidentId}`;
  return (
    <Link href={href}
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
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin, isAnalyst } = useAuth();
  const isAdminList = pathname.startsWith("/admin/incident");
  const { incidents, isLoading: isIncidentsLoading } = useIncidents((isAdmin || isAnalyst) ? "all" : "mine");
  const [adminIncidents, setAdminIncidents] = useState<Incident[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  // Filters are seeded from (and kept in sync with) the URL so that leaving
  // this page — e.g. opening an incident, then returning via the breadcrumb
  // or the browser back button — restores exactly the same filtered/paginated
  // view instead of resetting to defaults.
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "All");
  const [priority, setPriority] = useState(searchParams.get("priority") ?? "All");
  const [assignmentGroup, setAssignmentGroup] = useState(searchParams.get("group") ?? "All");
  const [category, setCategory] = useState(searchParams.get("category") ?? "All");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("to") ?? "");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1) || 1);

  useEffect(() => {
    if (!isAdminList) return;
    const loadAdminIncidents = async () => {
      setAdminLoading(true);
      try {
        setAdminIncidents(await IncidentsApi.listAdmin({
          search: query,
          status: status === "All" ? undefined : status,
          priority: priority === "All" ? undefined : priority,
          assignmentGroupId: assignmentGroup === "All" ? undefined : assignmentGroup,
          categoryId: category === "All" ? undefined : category,
          createdFrom: dateFrom || undefined,
          createdTo: dateTo || undefined,
        }));
      } finally {
        setAdminLoading(false);
      }
    };
    void loadAdminIncidents();
  }, [isAdminList, query, status, priority, assignmentGroup, category, dateFrom, dateTo]);

  // Skip the very first sync so we don't rewrite the URL (and blow away
  // scroll position/history) before the user has touched anything.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status !== "All") params.set("status", status);
    if (priority !== "All") params.set("priority", priority);
    if (assignmentGroup !== "All") params.set("group", assignmentGroup);
    if (category !== "All") params.set("category", category);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (page !== 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status, priority, assignmentGroup, category, dateFrom, dateTo, page]);
  const [statusOptions, setStatusOptions] = useState<Status[]>([]);
  const [priorityOptions, setPriorityOptions] = useState<Priority[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<Category[]>([]);
  const [assignmentGroupOptions, setAssignmentGroupOptions] = useState<AssignmentGroup[]>([]);

  // Pull from the same admin-configured Status / Priority lists used when
  // creating an incident, so anything added there shows up here too.
  useEffect(() => {
    void Promise.allSettled([
      apiFetch<Status[]>("/status"),
      apiFetch<Priority[]>("/priority"),
      CategoriesApi.list(),
      AssignmentGroupApi.list(),
    ]).then(([statuses, priorities, categories, groups]) => {
      if (statuses.status === "fulfilled") {
        setStatusOptions(statuses.value.filter((x) => x.isActive && x.type === "incident"));
      }
      if (priorities.status === "fulfilled") {
        setPriorityOptions(priorities.value.filter((x) => x.isActive));
      }
      if (categories.status === "fulfilled") {
        setCategoryOptions(categories.value.filter((x) => x.isActive));
      }
      if (groups.status === "fulfilled") {
        setAssignmentGroupOptions(groups.value.filter((x) => x.isActive));
      }
    });
  }, []);

  const filtered = useMemo(() => {
    const source = isAdminList ? adminIncidents : incidents;
    return source.filter((inc) => {
      const q = query.toLowerCase();
      const matchQ = !q || inc.title.toLowerCase().includes(q) || String(inc.incidentId).toLowerCase().includes(q)
        || inc.category?.categoryName.toLowerCase().includes(q)
        || inc.assignmentGroup?.groupName.toLowerCase().includes(q);
      const matchS = status === "All" || inc.status === status;
      const matchP = priority === "All" || inc.priority === priority;
      const matchG = assignmentGroup === "All" || String(inc.assignmentGroup?.groupId) === assignmentGroup;
      const matchC = category === "All" || String(inc.category?.categoryId) === category;
      const createdAt = new Date(inc.createdAt);
      const matchFrom = !dateFrom || createdAt >= new Date(`${dateFrom}T00:00:00`);
      const matchTo = !dateTo || createdAt <= new Date(`${dateTo}T23:59:59.999`);
      return matchQ && matchS && matchP && matchG && matchC && matchFrom && matchTo;
    });
  }, [adminIncidents, incidents, isAdminList, query, status, priority, assignmentGroup, category, dateFrom, dateTo]);

  const activeFilterCount = [status, priority, assignmentGroup, category, dateFrom, dateTo]
    .filter((value) => value && value !== "All").length;

  function resetFilters() {
    setQuery("");
    setStatus("All");
    setPriority("All");
    setAssignmentGroup("All");
    setCategory("All");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="w-full">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: (isAdminList || isAdmin || isAnalyst) ? "All Incidents" : "My Incidents" }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{(isAdminList || isAdmin || isAnalyst) ? "All Incidents" : "My Incidents"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {(isAdminList || isAdmin || isAnalyst) ? "All incidents across the system, regardless of status." : "View and track all your raised incidents."}
          </p>
        </div>
        <Button asChild className="gap-1.5">
          <Link href="/incidents/create"><Plus className="size-4" /> New Incident</Link>
        </Button>
      </div>

      <Card className="mt-6 p-4">
        <div className="grid gap-3 xl:grid-cols-[1.2fr_repeat(4,minmax(145px,1fr))_auto]">
          <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search in list..." leadingIcon={<Search />} aria-label="Search incidents" />
          <Select aria-label="Filter by assignment group" value={assignmentGroup}
            onChange={(e) => { setAssignmentGroup(e.target.value); setPage(1); }}>
            <option value="All">All Assignment Groups</option>
            {assignmentGroupOptions.map((group) => <option key={group.groupId} value={group.groupId}>{group.groupName}</option>)}
          </Select>
          <Select aria-label="Filter by category" value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
            <option value="All">All Categories</option>
            {categoryOptions.map((item) => <option key={item.categoryId} value={item.categoryId}>{item.categoryName}</option>)}
          </Select>
          <Select aria-label="Filter by priority" value={priority}
            onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
            <option value="All">All Priorities</option>
            {priorityOptions.map((item) => <option key={item.priorityId} value={item.priorityName}>{item.priorityName}</option>)}
          </Select>
          <Select aria-label="Filter by status" value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="All">All Status</option>
            {statusOptions.map((item) => <option key={item.statusId} value={item.statusName}>{item.statusName}</option>)}
          </Select>
          <Button type="button" variant="outline" onClick={resetFilters} title="Reset filters" className="gap-1.5">
            <RotateCcw /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          <span className="text-xs font-medium text-slate-500">Created between</span>
          <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            aria-label="Created from date" className="w-auto min-w-40" leadingIcon={<CalendarDays />} />
          <span className="text-xs text-slate-400">and</span>
          <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            aria-label="Created to date" className="w-auto min-w-40" leadingIcon={<CalendarDays />} />
        </div>
      </Card>

      <Card className="mt-4">
        {adminLoading || (!isAdminList && isIncidentsLoading) ? <PageSpinner /> : (
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
