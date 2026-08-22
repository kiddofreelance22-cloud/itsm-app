"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Users, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageSpinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/hooks/use-auth";
import { useAdminAssignmentGroup } from "@/lib/hooks/use-admin-modules";
import { useIncidents, useGroupQueue } from "@/lib/hooks/use-incidents";
import { IncidentsApi, Incident } from "@/lib/api/incidents.api";
import { useToast } from "@/lib/hooks/use-toast";

function priorityColor(p: string) {
  return p === "Critical" ? "bg-red-100 text-red-700"
    : p === "High" ? "bg-orange-100 text-orange-700"
    : p === "Medium" ? "bg-yellow-100 text-yellow-700"
    : "bg-slate-100 text-slate-600";
}

function QueueRow({
  inc,
  actionLabel,
  onAction,
  actionLoading,
}: {
  inc: Incident;
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <Link href={`/incidents/${inc.incidentId}`} className="min-w-0 flex-1">
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
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs font-medium text-slate-500">{inc.status}</span>
        {actionLabel && (
          <Button size="sm" onClick={onAction} loading={actionLoading}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

function GroupQueuePanel({ groupId, groupName }: { groupId: number; groupName: string }) {
  const { incidents, isLoading, refetch } = useGroupQueue(groupId);
  const { toast } = useToast();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const handleClaim = async (id: string) => {
    setClaimingId(id);
    try {
      await IncidentsApi.claim(id);
      toast({ title: "Incident claimed", description: "It now appears in My Incidents.", variant: "success" });
      await refetch();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "error" });
    } finally {
      setClaimingId(null);
    }
  };

  if (isLoading) return <PageSpinner />;

  if (incidents.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-slate-400">
        No unclaimed incidents in {groupName} right now.
      </p>
    );
  }

  return (
    <div className="divide-y">
      {incidents.map((inc) => (
        <QueueRow
          key={inc.incidentId}
          inc={inc}
          actionLabel="Claim"
          actionLoading={claimingId === inc.incidentId}
          onAction={() => handleClaim(inc.incidentId)}
        />
      ))}
    </div>
  );
}

export default function IncidentQueuePage() {
  const { user } = useAuth();
  const { items: groups, isLoading: groupsLoading } = useAdminAssignmentGroup();
  const { incidents: myIncidents, isLoading: mineLoading } = useIncidents("assigned");

  const myGroups = useMemo(
    () => groups.filter((g) => g.isActive && g.members.some((m) => m.userId === user?.userId)),
    [groups, user?.userId]
  );

  const [tab, setTab] = useState<"mine" | number>("mine");
  const activeGroup = typeof tab === "number" ? myGroups.find((g) => g.groupId === tab) : null;

  const openMine = myIncidents.filter((i) => i.status !== "Resolved" && i.status !== "Closed");

  return (
    <div className="w-full">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "Incident Queue" }]} />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Incident Queue</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pick up incidents from your groups&apos; queues, or work the ones already assigned to you.
        </p>
      </div>

      {groupsLoading ? (
        <PageSpinner />
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200">
            <button
              onClick={() => setTab("mine")}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === "mine" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Inbox className="size-4" /> My Queue
              <Badge variant="gray">{openMine.length}</Badge>
            </button>
            {myGroups.map((g) => (
              <button
                key={g.groupId}
                onClick={() => setTab(g.groupId)}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  tab === g.groupId ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Users className="size-4" /> {g.groupName}
              </button>
            ))}
          </div>

          {myGroups.length === 0 && (
            <p className="mt-4 text-sm text-slate-400">
              You are not a member of any assignment group yet, so no group queue is available to you.
            </p>
          )}

          <Card className="mt-4">
            {tab === "mine" ? (
              mineLoading ? (
                <PageSpinner />
              ) : openMine.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-400">
                  You have no open incidents. Pick one up from a group queue above.
                </p>
              ) : (
                <div className="divide-y">
                  {openMine.map((inc) => (
                    <QueueRow key={inc.incidentId} inc={inc} />
                  ))}
                </div>
              )
            ) : activeGroup ? (
              <GroupQueuePanel groupId={activeGroup.groupId} groupName={activeGroup.groupName} />
            ) : null}
          </Card>
        </>
      )}
    </div>
  );
}
