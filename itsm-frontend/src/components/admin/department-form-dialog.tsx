"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Department } from "@/lib/api/departments.api";

interface DepartmentFormDialogProps {
  open: boolean;
  department: Department | null;
  isLoading: boolean;
  onSubmit: (data: { departmentName: string; departmentCode: string; description?: string; isActive?: boolean; availableInPortal?: boolean }) => Promise<boolean>;
  onClose: () => void;
}

export function DepartmentFormDialog({ open, department, isLoading, onSubmit, onClose }: DepartmentFormDialogProps) {
  const [formData, setFormData] = useState({
    departmentName: "",
    departmentCode: "",
    description: "",
    isActive: true,
    availableInPortal: true,
  });

  useEffect(() => {
    if (department) {
      setFormData({
        departmentName: department.departmentName,
        departmentCode: department.departmentCode,
        description: department.description || "",
        isActive: department.isActive,
        availableInPortal: department.availableInPortal,
      });
    } else {
      setFormData({
        departmentName: "",
        departmentCode: "",
        description: "",
        isActive: true,
        availableInPortal: true,
      });
    }
  }, [department, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onSubmit(formData);
    if (success) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{department ? "Edit Department" : "Add Department"}</DialogTitle>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Department Name *</label>
            <input
              type="text"
              value={formData.departmentName}
              onChange={(e) => setFormData({ ...formData, departmentName: e.target.value })}
              className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Department Code *</label>
            <input
              type="text"
              value={formData.departmentCode}
              onChange={(e) => setFormData({ ...formData, departmentCode: e.target.value.toUpperCase() })}
              className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm uppercase"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full h-20 rounded-lg border border-slate-300 bg-white px-3 text-sm resize-none"
              placeholder="Optional description"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="isActive" className="text-sm text-slate-700">Active</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="availableInPortal"
                checked={formData.availableInPortal}
                onChange={(e) => setFormData({ ...formData, availableInPortal: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="availableInPortal" className="text-sm text-slate-700">Available in Portal</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : department ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
