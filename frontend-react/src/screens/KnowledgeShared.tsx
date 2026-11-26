import React, { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "../router";
import { FilePlus2, X } from "lucide-react";
import { useAuth } from "../AuthContext";
import { fetchLookupOptions } from "../lookupSources";
import { errMsg, ErrorBar } from "../components/configKit";
import { knowledgeApi, type ArticleType, type HealthStatus, type KnowledgeArticle, type Severity, type WorkaroundStatus } from "../knowledgeApi";

export const pctText = (v: number | null | undefined) => (v == null ? "—" : `${v}%`);
export const barWidth = (v: number | null | undefined) => `${Math.max(0, Math.min(100, v ?? 0))}%`;

/** Knowledge management is a staff workspace (the API enforces it; this just avoids a wall of 403s). */
export function useIsStaff(): boolean {
  const { user } = useAuth();
  return user?.role === "ADMIN" || user?.role === "RESOLVER";
}

export function StaffOnly() {
  return <div className="page-body"><ErrorBar msg="Knowledge management is available to support staff." /></div>;
}

const GLOBAL_Q = "skms_global_q";
/** The header search hands its text to the KEDB page, which searches every article type. */
export function takeGlobalQuery(): string {
  try { const q = sessionStorage.getItem(GLOBAL_Q) ?? ""; sessionStorage.removeItem(GLOBAL_Q); return q; } catch { return ""; }
}

export function SkmsHeader({ title, subtitle, onNew }: { title: string; subtitle: string; onNew: () => void }) {
  const { navigate } = useRouter();
  const [q, setQ] = useState("");
  const go = () => {
    if (!q.trim()) return;
    try { sessionStorage.setItem(GLOBAL_Q, q.trim()); } catch { /* storage unavailable: search just opens the KEDB */ }
    navigate("/knowledge/kedb");
  };
  return (
    <div className="page-header-row">
      <div className="page-header-left">
        <div className="breadcrumb">Knowledge Management &gt; {title}</div>
        <div className="page-title">{title}</div>
        <div className="page-subtitle">{subtitle}</div>
      </div>
      <div className="skms-actions">
        <div className="skms-gsearch">
          <Search size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder="Search SKMS, Known Errors, Articles…" aria-label="Search SKMS" />
        </div>
        <button className="btn-primary" onClick={onNew}><FilePlus2 size={14} /> New Article / KEDB</button>
      </div>
    </div>
  );
}

export function SeverityPill({ severity }: { severity: Severity }) {
  const cls = severity === "Critical" || severity === "High" ? "red" : severity === "Medium" ? "amber" : "gray";
  return <span className={`skms-pill ${cls}`}>{severity}</span>;
}

export function WorkaroundBadge({ status }: { status: WorkaroundStatus }) {
  const cls = status === "Verified" ? "green" : status === "Pending" ? "amber" : "gray";
  const label = status === "Verified" ? "Workaround Verified" : status === "Pending" ? "Workaround Pending" : "Draft";
  return <span className={`skms-flag ${cls}`}>{status === "Verified" ? "✓ " : ""}{label}</span>;
}

export function HealthPill({ status }: { status: HealthStatus }) {
  const cls = status === "Healthy" ? "green" : status === "Review Due" ? "amber" : "red";
  return <span className={`skms-pill ${cls}`}>{status}</span>;
}

export function TagList({ tags }: { tags: string[] }) {
  return <div className="skms-tags">{tags.map((t) => <span key={t} className="skms-tag">#{t}</span>)}</div>;
}

export const initialsOf = (name: string) => {
  const p = name.trim().split(/\s+/);
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
};

/** First line of the resolution, shortened, for list rows. */
export const snippet = (a: KnowledgeArticle, max = 130) => {
  const t = a.resolution.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

const DEFAULT_SERVICE_LINES = ["Cloud Infrastructure", "Identity & Access", "Enterprise Applications", "Network Services"];
const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: "Low", label: "Low - Minor Friction" },
  { value: "Medium", label: "Medium - Departmental Impact" },
  { value: "High", label: "High - Enterprise Wide" },
];
const USER_GROUPS = ["All Employees (Global)", "VIP Executives Only", "Remote Workers", "Contractors / Vendors"];
const ANALYST_ROLES = ["All Service Desk Analysts", "Tier 2 & Tier 3 Specialists Only", "Problem Managers Only", "Change Approvers"];
const DEFAULT_WORKGROUPS = ["Global Helpdesk", "Network Operations (NOC)", "Cloud Core Infra", "App Support"];
const DEFAULT_LOCATIONS = ["Global / All Sites", "Headquarters (HQ)", "EMEA Regional Offices", "APAC Tech Hub"];
const DEFAULT_DEPARTMENTS = ["All Departments", "Information Technology", "Finance & Accounting", "Human Resources"];

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="field-group">
      <label className="lbl">{label}</label>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

const unique = (list: string[]) => [...new Set(list.filter(Boolean))];

export function NewArticleModal({ defaultType = "Standard KB", onClose, onCreated }: {
  defaultType?: ArticleType; onClose: () => void; onCreated: (a: KnowledgeArticle) => void;
}) {
  const { user } = useAuth();
  const [type, setType] = useState<ArticleType>(defaultType);
  const [serviceLine, setServiceLine] = useState(DEFAULT_SERVICE_LINES[3]);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [problemCode, setProblemCode] = useState("");
  const [group, setGroup] = useState(USER_GROUPS[0]);
  const [analystRole, setAnalystRole] = useState(ANALYST_ROLES[0]);
  const [workgroup, setWorkgroup] = useState("Global Helpdesk");
  const [location, setLocation] = useState("Global / All Sites");
  const [department, setDepartment] = useState("All Departments");
  const [severity, setSeverity] = useState<Severity>("Low");
  const [author, setAuthor] = useState(user?.name ?? "");
  const [resolution, setResolution] = useState("");
  const [serviceLines, setServiceLines] = useState(DEFAULT_SERVICE_LINES);
  const [workgroups, setWorkgroups] = useState<string[]>(DEFAULT_WORKGROUPS);
  const [locations, setLocations] = useState<string[]>(DEFAULT_LOCATIONS);
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    knowledgeApi.serviceLines().then((l) => live && setServiceLines((cur) => unique([...cur, ...l]))).catch(() => {});
    fetchLookupOptions("groups", "").then((o) => live && setWorkgroups(unique([...DEFAULT_WORKGROUPS, ...o.map((x) => x.label)]))).catch(() => {});
    fetchLookupOptions("locations", "").then((o) => live && setLocations(unique([...DEFAULT_LOCATIONS, ...o.map((x) => x.label)]))).catch(() => {});
    fetchLookupOptions("departments", "").then((o) => live && setDepartments(unique([...DEFAULT_DEPARTMENTS, ...o.map((x) => x.label)]))).catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (!title.trim()) return setError("Enter an article title or error symptom.");
    if (!resolution.trim()) return setError("Provide the resolution or workaround steps.");
    setSaving(true); setError("");
    try {
      const created = await knowledgeApi.create({
        articleType: type,
        title: title.trim(),
        serviceLine,
        tags: tags.split(","),
        audience: { targetUserGroup: group, analystRole, workgroup, location, department },
        severity,
        authorName: author.trim() || undefined,
        resolution: resolution.trim(),
        problemCode: type === "Known Error" ? problemCode.trim() || undefined : undefined,
      });
      onCreated(created);
    } catch (e) {
      setError(errMsg(e, "Could not publish the article."));
      setSaving(false);
    }
  };

  return (
    <>
      <div className="skms-scrim" onClick={onClose} />
      <div className="skms-modal" role="dialog" aria-modal="true" aria-label="Create SKMS Article / Known Error">
        <div className="skms-modal-head">
          <div><FilePlus2 size={16} /> Create SKMS Article / Known Error</div>
          <button className="skms-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="skms-modal-body">
          <ErrorBar msg={error} />
          <div className="skms-grid-2">
            <div className="field-group">
              <label className="lbl">Article Type</label>
              <select className="select" value={type} onChange={(e) => setType(e.target.value as ArticleType)}>
                <option value="Standard KB">Standard KB (How-to / Troubleshooting)</option>
                <option value="Known Error">Known Error (KEDB Workaround)</option>
                <option value="Standard Change">Standard Change Procedure</option>
              </select>
            </div>
            <Select label="Service Line / CI" value={serviceLine} onChange={setServiceLine} options={serviceLines} />
          </div>

          <div className="field-group">
            <label className="lbl">Article Title / Error Symptom <span className="req">*</span></label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300}
              placeholder="e.g., Error 504 Gateway Timeout during batch upload" />
          </div>

          <div className="field-group">
            <label className="lbl">Keywords &amp; Search Tags (Comma separated)</label>
            <input className="input" value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., vpn, gateway, globalprotect, network, timeout" />
            <div className="hint">Used across Incident auto-suggestion and the cross-module ITSM search engine.</div>
          </div>

          {type === "Known Error" && (
            <div className="field-group">
              <label className="lbl">Related Problem record (optional)</label>
              <input className="input" value={problemCode} onChange={(e) => setProblemCode(e.target.value)} placeholder="e.g., PRB-1042" />
              <div className="hint">Links this known error to the Problem it came from.</div>
            </div>
          )}

          <fieldset className="skms-audience">
            <legend>Target Audience &amp; Visibility Access Rules</legend>
            <div className="skms-grid-2">
              <Select label="Target User Group" value={group} onChange={setGroup} options={USER_GROUPS} />
              <Select label="Analyst Role Restriction" value={analystRole} onChange={setAnalystRole} options={ANALYST_ROLES} />
            </div>
            <div className="skms-grid-3">
              <Select label="Workgroup" value={workgroup} onChange={setWorkgroup} options={workgroups} />
              <Select label="Location Scope" value={location} onChange={setLocation} options={locations} />
              <Select label="Department" value={department} onChange={setDepartment} options={departments} />
            </div>
          </fieldset>

          <div className="skms-grid-2">
            <div className="field-group">
              <label className="lbl">Severity / Impact</label>
              <select className="select" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
                {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label className="lbl">Author Name</label>
              <input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} />
            </div>
          </div>

          <div className="field-group">
            <label className="lbl">Resolution / Workaround Steps <span className="req">*</span></label>
            <textarea className="textarea" rows={5} value={resolution} onChange={(e) => setResolution(e.target.value)}
              placeholder="Provide step-by-step resolution or temporary workaround in accordance with KCS standards..." />
          </div>
        </div>
        <div className="skms-modal-foot">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? "Publishing…" : "Publish to SKMS"}</button>
        </div>
      </div>
    </>
  );
}
