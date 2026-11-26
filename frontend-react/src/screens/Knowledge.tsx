import React, { useState } from "react";
import { ArrowRight, Bug, CalendarCheck, CheckCircle2, BookOpen, Play, RefreshCw, ShieldCheck, TriangleAlert, Workflow } from "lucide-react";
import { useAuth } from "../AuthContext";
import { Link, useRouter } from "../router";
import { useAsync } from "../hooks";
import { ErrorBar, SearchBox, errMsg, formatDate } from "../components/configKit";
import { knowledgeApi, type KnowledgeArticle, type Simulation } from "../knowledgeApi";
import {
  HealthPill, SeverityPill, SkmsHeader, StaffOnly, TagList, WorkaroundBadge,
  barWidth, initialsOf, pctText, snippet, takeGlobalQuery, useIsStaff,
} from "./KnowledgeShared";

/* ------------------------------------------------------------------ SKMS dashboard */

export function SkmsDashboardPage() {
  const staff = useIsStaff();
  const { navigate } = useRouter();
  const [open, setOpen] = useState<KnowledgeArticle | null>(null);
  const { data, loading, error, reload } = useAsync(() => (staff ? knowledgeApi.dashboard() : Promise.resolve(null)), [staff]);
  if (!staff) return <StaffOnly />;

  const fresh = data?.freshnessIndex;
  return (
    <>
      <SkmsHeader title="SKMS Dashboard" subtitle="Service knowledge at a glance: reuse, deflection, known errors and freshness." onNew={() => navigate("/knowledge/articles/new/standard-kb")} />
      <div className="page-body">
        <ErrorBar msg={error ?? ""} />
        {loading && !data ? <div className="spinner-row">Loading…</div> : data && (
          <>
            <div className="skms-stats">
              <StatCard label="SKMS Total Articles" value={data.totalArticles.toLocaleString()} icon={<BookOpen size={18} />} tone="indigo"
                note={<span className="ok">+{data.addedThisMonth} this month{data.growthPct != null ? ` (+${data.growthPct}%)` : ""}</span>} />
              <StatCard label="Portal Deflection Rate" value={pctText(data.deflectionRate)} icon={<ShieldCheck size={18} />} tone="green"
                note={<span className={data.deflectionRate != null && data.deflectionRate > data.deflectionTarget ? "ok" : "muted"}>Target: &gt;{data.deflectionTarget}% (last 30 days)</span>} />
              <StatCard label="Active Known Errors" value={String(data.activeKnownErrors)} icon={<Bug size={18} />} tone="amber"
                note={<span className={data.pendingPatches ? "warn" : "ok"}>{data.pendingPatches ? <><TriangleAlert size={12} /> {data.pendingPatches} pending patches</> : "No pending patches"}</span>} />
              <StatCard label="Knowledge Freshness Index" value={pctText(fresh)} icon={<CalendarCheck size={18} />} tone="blue"
                note={fresh == null ? <span className="muted">No articles yet</span> : fresh >= 90 ? <span className="ok"><CheckCircle2 size={12} /> Audit compliant</span> : <span className="warn"><TriangleAlert size={12} /> Review needed (target 90%)</span>} />
            </div>

            <div className="skms-split">
              <section className="card skms-panel">
                <div className="skms-panel-head">
                  <div>
                    <h2>High-Impact Knowledge Assets</h2>
                    <p>Most referenced and recently published knowledge assets</p>
                  </div>
                  <Link to="/knowledge/kedb" className="skms-link">View KEDB <ArrowRight size={13} /></Link>
                </div>
                {data.topAssets.length === 0 ? (
                  <div className="empty-state">No articles yet. Use “New Article / KEDB” to publish the first one.</div>
                ) : (
                  <div className="skms-assets">
                    {data.topAssets.map((a) => (
                      <div key={a.articleId} className="skms-asset clickable" role="button" tabIndex={0}
                        onClick={() => setOpen(a)} onKeyDown={(e) => e.key === "Enter" && setOpen(a)}>
                        <div className="skms-asset-main">
                          <div className="skms-asset-meta">
                            <span className="skms-code">{a.articleCode}</span>
                            {a.serviceLine && <span className="skms-chip">{a.serviceLine}</span>}
                          </div>
                          <div className="skms-asset-title">{a.title}</div>
                          <TagList tags={a.tags} />
                        </div>
                        <div className="skms-asset-side">
                          <strong>{a.usageCount.toLocaleString()} references</strong>
                          {a.articleType === "Known Error"
                            ? <span className={a.workaroundStatus === "Verified" ? "ok" : "warn"}>{a.workaroundStatus === "Verified" ? "Verified Workaround" : "Workaround " + a.workaroundStatus}</span>
                            : <span className="muted">Standard KB</span>}
                          <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/knowledge/articles/${a.articleId}/edit`); }}>Edit</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="card skms-panel">
                <div className="skms-panel-head"><div>
                  <h2>KCS Solve-Evolve Loop</h2>
                  <p>Real-time sync between reactive troubleshooting and proactive knowledge creation.</p>
                </div></div>
                <Meter label="Capture Velocity" value={data.kcsLoop.captureVelocity} tone="indigo" help="Ratio of tickets resolved in the last 30 days with an attached article." />
                <Meter label="Structure Quality Index" value={data.kcsLoop.structureQuality} tone="green" help="Compliance with KCS metadata & template standards (title, 3+ tags, service line, full steps)." />
                <Meter label="Problem-to-KEDB Conversion" value={data.kcsLoop.problemToKedb} tone="blue" help="Problem records with a published known error cataloged." />
              </section>
            </div>
          </>
        )}
      </div>
      {open && <ArticleDrawer article={open} onClose={() => setOpen(null)} onChanged={(a) => { setOpen(a); reload(); }} />}
    </>
  );
}

function StatCard({ label, value, icon, note, tone }: { label: string; value: string; icon: React.ReactNode; note: React.ReactNode; tone: string }) {
  return (
    <div className="card skms-stat">
      <div>
        <div className="skms-stat-label">{label}</div>
        <div className="skms-stat-value">{value}</div>
        <div className="skms-stat-note">{note}</div>
      </div>
      <div className={`skms-stat-icon ${tone}`}>{icon}</div>
    </div>
  );
}

function Meter({ label, value, tone, help }: { label: string; value: number | null; tone: string; help: string }) {
  return (
    <div className="skms-meter">
      <div className="skms-meter-row"><span>{label}</span><strong className={tone}>{pctText(value)}</strong></div>
      <div className="skms-bar"><div className={`skms-bar-fill ${tone}`} style={{ width: barWidth(value) }} /></div>
      <div className="skms-meter-help">{help}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ Known Error DB */

export function KedbPage() {
  const staff = useIsStaff();
  const { navigate } = useRouter();
  const [serviceLine, setServiceLine] = useState("");
  const [globalQ] = useState(takeGlobalQuery);
  const [q, setQ] = useState(globalQ);
  const [allTypes, setAllTypes] = useState(!!globalQ);
  const [open, setOpen] = useState<KnowledgeArticle | null>(null);
  const lines = useAsync(() => (staff ? knowledgeApi.serviceLines() : Promise.resolve([] as string[])), [staff]);
  const { data, loading, error, reload } = useAsync(
    () => (staff ? knowledgeApi.articles({ type: allTypes ? undefined : "Known Error", serviceLine: serviceLine || undefined, q }) : Promise.resolve([] as KnowledgeArticle[])),
    [staff, serviceLine, q, allTypes],
  );
  if (!staff) return <StaffOnly />;

  return (
    <>
      <SkmsHeader title="Known Error Database (KEDB)" subtitle="Managed jointly with Problem Management for verified root causes & workarounds." onNew={() => navigate("/knowledge/articles/new/known-error")} />
      <div className="page-body">
        <ErrorBar msg={error ?? ""} />
        <div className="skms-filters">
          <select className="select" value={serviceLine} onChange={(e) => setServiceLine(e.target.value)} aria-label="Service line">
            <option value="">All Service Lines</option>
            {(lines.data ?? []).map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <SearchBox value={q} onChange={setQ} placeholder="Search error code or symptom…" />
        </div>
        {allTypes && (
          <div className="skms-note" role="status">
            Showing every article type that matches your search.{" "}
            <button className="skms-linkbtn" onClick={() => setAllTypes(false)}>Show known errors only</button>
          </div>
        )}
        <div className="card skms-table-card">
          <table className="skms-table">
            <thead>
              <tr><th>{allTypes ? "Article ID" : "Known Error ID"}</th><th>Symptom / Problem Title</th><th>CI / Service Line</th><th>Severity</th><th>Workaround Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {loading && !data ? <tr><td colSpan={6}><div className="spinner-row">Loading…</div></td></tr>
                : !data?.length ? <tr><td colSpan={6}><div className="empty-state">{q || serviceLine ? "No known errors match these filters." : "No known errors recorded yet."}</div></td></tr>
                : data.map((a) => (
                  <tr key={a.articleId}>
                    <td><span className="skms-code">{a.articleCode}</span></td>
                    <td>
                      <div className="skms-row-title">{a.title}</div>
                      <div className="skms-row-sub">{snippet(a)}</div>
                      <TagList tags={a.tags} />
                    </td>
                    <td>{a.serviceLine ?? "—"}</td>
                    <td><SeverityPill severity={a.severity} /></td>
                    <td>{a.articleType === "Known Error" ? <WorkaroundBadge status={a.workaroundStatus} /> : <span className="skms-chip">{a.articleType}</span>}</td>
                    <td className="skms-row-actions">
                      <button className="btn-ghost btn-sm" onClick={() => setOpen(a)}>{a.articleType === "Known Error" ? "View KEDB" : "View"}</button>
                      <button className="btn-ghost btn-sm" onClick={() => navigate(`/knowledge/articles/${a.articleId}/edit`)}>Edit</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && <ArticleDrawer article={open} onClose={() => setOpen(null)} onChanged={(a) => { setOpen(a); reload(); }} />}
    </>
  );
}

function ArticleDrawer({ article, onClose, onChanged }: { article: KnowledgeArticle; onClose: () => void; onChanged: (a: KnowledgeArticle) => void }) {
  const { navigate } = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const act = async (fn: () => Promise<KnowledgeArticle>) => {
    setBusy(true); setErr("");
    try { onChanged(await fn()); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const aud = article.audience;
  const isKE = article.articleType === "Known Error";
  return (
    <>
      <button className="cm-scrim" aria-label="Close" onClick={onClose} />
      <aside className="cm-drawer skms-drawer">
        <div className="skms-drawer-head">
          <div><span className="skms-code">{article.articleCode}</span> <SeverityPill severity={article.severity} /></div>
          <button className="btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="skms-drawer-body">
          <ErrorBar msg={err} />
          <h2>{article.title}</h2>
          <TagList tags={article.tags} />
          <dl className="skms-facts">
            <div><dt>Service line / CI</dt><dd>{article.serviceLine ?? "—"}</dd></div>
            <div><dt>Asset type</dt><dd className="indigo">{article.articleType}</dd></div>
            {isKE && <div><dt>Workaround</dt><dd><WorkaroundBadge status={article.workaroundStatus} /></dd></div>}
            {isKE && <div><dt>Problem record</dt><dd>{article.problemCode ?? "Not linked"}</dd></div>}
            {isKE && <div><dt>Permanent fix</dt><dd>{article.permanentFixStatus}</dd></div>}
            <div><dt>Author</dt><dd>{article.authorName ?? "—"}</dd></div>
            <div><dt>Last reviewed</dt><dd>{formatDate(article.lastReviewedAt)}</dd></div>
            <div><dt>Used on tickets</dt><dd>{article.usageCount}</dd></div>
            <div><dt>Audience</dt><dd>{[aud.targetUserGroup, aud.analystRole, aud.workgroup, aud.location, aud.department].filter(Boolean).join(" · ") || "—"}</dd></div>
          </dl>
          <h3>{isKE ? "Resolution / KEDB Workaround Procedure" : "Resolution / Procedure"}</h3>
          <pre className="skms-steps">{article.resolution}</pre>
        </div>
        <div className="skms-drawer-foot">
          <button className="btn-primary" disabled={busy} onClick={() => navigate(`/knowledge/articles/${article.articleId}/edit`)}>Edit Article</button>
          <button className="btn-ghost" disabled={busy} onClick={() => act(() => knowledgeApi.markReviewed(article.articleId))}>Mark reviewed</button>
          {isKE && (article.workaroundStatus !== "Verified"
            ? <button className="btn-primary" disabled={busy} onClick={() => act(() => knowledgeApi.setWorkaround(article.articleId, "Verified"))}>Verify workaround</button>
            : <button className="btn-ghost" disabled={busy} onClick={() => act(() => knowledgeApi.setWorkaround(article.articleId, "Pending"))}>Mark workaround unverified</button>)}
        </div>
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------ Article health */

export function ArticleHealthPage() {
  const staff = useIsStaff();
  const { navigate } = useRouter();
  const { user } = useAuth();
  const [auditing, setAuditing] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const { data, loading, error, reload } = useAsync(() => (staff ? knowledgeApi.health() : Promise.resolve(null)), [staff]);
  if (!staff) return <StaffOnly />;

  const runAudit = async () => {
    setAuditing(true); setErr(""); setNote("");
    try {
      const r = await knowledgeApi.runAudit();
      setNote(`Audit complete: ${r.movedToPendingArchive} moved to Pending Archive, ${r.reviewDue} due for review.`);
      reload();
    } catch (e) { setErr(errMsg(e)); } finally { setAuditing(false); }
  };
  const review = async (a: KnowledgeArticle) => {
    try { await knowledgeApi.markReviewed(a.articleId); reload(); } catch (e) { setErr(errMsg(e)); }
  };

  return (
    <>
      <div className="page-header-row">
        <div className="page-header-left">
          <div className="breadcrumb">Knowledge Management &gt; Article Health &amp; Quality</div>
          <div className="page-title">Article Health &amp; Quality Tracker</div>
          <div className="page-subtitle">Continuous review tracking, freshness audits, and deflection analytics.</div>
        </div>
        <div className="skms-actions">
          {user?.role === "ADMIN" && (
            <button className="btn-primary" onClick={runAudit} disabled={auditing}><RefreshCw size={14} /> {auditing ? "Running…" : "Run Freshness Audit"}</button>
          )}
          <button className="btn-ghost" onClick={() => navigate("/knowledge/articles/new/standard-kb")}>New Article / KEDB</button>
        </div>
      </div>
      <div className="page-body">
        <ErrorBar msg={err || (error ?? "")} />
        {note && <div className="skms-note" role="status">{note}</div>}
        {loading && !data ? <div className="spinner-row">Loading…</div> : data && (
          <>
            <div className="skms-triple">
              <section className="card skms-panel">
                <div className="skms-panel-head"><h2>Freshness &amp; Expiry Status</h2><span className="skms-pill green">{pctText(data.freshness.freshPct)} Fresh</span></div>
                <Line label="Active & Up-to-Date (< 90 days)" value={data.freshness.fresh.toLocaleString()} />
                <Line label="Review Due (90-180 days)" value={String(data.freshness.reviewDue)} tone="amber" />
                <Line label="Stale / Pending Archive (> 180 days)" value={String(data.freshness.stale)} tone="red" />
              </section>
              <section className="card skms-panel">
                <div className="skms-panel-head"><h2>Top Deflection Drivers</h2><span className="skms-pill indigo">Portal Self-Service</span></div>
                {data.deflectionDrivers.length === 0
                  ? <div className="skms-empty-line">No portal deflections in the last 30 days.</div>
                  : data.deflectionDrivers.map((d) => <Line key={d.articleCode} label={d.title} value={`${d.hits.toLocaleString()} hits`} />)}
              </section>
              <section className="card skms-panel">
                <div className="skms-panel-head"><h2>Feedback &amp; Ratings</h2>
                  <span className="skms-pill blue">{data.feedback.averageRating == null ? "No ratings" : `${data.feedback.averageRating} / 5.0 Avg`}</span></div>
                <Line label="Helpful Votes (Thumbs Up)" value={`${data.feedback.helpful.toLocaleString()} (${pctText(data.feedback.helpfulPct)})`} tone="green" />
                <Line label="Needs Improvement (Thumbs Down)" value={`${data.feedback.unhelpful.toLocaleString()} (${pctText(data.feedback.unhelpfulPct)})`} tone="red" />
                <Line label="Unresolved Incident Feedback Flagged" value={`${data.feedback.flaggedArticles} items`} tone="amber" />
              </section>
            </div>

            <section className="card skms-table-card">
              <div className="skms-panel-head pad"><h2>Recent Article Health &amp; Audit Log</h2></div>
              <table className="skms-table">
                <thead><tr><th>Article ID &amp; Title</th><th>Author / Owner</th><th>Last Reviewed</th><th>Usage Count</th><th>Health Status</th><th /></tr></thead>
                <tbody>
                  {!data.auditLog.length ? <tr><td colSpan={6}><div className="empty-state">No articles to audit yet.</div></td></tr>
                    : data.auditLog.map((a) => (
                      <tr key={a.articleId}>
                        <td><strong>{a.articleCode}</strong> - {a.title}</td>
                        <td>{a.authorName ?? "—"}</td>
                        <td>{a.lastReviewedAt.slice(0, 10)}</td>
                        <td>{a.usageCount}</td>
                        <td><HealthPill status={a.status === "Pending Archive" ? "Stale / Archive" : a.health} /></td>
                        <td>{(a.health !== "Healthy" || a.status !== "Published") && <button className="btn-ghost btn-sm" onClick={() => review(a)}>Mark reviewed</button>}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: "amber" | "red" | "green" }) {
  return <div className="skms-line"><span>{label}</span><strong className={tone}>{value}</strong></div>;
}

/* ------------------------------------------------------------------ KCS leaderboard */

export function KcsLeaderboardPage() {
  const staff = useIsStaff();
  const { navigate } = useRouter();
  const { data, loading, error } = useAsync(() => (staff ? knowledgeApi.leaderboard() : Promise.resolve([])), [staff]);
  if (!staff) return <StaffOnly />;

  return (
    <>
      <SkmsHeader title="KCS Contributor Leaderboard" subtitle="Recognizing engineers and service desk analysts driving knowledge reuse and capture." onNew={() => navigate("/knowledge/articles/new/standard-kb")} />
      <div className="page-body">
        <ErrorBar msg={error ?? ""} />
        <div className="skms-basis">Scoring basis: <span>Capture + Reuse + Quality Index</span>
          <small>10 pts per article · 2 pts per reuse · 1 pt per helpful vote</small></div>
        <div className="card skms-table-card">
          <table className="skms-table">
            <thead><tr><th>Rank</th><th>Engineer / Analyst</th><th>Team / Group</th><th className="num">Articles Created</th><th className="num">Articles Reused</th><th className="num">Quality Score</th><th className="num">KCS Points</th></tr></thead>
            <tbody>
              {loading && !data ? <tr><td colSpan={7}><div className="spinner-row">Loading…</div></td></tr>
                : !data?.length ? <tr><td colSpan={7}><div className="empty-state">No contributors yet. Rankings appear once articles are published.</div></td></tr>
                : data.map((r) => (
                  <tr key={r.rank}>
                    <td><strong>#{r.rank}</strong></td>
                    <td><span className="skms-avatar">{initialsOf(r.name)}</span> <strong>{r.name}</strong></td>
                    <td>{r.team ?? "—"}</td>
                    <td className="num">{r.articlesCreated}</td>
                    <td className="num">{r.articlesReused}</td>
                    <td className="num green">{pctText(r.qualityScore)}</td>
                    <td className="num indigo"><strong>{r.points.toLocaleString()} PTS</strong></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ Workflow simulator */

export function WorkflowSimulatorPage() {
  const staff = useIsStaff();
  const { navigate } = useRouter();
  const [ref, setRef] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Simulation | null>(null);
  const [err, setErr] = useState("");
  const incidents = useAsync(() => (staff ? knowledgeApi.simulatorIncidents() : Promise.resolve([])), [staff]);
  const selected = ref || incidents.data?.[0]?.incidentId || "";
  if (!staff) return <StaffOnly />;

  const run = async () => {
    if (!selected) return;
    setRunning(true); setErr(""); setResult(null);
    try { setResult(await knowledgeApi.simulate(selected)); } catch (e) { setErr(errMsg(e)); } finally { setRunning(false); }
  };

  return (
    <>
      <SkmsHeader title="ITSM Workflow & SKMS Integration Simulator" subtitle="Test how a knowledge article or KEDB entry connects across Incident, Problem, and Change Management." onNew={() => navigate("/knowledge/articles/new/standard-kb")} />
      <div className="page-body">
        <ErrorBar msg={err || (incidents.error ?? "")} />
        <div className="skms-sim">
          <section className="card skms-panel">
            <div className="skms-panel-head"><h2>Select Scenario to Simulate</h2></div>
            <div className="field-group">
              <label className="lbl">Simulate Incident Ticket</label>
              <select className="select" value={selected} onChange={(e) => { setRef(e.target.value); setResult(null); }} disabled={!incidents.data?.length}>
                {!incidents.data?.length && <option value="">No incidents available</option>}
                {incidents.data?.map((i) => <option key={i.incidentId} value={i.incidentId}>{i.incidentCode ?? i.incidentId} - {i.title}</option>)}
              </select>
            </div>
            <button className="btn-primary skms-run" onClick={run} disabled={running || !selected}><Play size={14} /> {running ? "Tracing…" : "Execute Cross-Workflow Trace"}</button>
            <ul className="skms-infos">
              <li>Traces context from Service Desk incident search.</li>
              <li>Links Known Error (KEDB) to active Problem record.</li>
              <li>Attaches standard change model for permanent fix deployment.</li>
              <li>Read-only: nothing is created or changed.</li>
            </ul>
          </section>

          <section className="card skms-panel">
            <div className="skms-panel-head"><h2>Integration Workflow Trace</h2>
              <span className="skms-pill gray">{running ? "Running…" : result ? "Complete" : "Idle - Awaiting Run"}</span></div>
            {!result ? (
              <div className="skms-trace-empty">
                <Workflow size={34} />
                <p>Select a scenario on the left and click “Execute Cross-Workflow Trace” to visualize ITIL 4 integration.</p>
              </div>
            ) : (
              <ol className="skms-trace">
                {result.steps.map((s) => (
                  <li key={s.key} className={s.state}>
                    <span className="skms-trace-dot">{s.state === "done" ? <CheckCircle2 size={16} /> : <TriangleAlert size={16} />}</span>
                    <div>
                      <div className="skms-trace-title">{s.title}</div>
                      <div className="skms-trace-detail">{s.detail}</div>
                      {s.articles?.map((a) => (
                        <div key={a.articleId} className="skms-trace-article"><span className="skms-code">{a.articleCode}</span> {a.title}</div>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
