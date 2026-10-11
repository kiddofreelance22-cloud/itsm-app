import React, { useMemo, useState } from "react";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { Link, useRouteParams } from "../router";
import { useAuth } from "../AuthContext";
import { useAsync } from "../hooks";
import { ErrorBar, errMsg, formatDateTime } from "../components/configKit";
import { serviceRequestApi, type ServiceRequest } from "../requestsApi";

const STATUSES = ["Submitted", "Pending Approval", "In Progress", "Approved", "Rejected", "Closed"];
const PAGE_SIZE = 10;

function requestNumber(id: number): string {
  return `REQ${String(id).padStart(8, "0")}`;
}

export function ServiceRequestListPage({ admin = false }: { admin?: boolean }) {
  const { user } = useAuth();
  const pattern = admin ? "/admin/requests/:id" : "/service-requests/my-requests/:id";
  const params = useRouteParams(pattern);
  const requestId = params ? Number(params.id) : 0;
  const listQuery = useAsync(() => admin ? serviceRequestApi.all() : serviceRequestApi.mine(), [admin]);
  const detailQuery = useAsync(() => requestId ? serviceRequestApi.get(requestId) : Promise.resolve(null), [requestId]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState("");

  const requests = listQuery.data ?? [];
  const filtered = useMemo(() => requests.filter((request) => {
    const normalized = query.trim().toLowerCase();
    const requestNo = requestNumber(request.requestId).toLowerCase();
    const matchQuery = !normalized || requestNo.includes(normalized)
      || (request.catalog?.catalogName ?? "").toLowerCase().includes(normalized)
      || (request.requestedBy?.fullName ?? "").toLowerCase().includes(normalized);
    return matchQuery && (status === "All" || request.status === status);
  }), [query, requests, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const cancelRequest = async (id: number) => {
    const action = admin ? "Close" : "Cancel";
    if (!window.confirm(`${action} ${requestNumber(id)}? The request and its audit history will be retained.`)) return;
    setCancelling(true);
    setActionError("");
    try {
      await serviceRequestApi.cancel(id);
      await Promise.all([listQuery.reload(), detailQuery.reload()]);
    } catch (error) {
      setActionError(errMsg(error, "Unable to cancel this service request."));
    } finally {
      setCancelling(false);
    }
  };

  const detail = detailQuery.data;
  const backTo = admin ? "/admin/requests" : "/service-requests/my-requests";
  const heading = admin ? "Service Requests" : "My Service Requests";

  if (admin && user?.role !== "ADMIN") {
    return <div className="page-body"><ErrorBar msg="You don’t have permission to manage requests." /></div>;
  }

  if (requestId) {
    return (
      <div className="service-requests-page">
        <header className="page-header">
          <div className="page-header-left">
            <div className="breadcrumb"><Link to={backTo}>{heading}</Link> / Request details</div>
            <div className="page-title">{requestNumber(requestId)}</div>
            <div className="page-subtitle">{detail?.catalog?.catalogName ?? "Service request details"}</div>
          </div>
          <div className="service-request-header-actions">
            {admin && detail?.status === "Submitted" && <Link className="btn-ghost service-request-nav-button" to={`/admin/edit-service-request/${detail.requestId}`}>Edit request</Link>}
            {detail && ["Submitted", "Pending Approval", "In Progress"].includes(detail.status) && (
              <button className="btn-danger" type="button" disabled={cancelling} onClick={() => void cancelRequest(detail.requestId)}>
                {cancelling ? "Closing…" : admin ? "Delete / Close Request" : "Cancel Request"}
              </button>
            )}
          </div>
        </header>
        <div className="page-body service-requests-body">
          {actionError && <ErrorBar msg={actionError} />}
          {detailQuery.loading && <div className="spinner-row">Loading request…</div>}
          {detailQuery.error && <><ErrorBar msg={detailQuery.error} /><button className="btn-ghost" onClick={detailQuery.reload}>Retry</button></>}
          {!detailQuery.loading && !detailQuery.error && !detail && <div className="empty-state">This request could not be found.</div>}
          {detail && (
            <>
              <section className="card service-request-section">
                <div className="service-request-section-heading">
                  <div>
                    <h2>{detail.catalog?.catalogName ?? "Service request"}</h2>
                    <p>Submitted {formatDateTime(detail.createdAt)}</p>
                  </div>
                  <span className={`service-request-status ${detail.status.toLowerCase().replace(/\s+/g, "-")}`}>{detail.status}</span>
                </div>
                <dl className="service-request-details">
                  {admin && <div><dt>Requested by</dt><dd>{detail.requestedBy?.fullName || "—"}</dd></div>}
                  <div><dt>Request number</dt><dd>{requestNumber(detail.requestId)}</dd></div>
                  <div><dt>Current step</dt><dd>{detail.currentStep?.stepName || "—"}</dd></div>
                  <div><dt>Last updated</dt><dd>{formatDateTime(detail.updatedAt)}</dd></div>
                  {detail.closedAt && <div><dt>Closed</dt><dd>{formatDateTime(detail.closedAt)}</dd></div>}
                </dl>
              </section>
              <section className="card service-request-section">
                <div className="service-request-section-heading"><div><h2>Submitted information</h2><p>Details provided with this request.</p></div></div>
                {!detail.variableValues?.length ? <div className="empty-state">No additional information was provided.</div> : (
                  <dl className="service-request-details service-request-values">
                    {detail.variableValues.map((entry) => (
                      <div key={entry.variable.variableId}>
                        <dt>{entry.variable.label}</dt>
                        <dd>{entry.value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
            </>
          )}
          <Link className="btn-ghost service-request-back" to={backTo}><ArrowLeft size={14} /> Back to {heading}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="service-requests-page">
      <header className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">{admin ? "Administration" : "Self Service"}</div>
          <div className="page-title">{heading}</div>
          <div className="page-subtitle">{admin ? "Review and track service requests from all users." : "View and track the service requests you have submitted."}</div>
        </div>
        {admin
          ? <Link className="btn-primary service-request-nav-button" to="/admin/create-service-request"><Plus size={14} /> Create Request</Link>
          : <Link className="btn-primary service-request-nav-button" to="/service-requests"><Plus size={14} /> New Request</Link>}
      </header>
      <div className="page-body service-requests-body">
        {listQuery.error && <><ErrorBar msg={listQuery.error} /><button className="btn-ghost" onClick={listQuery.reload}>Retry loading requests</button></>}
        <section className="card service-request-section">
          <div className="service-request-list-filters">
            <label className="service-request-search"><Search size={15} aria-hidden="true" /><input aria-label="Search requests" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search request number, service or requester…" /></label>
            <select className="select" aria-label="Filter requests by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="All">All statuses</option>
              {STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          {listQuery.loading && !listQuery.data && <div className="spinner-row">Loading requests…</div>}
          {listQuery.data && pageItems.length === 0 && <div className="empty-state">No service requests found.</div>}
          {listQuery.data && pageItems.length > 0 && (
            <>
              <div className="service-request-table-wrap">
                <table className="service-request-table">
                  <thead><tr><th>Request</th><th>Service</th>{admin && <th>Requester</th>}<th>Status</th><th>Current step</th><th>Submitted</th><th /></tr></thead>
                  <tbody>
                    {pageItems.map((request) => (
                      <tr key={request.requestId}>
                        <td><Link to={`${admin ? "/admin/requests" : "/service-requests/my-requests"}/${request.requestId}`}>{requestNumber(request.requestId)}</Link></td>
                        <td>{request.catalog?.catalogName ?? "—"}</td>
                        {admin && <td>{request.requestedBy?.fullName ?? "—"}</td>}
                        <td><span className={`service-request-status ${request.status.toLowerCase().replace(/\s+/g, "-")}`}>{request.status}</span></td>
                        <td>{request.currentStep?.stepName ?? "—"}</td>
                        <td>{formatDateTime(request.createdAt)}</td>
                        <td><Link className="service-request-view-link" to={`${admin ? "/admin/requests" : "/service-requests/my-requests"}/${request.requestId}`}>View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="service-request-pagination">
                <span>{filtered.length ? `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} of ${filtered.length}` : "No results"}</span>
                <div>
                  <button className="btn-ghost btn-sm" disabled={currentPage <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
                  <span>Page {currentPage} of {pages}</span>
                  <button className="btn-ghost btn-sm" disabled={currentPage >= pages} onClick={() => setPage((value) => value + 1)}>Next</button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
