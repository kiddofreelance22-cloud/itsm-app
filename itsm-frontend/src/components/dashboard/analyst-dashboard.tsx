"use client";

import Link from "next/link";
import {
  AlertCircle,
  Clipboard,
  Layers,
  GitBranch,
  ListChecks,
  ThumbsUp,
  Inbox,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageSpinner } from "@/components/ui/spinner";
import { useAnalystDashboard } from "@/lib/hooks/use-dashboard";
import { useAuth } from "@/lib/hooks/use-auth";

function priorityColor(p: string) {
  return p === "Critical" ? "bg-red-100 text-red-700"
    : p === "High" ? "bg-orange-100 text-orange-700"
    : p === "Medium" ? "bg-yellow-100 text-yellow-700"
    : "bg-slate-100 text-slate-600";
}

function StatCard({
  icon: Icon,
  label,
  total,
  rows,
  href,
}: {
  icon: React.ElementType;
  label: string;
  total: number;
  rows: { label: string; value: number; tone?: string }[];
  href?: string;
}) {
  const content = (
    <Card className={`p-4 ${href ? "transition-colors hover:border-brand-200 hover:bg-brand-50/30" : ""}`}>
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        <Icon className="size-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{total}</p>
      <div className="mt-3 space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-xs">
            <span className="text-slate-500">{r.label}</span>
            <span className={`font-medium ${r.tone ?? "text-slate-700"}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
  return href ? <Link href={href} className="block">{content}</Link> : content;
}

function TicketList({
  title,
  href,
  items,
}: {
  title: string;
  href: string;
  items: { id: string; summary: string; priority: string; status: string }[];
}) {
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <Link href={href} className="text-xs font-medium text-brand-600 hover:underline">View All</Link>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">Nothing here right now.</p>
      ) : (
        <div className="divide-y">
          {items.map((i) => (
            <Link key={i.id} href={`/incidents/${i.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{i.id}</p>
                <p className="truncate text-xs text-slate-400">{i.summary}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${priorityColor(i.priority)}`}>
                {i.priority}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

export function AnalystDashboard() {
  const { user, isAdmin } = useAuth();
  const { stats, isLoading } = useAnalystDashboard();

  if (isLoading || !stats) return <PageSpinner />;

  return (
    <div className="w-full">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {isAdmin ? "Operations Dashboard" : "Analyst Dashboard"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome back{user?.fullName ? `, ${user.fullName}` : ""} — overview of {isAdmin ? "system-wide" : "your"} work items and key metrics.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={AlertCircle} label="Incidents" href="/incidents/queue" total={stats.incidents.open ?? 0} rows={[
          { label: "Open", value: stats.incidents.open ?? 0 },
          { label: "In Progress", value: stats.incidents.inProgress ?? 0 },
          { label: "Resolved Today", value: stats.incidents.resolvedToday ?? 0, tone: "text-emerald-600" },
        ]} />
        <StatCard icon={Clipboard} label="Service Requests" href="/service-requests/my-requests" total={stats.serviceRequests.total} rows={[
          { label: "Open", value: stats.serviceRequests.open },
          { label: "In Progress", value: stats.serviceRequests.inProgress },
          { label: "Completed Today", value: stats.serviceRequests.completedToday ?? 0, tone: "text-emerald-600" },
        ]} />
        <StatCard icon={Layers} label="Problems" total={stats.problems.total} rows={[
          { label: "Open", value: stats.problems.open },
          { label: "In Progress", value: stats.problems.inProgress },
        ]} />
        <StatCard icon={GitBranch} label="Changes" total={stats.changes.total} rows={[
          { label: "Open", value: stats.changes.open },
          { label: "In Progress", value: stats.changes.inProgress },
        ]} />
        <StatCard icon={ListChecks} label="Tasks" total={stats.tasks.total} rows={[
          { label: "Open", value: stats.tasks.open },
          { label: "Overdue", value: stats.tasks.overdue, tone: stats.tasks.overdue > 0 ? "text-red-600" : undefined },
        ]} />
        <StatCard icon={ThumbsUp} label="Approvals" href="/approvals" total={stats.approvals.total} rows={[
          { label: "Pending", value: stats.approvals.pending, tone: "text-amber-600" },
          { label: "Approved", value: stats.approvals.approved },
        ]} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-1">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">SLA Performance</h3>
          <p className="text-3xl font-bold text-slate-900">{stats.sla.metPercent}%</p>
          <p className="mb-3 text-xs text-slate-400">Met</p>
          <Progress value={stats.sla.metPercent} />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div><p className="font-semibold text-emerald-600">{stats.sla.met}</p><p className="text-slate-400">Met</p></div>
            <div><p className="font-semibold text-red-600">{stats.sla.breached}</p><p className="text-slate-400">Breached</p></div>
            <div><p className="font-semibold text-amber-600">{stats.sla.atRisk}</p><p className="text-slate-400">At Risk</p></div>
          </div>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Inbox className="size-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800">Unassigned Tickets by Group</h3>
          </div>
          {stats.unassignedByGroup.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Every group queue is clear. Nice work.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.unassignedByGroup.map((g) => (
                <Link
                  key={g.groupId}
                  href="/incidents/queue"
                  className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 hover:bg-amber-50"
                >
                  <p className="text-xs font-medium text-slate-600">{g.groupName}</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{g.incidentCount}</p>
                  <p className="text-[11px] text-slate-400">incidents</p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TicketList title="My Open Incidents" href="/incidents/queue" items={stats.myOpenIncidents} />
        <TicketList title="My Open Service Requests" href="/service-requests/my-requests" items={stats.myOpenRequests} />
      </div>
    </div>
  );
}
