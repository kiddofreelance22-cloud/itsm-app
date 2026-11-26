import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Link } from "../router";
import { useAuth } from "../AuthContext";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, SearchBox, TH, errMsg, formatDateTime } from "../components/configKit";
import { requestLifecycleApi, serviceRequestApi } from "../requestsApi";
import { PriorityBadge, SlaBadge, StatusPill, requestNo, useRequestStatuses } from "../components/serviceRequestKit";

const PAGE_SIZE = 25;

/** Service Request List: the fulfilment queue for agents and admins. */
export function ServiceRequestQueuePage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const urlAssignee = searchParams?.get("assignee") ?? "";
  const urlGroupId = searchParams?.get("groupId") ?? "";
  const urlStatus = searchParams?.get("status") ?? "";

  const [status, setStatus] = useState(() => urlStatus || "All");
  const [assignee, setAssignee] = useState(() => (["me", "unassigned"].includes(urlAssignee) ? urlAssignee : ""));
  const [groupId, setGroupId] = useState(() => (/^\d+$/.test(urlGroupId) ? urlGroupId : ""));

  useEffect(() => {
    if (urlAssignee && ["me", "unassigned"].includes(urlAssignee)) setAssignee(urlAssignee);
    if (urlGroupId && /^\d+$/.test(urlGroupId)) setGroupId(urlGroupId);
    if (urlStatus) setStatus(urlStatus);
  }, [urlAssignee, urlGroupId, urlStatus]);

  const [claiming, setClaiming] = useState<number | null>(null);
  const [claimErr, setClaimErr] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [breached, setBreached] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const statusRows = useRequestStatuses().filter((x) => x.isSystem).sort((a, b) => a.displayOrder - b.displayOrder);
  const groups = useAsync(() => serviceRequestApi.assignmentGroups(), []);
  const priorities = useAsync(() => serviceRequestApi.priorities(), []);
  const list = useAsync(() => requestLifecycleApi.queue({
    status: status === "All" ? undefined : status, assignee: assignee || undefined,
    groupId: groupId ? Number(groupId) : undefined, priorityId: priorityId ? Number(priorityId) : undefined,
    sla: breached ? "breached" : undefined, q: query.trim() || undefined, page, pageSize: PAGE_SIZE,
  }), [status, assignee, groupId, priorityId, breached, query, page]);

  const data = list.data;
  const counts = data?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const claim = async (id: number) => {
    setClaimErr(""); setClaiming(id);
    try { await requestLifecycleApi.start(id); list.reload(); } catch (e) { setClaimErr(errMsg(e, "Unable to claim this request.")); } finally { setClaiming(null); }
  };

  return (
    <>
      <PageHeader crumb="Manage Service Requests > Service Request List" title="Service Request List" subtitle="Every service request across the organisation. Open one to assign it and work its fulfilment tasks." />
      <div className="page-body">
        <ErrorBar msg={claimErr || (list.error ?? "")} />
        <div className="card admin-master-table-wrap">
          <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <SearchBox value={query} onChange={reset(setQuery)} placeholder="Search by SR number, service, requester…" />
            {user?.role === "ADMIN" && <Link to="/admin/create-service-request" className="btn-primary"><Plus size={14} aria-hidden="true" /> New request for user</Link>}
          </div>
          <div className="sr-chips">
            <button type="button" className={`sr-chip${status === "All" && assignee !== "me" ? " active" : ""}`} onClick={() => { setStatus("All"); setAssignee(""); setPage(1); }}>All<span className="n">{total}</span></button>
            <button type="button" className={`sr-chip${assignee === "me" ? " active" : ""}`} onClick={() => { setStatus("All"); setAssignee(assignee === "me" ? "" : "me"); setPage(1); }}>Assigned to me<span className="n">{data?.mine ?? 0}</span></button>
            {statusRows.map((st) => (
              <button key={st.requestStatusId} type="button" className={`sr-chip${status === st.statusName ? " active" : ""}`} onClick={() => reset(setStatus)(st.statusName)}>
                {st.statusName}<span className="n">{counts[st.statusName] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="sr-toolbar">
            <select className="select" value={assignee} onChange={(e) => reset(setAssignee)(e.target.value)} aria-label="Assignee">
              <option value="">Anyone</option><option value="me">Assigned to me ({data?.mine ?? 0})</option><option value="unassigned">Unassigned</option>
            </select>
            <select className="select" value={groupId} onChange={(e) => reset(setGroupId)(e.target.value)} aria-label="Assignment group">
              <option value="">{user?.role === "ADMIN" ? "Organization-wide" : "My workgroups"}</option>{(groups.data ?? []).map((g) => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}
            </select>
            <select className="select" value={priorityId} onChange={(e) => reset(setPriorityId)(e.target.value)} aria-label="Priority">
              <option value="">All priorities</option>{(priorities.data ?? []).map((p) => <option key={p.priorityId} value={p.priorityId}>{p.priorityName}</option>)}
            </select>
            <label className="admin-master-check-label"><input type="checkbox" checked={breached} onChange={(e) => reset(setBreached)(e.target.checked)} /> SLA breached</label>
          </div>
          {list.loading && !data ? <div className="spinner-row">Loading…</div> : !data || data.items.length === 0 ? (
            <div className="empty-state">No service requests match your filters.</div>
          ) : (
            <div style={{ padding: "0 20px 8px", overflowX: "auto" }}>
              <table>
                <thead><tr>
                  <th style={TH}>Number</th><th style={TH}>Service</th><th style={TH}>Requested by</th><th style={TH}>Priority</th>
                  <th style={TH}>Status</th><th style={TH}>Assignment group</th><th style={TH}>Assigned to</th><th style={TH}>Due</th><th style={TH}></th>
                </tr></thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.requestId}>
                      <td><Link to={`/service-requests/queue/${r.requestId}`} className="sr-row-link">{requestNo(r)}</Link></td>
                      <td style={{ fontSize: 13 }}>{r.catalog?.catalogName}<div style={{ fontSize: 12, color: "var(--muted)" }}>{r.catalog?.category?.categoryName}</div></td>
                      <td style={{ fontSize: 12.5 }}>{r.requestedBy?.fullName}<div style={{ fontSize: 12, color: "var(--muted)" }}>{formatDateTime(r.createdAt)}</div></td>
                      <td><PriorityBadge name={r.priority?.priorityName} color={r.priority?.color} /></td>
                      <td>
                        <StatusPill status={r.status} subStatus={r.subStatus} />
                        {r.status === "Pending Approval" && (() => {
                          const pending = (r.approvals ?? []).find((a) => a.status === "Pending");
                          const done = (r.approvals ?? []).filter((a) => a.status === "Approved").length;
                          const total = (r.approvals ?? []).length;
                          const stageLabel = pending?.title || r.currentStep?.stepName;
                          return (
                            <div style={{ fontSize: 11.5, color: "#B54708", marginTop: 4, fontWeight: 500, lineHeight: 1.3 }}>
                              {stageLabel ? (
                                <>
                                  <span>{stageLabel}</span>
                                  {total > 1 && <span style={{ color: "var(--muted)", marginLeft: 4 }}>({done}/{total})</span>}
                                </>
                              ) : total > 0 ? (
                                <span>{done} of {total} approved</span>
                              ) : (
                                <span>Awaiting review</span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ fontSize: 12.5 }}>{r.assignmentGroup?.groupName ?? <span style={{ color: "var(--muted)" }}>—</span>}</td>
                      <td style={{ fontSize: 12.5 }}>{r.assignedTo?.fullName ?? <span style={{ color: "var(--muted)" }}>Unassigned</span>}</td>
                      <td style={{ fontSize: 12.5 }}>{["Approved", "In Progress", "On Hold"].includes(r.status) && r.slaFulfilmentTarget ? formatDateTime(r.slaFulfilmentTarget) : "—"}
                        <div style={{ marginTop: 2 }}><SlaBadge state={r.sla?.state} /></div></td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {r.status === "Approved" && !r.assignedTo && <button type="button" className="btn-primary" disabled={claiming === r.requestId} onClick={() => void claim(r.requestId)}>{claiming === r.requestId ? "Claiming…" : "Claim"}</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="sr-pager">
            <span>{data ? `${data.total} request${data.total === 1 ? "" : "s"} · page ${page} of ${pages}` : ""}</span>
            <span style={{ display: "flex", gap: 8 }}>
              <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <button className="btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
