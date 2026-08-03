"use client";
import { useState } from "react";
import { X, UserCog, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { AdminUser, Role } from "@/types/admin";

interface RoleAssignDialogProps {
  open: boolean;
  user: AdminUser | null;
  roles: Role[];
  isLoading?: boolean;
  onAssign: (userId: number, roleId: number) => Promise<boolean>;
  onUnassign: (userId: number, roleId: number) => Promise<boolean>;
  onClose: () => void;
}

export function RoleAssignDialog({
  open, user, roles, isLoading = false, onAssign, onUnassign, onClose,
}: RoleAssignDialogProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<number | "">("");

  if (!user) return null;

  const assignedIds = new Set((user.userRoles ?? []).map((ur) => ur.role.roleId));
  const unassignedRoles = roles.filter((r) => !assignedIds.has(r.roleId));

  const handleAssign = async () => {
    if (!selectedRoleId) return;
    const ok = await onAssign(user.userId, Number(selectedRoleId));
    if (ok) setSelectedRoleId("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-xl border-slate-200 p-0 overflow-hidden">
        <div className="p-5">
          <DialogHeader>
            <div className="flex gap-3 items-center">
              <div className="size-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                <UserCog className="size-5" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Manage Roles — {user.fullName}
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-0.5">
                  {user.email}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 pt-5">
            {/* Current roles */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Current Roles
              </p>
              {(user.userRoles ?? []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-4 text-center">
                  <p className="text-sm text-slate-400">No roles assigned</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(user.userRoles ?? []).map((ur) => (
                    <span
                      key={ur.role.roleId}
                      className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 pl-3 pr-2 py-1 text-xs font-semibold"
                    >
                      {ur.role.roleName}
                      <button
                        onClick={() => onUnassign(user.userId, ur.role.roleId)}
                        className="rounded-full p-0.5 text-blue-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Assign new role */}
            {unassignedRoles.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Assign Role</Label>
                <div className="flex gap-2">
                  <select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(Number(e.target.value) || "")}
                    className="flex-1 rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">-- Select role --</option>
                    {unassignedRoles.map((r) => (
                      <option key={r.roleId} value={r.roleId}>{r.roleName}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    onClick={handleAssign}
                    disabled={!selectedRoleId || isLoading}
                    className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-medium"
                  >
                    {isLoading ? <Spinner size="sm" /> : <Check className="size-4" />}
                    Assign
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-5 py-4 bg-slate-50/50 border-t border-slate-100">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-200 text-slate-600 font-medium"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}