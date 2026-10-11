import React from "react";
import {
  AlertCircle, Clipboard, GitBranch, Inbox, Layers, ListChecks, ThumbsUp, Wrench, type LucideIcon,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { dashboardApi, type AnalystDashboardStats } from "../dashboardApi";
import { useAsync } from "../hooks";
import { Link } from "../router";
import { workOrderApi, type WorkOrderRow } from "../configApi";

function StatCard({
  icon: Icon,
  label,
  total,
  rows,
  to,
}: {
  icon: LucideIcon;
  label: string;
  total: number | string;
  rows: { label: string; value: number | string; tone?: "positive" | "warning" | "danger" }[];
  to?: string;
}) {
  const card = (
    <div className={`analyst-stat-card ${to ? "clickable" : ""}`}>
      <div className="analyst-stat-heading"><Icon aria-hidden="true" size={16} /><span>{label}</span></div>
      <div className="analyst-stat-total">{total}</div>
      <div className="analyst-stat-details">
        {rows.map((row) => (
          <div className="analyst-stat-detail" key={row.label}>
            <span>{row.label}</span>
            <strong className={row.tone ? `tone-${row.tone}` : ""}>{row.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
  return to ? <Link className="analyst-stat-link" to={to}>{card}</Link> : card;
}

function TicketList({
  title,
  to,
  items,
}: {
  title: string;
  to?: string;
  items: AnalystDashboardStats["myOpenIncidents"];
}) {
  return (
    <section className="analyst-panel">
      <div className="analyst-panel-heading">
        <h2>{title}</h2>
        {to && <Link to={to}>View All</Link>}
      </div>
      {items.length === 0 ? (
        <div className="analyst-empty">Nothing here right now.</div>
      ) : (
        <div className="analyst-ticket-list">
          {items.map((item) => (
            <div className="analyst-ticket" key={item.id}>
              <div className="analyst-ticket-copy">
                <strong>{item.id}</strong>
                <span>{item.summary}</span>
                <small>{item.assignmentGroup} · Updated {item.updatedAgo}</small>
              </div>
              <div className="analyst-ticket-meta">
                <span className={`analyst-priority priority-${item.priority.toLowerCase()}`}>{item.priority}</span>
                <span>{item.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DistributionPanel({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <section className="analyst-panel">
      <div className="analyst-panel-heading"><h2>{title}</h2></div>
      {rows.length === 0 ? (
        <div className="analyst-empty">No data yet.</div>
      ) : (
        <div className="analyst-distribution">
          {rows.map((row) => (
            <div className="analyst-distribution-row" key={row.label}>
              <span title={row.label}>{row.label}</span>
              <div className="analyst-bar"><div style={{ width: `${(row.count / max) * 100}%` }} /></div>
              <strong>{row.count}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const WO_CLOSED = ["Completed", "Cancelled"];

function WorkOrderPanel({ items }: { items: WorkOrderRow[] }) {
  return (
    <section className="analyst-panel">
      <div className="analyst-panel-heading">
        <h2>My Open Work Orders</h2>
        <Link to="/work-orders">View All</Link>
      </div>
      {items.length === 0 ? (
        <div className="analyst-empty">Nothing here right now.</div>
      ) : (
        <div className="analyst-ticket-list">
          {items.slice(0, 8).map((w) => (
            <Link className="analyst-ticket" key={w.workOrderId} to={`/work-orders?open=${w.workOrderId}`} style={{ color: "inherit", textDecoration: "none" }}>
              <div className="analyst-ticket-copy">
                <strong>{w.woNumber}</strong>
                <span>{w.title}</span>
                <small>{w.workgroup}{w.incidentRef ? ` · Incident ${w.incidentRef}` : ""}</small>
              </div>
              <div className="analyst-ticket-meta">
                <span className="analyst-priority">{w.priority.slice(0, 2)}</span>
                <span>{w.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export function ResolverDashboardPage() {
  const { user } = useAuth();
  const { data, loading, error } = useAsync(() => dashboardApi.analyst(), []);
  const woQ = useAsync(() => workOrderApi.list().catch(() => [] as WorkOrderRow[]), []);
  const openWos = (woQ.data ?? []).filter((w) => w.isActive && !WO_CLOSED.includes(w.status));
  const myWos = openWos.filter((w) => String(w.assignedToId ?? "") === user?.id);
  const stats = data;
  const value = (count: number | undefined) => loading ? "–" : count ?? 0;
  const incidentTotal = (stats?.incidents.totalInWorkgroups ?? stats?.incidents.total ?? 0) + (stats?.incidents.mineOpen ?? 0);

  return (
    <div className="analyst-dashboard">
      <header className="analyst-dashboard-header">
        <div className="breadcrumb">Analyst Workspace <span>›</span> Analyst Dashboard</div>
        <h1>Analyst Dashboard</h1>
        <p>Welcome back{user?.name ? `, ${user.name}` : ""} — your work items and key metrics.</p>
      </header>

      {error && <div className="analyst-dashboard-error" role="alert">{error}</div>}

      <div className="analyst-stats-grid">
        <StatCard icon={AlertCircle} label="Incidents" total={value(incidentTotal)} to="/incidents" rows={[
          { label: "My Workgroup Total", value: value(stats?.incidents.totalInWorkgroups ?? stats?.incidents.total) },
          { label: "Assigned to Me", value: value(stats?.incidents.mineOpen) },
          { label: "Resolved in Workgroups", value: value(stats?.incidents.totalResolvedInAllWorkgroups), tone: "positive" },
        ]} />
        <StatCard icon={Clipboard} label="Service Requests" total={value(stats?.serviceRequests.total)} rows={[
          { label: "Open", value: value(stats?.serviceRequests.open) },
          { label: "In Progress", value: value(stats?.serviceRequests.inProgress) },
          { label: "Completed Today", value: value(stats?.serviceRequests.completedToday), tone: "positive" },
        ]} />
        <StatCard icon={Layers} label="Problems" total={value(stats?.problems.total)} rows={[
          { label: "Open", value: value(stats?.problems.open) },
          { label: "In Progress", value: value(stats?.problems.inProgress) },
        ]} />
        <StatCard icon={GitBranch} label="Changes" total={value(stats?.changes.total)} rows={[
          { label: "Open", value: value(stats?.changes.open) },
          { label: "In Progress", value: value(stats?.changes.inProgress) },
        ]} />
        <StatCard icon={ListChecks} label="Tasks" total={value(stats?.tasks.total)} rows={[
          { label: "Open", value: value(stats?.tasks.open) },
          { label: "Overdue", value: value(stats?.tasks.overdue), tone: (stats?.tasks.overdue ?? 0) > 0 ? "danger" : undefined },
        ]} />
        <StatCard icon={Wrench} label="Work Orders" total={woQ.loading ? "–" : openWos.length} to="/work-orders" rows={[
          { label: "Assigned to Me", value: woQ.loading ? "–" : myWos.length },
          { label: "In Progress", value: woQ.loading ? "–" : openWos.filter((w) => w.status === "In Progress").length },
        ]} />
        <StatCard icon={ThumbsUp} label="Approvals" total={value(stats?.approvals.total)} to="/approvals" rows={[
          { label: "Pending", value: value(stats?.approvals.pending), tone: "warning" },
          { label: "Approved", value: value(stats?.approvals.approved) },
        ]} />
      </div>

      <div className="analyst-overview-grid">
        <section className="analyst-panel analyst-sla-panel">
          <div className="analyst-panel-heading"><h2>SLA Performance</h2></div>
          <div className="analyst-sla-percent">{loading ? "–" : `${stats?.sla.metPercent ?? 0}%`}</div>
          <div className="analyst-sla-caption">Met</div>
          <div className="analyst-sla-track">
            <div style={{ width: `${Math.max(0, Math.min(100, stats?.sla.metPercent ?? 0))}%` }} />
          </div>
          <div className="analyst-sla-details">
            <div><strong className="tone-positive">{value(stats?.sla.met)}</strong><span>Met</span></div>
            <div><strong className="tone-danger">{value(stats?.sla.breached)}</strong><span>Breached</span></div>
            <div><strong className="tone-warning">{value(stats?.sla.atRisk)}</strong><span>At Risk</span></div>
          </div>
        </section>

        <DistributionPanel title="Work Items by Type" rows={(stats?.byType ?? []).map((row) => ({ label: row.type, count: row.count }))} />
        <DistributionPanel title="Incidents by Status" rows={(stats?.byStatus ?? []).map((row) => ({ label: row.status, count: row.count }))} />
      </div>

      <section className="analyst-panel analyst-groups-panel">
        <div className="analyst-panel-heading">
          <h2><Inbox aria-hidden="true" size={16} /> Unassigned Tickets by Group</h2>
          <Link to="/incident-queue">View Queue</Link>
        </div>
        {(stats?.unassignedByGroup ?? []).length === 0 ? (
          <div className="analyst-empty">Every group queue is clear. Nice work.</div>
        ) : (
          <div className="analyst-groups-grid">
            {stats?.unassignedByGroup.map((group) => (
              <Link to="/incident-queue" className="analyst-group-card" key={group.groupId}>
                <span>{group.groupName}</span>
                <strong>{group.incidentCount + group.requestCount}</strong>
                <small>unassigned tickets</small>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="analyst-ticket-grid">
        <TicketList title="My Open Incidents" to="/incident-queue" items={stats?.myOpenIncidents ?? []} />
        <TicketList title="My Open Service Requests" items={stats?.myOpenRequests ?? []} />
      </div>

      <div className="analyst-ticket-grid">
        <WorkOrderPanel items={myWos} />
      </div>
    </div>
  );
}
