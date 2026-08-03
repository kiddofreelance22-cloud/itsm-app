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

interface RoleFormDialogProps {
  open: boolean;
  isLoading?: boolean;
  onSubmit: (data: {
    roleName: string;
    roleCode?: string;
    description?: string;
    isActive?: boolean;
  }) => Promise<boolean>;
  onClose: () => void;
}

export function RoleFormDialog({
  open, isLoading = false, onSubmit, onClose,
}: RoleFormDialogProps) {
  const [form, setForm] = useState({
    roleName: "", roleCode: "", description: ""
  });
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      setForm({ roleName: "", roleCode: "", description: "" });
      setIsActive(true);
    }
  }, [open]);

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
            <DialogTitle>Create New Role</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="roleName">Role Name <span className="text-red-500">*</span></Label>
              <Input
                id="roleName"
                value={form.roleName}
                onChange={set("roleName")}
                placeholder="e.g. Helpdesk Agent"
                required
              />
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !form.roleName}>
              {isLoading && <Spinner className="mr-2" size="sm" />}
              Create Role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
