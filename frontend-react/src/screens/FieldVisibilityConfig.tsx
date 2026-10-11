import React, { useEffect, useState } from "react";
import { ApiError } from "../api";
import { incidentApi } from "../incidentApi";
import { useAsync } from "../hooks";
import type { FieldVisibility } from "../types";

export function FieldVisibilityConfigPage() {
  const fieldsQ = useAsync<{ fields: FieldVisibility[] }>(() => incidentApi.fieldVisibility(), []);
  const [rows, setRows] = useState<FieldVisibility[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fieldsQ.data) setRows(fieldsQ.data.fields);
  }, [fieldsQ.data]);

  const toggle = (fieldName: string, key: "visible" | "required") => {
    setRows((prev) => prev.map((f) => (f.fieldName === fieldName ? { ...f, [key]: !f[key] } : f)));
    setDirty(true);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await incidentApi.saveFieldVisibility(rows);
      setRows(res.fields);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const DEFAULTS: Record<string, { visible: boolean; required: boolean }> = {
    "Incident Number": { visible: true, required: false },
    "Status": { visible: true, required: false },
    "Short Description": { visible: true, required: false },
    "Description": { visible: true, required: false },
    "Priority": { visible: true, required: false },
    "Category": { visible: true, required: false },
    "Assigned Workgroup": { visible: true, required: false },
    "Assigned Agent": { visible: false, required: false },
    "Created Date": { visible: true, required: false },
    "Resolution Notes": { visible: true, required: false },
    "Closure Code": { visible: false, required: false },
    "Feedback / Rating": { visible: true, required: true },
  };

  const resetDefaults = () => {
    setRows((prev) =>
      prev.map((f) => ({
        ...f,
        visible: DEFAULTS[f.fieldName]?.visible ?? f.visible,
        required: DEFAULTS[f.fieldName]?.required ?? f.required,
      }))
    );
    setDirty(true);
    setSaved(false);
  };

  return (
    <>
      <div className="page-header-row">
        <div className="page-header-left">
          <div className="breadcrumb">Configuration &gt; Incident Masters &gt; End User Incident Details Page</div>
          <div className="page-title">End User Incident Details Page</div>
          <div className="page-subtitle">Control which fields a requester sees when they open one of their own incidents.</div>
        </div>
        <button className="btn-ghost">Close</button>
      </div>

      <div className="page-body">
        <div className="card admin-master-table-wrap">
          <div style={{ padding: "16px 20px" }}>
            <div className="proto-eyebrow">
              <div className="proto-eyebrow-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6M9 12h6M9 15h4" />
                </svg>
                &nbsp; FIELDS ( {rows.length} )
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-ghost" onClick={resetDefaults}>Reset to Recommended Defaults</button>
                <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>

          <div style={{ margin: "0 20px 14px", fontSize: 12, color: "#475467", background: "#F5F8FE", border: "1px solid #D7E4FA", borderRadius: 7, padding: "10px 14px" }}>
            Tick <strong>Visible</strong> to show a field to the requester on their incident details page. <strong>Required</strong> applies to fields the requester can edit, such as feedback. Click <strong>Save Changes</strong> to apply.
          </div>

          {error && <div className="admin-master-error" style={{ margin: "0 20px 14px" }} role="alert">{error}</div>}
          {saved && <div style={{ margin: "0 20px 14px", fontSize: 12, color: "#067647", fontWeight: 600 }}>✓ Saved successfully</div>}

          {fieldsQ.loading ? (
            <div className="spinner-row">Loading…</div>
          ) : (
            <div style={{ padding: "0 20px 20px" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>FIELD</th>
                    <th style={{ width: 100, textAlign: "center" }}>VISIBLE</th>
                    <th style={{ width: 100, textAlign: "center" }}>REQUIRED</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((f) => (
                    <tr key={f.fieldName}>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{f.fieldName}</span>{" "}
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#98A2B3", background: "#F2F4F7", padding: "2px 8px", borderRadius: 10 }}>
                          {f.section}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          style={{ accentColor: "var(--blue)", width: 15, height: 15 }}
                          checked={f.visible}
                          onChange={() => toggle(f.fieldName, "visible")}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          style={{ accentColor: "var(--blue)", width: 15, height: 15 }}
                          checked={f.required}
                          onChange={() => toggle(f.fieldName, "required")}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
