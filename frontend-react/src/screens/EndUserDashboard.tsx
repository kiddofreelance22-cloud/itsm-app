import React, { useMemo, useState } from "react";
import {
  BookOpen, Bell, ChevronLeft, ChevronRight, ClipboardCheck, EllipsisVertical, FilePlus2,
  FileText, Headset, Megaphone, Plus, Search, ShoppingCart, UserRound, type LucideIcon,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { incidentApi } from "../incidentApi";
import { PRIORITY_META, STATUS_META, formatDateTime } from "../fieldMeta";
import { useAsync } from "../hooks";
import { Link, useRouter } from "../router";
import type { Incident } from "../types";

const PAGE_SIZE = 5;

/* Announcements and knowledge-base articles have no backend endpoint yet, so
   these are static placeholders. Replace with API calls when they exist. */
const ANNOUNCEMENTS = [
  { title: "System maintenance", body: "Scheduled downtime on 18 May 2025, 12:00 AM to 02:00 AM.", date: "14 May 2025", tone: "blue" },
  { title: "New self-service portal", body: "We've added new features to improve your experience.", date: "14 May 2025", tone: "green" },
  { title: "Password policy update", body: "The password policy has changed. Please update your password regularly.", date: "10 May 2025", tone: "amber" },
];

const KB_ARTICLES = [
  "How to reset your VPN password",
  "Fix Outlook not syncing email",
  "How to connect to Wi-Fi",
  "Install software on Windows",
  "Printer not responding",
];

interface Tile {
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: "blue" | "orange" | "green" | "purple";
  to?: string; // omitted = screen not built yet
}

const TILES: Tile[] = [
  { label: "Create incident", hint: "Report an issue", icon: Plus, tone: "blue", to: "/new-incident" },
  { label: "My incidents", hint: "View your incidents", icon: FileText, tone: "orange", to: "/my-incidents" },
  { label: "Knowledge base", hint: "Find helpful articles", icon: BookOpen, tone: "green", to: "/knowledge-base" },
  { label: "Service request", hint: "Raise a request", icon: ShoppingCart, tone: "purple", to: "/service-requests" },
];

const QUICK_LINKS: { label: string; hint: string; icon: LucideIcon; to?: string }[] = [
  { label: "Report an issue", hint: "Create a new incident", icon: Headset, to: "/new-incident" },
  { label: "Request something", hint: "Raise a service request", icon: ShoppingCart, to: "/service-requests" },
  { label: "My approvals", hint: "View pending approvals", icon: ClipboardCheck, to: "/approvals" },
  { label: "Notifications", hint: "View all notifications", icon: Bell, to: "/notifications" },
  { label: "My profile", hint: "Manage your profile", icon: UserRound, to: "/profile" },
];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function EndUserDashboardPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const incidentsQ = useAsync<{ incidents: Incident[] }>(() => incidentApi.myIncidents(), []);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const q = query.trim().toLowerCase();

  const incidents = useMemo(() => {
    const all = [...(incidentsQ.data?.incidents ?? [])].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return q
      ? all.filter((i) => `${i.number} ${i.shortDescription} ${i.category ?? ""}`.toLowerCase().includes(q))
      : all;
  }, [incidentsQ.data, q]);

  const articles = useMemo(
    () => (q ? KB_ARTICLES.filter((a) => a.toLowerCase().includes(q)) : KB_ARTICLES),
    [q],
  );

  const pageCount = Math.max(1, Math.ceil(incidents.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const rows = incidents.slice(start, start + PAGE_SIZE);

  return (
    <div className="dash">
      <div className="dash-main">
        <header className="dash-hello">
          <h1>{greeting()}, {firstName(user?.name ?? "there")}</h1>
          <p>How can we help you today?</p>
        </header>

        <form
          className="dash-search"
          role="search"
          onSubmit={(e) => { e.preventDefault(); setPage(1); }}
        >
          <input
            type="search"
            aria-label="Search incidents and knowledge base articles"
            placeholder="Search incidents, knowledge base articles…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          />
          <Search size={17} aria-hidden="true" />
        </form>

        <div className="dash-tiles">
          {TILES.map((t) => {
            const Icon = t.icon;
            const body = (
              <>
                <span className={`dash-tile-icon ${t.tone}`}><Icon size={22} aria-hidden="true" /></span>
                <span className="dash-tile-label">{t.label}</span>
                <span className="dash-tile-hint">{t.hint}</span>
              </>
            );
            return t.to ? (
              <Link key={t.label} to={t.to} className="dash-tile">{body}</Link>
            ) : (
              <div key={t.label} className="dash-tile disabled" aria-disabled="true" title="Coming soon">
                {body}
                <span className="dash-soon">Coming soon</span>
              </div>
            );
          })}
        </div>

        <section className="card dash-panel" aria-labelledby="recent-incidents">
          <div className="dash-panel-head">
            <h2 id="recent-incidents">Recent incidents</h2>
            <Link to="/my-incidents" className="dash-viewall">View all</Link>
          </div>

          {incidentsQ.loading ? (
            <div className="spinner-row">Loading…</div>
          ) : incidentsQ.error ? (
            <div className="error-text" style={{ padding: "0 16px 16px" }}>{incidentsQ.error}</div>
          ) : incidents.length === 0 ? (
            <div className="empty-state">
              {q ? (
                <>No incidents match “{query}”.</>
              ) : (
                <>You haven't reported any incidents yet. <Link to="/new-incident">Create your first incident</Link>.</>
              )}
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ minWidth: 620 }}>
                  <thead>
                    <tr>
                      <th>Incident ID</th>
                      <th>Summary</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Updated on</th>
                      <th aria-label="Actions" style={{ width: 36 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((inc) => {
                      const sm = STATUS_META[inc.status];
                      const pm = inc.priority ? PRIORITY_META[inc.priority] : null;
                      return (
                        <tr key={inc.id}>
                          <td><Link to={`/my-incidents/${inc.id}`} className="inc-link">{inc.number}</Link></td>
                          <td>{inc.shortDescription}</td>
                          <td>
                            <span className="badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
                          </td>
                          <td>
                            {pm ? (
                              <span className="dash-priority">
                                <span className="dot" style={{ background: pm.dot }} />{pm.label}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="muted">{formatDateTime(inc.updatedAt)}</td>
                          <td>
                            <button
                              className="admin-master-icon-button"
                              aria-label={`Open ${inc.number}`}
                              onClick={() => navigate(`/my-incidents/${inc.id}`)}
                            >
                              <EllipsisVertical size={15} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="dash-pager">
                <span className="muted">
                  Showing {start + 1} to {Math.min(start + PAGE_SIZE, incidents.length)} of {incidents.length}
                </span>
                <div className="dash-pager-controls">
                  <button aria-label="Previous page" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
                    <ChevronLeft size={14} aria-hidden="true" />
                  </button>
                  {Array.from({ length: pageCount }, (_, i) => i + 1).slice(0, 7).map((n) => (
                    <button
                      key={n}
                      className={n === safePage ? "current" : ""}
                      aria-current={n === safePage ? "page" : undefined}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  ))}
                  <button aria-label="Next page" disabled={safePage === pageCount} onClick={() => setPage(safePage + 1)}>
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="card dash-panel" aria-labelledby="quick-links">
          <div className="dash-panel-head"><h2 id="quick-links">Quick links</h2></div>
          <div className="dash-links">
            {QUICK_LINKS.map((l) => {
              const Icon = l.icon;
              const body = (
                <>
                  <Icon size={22} aria-hidden="true" />
                  <span className="dash-link-label">{l.label}</span>
                  <span className="dash-link-hint">{l.hint}</span>
                </>
              );
              return l.to ? (
                <Link key={l.label} to={l.to} className="dash-link">{body}</Link>
              ) : (
                <div key={l.label} className="dash-link disabled" aria-disabled="true" title="Coming soon">{body}</div>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="dash-side">
        <section className="card dash-panel" aria-labelledby="announcements">
          <div className="dash-panel-head">
            <h2 id="announcements"><Megaphone size={15} aria-hidden="true" /> Announcements</h2>
          </div>
          <ul className="dash-announce">
            {ANNOUNCEMENTS.map((a) => (
              <li key={a.title}>
                <span className={`dot ${a.tone}`} />
                <div>
                  <div className="dash-announce-title">{a.title}</div>
                  <div className="dash-announce-body">{a.body}</div>
                  <div className="dash-announce-date">{a.date}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card dash-panel" aria-labelledby="kb">
          <div className="dash-panel-head">
            <h2 id="kb"><BookOpen size={15} aria-hidden="true" /> Knowledge base</h2>
          </div>
          {articles.length === 0 ? (
            <div className="empty-state" style={{ padding: "12px 16px 20px" }}>No articles match “{query}”.</div>
          ) : (
            <ul className="dash-kb">
              {articles.map((title) => (
                <li key={title}><FilePlus2 size={14} aria-hidden="true" /> {title}</li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
