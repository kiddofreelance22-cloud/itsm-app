"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageSpinner } from "@/components/ui/spinner";
import { useIncidents } from "@/lib/hooks/use-incidents";
import { Incident } from "@/lib/api/incidents.api";

function priorityColor(p: string) {
  return p === "Critical" ? "bg-red-100 text-red-700"
    : p === "High" ? "bg-orange-100 text-orange-700"
    : p === "Medium" ? "bg-yellow-100 text-yellow-700"
    : "bg-slate-100 text-slate-600";
}

function QueueRow({ inc }: { inc: Incident }) {
  return (
    <Link
      href={`/incidents/${inc.incidentId}`}
      className="flex flex-col gap-2 border-b border-slate-100 px-5 py-3 last:border-0 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-slate-400">#{inc.incidentId}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColor(inc.priority)}`}>
            {inc.priority}
          </span>
          {inc.assignmentGroup && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              {inc.assignmentGroup.groupName}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm font-medium text-slate-800">{inc.title}</p>
        <p className="mt-0.5 text-xs text-slate-400">
          {inc.category?.categoryName ?? "—"} · Raised by {inc.createdBy?.fullName ?? "—"} ·{" "}
          {new Date(inc.createdAt).toLocaleString()}
        </p>
      </div>
      <span className="shrink-0 text-xs font-medium text-slate-500">{inc.status}</span>
    </Link>
  );
}

export default function MyQueuePage() {
  const { incidents, isLoading } = useIncidents("assigned");
  const openIncidents = incidents.filter((i) => i.status !== "Resolved" && i.status !== "Closed");

  return (
    <div className="w-full">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "Assigned to Me" }]} />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Assigned to Me</h1>
        <p className="mt-1 text-sm text-slate-500">
          Incidents currently assigned to you.
        </p>
      </div>

      <Card className="mt-6 p-0">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <Inbox className="size-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800">My Assigned Incidents</h3>
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {openIncidents.length}
          </span>
        </div>

        {isLoading ? (
          <PageSpinner />
        ) : openIncidents.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            You have no incidents assigned to you right now.
          </p>
        ) : (
          <div className="divide-y">
            {openIncidents.map((inc) => (
              <QueueRow key={inc.incidentId} inc={inc} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
