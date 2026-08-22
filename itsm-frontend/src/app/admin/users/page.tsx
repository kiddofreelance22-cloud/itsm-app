"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, ShieldCheck, UserX, Eye } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, Column } from "@/components/admin/data-table";
import { RoleAssignDialog } from "@/components/admin/role-assign-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAdminUsers, useAdminRoles } from "@/lib/hooks/use-admin";
import { AdminUser } from "@/types/admin";

export default function AdminUsersPage() {
  const { users, isLoading, remove, deactivate, refetch } = useAdminUsers();
  const { roles, assign, unassign } = useAdminRoles();

  const [roleUser,   setRoleUser]   = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);

  const columns: Column<AdminUser>[] = [
    {
      key: "fullName", label: "Name", sortable: true,
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
            {u.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-800 truncate">{u.fullName}</p>
            {u.jobTitle && <p className="text-xs text-slate-400 truncate">{u.jobTitle}</p>}
          </div>
        </div>
      ),
    },
    { key: "username", label: "Username", sortable: true,
      render: (u) => <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{u.username}</span> },
    { key: "email", label: "Email", sortable: true },
    {
      key: "primaryRole", label: "Role",
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.primaryRole
            ? <span className="text-xs bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 rounded-full px-2 py-0.5">{u.primaryRole.roleName}</span>
            : (u.userRoles ?? []).length > 0
              ? (u.userRoles ?? []).map((ur) => (
                  <span key={ur.role.roleId} className="text-xs bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 rounded-full px-2 py-0.5">
                    {ur.role.roleName}
                  </span>
                ))
              : <span className="text-slate-400 text-xs">No role</span>}
        </div>
      ),
    },
    {
      key: "assignmentGroup", label: "Group",
      render: (u) => u.assignmentGroup
        ? <span className="text-xs text-slate-600">{u.assignmentGroup.groupName}</span>
        : <span className="text-slate-300 text-xs">—</span>,
    },
    {
      key: "isActive", label: "Status",
      render: (u) => (
        <span className={`text-xs rounded-full px-2.5 py-0.5 font-medium ring-1 ring-inset ${
          u.isActive
            ? "bg-green-50 text-green-700 ring-green-200"
            : "bg-slate-50 text-slate-500 ring-slate-200"
        }`}>
          {u.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions", label: "",
      render: (u) => (
        <div className="flex items-center gap-1">
          <Link href={`/admin/users/${u.userId}`}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-brand-600" title="View">
            <Eye className="size-3.5" />
          </Link>
          <Link href={`/admin/users/${u.userId}/edit`}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-brand-600" title="Edit">
            <Pencil className="size-3.5" />
          </Link>
          <button onClick={() => setRoleUser(u)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-brand-600" title="Manage Roles">
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
    <div className="w-full">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Users" }]} />
      <PageHeader
        title="Users Management"
        description="Manage system users, their roles, and access permissions."
        action={
          <Button asChild className="gap-1.5">
            <Link href="/admin/users/create">
              <Plus className="size-4" /> Add User
            </Link>
          </Button>
        }
      />
      <DataTable
        columns={columns} data={users} isLoading={isLoading}
        rowKey={(u) => u.userId}
        searchKeys={["fullName", "username", "email"]}
        searchPlaceholder="Search by name, username or email..."
        emptyText="No users found."
      />

      <RoleAssignDialog
        open={!!roleUser} user={roleUser} roles={roles}
        onAssign={async (uid, rid) => {
          const ok = await assign(uid, rid);
          if (ok) {
            const latestUsers = await refetch();
            setRoleUser(latestUsers?.find((u) => u.userId === uid) ?? null);
          }
          return !!ok;
        }}
        onUnassign={async (uid, rid) => {
          const ok = await unassign(uid, rid);
          if (ok) {
            const latestUsers = await refetch();
            setRoleUser(latestUsers?.find((u) => u.userId === uid) ?? null);
          }
          return !!ok;
        }}
        onClose={() => setRoleUser(null)}
      />

      <ConfirmDialog
        open={!!deleteUser}
        title={`Delete ${deleteUser?.fullName}?`}
        description="This action cannot be undone. All associated data will be permanently removed."
        confirmLabel="Delete" variant="danger"
        onConfirm={async () => { if (deleteUser) { await remove(deleteUser.userId); setDeleteUser(null); } }}
        onCancel={() => setDeleteUser(null)}
      />
    </div>
  );
}
