"use client";
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Role } from "@/types/admin";
import { RolesApi } from "@/lib/api/roles.api";
import { Users } from "lucide-react";

// System roles whose name can't be changed (mirrors the backend's
// PROTECTED_ROLE_NAMES guard in RolesService).
const PROTECTED_ROLE_NAMES = ["Admin", "Administrator"];

interface RoleFormDialogProps {
  open: boolean;
  isLoading?: boolean;
  /** When set, the dialog edits this role instead of creating a new one. */
  initialRole?: Role | null;
  onSubmit: (data: {
    roleName: string;
    roleCode?: string;
    description?: string;
    isActive?: boolean;
  }) => Promise<boolean>;
  onClose: () => void;
}

export function RoleFormDialog({
  open, isLoading = false, initialRole = null, onSubmit, onClose,
}: RoleFormDialogProps) {
  const isEditMode = !!initialRole;
  const roleNameLocked = isEditMode && PROTECTED_ROLE_NAMES.includes(initialRole?.roleName ?? "");

  const [form, setForm] = useState({
    roleName: "", roleCode: "", description: ""
  });
  const [isActive, setIsActive] = useState(true);
  const [activeTab, setActiveTab] = useState<"details" | "users">("details");
  const [roleUsers, setRoleUsers] = useState<{
    userId: number;
    fullName: string;
    email: string;
    isActive: boolean;
  }[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const displayedUserCount = isLoadingUsers
    ? initialRole?.userCount ?? roleUsers.length
    : roleUsers.length;

  useEffect(() => {
    if (open) {
      setActiveTab("details");
      setForm({
        roleName: initialRole?.roleName ?? "",
        roleCode: initialRole?.roleCode ?? "",
        description: initialRole?.description ?? "",
      });
      setIsActive(initialRole?.isActive ?? true);

      if (initialRole) {
        setIsLoadingUsers(true);
        RolesApi.getUsers(initialRole.roleId)
          .then(setRoleUsers)
          .catch(() => setRoleUsers([]))
          .finally(() => setIsLoadingUsers(false));
      } else {
        setRoleUsers([]);
      }
    }
  }, [open, initialRole]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onSubmit({
      roleName: form.roleName,
      roleCode: form.roleCode || undefined,
      description: form.description || undefined,
      isActive,
    });
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Role" : "Create New Role"}</DialogTitle>
          </DialogHeader>

          {isEditMode && (
            <div className="flex gap-5 border-b">
              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "details"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Role Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("users")}
                className={`flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "users"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Users className="size-3.5" />
                Users ({displayedUserCount})
              </button>
            </div>
          )}

          {activeTab === "details" && <div className="grid gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="roleName">Role Name <span className="text-red-500">*</span></Label>
              <Input
                id="roleName"
                value={form.roleName}
                onChange={set("roleName")}
                placeholder="e.g. Helpdesk Agent"
                required
                disabled={roleNameLocked}
              />
              {roleNameLocked && (
                <p className="text-xs text-slate-400">This is a protected system role and can&apos;t be renamed.</p>
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              <Label htmlFor="roleCode">Role Code</Label>
              <Input
                id="roleCode"
                value={form.roleCode}
                onChange={set("roleCode")}
                placeholder="e.g. ROLE_HELPDESK"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={form.description}
                onChange={set("description")}
                rows={3}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe this role..."
              />
            </div>
            
            <div className="flex items-center gap-3">
              <Label>Active</Label>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  isActive ? "bg-blue-600" : "bg-slate-300"
                }`}
              >
                <span className={`inline-block size-3.5 transform rounded-full bg-white transition-transform ${
                  isActive ? "translate-x-[18px]" : "translate-x-[3px]"
                }`} />
              </button>
            </div>
          </div>}

          {activeTab === "users" && (
            <div className="py-2">
              {isLoadingUsers ? (
                <div className="py-10 text-center text-sm text-slate-500">Loading users...</div>
              ) : roleUsers.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">No users are assigned to this role.</div>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="border-b text-left text-xs font-semibold text-slate-600">
                        <th className="px-3 py-2.5">Name</th>
                        <th className="px-3 py-2.5">Email</th>
                        <th className="px-3 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {roleUsers.map((user) => (
                        <tr key={user.userId}>
                          <td className="px-3 py-2.5 font-medium text-slate-800">{user.fullName}</td>
                          <td className="px-3 py-2.5 text-slate-500">{user.email}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={user.isActive ? "text-green-600" : "text-slate-400"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            {activeTab === "details" && (
              <Button type="submit" disabled={isLoading || !form.roleName}>
                {isLoading && <Spinner className="mr-2" size="sm" />}
                {isEditMode ? "Save Changes" : "Create Role"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

