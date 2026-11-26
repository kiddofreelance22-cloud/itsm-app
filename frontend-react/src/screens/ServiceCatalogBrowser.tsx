import { assetUrl } from "../api";
import React, { useMemo, useState } from "react";
import { ErrorBar } from "../components/configKit";
import { useAsync } from "../hooks";
import { Link, useRouter } from "../router";
import { serviceCategoryApi, serviceRequestApi, type ServiceCatalog, type ServiceCategoryNode } from "../requestsApi";

const TONES = [
  { bg: "#EFF4FC", color: "#175CD3" },
  { bg: "#F4F3FF", color: "#5925DC" },
  { bg: "#ECFDF3", color: "#067647" },
  { bg: "#FFFAEB", color: "#B54708" },
  { bg: "#F0F9FF", color: "#026AA2" },
];

const money = (c: string | number | null | undefined) => (c == null || c === "" || Number(c) === 0 ? "No cost" : "₹" + Number(c).toLocaleString("en-IN"));

function approvalModel(x: ServiceCatalog): { label: string; cls: string } {
  if (!x.approvalRequired && !x.workflow) return { label: "Pre-approved", cls: "pill green" };
  const name = x.workflow?.workflowName;
  return { label: name ? `${name} approval` : "Approval required", cls: "pill blue" };
}

export function ServiceCatalogBrowser() {
  const { navigate } = useRouter();
  const catalogsQuery = useAsync(() => serviceRequestApi.catalogs(), []);
  const catsQuery = useAsync(() => serviceCategoryApi.list(), []);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<number | "all">("all");
  const [closed, setClosed] = useState<Record<number, boolean>>({});

  const cats = catsQuery.data ?? [];
  const byId = useMemo(() => new Map(cats.map((c) => [c.serviceCategoryId, c])), [cats]);
  const chain = (id: number | null | undefined): ServiceCategoryNode[] => {
    const out: ServiceCategoryNode[] = [];
    let cur = id != null ? byId.get(id) : undefined;
    let guard = 0;
    while (cur && guard++ < 8) { out.unshift(cur); cur = cur.parentCategoryId != null ? byId.get(cur.parentCategoryId) : undefined; }
    return out;
  };

  // A switched-off category hides everything under it.
  const live = useMemo(() => cats.filter((c) => chain(c.serviceCategoryId).every((p) => p.isActive !== false)), [cats, byId]); // eslint-disable-line react-hooks/exhaustive-deps
  const kidsOf = (pid: number | null) => live.filter((c) => (c.parentCategoryId ?? null) === pid).sort((a, b) => a.sortOrder - b.sortOrder || a.categoryName.localeCompare(b.categoryName));

  const visible = useMemo(() => (catalogsQuery.data ?? [])
    .filter((x) => (x.status ?? "published").toLowerCase() !== "draft" && x.isActive !== false && x.showInCatalog !== false)
    .map((x) => {
      const ch = chain(x.serviceCategory?.serviceCategoryId);
      return { x, ids: ch.map((c) => c.serviceCategoryId), root: ch[0]?.serviceCategoryId ?? 0, path: ch.length ? ch.map((c) => c.categoryName).join(" › ") : "Uncategorised", chainOk: ch.every((c) => c.isActive !== false) };
    })
    .filter((o) => o.chainOk), [catalogsQuery.data, byId]); // eslint-disable-line react-hooks/exhaustive-deps

  const picked = cat === "all" ? null : live.find((c) => c.serviceCategoryId === cat) ?? null;
  const active = picked ? picked.serviceCategoryId : "all";
  const countIn = (id: number) => visible.filter((o) => o.ids.includes(id)).length;
  const select = (id: number | "all") => { setCat(id); if (id !== "all") setClosed((c) => ({ ...c, [id]: false })); };
  const parents = live.filter((c) => kidsOf(c.serviceCategoryId).length > 0);
  const allOpen = parents.every((c) => !closed[c.serviceCategoryId]);
  const roots = kidsOf(null);

  const rows: { node: ServiceCategoryNode; depth: number; hasKids: boolean; open: boolean }[] = [];
  const walk = (pid: number | null, depth: number) => kidsOf(pid).forEach((c) => {
    const hasKids = kidsOf(c.serviceCategoryId).length > 0;
    const open = !closed[c.serviceCategoryId];
    rows.push({ node: c, depth, hasKids, open });
    if (hasKids && open) walk(c.serviceCategoryId, depth + 1);
  });
  walk(null, 0);

  const query = q.trim().toLowerCase();
  const shown = visible.filter((o) => (active === "all" || o.ids.includes(active)) && (!query || `${o.x.catalogName} ${o.x.shortDescription ?? ""} ${o.x.description ?? ""} ${o.path}`.toLowerCase().includes(query)));
  const trail = picked ? chain(picked.serviceCategoryId) : [];
  const crumbs = [{ label: "All services", id: "all" as number | "all" }, ...trail.map((c) => ({ label: c.categoryName, id: c.serviceCategoryId as number | "all" }))];
  const pickedDesc = picked?.description?.trim() ?? "";

  const emptyText = query
    ? (picked ? `No services in ${picked.categoryName} match your search.` : "No services match your search.")
    : (picked ? `There are no services in ${picked.categoryName} yet.` : "There are no published services yet.");

  return (
    <div className="sc-page">
      <div className="sc-head">
        <div className="sc-crumb">User &gt; <span>Service Catalog</span></div>
        <div className="sc-head-row">
          <div>
            <h1>Service Catalog</h1>
            <div className="sc-sub">Pick a category to see the services in it. Each service shows its cost, delivery target and who has to approve it.</div>
          </div>
          <Link to="/service-requests/my-requests" className="sc-btn">My Service Requests</Link>
        </div>
      </div>

      <div className="sc-body">
        {(catalogsQuery.error || catsQuery.error) && <div style={{ flex: "1 1 100%" }}><ErrorBar msg={catalogsQuery.error || catsQuery.error || ""} /></div>}

        <aside className="sc-panel sc-tree" aria-label="Categories">
          <div className="sc-tree-head">
            <span className="sc-eyebrow">Categories</span>
            {parents.length > 0 && (
              <button type="button" className="sc-linkbtn" onClick={() => setClosed(allOpen ? Object.fromEntries(parents.map((c) => [c.serviceCategoryId, true])) : {})}>
                {allOpen ? "Collapse all" : "Expand all"}
              </button>
            )}
          </div>
          <div className={active === "all" ? "sc-trow sel" : "sc-trow"}>
            <span className="sc-tw" aria-hidden="true" />
            <button type="button" className="sc-tname" aria-pressed={active === "all"} onClick={() => select("all")}>All services</button>
            <span className="sc-tcount">{visible.length}</span>
          </div>
          {rows.map(({ node, depth, hasKids, open }) => (
            <div key={node.serviceCategoryId} className={node.serviceCategoryId === active ? "sc-trow sel" : "sc-trow"} style={{ paddingLeft: depth * 16 }}>
              {hasKids ? (
                <button type="button" className="sc-tw" aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${node.categoryName}`}
                  onClick={() => setClosed((c) => ({ ...c, [node.serviceCategoryId]: open }))}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ transform: open ? "rotate(90deg)" : "none" }}><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              ) : <span className="sc-tw" aria-hidden="true" />}
              <button type="button" className="sc-tname" aria-pressed={node.serviceCategoryId === active} onClick={() => select(node.serviceCategoryId)}>{node.categoryName}</button>
              <span className="sc-tcount">{countIn(node.serviceCategoryId)}</span>
            </div>
          ))}
          {!catsQuery.loading && rows.length === 0 && (
            <div className="sc-note">No categories are set up yet. Add them in <Link to="/config/admin/service-category">Service Category</Link>.</div>
          )}
        </aside>

        <div className="sc-main">
          <div className="sc-toolbar">
            <input className="sc-field" style={{ maxWidth: 340 }} type="search" aria-label={picked ? `Search in ${picked.categoryName}…` : "Search services…"} placeholder={picked ? `Search in ${picked.categoryName}…` : "Search services…"} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="sc-count">{shown.length} {shown.length === 1 ? "service" : "services"}{picked ? ` in ${picked.categoryName}` : ""}</div>
          </div>

          <div>
            {picked && (
              <div className="sc-crumbs">
                {crumbs.map((c, i) => i < crumbs.length - 1
                  ? <React.Fragment key={String(c.id)}><button type="button" className="sc-linkbtn" style={{ padding: "2px 0", fontSize: 12 }} onClick={() => select(c.id)}>{c.label}</button><span aria-hidden="true" style={{ color: "#98A2B3" }}>›</span></React.Fragment>
                  : <span key={String(c.id)} style={{ color: "#344054", fontWeight: 600 }}>{c.label}</span>)}
              </div>
            )}
            <h2 className="sc-title">{picked ? picked.categoryName : "All services"}</h2>
            {pickedDesc && <div className="sc-desc">{pickedDesc}</div>}
          </div>

          {catalogsQuery.loading && !catalogsQuery.data && <div className="spinner-row">Loading services…</div>}

          <div className="sc-grid">
            {shown.map(({ x, path, root }) => {
              const tone = TONES[Math.max(0, roots.findIndex((c) => c.serviceCategoryId === root)) % TONES.length];
              const model = approvalModel(x);
              const days = Number(x.deliveryTimeSla ?? x.estimatedTime) || 1;
              const img = x.bannerUrl || x.iconUrl;
              return (
                <div key={x.catalogId} className="sc-panel sc-card">
                  {img ? (
                    <span aria-hidden="true" className="sc-img" style={{ backgroundImage: `url("${assetUrl(img)}")` }} />
                  ) : (
                    <div className="sc-icon" style={{ background: tone.bg, color: tone.color }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                    </div>
                  )}
                  <div className="sc-card-cat" style={{ color: tone.color }}>{path}</div>
                  <div className="sc-card-name">{x.catalogName}</div>
                  <div className="sc-card-desc">{x.shortDescription || x.description || ""}</div>
                  <div className="sc-card-meta"><span>Est. cost: {x.hidePrice ? "—" : money(x.estimatedCost)}</span><span>{days} {days > 1 ? "business days" : "business day"}</span></div>
                  <div><span className={model.cls}>{model.label}</span></div>
                  <button type="button" className="sc-btn primary" style={{ marginTop: 6 }} onClick={() => navigate(`/service-requests/request/${x.catalogId}`)}>Request this</button>
                </div>
              );
            })}
          </div>

          {!catalogsQuery.loading && shown.length === 0 && (
            <div className="sc-panel sc-empty">
              <span>{emptyText}</span>
              {picked && <button type="button" className="sc-btn" onClick={() => select("all")}>Show all services</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
