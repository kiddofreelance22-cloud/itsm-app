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
import { Category } from "@/types/admin";

interface CategoryFormDialogProps {
  open: boolean;
  category?: Category | null;
  categories: Category[];       // for parent dropdown
  isLoading?: boolean;
  onSubmit: (data: {
    categoryName: string;
    description?: string;
    parentCategoryId?: number;
  }) => Promise<boolean>;
  onClose: () => void;
}

export function CategoryFormDialog({
  open, category, categories, isLoading = false, onSubmit, onClose,
}: CategoryFormDialogProps) {
  const isEdit = !!category;
  const [form, setForm] = useState({
    categoryName: "", description: "", parentCategoryId: "" as number | "",
  });

  useEffect(() => {
    if (category) {
      setForm({
        categoryName: category.categoryName,
        description: category.description ?? "",
        parentCategoryId: category.parent?.categoryId ?? "",
      });
    } else {
      setForm({ categoryName: "", description: "", parentCategoryId: "" });
    }
  }, [category, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onSubmit({
      categoryName: form.categoryName,
      description: form.description || undefined,
      parentCategoryId: form.parentCategoryId ? Number(form.parentCategoryId) : undefined,
    });
    if (ok) onClose();
  };

  // Exclude the category itself from the parent list (can't be its own parent)
  const parentOptions = categories.filter(
    (c) => !category || c.categoryId !== category.categoryId
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Category" : "Create Category"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Category Name *</Label>
            <Input
              value={form.categoryName}
              onChange={(e) => setForm((p) => ({ ...p, categoryName: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Parent Category (optional)</Label>
            <select
              value={form.parentCategoryId}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  parentCategoryId: e.target.value ? Number(e.target.value) : "",
                }))
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— None (top-level) —</option>
              {parentOptions.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.categoryName}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading && <Spinner size="sm" />}
              {isEdit ? "Save Changes" : "Create Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
