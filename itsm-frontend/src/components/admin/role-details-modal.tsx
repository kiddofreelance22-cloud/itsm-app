"use client";

import { useEffect, useState } from "react";
import { Shield, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/lib/hooks/use-toast";
import { RolesApi } from "@/lib/api/roles.api";
import { Role, Permission } from "@/types/admin";
import { Checkbox } from "@/components/ui/checkbox";

type RoleTab = "details" | "permissions" | "users" | "groups" | "audit";

interface RoleDetailsModalProps {
  open: boolean;
  role: Role;
  onClose: () => void;
  onRoleUpdated: () => void;
}

export default function RoleDetailsModal({
  open,
  role,
  onClose,
  onRoleUpdated,
}: RoleDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<RoleTab>("permissions");
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
  const [allPermissions, setAllPermissions] = useState<Record<string, Permission[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (open && role) {
      loadRolePermissions();
      loadAllPermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, role]);

  const loadRolePermissions = async () => {
    try {
      const data = await RolesApi.getPermissions(role.roleId);
      setSelectedPermissions(data.permissions.map((p) => p.permissionId));
    } catch (error: unknown) {
      toast({ title: "Error", description: "Failed to load permissions", variant: "error" });
    }
  };

  const loadAllPermissions = async () => {
    try {
      const data = await RolesApi.getAllPermissions();
      setAllPermissions(data);
      // Initialize all modules as expanded
      const expanded: Record<string, boolean> = {};
      Object.keys(data).forEach((module) => {
        expanded[module] = true;
      });
      setExpandedModules(expanded);
    } catch (error: unknown) {
      toast({ title: "Error", description: "Failed to load all permissions", variant: "error" });
    }
  };

  const handlePermissionToggle = (permissionId: number) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleSavePermissions = async () => {
    try {
      setIsSaving(true);
      await RolesApi.updatePermissions(role.roleId, {
        permissionIds: selectedPermissions,
      });
      toast({ title: "Permissions updated", variant: "success" });
      onRoleUpdated();
    } catch (error: unknown) {
      toast({ title: "Error", description: "Failed to save permissions", variant: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const calculatePermissionSummary = () => {
    const summary: Record<string, number> = {
      "Read": 0,
      "Create": 0,
      "Update": 0,
      "Delete": 0,
      "Admin": 0,
    };

    selectedPermissions.forEach((permId) => {
      const perm = Object.values(allPermissions)
        .flat()
        .find((p) => p.permissionId === permId);
      if (perm) {
        summary[perm.permissionType] = (summary[perm.permissionType] || 0) + 1;
      }
    });

    return summary;
  };

  const summary = calculatePermissionSummary();
  const totalModules = Object.keys(allPermissions).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Shield className="size-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle>{role.roleName}</DialogTitle>
              <p className="text-xs text-slate-500 mt-1">
                Role Code: {role.roleCode}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b mt-4">
          {(
            [
              { key: "details" as const, label: "Role Details" },
              { key: "permissions" as const, label: "Permissions" },
              { key: "users" as const, label: "Users" },
              { key: "groups" as const, label: "Groups" },
              { key: "audit" as const, label: "Audit Logs" },
            ] as Array<{ key: RoleTab; label: string }>
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="mt-6">
          {activeTab === "details" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Role Name</label>
                <p className="mt-1 text-slate-900">{role.roleName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Role Code</label>
                <p className="mt-1 font-mono text-sm text-slate-600">{role.roleCode}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Description</label>
                <p className="mt-1 text-slate-600">{role.description || "—"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Status</label>
                <p className="mt-1">
                  <span
                    className={`text-xs rounded-full px-2.5 py-1 font-medium ${
                      role.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {role.isActive ? "Active" : "Inactive"}
                  </span>
                </p>
              </div>
            </div>
          )}

          {activeTab === "permissions" && (
            <div className="space-y-6">
              {/* Permission Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-50 p-3 text-center border">
                  <p className="text-2xl font-bold text-slate-700">{totalModules}</p>
                  <p className="text-xs text-slate-600 mt-1">Total Modules</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3 text-center border border-blue-200">
                  <p className="text-2xl font-bold text-blue-600">{summary["Read"] || 0}</p>
                  <p className="text-xs text-blue-600 mt-1">Read Access</p>
                </div>
                <div className="rounded-lg bg-green-50 p-3 text-center border border-green-200">
                  <p className="text-2xl font-bold text-green-600">{summary["Create"] || 0}</p>
                  <p className="text-xs text-green-600 mt-1">Create Access</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3 text-center border border-amber-200">
                  <p className="text-2xl font-bold text-amber-600">{summary["Update"] || 0}</p>
                  <p className="text-xs text-amber-600 mt-1">Update Access</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3 text-center border border-red-200">
                  <p className="text-2xl font-bold text-red-600">{summary["Delete"] || 0}</p>
                  <p className="text-xs text-red-600 mt-1">Delete Access</p>
                </div>
                <div className="rounded-lg bg-purple-50 p-3 text-center border border-purple-200">
                  <p className="text-2xl font-bold text-purple-600">{summary["Admin"] || 0}</p>
                  <p className="text-xs text-purple-600 mt-1">Admin Access</p>
                </div>
              </div>

              {/* Permissions by Module */}
              <div className="space-y-3">
                {Object.entries(allPermissions).map(([module, perms]) => (
                  <div key={module} className="rounded-lg border bg-white">
                    <button
                      onClick={() =>
                        setExpandedModules((prev) => ({
                          ...prev,
                          [module]: !prev[module],
                        }))
                      }
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-900">{module}</span>
                      {expandedModules[module] ? (
                        <ChevronUp className="size-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="size-4 text-slate-400" />
                      )}
                    </button>

                    {expandedModules[module] && (
                      <div className="border-t px-4 py-3 bg-slate-50 space-y-2">
                        {perms.map((perm) => (
                          <label
                            key={perm.permissionId}
                            className="flex items-center gap-3 cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedPermissions.includes(
                                perm.permissionId
                              )}
                              onCheckedChange={() =>
                                handlePermissionToggle(perm.permissionId)
                              }
                            />
                            <span className="text-sm text-slate-700">
                              {perm.permissionType}{" "}
                              {perm.description && (
                                <span className="text-slate-500">
                                  ({perm.description})
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab !== "details" && activeTab !== "permissions" && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Shield className="size-10 mb-2 opacity-30" />
              <p className="text-sm">This tab is not yet implemented.</p>
            </div>
          )}
        </div>

        {activeTab === "permissions" && (
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Permissions"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
