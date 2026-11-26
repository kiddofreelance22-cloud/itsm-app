import React from "react";
import { ClipboardList, FileText, Plus, Star } from "lucide-react";
import { useAuth } from "../AuthContext";
import { dashboardApi } from "../dashboardApi";
import { useAsync } from "../hooks";
import { Link } from "../router";
import { Badge, Card, Crumb, QuickLinks, StatStrip, formatDate, stars, userPriorityMeta, userStatusMeta } from "../components/dashboardKit";
import { serviceRequestApi } from "../requestsApi";
import { StatusPill, requestNo, useRequestStatuses } from "../components/serviceRequestKit";

export function UserDashboardPage() {
  const { user } = useAuth();
  const { data, loading, error } = useAsync(() => dashboardApi.endUser(), []);
  const firstName = user?.name ?? "";

  // The person's own service requests, shown next to their incidents.
  const requests = useAsync(() => serviceRequestApi.mine(), []);
  const statusRows = useRequestStatuses();
  const stageOf = (name: string) => statusRows.find((x) => x.statusName === name)?.stage ?? "";
  const myRequests = requests.data ?? [];
  const openRequests = myRequests.filter((r) => ["approval", "queue", "work", "hold"].includes(stageOf(r.status)));
  const toConfirm = myRequests.filter((r) => stageOf(r.status) === "done");
  const reqLoading = requests.loading;

  return (
    <div className="dash-page">
      <div className="dash-header">
        <Crumb group="User" page="My Dashboard" />
        <div className="dash-head-row">
          <div>
            <div className="dash-title">Welcome back, {firstName}</div>
            <div className="dash-sub">Here&apos;s what&apos;s happening with the incidents and service requests you&apos;ve raised.</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link to="/service-requests" className="dash-btn"><Plus size={13} strokeWidth={2.2} />Request a Service</Link>
            <Link to="/new-incident" className="dash-btn"><Plus size={13} strokeWidth={2.2} />Report New Incident</Link>
          </div>
        </div>
      </div>

      {error && <div className="dash-error">{error}</div>}

      <StatStrip
        items={[
          { value: loading ? "–" : data?.stats.total ?? 0, label: "Total Reported" },
          { value: loading ? "–" : data?.stats.open ?? 0, label: "Open Incidents", color: "#175CD3" },
          { value: loading ? "–" : data?.stats.resolved ?? 0, label: "Resolved", color: "#067647" },
          { value: reqLoading ? "–" : myRequests.length, label: "Service Requests" },
          { value: reqLoading ? "–" : openRequests.length, label: "Open Requests", color: "#175CD3" },
          { value: loading || reqLoading ? "–" : (data?.stats.needsFeedback ?? 0) + toConfirm.length, label: "Needs Your Feedback", color: "#B54708" },
        ]}
      />

      <div className="dash-body">
        <div className="dash-col wide">
          <Card
            title={`My Open Tickets (${data?.openTickets.length ?? 0})`}
            icon={<FileText size={13} color="#1D2433" />}
            link={{ to: "/my-incidents", label: "View All My Incidents →" }}
          >
            <div className="dash-scroll">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>Number</th>
                    <th>Short Description</th>
                    <th style={{ width: 90 }}>Priority</th>
                    <th style={{ width: 110 }}>Status</th>
                    <th style={{ width: 140 }}>Assigned Workgroup</th>
                    <th style={{ width: 100 }}>Reported</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.openTickets ?? []).map((r) => (
                    <tr key={r.incidentId}>
                      <td><Link to={`/my-incidents/${r.incidentId}`} className="num">{r.id}</Link></td>
                      <td>{r.shortDescription}</td>
                      <td><Badge meta={userPriorityMeta(r.priority)} /></td>
                      <td><Badge meta={userStatusMeta(r.status)} /></td>
                      <td>{r.assignedWorkgroup}</td>
                      <td>{formatDate(r.reported)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && !data?.openTickets.length && <div className="dash-empty">No open tickets right now — nice and quiet.</div>}
            </div>
            <div className="dash-footer-block">
              <div className="dash-eyebrow">Recently Closed</div>
              {(data?.recentlyClosed ?? []).map((r) => (
                <div className="dash-closed-row" key={r.incidentId}>
                  <div><span style={{ fontWeight: 700 }}>{r.id}</span> — {r.shortDescription}</div>
                  <div className="dash-stars">{stars(r.rating)}</div>
                </div>
              ))}
              {!loading && !data?.recentlyClosed.length && <div style={{ fontSize: 12, color: "#98A2B3" }}>Nothing closed yet.</div>}
            </div>
          </Card>

          <Card
            title={`My Open Service Requests (${openRequests.length})`}
            icon={<ClipboardList size={13} color="#1D2433" />}
            link={{ to: "/service-requests/my-requests", label: "View All My Service Requests →" }}
          >
            <div className="dash-scroll">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>Number</th>
                    <th>Item</th>
                    <th style={{ width: 150 }}>Status</th>
                    <th style={{ width: 140 }}>Assigned Workgroup</th>
                    <th style={{ width: 100 }}>Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {openRequests.map((r) => (
                    <tr key={r.requestId}>
                      <td><Link to={`/service-requests/my-requests/${r.requestId}`} className="num">{requestNo(r)}</Link></td>
                      <td>{r.catalog?.catalogName ?? "—"}</td>
                      <td><StatusPill status={r.status} subStatus={r.subStatus} /></td>
                      <td>{r.assignmentGroup?.groupName ?? r.catalog?.fulfillmentGroup?.groupName ?? r.catalog?.assignmentGroup?.groupName ?? "—"}</td>
                      <td>{formatDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!reqLoading && !openRequests.length && <div className="dash-empty">No open service requests right now.</div>}
              {requests.error && <div className="dash-empty">Service requests could not be loaded.</div>}
            </div>
          </Card>
        </div>

        <div className="dash-col narrow">
          <Card title="Needs Your Feedback" icon={<Star size={13} color="#B54708" />} style={{ flex: "1 1 auto" }}>
            <div className="dash-scroll">
              {(data?.needsFeedback ?? []).map((r) => (
                <div className="dash-item" key={r.incidentId}>
                  <div className="dash-item-title">{r.id} — {r.shortDescription}</div>
                  <div className="dash-item-meta">Resolved {formatDate(r.resolvedAt ?? r.reported)}</div>
                  <Link to={`/my-incidents/${r.incidentId}`} className="dash-item-link">Close &amp; Rate →</Link>
                </div>
              ))}
              {toConfirm.map((r) => (
                <div className="dash-item" key={`sr-${r.requestId}`}>
                  <div className="dash-item-title">{requestNo(r)} — {r.catalog?.catalogName ?? "Service request"}</div>
                  <div className="dash-item-meta">Fulfilled {formatDate(r.fulfilledAt ?? r.updatedAt)}</div>
                  <Link to={`/service-requests/my-requests/${r.requestId}`} className="dash-item-link">Confirm &amp; Close →</Link>
                </div>
              ))}
              {!loading && !reqLoading && !data?.needsFeedback.length && !toConfirm.length && (
                <div className="dash-empty left">You&apos;re all caught up — nothing waiting on your feedback.</div>
              )}
            </div>
          </Card>
          <QuickLinks
            links={[
              { to: "/new-incident", label: "Report New Incident", icon: <Plus size={13} color="#344054" /> },
              { to: "/my-incidents", label: "My Incidents", icon: <FileText size={13} color="#344054" /> },
              { to: "/service-requests", label: "Request a Service", icon: <Plus size={13} color="#344054" /> },
              { to: "/service-requests/my-requests", label: "My Service Requests", icon: <ClipboardList size={13} color="#344054" /> },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
