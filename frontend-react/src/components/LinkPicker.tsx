import React, { useEffect, useState } from "react";
import { requestLinksApi, type LinkCandidate, type LinkCandidateQuery, type RelatedType } from "../requestsApi";
import { incidentApi } from "../incidentApi";

const TYPES: { type: RelatedType; label: string }[] = [
  { type: "incident", label: "Incident" }, { type: "change", label: "Change" }, { type: "problem", label: "Problem" },
  { type: "work_order", label: "Work order" }, { type: "request", label: "Service request" },
];
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/** "Add existing ticket": pick a type, narrow the list with filters, then link one. */
export function LinkPicker({ requestId, incidentId, onLinked }: { requestId?: number; incidentId?: string; onLinked: () => void }) {
  const [f, setF] = useState<LinkCandidateQuery>({ type: "incident", state: "any", raisedBy: "any", raised: "any", match: "none", sort: "newest" });
  const [text, setText] = useState("");
  const [items, setItems] = useState<LinkCandidate[] | null>(null); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  const set = (p: Partial<LinkCandidateQuery>) => setF((x) => ({ ...x, ...p }));
  const dirty = f.state !== "any" || f.raisedBy !== "any" || f.raised !== "any" || f.match !== "none" || f.sort !== "newest" || !!text;

  useEffect(() => {
    let live = true; setItems(null); setError("");
    const t = setTimeout(() => {
      const query = { ...f, q: text.trim() || undefined };
      const candidates = requestId !== undefined
        ? requestLinksApi.candidates(requestId, query)
        : incidentId ? incidentApi.ticketLinkCandidates(incidentId, query) : Promise.resolve({ items: [], note: undefined });
      candidates
        .then((r) => { if (live) { setItems(r.items); setNote(r.note ?? ""); } })
        .catch((e) => { if (live) { setItems([]); setError(errMsg(e)); } });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [requestId, incidentId, f, text]);

  const link = async (c: LinkCandidate) => {
    setBusy(c.number); setError("");
    try {
      if (requestId !== undefined) await requestLinksApi.attach(requestId, { type: c.type, targetNumber: c.number, relation: "Related to" });
      else if (incidentId) await incidentApi.attachTicketLink(incidentId, { type: c.type, targetNumber: c.number, relation: "Related to" });
      setItems((x) => (x ?? []).filter((y) => y.number !== c.number)); onLinked();
    }
    catch (e) { setError(errMsg(e)); } finally { setBusy(""); }
  };
  const sel = (label: string, value: string, on: (v: string) => void, opts: [string, string][]) => (
    <label className="field-group" style={{ margin: 0 }}><span className="lbl">{label}</span>
      <select className="select" value={value} onChange={(e) => on(e.target.value)}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>);

  return (
    <div style={{ border: "1px solid #E4E7EC", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>Add an existing ticket</div>
      <div className="sr-chips" role="group" aria-label="Ticket type">
        {TYPES.map((t) => <button key={t.type} type="button" className={`sr-chip ${f.type === t.type ? "active" : ""}`} aria-pressed={f.type === t.type} onClick={() => set({ type: t.type })}>{t.label}</button>)}
      </div>
      <input className="input" placeholder="Search by number or title..." aria-label="Search tickets" value={text} onChange={(e) => setText(e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        {sel("This ticket is", f.state ?? "any", (v) => set({ state: v as LinkCandidateQuery["state"] }), [["any", "Any state"], ["open", "Open"], ["closed", "Closed or resolved"]])}
        {sel("Raised by", f.raisedBy ?? "any", (v) => set({ raisedBy: v as LinkCandidateQuery["raisedBy"] }), [["any", "Anyone"], ["me", "Me"]])}
        {sel("Raised", f.raised ?? "any", (v) => set({ raised: v as LinkCandidateQuery["raised"] }), [["any", "Any time"], ["1", "Last 24 hours"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"]])}
        {sel(requestId !== undefined ? "Matches this request" : "Matches this incident", f.match ?? "none", (v) => set({ match: v as LinkCandidateQuery["match"] }), [["none", "Any"], ["requester", "Same requester"], ["group", "Same assignment group"]])}
        {sel("Sort by", f.sort ?? "newest", (v) => set({ sort: v as LinkCandidateQuery["sort"] }), [["newest", "Newest first"], ["oldest", "Oldest first"], ["number", "Number"]])}
      </div>
      {dirty && <div><button type="button" className="btn-ghost" onClick={() => { setText(""); set({ state: "any", raisedBy: "any", raised: "any", match: "none", sort: "newest" }); }}>Clear filters</button></div>}
      {note && <div style={{ fontSize: 12.5, color: "#B54708" }}>{note}</div>}
      {error && <div className="sr-notice danger" role="alert">{error}</div>}
      {items === null ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Searching...</div>
        : items.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No tickets match. Loosen the filters or try another number.</div>
        : (
          <div style={{ display: "grid", gap: 6, maxHeight: 260, overflowY: "auto" }}>
            {items.map((c) => (
              <div key={`${c.type}${c.number}`} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, borderBottom: "1px solid #F2F4F7", paddingBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div><strong>{c.number}</strong> <span style={{ overflowWrap: "anywhere" }}>{c.title}</span></div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{[c.status, c.group, c.raisedBy && `raised by ${c.raisedBy}`, c.createdAt && new Date(c.createdAt).toLocaleDateString()].filter(Boolean).join(" \u00b7 ")}</div>
                </div>
                <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => void link(c)}>{busy === c.number ? "Linking..." : "Link"}</button>
              </div>))}
          </div>)}
    </div>
  );
}
