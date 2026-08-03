"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, ShieldCheck, UserX } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, Column } from "@/components/admin/data-table";
import { UserFormDialog } from "@/components/admin/user-form-dialog";
import { RoleAssignDialog } from "@/components/admin/role-assign-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAdminUsers, useAdminRoles } from "@/lib/hooks/use-admin";
import { AdminUser } from "@/types/admin";

export default function AdminUsersPage() {
  const { users, isLoading, create, update, remove, deactivate, refetch } = useAdminUsers();
  const { roles, assign, unassign } = useAdminRoles();

  const [userDialog, setUserDialog] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [roleUser, setRoleUser] = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);

  const columns: Column<AdminUser>[] = [
    { key: "fullName", label: "Name", sortable: true,
      render: (u) => <span className="font-medium">{u.fullName}</span> },
    { key: "username", label: "Username", sortable: true },
    { key: "email", label: "Email", sortable: true },
    { key: "userRoles", label: "Roles",
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {(u.userRoles ?? []).length === 0
            ? <span className="text-slate-400 text-xs">No roles</span>
            : (u.userRoles ?? []).map((ur) => (
                <span key={ur.role.roleId} className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                  {ur.role.roleName}
                </span>
              ))}
        </div>
      ),
    },
    { key: "isActive", label: "Status",
      render: (u) => (
        <span className={`text-xs rounded-full px-2 py-0.5 ${u.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {u.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    { key: "actions", label: "",
      render: (u) => (
        <div className="flex items-center gap-1">
          <button onClick={() => { setEditUser(u); setUserDialog(true); }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600" title="Edit">
            <Pencil className="size-3.5" />
          </button>
          <button onClick={() => setRoleUser(u)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600" title="Manage Roles">
            <ShieldCheck className="size-3.5" />
          </button>
          <button onClick={() => deactivate(u.userId)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-amber-600" title="Deactivate">
            <UserX className="size-3.5" />
          </button>
          <button onClick={() => setDeleteUser(u)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-red-600" title="Delete">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Users" }]} />
      <PageHeader title="Users" description="Manage system users and their roles."
        action={
          <Button onClick={() => { setEditUser(null); setUserDialog(true); }} className="gap-1.5">
            <Plus className="size-4" /> Add User
          </Button>
        }
      />
      <DataTable
        columns={columns} data={users} isLoading={isLoading}
        rowKey={(u) => u.userId} searchKeys={["fullName", "username", "email"]}
        searchPlaceholder="Search users..." emptyText="No users found."
      />

      <UserFormDialog
        open={userDialog} user={editUser} isLoading={saving}
        onSubmit={async (data) => {
          setSaving(true);
          const ok = editUser
            ? await update(editUser.userId, data)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : await create(data as any);
          setSaving(false);
          return !!ok;
        }}
        onClose={() => { setUserDialog(false); setEditUser(null); }}
      />

      <RoleAssignDialog
        open={!!roleUser} user={roleUser} roles={roles}
        onAssign={async (uid, rid) => {
          const ok = await assign(uid, rid);
          if (ok) {
            const latestUsers = await refetch();
            const updated = latestUsers?.find((u) => u.userId === uid) ?? null;
            setRoleUser(updated);
          }
          return !!ok;
        }}
        onUnassign={async (uid, rid) => {
          const ok = await unassign(uid, rid);
          if (ok) {
            const latestUsers = await refetch();
            const updated = latestUsers?.find((u) => u.userId === uid) ?? null;
            setRoleUser(updated);
          }
          return !!ok;
        }}
        onClose={() => setRoleUser(null)}
      />

      <ConfirmDialog
        open={!!deleteUser}
        title={`Delete ${deleteUser?.fullName}?`}
        description="This action cannot be undone."
        confirmLabel="Delete" variant="danger"
        onConfirm={async () => { if (deleteUser) { await remove(deleteUser.userId); setDeleteUser(null); } }}
        onCancel={() => setDeleteUser(null)}
      />
    </div>
  );
}
