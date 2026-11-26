import React, { useEffect, useMemo, useState } from "react";
import { useAsync } from "../hooks";
import { ErrorBar, errMsg } from "./configKit";
import { useIsStaff } from "../screens/KnowledgeShared";
import { knowledgeApi, type KnowledgeArticle } from "../knowledgeApi";

/**
 * Knowledge on a ticket: the articles already linked, matches suggested from the ticket's text,
 * and a search for anything else. Linking records a "reference", which is what the SKMS dashboard
 * counts as reuse and capture, and what the KCS leaderboard credits to the article's author.
 */
export function LinkedKnowledgeCard({ incidentId, locked }: { incidentId: string; locked: boolean }) {
  // Staff only (the API enforces it too). Kept as a wrapper so the hooks below always run in the same order.
  const staff = useIsStaff();
  return staff && incidentId ? <Card incidentId={incidentId} locked={locked} /> : null;
}

function Card({ incidentId, locked }: { incidentId: string; locked: boolean }) {
  const links = useAsync(() => knowledgeApi.incidentLinks(incidentId), [incidentId]);
  // Suggestions are a convenience: if matching fails (e.g. no articles yet) the card still works.
  const suggested = useAsync(
    () => knowledgeApi.simulate(incidentId).then((s) => s.steps.find((x) => x.key === "search")?.articles ?? []).catch(() => []),
    [incidentId],
  );

  const [text, setText] = useState("");
  const [found, setFound] = useState<KnowledgeArticle[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");

  const linked = links.data ?? [];
  const linkedIds = useMemo(() => new Set(linked.map((a) => a.articleId)), [linked]);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) { setFound([]); return; }
    let live = true;
    const t = setTimeout(() => {
      knowledgeApi.articles({ q })
        .then((r) => { if (live) setFound(r.slice(0, 6)); })
        .catch((e) => { if (live) { setFound([]); setErr(errMsg(e)); } });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [text]);

  const link = async (a: KnowledgeArticle) => {
    setBusy(a.articleId); setErr("");
    try {
      await knowledgeApi.recordEvent(a.articleId, "reference", incidentId);
      links.reload();
    } catch (e) {
      setErr(errMsg(e, "Unable to link this article."));
    } finally {
      setBusy(null);
    }
  };

  const suggestions = (suggested.data ?? []).filter((a) => !linkedIds.has(a.articleId));
  const results = found.filter((a) => !linkedIds.has(a.articleId));

  const row = (a: KnowledgeArticle) => (
    <div key={a.articleId} className="kl-row">
      <span className="skms-code">{a.articleCode}</span>
      <span className="kl-title">{a.title}</span>
      {a.articleType === "Known Error" && <span className="skms-chip">Known Error</span>}
      <button type="button" className="btn-ghost btn-sm" disabled={busy === a.articleId} onClick={() => void link(a)}>
        {busy === a.articleId ? "Linking…" : "Link to ticket"}
      </button>
    </div>
  );

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="proto-eyebrow-title" style={{ marginBottom: 10 }}>Knowledge{linked.length ? ` (${linked.length})` : ""}</div>
      <ErrorBar msg={err || (links.error ?? "")} />

      {linked.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "#98A2B3" }}>No article is linked to this incident yet.</div>
      ) : (
        <div>
          {linked.map((a) => (
            <div key={a.articleId} className="kl-row">
              <span className="skms-code">{a.articleCode}</span>
              <span className="kl-title">{a.title}</span>
              {a.articleType === "Known Error" && <span className="skms-chip">Known Error</span>}
            </div>
          ))}
        </div>
      )}

      {!locked && (
        <>
          {suggestions.length > 0 && (
            <>
              <div className="kl-sub">Suggested from this ticket</div>
              {suggestions.map(row)}
            </>
          )}
          <div className="kl-sub">Find another article</div>
          <input
            className="input"
            placeholder="Search by title, tag or code…"
            aria-label="Search knowledge articles"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {text.trim().length >= 2 && results.length === 0 && (
            <div style={{ fontSize: 12.5, color: "#98A2B3", marginTop: 8 }}>No other articles match.</div>
          )}
          {results.map(row)}
        </>
      )}
    </div>
  );
}
