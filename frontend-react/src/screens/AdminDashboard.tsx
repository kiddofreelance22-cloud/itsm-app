import React from "react";
import { FileText, Users, FilePlus2, Settings, PackageOpen } from "lucide-react";
import { dashboardApi } from "../dashboardApi";
import { useAsync } from "../hooks";
import { Link } from "../router";
import { Badge, Card, Crumb, QuickLinks, StatStrip, priorityMeta, statusMeta } from "../components/dashboardKit";

const STATUS_COLORS: Record<string, string> = {
  Open: "#98A2B3", Assigned: "#0BA5EC", "In Progress": "#175CD3",
  "On Hold": "#F79009", Resolved: "#12B76A", Closed: "#667085",
};
const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#B42318", High: "#D92D20", Medium: "#F79009", Low: "#175CD3",
};

function Bars({ rows, colors }: { rows: { label: string; count: number }[]; colors?: Record<string, string> }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div style={{ padding: "8px 0" }}>
      {rows.map((r) => (
        <div className="dash-bar-row" key={r.label}>
          <div className="dash-bar-label" title={r.label}>{r.label}</div>
          <div className="dash-bar-track">
            <div className="dash-bar-fill" style={{ width: `${(r.count / max) * 100}%`, background: colors?.[r.label] ?? "#175CD3" }} />
          </div>
          <div className="dash-bar-val">{r.count}</div>
        </div>
      ))}
      {!rows.length && <div className="dash-empty">No data yet.</div>}
    </div>
  );
}

function Trend({ data }: { data: { day: string; created: number; resolved: number }[] }) {
  const W = 560, H = 150, pad = 24;
  const max = Math.max(1, ...data.flatMap((d) => [d.created, d.resolved]));
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, data.length - 1);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = (key: "created" | "resolved") => data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d[key])}`).join(" ");
  return (
    <div className="dash-trend">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Incidents created vs resolved, last 7 days">
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={pad} x2={W - pad} y1={y(max * t)} y2={y(max * t)} stroke="#EDEFF2" />
        ))}
        <path d={line("created")} fill="none" stroke="#175CD3" strokeWidth={2} />
        <path d={line("resolved")} fill="none" stroke="#12B76A" strokeWidth={2} />
        {data.map((d, i) => (
          <text key={d.day} x={x(i)} y={H - 6} fontSize={10} textAnchor="middle" fill="#98A2B3">{d.day.slice(5)}</text>
        ))}
      </svg>
    </div>
  );
}

export function AdminDashboardPage() {
  const { data, loading, error } = useAsync(() => dashboardApi.admin(), []);
  const s = data?.stats;
  const v = (n?: number | string | null) => (loading ? "–" : n ?? 0);

  return (
    <div className="dash-page">
      <div className="dash-header">
        <Crumb group="Administration" page="Admin Dashboard" />
        <div className="dash-head-row">
          <div>
            <div className="dash-title">Admin Dashboard</div>
            <div className="dash-sub">System-wide incident health, workload and SLA performance.</div>
          </div>
          <div className="dash-actions">
            <Link to="/admin/catalogs" className="dash-btn secondary"><PackageOpen size={13} />Manage Service Catalog</Link>
            <Link to="/config/admin/users/create" className="dash-btn secondary"><Users size={13} />Create New User</Link>
            <Link to="/new-incident" className="dash-btn"><FilePlus2 size={13} />New Incident for User</Link>
          </div>
        </div>
      </div>

      {error && <div className="dash-error">{error}</div>}

      <StatStrip
        items={[
          { value: v(s?.totalIncidents), label: "Total Incidents" },
          { value: v(s?.openIncidents), label: "Open", color: "#175CD3" },
          { value: v(s?.unassignedIncidents), label: "Unassigned", color: "#B42318" },
          { value: v(s?.resolvedToday), label: "Resolved Today", color: "#067647" },
          { value: loading ? "–" : `${s?.slaCompliance ?? 100}%`, label: "SLA Compliance", color: "#067647" },
          { value: v(s?.slaBreached), label: "SLA Breached", color: "#B54708" },
        ]}
      />

      <div className="dash-body">
        <div className="dash-col wide">
          <Card
            title="Incidents — last 7 days"
            icon={<FileText size={13} color="#1D2433" />}
          >
            <div style={{ padding: "10px 18px 0" }}>
              <div className="dash-legend">
                <span><i style={{ background: "#175CD3" }} />Created</span>
                <span><i style={{ background: "#12B76A" }} />Resolved</span>
              </div>
            </div>
            <Trend data={data?.trend ?? []} />
          </Card>

          <Card title="Recent Incidents" link={{ to: "/incidents", label: "View Incident List →" }}>
            <div className="dash-scroll">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>Number</th>
                    <th>Short Description</th>
                    <th style={{ width: 110 }}>Priority</th>
                    <th style={{ width: 120 }}>Status</th>
                    <th style={{ width: 140 }}>Workgroup</th>
                    <th style={{ width: 130 }}>Assigned To</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recent ?? []).map((r) => (
                    <tr key={r.incidentId}>
                      <td><Link to={`/incidents/${r.incidentId}`} className="num">{r.id}</Link></td>
                      <td>{r.shortDescription}</td>
                      <td><Badge meta={priorityMeta(r.priority)} /></td>
                      <td><Badge meta={statusMeta(r.status)} /></td>
                      <td>{r.assignmentGroup}</td>
                      <td>{r.assignedTo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && !data?.recent.length && <div className="dash-empty">No incidents yet.</div>}
            </div>
          </Card>
        </div>

        <div className="dash-col narrow">
          <Card title="By Status">
            <Bars rows={(data?.byStatus ?? []).map((r) => ({ label: r.status, count: r.count }))} colors={STATUS_COLORS} />
          </Card>
          <Card title="Open by Priority">
            <Bars rows={(data?.byPriority ?? []).map((r) => ({ label: r.priority, count: r.count }))} colors={PRIORITY_COLORS} />
          </Card>
          <Card title="Open by Workgroup">
            <Bars rows={(data?.byGroup ?? []).map((r) => ({ label: r.groupName, count: r.count }))} />
          </Card>
          <Card title="Platform">
            <div className="dash-item">
              <div className="dash-item-title">{v(s?.activeUsers)} active of {v(s?.totalUsers)} users</div>
              <div className="dash-item-meta">{v(s?.totalGroups)} assignment groups</div>
            </div>
            <div className="dash-item">
              <div className="dash-item-title">
                {s?.avgRating != null ? `${s.avgRating} / 5 average rating` : "No ratings yet"}
              </div>
              <div className="dash-item-meta">{s?.ratingCount ?? 0} feedback responses</div>
            </div>
          </Card>
          <QuickLinks
            links={[
              { to: "/incidents", label: "Incident List", icon: <FileText size={13} color="#344054" /> },
              { to: "/admin/catalogs", label: "Manage Service Catalog", icon: <PackageOpen size={13} color="#344054" /> },
              { to: "/config/admin/users", label: "Users", icon: <Users size={13} color="#344054" /> },
              { to: "/config/admin/categories", label: "Configuration", icon: <Settings size={13} color="#344054" /> },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
