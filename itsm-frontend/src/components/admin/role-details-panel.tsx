"use client";

import { useEffect, useState } from "react";
import { Shield, ChevronDown, ChevronUp, Users, Check, LayoutGrid, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { RolesApi } from "@/lib/api/roles.api";
import { Role, Permission } from "@/types/admin";
import { Checkbox } from "@/components/ui/checkbox";

type RoleTab = "details" | "permissions" | "users" | "groups" | "audit";

interface RoleDetailsPanelProps {
  role: Role;
  onClose: () => void;
  onRoleUpdated: () => void;
}

export default function RoleDetailsPanel({
  role,
  onClose,
  onRoleUpdated,
}: RoleDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<RoleTab>("permissions");
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
  const [allPermissions, setAllPermissions] = useState<Record<string, Permission[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (role) {
      loadRolePermissions();
      loadAllPermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

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

  // The screenshot shows a layout similar to what we're building
  return (
    <div className="flex h-full flex-col bg-white rounded-lg border shadow-sm">
      <div className="flex items-start justify-between border-b p-6">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-full bg-blue-50 flex items-center justify-center">
            <Users className="size-6 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">{role.roleName}</h2>
              <span
                className={`text-xs rounded px-2 py-0.5 font-medium ${
                  role.isActive
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {role.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
              <span className="font-medium text-slate-700">Role Code: {role.roleCode}</span>
              <span>|</span>
              <span>Users: {role.userCount ?? 0}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 text-slate-600">
             Edit Role Details
          </Button>
          <Button variant="outline" size="sm" className="gap-2 text-slate-600">
             More Actions <ChevronDown className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-600">
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b px-6 pt-4">
        {(
          [
            { key: "details" as const, label: "Role Details" },
            { key: "permissions" as const, label: "Permissions" },
            { key: "users" as const, label: `Users (${role.userCount ?? 0})` },
            { key: "groups" as const, label: "Groups (2)" }, // Mock data to match screenshot
            { key: "audit" as const, label: "Audit Logs" },
          ] as Array<{ key: RoleTab; label: string }>
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
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
      <div className="flex-1 overflow-y-auto p-6">
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
          </div>
        )}

        {activeTab === "permissions" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-3 bg-blue-50/50 text-blue-700 rounded-lg text-sm border border-blue-100">
              <Shield className="size-4 text-blue-500" />
              <span>Assign permissions to this role by selecting modules and their access rights.</span>
            </div>

            <div className="flex gap-6 border-b">
              <button className="pb-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600">
                Module Permissions
              </button>
              <button className="pb-3 text-sm font-medium border-b-2 border-transparent text-slate-500">
                Field Permissions
              </button>
            </div>

            <div className="rounded-lg border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3 text-left">Module</th>
                    <th className="px-4 py-3 text-center">None</th>
                    <th className="px-4 py-3 text-center">Read</th>
                    <th className="px-4 py-3 text-center">Create</th>
                    <th className="px-4 py-3 text-center">Update</th>
                    <th className="px-4 py-3 text-center">Delete</th>
                    <th className="px-4 py-3 text-center">Administer</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.entries(allPermissions).map(([module, perms]) => {
                    // Quick check if all module perms are unselected
                    const modulePermIds = perms.map(p => p.permissionId);
                    const isNone = !modulePermIds.some(id => selectedPermissions.includes(id));
                    
                    return (
                      <tr key={module} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 flex items-center gap-2 font-medium text-slate-700">
                          <LayoutGrid className="size-4 text-slate-400" />
                          {module}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center">
                            <div className={`size-4 rounded-full border flex items-center justify-center ${isNone ? 'border-slate-300' : 'border-slate-300'}`}>
                              {isNone && <div className="size-2 rounded-full bg-slate-300" />}
                            </div>
                          </div>
                        </td>
                        {["Read", "Create", "Update", "Delete", "Admin"].map((type) => {
                          const perm = perms.find(p => p.permissionType === type);
                          if (!perm) return <td key={type} className="px-4 py-3 text-center"><span className="text-slate-300">-</span></td>;
                          
                          const isSelected = selectedPermissions.includes(perm.permissionId);
                          return (
                            <td key={type} className="px-4 py-3 text-center">
                              <div className="flex justify-center cursor-pointer" onClick={() => handlePermissionToggle(perm.permissionId)}>
                                <div className={`size-4 rounded-full flex items-center justify-center border ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                                  {isSelected && <Check className="size-3 text-white" strokeWidth={3} />}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => loadRolePermissions()}>
                Cancel
              </Button>
              <Button onClick={handleSavePermissions} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>

            <div className="pt-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Permission Set Summary</h3>
              {/* Permission Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                <div className="rounded-lg bg-blue-50/50 p-4 border border-blue-100 flex flex-col items-start gap-2">
                  <div className="size-8 rounded bg-blue-100 flex items-center justify-center text-blue-600">
                    <LayoutGrid className="size-4" />
                  </div>
                  <p className="text-xs font-medium text-slate-600">Total Modules</p>
                  <p className="text-2xl font-bold text-slate-900">{totalModules}</p>
                </div>
                <div className="rounded-lg bg-green-50/50 p-4 border border-green-100 flex flex-col items-start gap-2">
                  <div className="size-8 rounded bg-green-100 flex items-center justify-center text-green-600">
                    <Check className="size-4" />
                  </div>
                  <p className="text-xs font-medium text-slate-600">Read Access</p>
                  <p className="text-2xl font-bold text-slate-900">{summary["Read"] || 0}</p>
                </div>
                <div className="rounded-lg bg-amber-50/50 p-4 border border-amber-100 flex flex-col items-start gap-2">
                  <div className="size-8 rounded bg-amber-100 flex items-center justify-center text-amber-600">
                    <Check className="size-4" />
                  </div>
                  <p className="text-xs font-medium text-slate-600">Create Access</p>
                  <p className="text-2xl font-bold text-slate-900">{summary["Create"] || 0}</p>
                </div>
                <div className="rounded-lg bg-purple-50/50 p-4 border border-purple-100 flex flex-col items-start gap-2">
                  <div className="size-8 rounded bg-purple-100 flex items-center justify-center text-purple-600">
                    <Check className="size-4" />
                  </div>
                  <p className="text-xs font-medium text-slate-600">Update Access</p>
                  <p className="text-2xl font-bold text-slate-900">{summary["Update"] || 0}</p>
                </div>
                <div className="rounded-lg bg-red-50/50 p-4 border border-red-100 flex flex-col items-start gap-2">
                  <div className="size-8 rounded bg-red-100 flex items-center justify-center text-red-600">
                    <X className="size-4" />
                  </div>
                  <p className="text-xs font-medium text-slate-600">Delete Access</p>
                  <p className="text-2xl font-bold text-slate-900">{summary["Delete"] || 0}</p>
                </div>
                <div className="rounded-lg bg-indigo-50/50 p-4 border border-indigo-100 flex flex-col items-start gap-2">
                  <div className="size-8 rounded bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <Shield className="size-4" />
                  </div>
                  <p className="text-xs font-medium text-slate-600">Administer Access</p>
                  <p className="text-2xl font-bold text-slate-900">{summary["Admin"] || 0}</p>
                </div>
              </div>
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
    </div>
  );
}
