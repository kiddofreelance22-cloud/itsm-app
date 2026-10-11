import React from "react";
import { FileText, Plus, Star } from "lucide-react";
import { useAuth } from "../AuthContext";
import { dashboardApi } from "../dashboardApi";
import { useAsync } from "../hooks";
import { Link } from "../router";
import { Badge, Card, Crumb, QuickLinks, StatStrip, formatDate, stars, userPriorityMeta, userStatusMeta } from "../components/dashboardKit";

export function UserDashboardPage() {
  const { user } = useAuth();
  const { data, loading, error } = useAsync(() => dashboardApi.endUser(), []);
  const firstName = user?.name ?? "";

  return (
    <div className="dash-page">
      <div className="dash-header">
        <Crumb group="User" page="My Dashboard" />
        <div className="dash-head-row">
          <div>
            <div className="dash-title">Welcome back, {firstName}</div>
            <div className="dash-sub">Here&apos;s what&apos;s happening with the incidents you&apos;ve reported.</div>
          </div>
          <Link to="/new-incident" className="dash-btn"><Plus size={13} strokeWidth={2.2} />Report New Incident</Link>
        </div>
      </div>

      {error && <div className="dash-error">{error}</div>}

      <StatStrip
        items={[
          { value: loading ? "–" : data?.stats.total ?? 0, label: "Total Reported" },
          { value: loading ? "–" : data?.stats.open ?? 0, label: "Open", color: "#175CD3" },
          { value: loading ? "–" : data?.stats.resolved ?? 0, label: "Resolved", color: "#067647" },
          { value: loading ? "–" : data?.stats.needsFeedback ?? 0, label: "Needs Your Feedback", color: "#B54708" },
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
              {!loading && !data?.needsFeedback.length && (
                <div className="dash-empty left">You&apos;re all caught up — nothing waiting on your feedback.</div>
              )}
            </div>
          </Card>
          <QuickLinks
            links={[
              { to: "/new-incident", label: "Report New Incident", icon: <Plus size={13} color="#344054" /> },
              { to: "/my-incidents", label: "My Incidents", icon: <FileText size={13} color="#344054" /> },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
