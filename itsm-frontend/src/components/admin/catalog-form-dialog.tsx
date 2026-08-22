"use client";
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Catalog } from "@/types/catalog";
import { Category } from "@/types/admin";
import { Workflow } from "@/types/workflow";

interface CatalogFormDialogProps {
  open: boolean;
  catalog?: Catalog | null;
  categories: Category[];
  workflows: Workflow[];
  isLoading?: boolean;
  onSubmit: (data: {
    catalogName: string;
    shortDescription?: string;
    description?: string;
    categoryId: number;
    iconUrl?: string;
    workflowId?: number;
    isActive?: boolean;
  }) => Promise<boolean>;
  onClose: () => void;
}

export function CatalogFormDialog({
  open, catalog, categories, workflows, isLoading = false, onSubmit, onClose,
}: CatalogFormDialogProps) {
  const isEdit = !!catalog;
  const [form, setForm] = useState({
    catalogName: "", shortDescription: "", description: "",
    categoryId: "" as number | "", iconUrl: "",
    workflowId: "" as number | "", isActive: true,
  });

  useEffect(() => {
    if (catalog) {
      setForm({
        catalogName: catalog.catalogName,
        shortDescription: catalog.shortDescription ?? "",
        description: catalog.description ?? "",
        categoryId: catalog.category?.categoryId ?? "",
        iconUrl: catalog.iconUrl ?? "",
        workflowId: catalog.workflow?.workflowId ?? "",
        isActive: catalog.isActive,
      });
    } else {
      setForm({
        catalogName: "", shortDescription: "", description: "",
        categoryId: "", iconUrl: "", workflowId: "", isActive: true,
      });
    }
  }, [catalog, open]);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categoryId) return;
    const ok = await onSubmit({
      catalogName: form.catalogName,
      shortDescription: form.shortDescription || undefined,
      description: form.description || undefined,
      categoryId: Number(form.categoryId),
      iconUrl: form.iconUrl || undefined,
      workflowId: form.workflowId ? Number(form.workflowId) : undefined,
      isActive: form.isActive,
    });
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Catalog Item" : "Create Catalog Item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Catalog Name *</Label>
            <Input value={form.catalogName} onChange={set("catalogName")} required />
          </div>
          <div className="space-y-1.5">
            <Label>Short Description</Label>
            <Input value={form.shortDescription} onChange={set("shortDescription")} placeholder="Shown on the catalog tile" />
          </div>
          <div className="space-y-1.5">
            <Label>Full Description</Label>
            <Textarea rows={3} value={form.description} onChange={set("description")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((p) => ({ ...p, categoryId: Number(e.target.value) || "" }))}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select --</option>
                {categories.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Workflow (optional)</Label>
              <select
                value={form.workflowId}
                onChange={(e) => setForm((p) => ({ ...p, workflowId: Number(e.target.value) || "" }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— No workflow —</option>
                {workflows.map((w) => (
                  <option key={w.workflowId} value={w.workflowId}>{w.workflowName}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Icon URL</Label>
            <Input value={form.iconUrl} onChange={set("iconUrl")} placeholder="https://..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading && <Spinner size="sm" />}
              {isEdit ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
