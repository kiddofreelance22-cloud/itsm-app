import React, { useEffect, useState } from "react";
import { incidentApi } from "../incidentApi";
import { useAuth } from "../AuthContext";
import { PRIORITY_META, STATUS_META, formatDate } from "../fieldMeta";
import { useAsync } from "../hooks";
import { Link } from "../router";
import type { Incident } from "../types";
import { ApiError } from "../api";

type QueueTab = "mine" | number;

export function IncidentQueuePage() {
  const { user } = useAuth();
  const groupsQ = useAsync(() => incidentApi.myWorkgroups(), [user?.id]);
  const myGroups = groupsQ.data ?? [];
  const myIncidentsQ = useAsync(() => incidentApi.assignedToMe(), [user?.id]);
  const [tab, setTab] = useState<QueueTab>("mine");
  const [queue, setQueue] = useState<Incident[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const activeGroupId = typeof tab === "number" ? tab : null;

  useEffect(() => {
    if (activeGroupId === null) {
      setQueue([]);
      setQueueError("");
      return;
    }
    let cancelled = false;
    setQueueLoading(true);
    setQueueError("");
    incidentApi.groupQueue(activeGroupId)
      .then((items) => { if (!cancelled) setQueue(items); })
      .catch((error: unknown) => {
        if (!cancelled) setQueueError(error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Unable to load this group queue.");
      })
      .finally(() => { if (!cancelled) setQueueLoading(false); });
    return () => { cancelled = true; };
  }, [activeGroupId]);

  const claim = async (incidentId: string) => {
    setBusyId(incidentId);
    setQueueError("");
    try {
      await incidentApi.claimIncident(incidentId);
      setQueue((items) => items.filter((item) => item.id !== incidentId));
      myIncidentsQ.reload();
    } catch (error: unknown) {
      setQueueError(error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Unable to claim this incident.");
    } finally {
      setBusyId(null);
    }
  };

  const incidents = tab === "mine" ? myIncidentsQ.data ?? [] : queue;
  const listLoading = tab === "mine" ? myIncidentsQ.loading : queueLoading;
  const listError = tab === "mine" ? myIncidentsQ.error : queueError;
  const activeGroup = typeof tab === "number" ? myGroups.find((group) => group.groupId === tab) : null;

  return (
    <>
      <div className="page-header-row">
        <div className="page-header-left">
          <div className="breadcrumb">Analyst Workspace &gt; Incident Queue</div>
          <div className="page-title">Incident Queue</div>
          <div className="page-subtitle">Pick up unassigned incidents from your workgroups or continue working on incidents assigned to you.</div>
        </div>
      </div>
      <div className="page-body">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, borderBottom: "1px solid #E4E7EC" }}>
          <button type="button" className={tab === "mine" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("mine")}>
            Assigned to Me{myIncidentsQ.data ? ` (${myIncidentsQ.data.length})` : ""}
          </button>
          {myGroups.map((group) => (
            <button type="button" key={group.groupId} className={tab === group.groupId ? "btn-primary" : "btn-ghost"} onClick={() => setTab(group.groupId)}>
              {group.groupName}
            </button>
          ))}
          {!groupsQ.loading && myGroups.length === 0 && <span style={{ padding: "8px 0", color: "#667085", fontSize: 13 }}>You are not a member of any active assignment group.</span>}
          {groupsQ.error && <span role="alert" className="error-text">{groupsQ.error}</span>}
        </div>
        {listLoading ? (
          <div className="spinner-row">Loading…</div>
        ) : listError ? (
          <div className="error-text" role="alert">{listError}</div>
        ) : incidents.length === 0 ? (
          <div className="empty-state">{tab === "mine" ? "You have no active incidents assigned to you." : `No unclaimed incidents in ${activeGroup?.groupName ?? "this group"} right now.`}</div>
        ) : (
          <div className="card" style={{ overflowX: "auto" }}>
            <table style={{ minWidth: typeof tab === "number" ? 1080 : 1000 }}>
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Incident Number</th>
                  <th>Short Description</th>
                  <th style={{ width: 140 }}>Category</th>
                  <th style={{ width: 100 }}>Priority</th>
                  <th style={{ width: 120 }}>Status</th>
                  <th style={{ width: 160 }}>Assigned Workgroup</th>
                  <th style={{ width: 120 }}>Created Date</th>
                  {typeof tab === "number" && <th style={{ width: 100 }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => {
                  const pm = inc.priority ? PRIORITY_META[inc.priority] : null;
                  const sm = STATUS_META[inc.status];
                  return (
                    <tr key={inc.id}>
                      <td><Link to={`/incidents/${inc.id}?source=queue`} style={{ fontWeight: 700 }}>{inc.number}</Link></td>
                      <td>{inc.shortDescription}</td>
                      <td>{inc.category ?? "—"}</td>
                      <td>{pm && <span className="badge" style={{ background: pm.bg, color: pm.color }}><span className="dot" style={{ background: pm.dot }} />{pm.label}</span>}</td>
                      <td><span className="badge" style={{ background: sm.bg, color: sm.color }}><span className="dot" style={{ background: sm.dot }} />{sm.label}</span></td>
                      <td>{inc.assignedWorkgroup ?? "—"}</td>
                      <td>{formatDate(inc.createdAt)}</td>
                      {typeof tab === "number" && (
                        <td><button type="button" className="btn-primary" disabled={busyId === inc.id} onClick={() => void claim(inc.id)}>{busyId === inc.id ? "Claiming…" : "Claim"}</button></td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
