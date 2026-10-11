"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ApiError } from "../api";
import { adminMasterApi } from "../adminMasterApi";

type RecordData = Record<string, unknown>;
interface UserOption { userId: number; fullName: string; username?: string; isActive?: boolean }

const codeFrom = (name: string) => name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50);

/** Add / edit a workgroup, including who manages it and which engineers are its members. */
export function WorkgroupForm({ item, onClose, onSaved }: { item: RecordData | null; onClose: () => void; onSaved: () => void }) {
  const groupId = item ? Number(item.groupId) : null;
  const existingMembers = useMemo(
    () => ((item?.members as UserOption[] | undefined) ?? []).map((m) => Number(m.userId)),
    [item],
  );
  const manager = item?.manager as { userId?: number } | null | undefined;

  const [users, setUsers] = useState<UserOption[]>([]);
  const [name, setName] = useState(String(item?.groupName ?? ""));
  const [description, setDescription] = useState(String(item?.description ?? ""));
  const [managerId, setManagerId] = useState(manager?.userId ? String(manager.userId) : "");
  const [memberIds, setMemberIds] = useState<number[]>(existingMembers);
  const [isActive, setIsActive] = useState(item ? Boolean(item.isActive) : true);
  const [isDefault, setIsDefault] = useState(Boolean(item?.isDefault));
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    adminMasterApi.list<UserOption>("/users").then(setUsers).catch(() => setUsers([]));
  }, []);

  const shown = users
    .filter((u) => u.isActive !== false || memberIds.includes(u.userId))
    .filter((u) => !filter.trim() || `${u.fullName} ${u.username ?? ""}`.toLowerCase().includes(filter.trim().toLowerCase()));

  const toggle = (id: number, on: boolean) => setMemberIds((cur) => (on ? [...new Set([...cur, id])] : cur.filter((x) => x !== id)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { setError("Workgroup Name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const body: RecordData = {
        groupName: name.trim(),
        description: description.trim() || undefined,
        managerId: managerId ? Number(managerId) : undefined,
        memberIds,
        isActive,
        isDefault,
      };
      if (groupId === null) await adminMasterApi.create<RecordData>("/assignment-groups", { ...body, groupCode: codeFrom(name) });
      else await adminMasterApi.update<RecordData>("/assignment-groups", groupId, { ...body, managerId: managerId ? Number(managerId) : null });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save workgroup.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card admin-master-form-panel" onSubmit={submit}>
      <div className="admin-master-form-heading">
        <h2>{groupId === null ? "Add workgroup" : "Edit workgroup"}</h2>
        <button type="button" className="admin-master-icon-button" aria-label="Close form" onClick={onClose}><X aria-hidden="true" size={16} /></button>
      </div>
      {error && <div className="admin-master-error" role="alert">{error}</div>}
      <div className="admin-master-form-grid">
        <label className="field-group"><span className="lbl">Workgroup Name<span className="req"> *</span></span>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field-group"><span className="lbl">Manager</span>
          <select className="select" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">— None —</option>
            {users.filter((u) => u.isActive !== false || String(u.userId) === managerId).map((u) => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
          </select></label>
        <label className="field-group admin-master-wide"><span className="lbl">Description</span>
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <div className="field-group admin-master-wide">
          <span className="lbl">Engineers ({memberIds.length} selected)</span>
          <input className="input" placeholder="Search engineers…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ marginBottom: 8 }} />
          <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid #E4E7EC", borderRadius: 8, padding: "6px 10px" }}>
            {shown.length === 0 ? <div className="muted" style={{ padding: 8 }}>No users found.</div> : shown.map((u) => (
              <label key={u.userId} className="admin-master-check-label" style={{ display: "flex", gap: 8, padding: "4px 0" }}>
                <input type="checkbox" checked={memberIds.includes(u.userId)} onChange={(e) => toggle(u.userId, e.target.checked)} />
                <span>{u.fullName}{u.username ? <span className="muted"> ({u.username})</span> : null}</span>
              </label>
            ))}
          </div>
        </div>
        <label className="field-group"><span className="admin-master-check-label">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active</span></label>
        <label className="field-group"><span className="admin-master-check-label">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Default Workgroup</span></label>
      </div>
      <div className="admin-master-form-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
