import React, { useMemo, useState } from "react";
import { Link } from "../router";
import { useAsync } from "../hooks";
import { ErrorBar, PageHeader, formatDateTime } from "../components/configKit";
import { isPendingApproval, loadApprovalHub, type ApprovalModule } from "../approvalHub";
import { useAuth } from "../AuthContext";

const MODULES: ApprovalModule[] = ["Incident", "Service Request", "Change"];

export function MyApprovalsPage() {
  const { user } = useAuth();
  const endUser = user?.role === "END_USER";
  const query = useAsync(() => loadApprovalHub(endUser), [endUser]);
  const [module, setModule] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const items = query.data?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) =>
      (!module || item.module === module) &&
      (!status || (status === "Pending" ? isPendingApproval(item) : !isPendingApproval(item))) &&
      (!q || `${item.reference} ${item.title} ${item.description} ${item.requestedBy}`.toLowerCase().includes(q))
    );
  }, [items, module, status, search]);
  const pendingCount = items.filter(isPendingApproval).length;

  return (
    <>
      <PageHeader crumb="Home > My Approvals" title="My Approvals" subtitle="Review approval requests across incidents, service requests, and changes." />
      <div className="page-body">
        <ErrorBar msg={query.error ?? ""} />
        {(query.data?.errors ?? []).map((error) => <ErrorBar key={error} msg={error} />)}
        <div className="approval-hub-summary">
          <strong>{pendingCount}</strong> pending approvals
          <span>{items.length} approvals found</span>
        </div>
        <div className="approval-hub-filters">
          <input className="input" type="search" aria-label="Search approvals" placeholder="Search reference, title, or requester…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="select" aria-label="Filter by module" value={module} onChange={(e) => setModule(e.target.value)}>
            <option value="">All modules</option>
            {MODULES.map((name) => <option key={name}>{name}</option>)}
          </select>
          <select className="select" aria-label="Filter by approval status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
        <div className="card admin-master-table-wrap">
          <div className="admin-master-table-scroll">
            <table className="approval-hub-table">
              <thead><tr><th>Approval request</th><th>Module</th><th>Requested by</th><th>Requested on</th><th>Status</th><th>Review</th></tr></thead>
              <tbody>
                {query.loading && !query.data ? <tr><td colSpan={6} className="empty-state">Loading approvals…</td></tr>
                  : filtered.length === 0 ? <tr><td colSpan={6} className="empty-state">{query.data?.errors.length === 3 ? "Approval data could not be loaded." : "No approvals match these filters."}</td></tr>
                  : filtered.map((item) => (
                    <tr key={item.id}>
                      <td><Link className="inc-link" to={item.href}>{item.reference} — {item.title}</Link><div className="approval-hub-description">{item.description}</div></td>
                      <td><span className={`approval-module ${item.module.toLowerCase().replace(" ", "-")}`}>{item.module}</span></td>
                      <td>{item.requestedBy}</td>
                      <td>{formatDateTime(item.requestedAt)}</td>
                      <td><span className={`approval-pill ${isPendingApproval(item) ? "pending" : item.status.toLowerCase()}`}>{item.status}</span></td>
                      <td><Link className="btn-ghost btn-sm" to={item.href}>Open</Link></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
