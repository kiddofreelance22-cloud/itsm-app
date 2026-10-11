"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, Column } from "@/components/admin/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAdminAssignmentGroup } from "@/lib/hooks/use-admin-modules";
import { useAdminUsers } from "@/lib/hooks/use-admin";
import { AssignmentGroup } from "@/types/admin";

export default function AdminAssignmentGroupPage() {
  const { items, isLoading, create, update, remove } = useAdminAssignmentGroup();
  const { users } = useAdminUsers();
  const [dialog, setDialog] = useState(false);
  const [editItem, setEditItem] = useState<AssignmentGroup | null>(null);
  const [deleteItem, setDeleteItem] = useState<AssignmentGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    groupName: "", groupCode: "", description: "",
    managerId: "" as number | "", memberIds: [] as number[], isActive: true, isDefault: false,
  });

  const openCreate = () => {
    setEditItem(null);
    setForm({ groupName: "", groupCode: "", description: "", managerId: "", memberIds: [], isActive: true, isDefault: false });
    setDialog(true);
  };

  const openEdit = (item: AssignmentGroup) => {
    setEditItem(item);
    setForm({
      groupName: item.groupName, groupCode: item.groupCode,
      description: item.description ?? "",
      managerId: item.manager?.userId ?? "",
      memberIds: item.members.map((m) => m.userId),
      isActive: item.isActive,
      isDefault: item.isDefault,
    });
    setDialog(true);
  };

  const toggleMember = (uid: number) => {
    setForm((p) => ({
      ...p,
      memberIds: p.memberIds.includes(uid)
        ? p.memberIds.filter((id) => id !== uid)
        : [...p.memberIds, uid],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, managerId: form.managerId || undefined };
    const ok = editItem
      ? await update(editItem.groupId, payload)
      : await create(payload);
    setSaving(false);
    if (ok) setDialog(false);
  };

  const columns: Column<AssignmentGroup>[] = [
    { key: "groupName", label: "Group Name", sortable: true, render: (r) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{r.groupName}</span>
        {r.isDefault && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-sm font-semibold">DEFAULT</span>}
      </div>
    ) },
    { key: "groupCode", label: "Group Code", render: (r) => <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{r.groupCode}</code> },
    { key: "manager", label: "Manager", render: (r) => <span className="text-slate-500">{r.manager?.fullName ?? "—"}</span> },
    { key: "members", label: "Members", render: (r) => (
        <span className="flex items-center gap-1 text-slate-500">
          <Users className="size-3.5" /> {r.members.length}
        </span>
      ),
    },
    { key: "isActive", label: "Status", render: (r) => (
        <span className={`text-xs rounded-full px-2 py-0.5 ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {r.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    { key: "_actions", label: "", render: (r) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600"><Pencil className="size-3.5" /></button>
          <button
            onClick={() => setDeleteItem(r)}
            disabled={r.members.length > 0}
            title={r.members.length > 0 ? "Remove all members before deleting this group" : "Delete group"}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent"
          ><Trash2 className="size-3.5" /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Assignment Groups" }]} />
      <PageHeader title="Assignment Group Management" description="Create, edit and manage assignment groups."
        action={<Button onClick={openCreate} className="gap-1.5"><Plus className="size-4" /> New Assignment Group</Button>}
      />
      <DataTable columns={columns} data={items} isLoading={isLoading}
        rowKey={(r) => r.groupId} searchKeys={["groupName", "groupCode"]}
        searchPlaceholder="Search groups..." emptyText="No assignment groups found."
      />

      <Dialog open={dialog} onOpenChange={(v) => !v && setDialog(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editItem ? "Edit Assignment Group" : "Create Assignment Group"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Group Name *</Label>
                <Input value={form.groupName} onChange={(e) => setForm((p) => ({ ...p, groupName: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Group Code *</Label>
                <Input value={form.groupCode} onChange={(e) => setForm((p) => ({ ...p, groupCode: e.target.value }))} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Manager</Label>
              <select value={form.managerId} onChange={(e) => setForm((p) => ({ ...p, managerId: Number(e.target.value) || "" }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— None —</option>
                {users.map((u) => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Members</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                {users.map((u) => (
                  <label key={u.userId} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-slate-50">
                    <input type="checkbox" checked={form.memberIds.includes(u.userId)}
                      onChange={() => toggleMember(u.userId)} className="accent-blue-600" />
                    <span className="text-sm">{u.fullName}</span>
                    <span className="text-xs text-slate-400">{u.email}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-400">{form.memberIds.length} member{form.memberIds.length !== 1 ? "s" : ""} selected</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="accent-blue-600" />
                <label className="text-sm text-gray-700">Active</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))} className="accent-blue-600" />
                <label className="text-sm text-gray-700">Default Group</label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Spinner size="sm" />}
                {editItem ? "Save Changes" : "Create Group"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteItem} title={`Delete "${deleteItem?.groupName}"?`}
        description="This will remove the group and all member assignments."
        confirmLabel="Delete" variant="danger"
        onConfirm={async () => { if (deleteItem) { await remove(deleteItem.groupId); setDeleteItem(null); } }}
        onCancel={() => setDeleteItem(null)}
      />
    </div>
  );
}
