"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/lib/hooks/use-toast";
import { RolesApi } from "@/lib/api/roles.api";
import { ApiError } from "@/lib/api/client";
import { Role } from "@/types/admin";
import RoleDetailsPanel from "@/components/admin/role-details-panel";
import { RoleFormDialog } from "@/components/admin/role-form-dialog";

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [isDeletingRole, setIsDeletingRole] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRoles = async () => {
    try {
      setIsLoading(true);
      const data = await RolesApi.list();
      setRoles(data);
    } catch (error: unknown) {
      toast({ title: "Error", description: "Failed to load roles", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRoles = roles.filter((role) =>
    role.roleName.toLowerCase().includes(search.toLowerCase()) ||
    (role.roleCode?.toLowerCase().includes(search.toLowerCase()))
  );

  const PROTECTED_ROLE_NAMES = ["Admin", "Administrator"];
  const isProtected = (role: Role) => PROTECTED_ROLE_NAMES.includes(role.roleName);
  const assignedUserCount = (role: Role) => Math.max(0, Number(role.userCount) || 0);

  const handleDeleteRole = async () => {
    if (!deleteRole || isDeletingRole) return;
    setIsDeletingRole(true);
    try {
      await RolesApi.remove(deleteRole.roleId);
      toast({ title: "Deleted", variant: "success" });
      await loadRoles();
      setDeleteRole(null);
      if (selectedRole?.roleId === deleteRole.roleId) {
        setSelectedRole(null);
      }
    } catch (error: unknown) {
      const description = error instanceof ApiError ? error.message : "Failed to delete role";
      toast({ title: "Error", description, variant: "error" });
      setDeleteRole(null);
      // Reconcile with the server regardless of outcome — if the delete
      // actually went through (e.g. a duplicate/late request 404ing on a
      // role that a prior click already removed), the list must reflect
      // that instead of leaving a stale row next to the error toast.
      await loadRoles();
    } finally {
      setIsDeletingRole(false);
    }
  };

  const openCreateForm = () => {
    setEditingRole(null);
    setFormOpen(true);
  };

  const openEditForm = (role: Role) => {
    setEditingRole(role);
    setFormOpen(true);
  };

  const handleSubmitRole = async (data: {
    roleName: string;
    roleCode?: string;
    description?: string;
    isActive?: boolean;
  }): Promise<boolean> => {
    setIsSavingRole(true);
    try {
      if (editingRole) {
        const updated = await RolesApi.update(editingRole.roleId, data);
        toast({ title: "Role updated", variant: "success" });
        // Keep the details panel in sync if we just edited the selected role.
        setSelectedRole((prev) => (prev?.roleId === updated.roleId ? { ...prev, ...updated } : prev));
      } else {
        await RolesApi.create(data);
        toast({ title: "Role created", variant: "success" });
      }
      await loadRoles();
      return true;
    } catch (error: unknown) {
      const description = error instanceof ApiError ? error.message : "Failed to save role";
      toast({ title: "Error", description, variant: "error" });
      return false;
    } finally {
      setIsSavingRole(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] h-full flex flex-col">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "Admin" }, { label: "Roles Management" }]} />

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Roles Management</h1>
          <p className="text-sm text-slate-500">Create, edit and manage roles and their permissions.</p>
        </div>
        <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={openCreateForm}>
          <Plus className="size-4" /> New Role
        </Button>
      </div>

      {/* Main Content Area: Split View */}
      <div className="flex flex-1 gap-6 min-h-0 overflow-hidden">
        {/* Left Column: Roles List */}
        <div className={`flex flex-col bg-white rounded-lg border shadow-sm ${selectedRole ? 'w-1/3' : 'w-full'} transition-all duration-300`}>
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Roles ({roles.length})</h2>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  placeholder="Search roles..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr className="border-b bg-white text-xs font-semibold text-slate-900">
                  <th className="px-6 py-3 text-left">Role Name</th>
                  <th className="px-6 py-3 text-left">Role Code</th>
                  <th className="px-6 py-3 text-center">Users</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRoles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No roles found.
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((role) => (
                    <tr 
                      key={role.roleId} 
                      className={`hover:bg-slate-50/50 transition-colors ${selectedRole?.roleId === role.roleId ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedRole(role)}
                          className="font-medium text-slate-900 hover:text-blue-600 text-left"
                        >
                          {role.roleName}
                        </button>
                        {isProtected(role) && (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                            System
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">{role.roleCode}</td>
                      <td className="px-6 py-4 text-center font-medium text-slate-700">{role.userCount ?? 0}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-xs rounded px-2.5 py-1 font-medium ${role.isActive ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                          {role.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEditForm(role)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-slate-100"
                            title="Edit role"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => setDeleteRole(role)}
                            disabled={isProtected(role) || assignedUserCount(role) > 0}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent"
                            title={
                              isProtected(role)
                                ? "System roles can't be deleted"
                                : assignedUserCount(role) > 0
                                ? "Reassign or remove the users on this role before deleting it"
                                : "Delete role"
                            }
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="border-t px-6 py-3 bg-white text-xs text-slate-500 rounded-b-lg">
            Showing 1 to {filteredRoles.length} of {roles.length} entries
          </div>
        </div>

        {/* Right Column: Role Details Panel */}
        {selectedRole && (
          <div className="w-2/3 flex flex-col min-h-0">
            <RoleDetailsPanel
              role={selectedRole}
              onClose={() => setSelectedRole(null)}
              onRoleUpdated={() => {
                loadRoles();
              }}
              onEditRole={() => openEditForm(selectedRole)}
            />
          </div>
        )}
      </div>

      {/* Create / Edit Role */}
      <RoleFormDialog
        open={formOpen}
        isLoading={isSavingRole}
        initialRole={editingRole}
        onSubmit={handleSubmitRole}
        onClose={() => setFormOpen(false)}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteRole}
        title={`Delete "${deleteRole?.roleName}"?`}
        description="This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeletingRole}
        onConfirm={handleDeleteRole}
        onCancel={() => !isDeletingRole && setDeleteRole(null)}
      />
    </div>
  );
}
