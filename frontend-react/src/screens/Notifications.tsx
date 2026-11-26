import React from "react";
import { Bell } from "lucide-react";
import { useAuth } from "../AuthContext";
import { isPendingApproval, loadApprovalHub } from "../approvalHub";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, formatDateTime } from "../components/configKit";
import { Link } from "../router";

export function NotificationsPage() {
  const { user } = useAuth();
  const q = useAsync(() => loadApprovalHub(user?.role === "END_USER"), [user?.role]);
  const items = (q.data?.items ?? []).filter(isPendingApproval);
  return (
    <>
      <PageHeader crumb="Home > Notifications" title="Notifications" subtitle="Approval requests that need your attention." />
      <div className="page-body">
        <ErrorBar msg={q.error ?? ""} />
        {(q.data?.errors ?? []).map((error) => <ErrorBar key={error} msg={error} />)}
        <section className="card notification-list">
          <div className="notification-list-heading"><h2><Bell size={17} /> Pending approvals</h2><Link to="/approvals">View all approvals</Link></div>
          {q.loading && !q.data ? <div className="empty-state">Loading notifications…</div>
            : items.length === 0 ? <div className="empty-state">You’re all caught up.</div>
            : items.map((item) => (
              <Link className="notification-list-item" key={item.id} to={item.href}>
                <span className="notification-dot" aria-hidden="true" />
                <span className="notification-list-copy"><strong>{item.module} approval: {item.reference}</strong><span>{item.title}{item.requestedBy ? ` · Requested by ${item.requestedBy}` : ""}</span><small>{formatDateTime(item.requestedAt)}</small></span>
              </Link>
            ))}
        </section>
      </div>
    </>
  );
}
