"use client";
import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Category } from "@/types/admin";
import { CategoryDeletePolicy } from "@/lib/api/categories.api";

interface CategoryDeleteDialogProps {
  category: Category | null;
  isLoading?: boolean;
  onConfirm: (policy: CategoryDeletePolicy) => void;
  onCancel: () => void;
}

export function CategoryDeleteDialog({ category, isLoading, onConfirm, onCancel }: CategoryDeleteDialogProps) {
  const hasChildren = !!category?.children?.length;
  const [policy, setPolicy] = useState<CategoryDeletePolicy>("reparent");

  useEffect(() => { if (category) setPolicy("reparent"); }, [category]);

  return (
    <Dialog open={!!category} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-red-500" />
            Delete &quot;{category?.categoryName}&quot;?
          </DialogTitle>
          <DialogDescription>
            {hasChildren
              ? "This category has subcategories. Choose what should happen to them."
              : "This category has no subcategories and will be removed."}
          </DialogDescription>
        </DialogHeader>

        {hasChildren && (
          <div className="space-y-2">
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
              policy === "reparent" ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50"
            }`}>
              <input
                type="radio" name="delete-policy" className="mt-0.5"
                checked={policy === "reparent"} onChange={() => setPolicy("reparent")}
              />
              <span>
                <span className="block font-medium text-slate-800">Re-parent / Shift Up</span>
                <span className="block text-xs text-slate-500">
                  Delete only this node — its {category?.children.length} subcategor{category?.children.length === 1 ? "y" : "ies"} move up one level, onto its parent.
                </span>
              </span>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
              policy === "cascade" ? "border-red-400 bg-red-50" : "border-slate-200 hover:bg-slate-50"
            }`}>
              <input
                type="radio" name="delete-policy" className="mt-0.5"
                checked={policy === "cascade"} onChange={() => setPolicy("cascade")}
              />
              <span>
                <span className="block font-medium text-slate-800">Cascade Delete</span>
                <span className="block text-xs text-slate-500">
                  Delete this node and all nested subcategories and their configurations.
                </span>
              </span>
            </label>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
          <Button type="button" variant={policy === "cascade" ? "destructive" : "default"}
            loading={isLoading} onClick={() => onConfirm(policy)}>
            {policy === "cascade" ? "Cascade Delete" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
