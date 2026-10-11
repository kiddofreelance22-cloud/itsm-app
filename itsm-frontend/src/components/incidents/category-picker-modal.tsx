"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CategoriesApi } from "@/lib/api/categories.api";
import { Category } from "@/types/admin";

interface CategoryPickerModalProps {
  open: boolean;
  initialCategoryId?: number | null;
  onSelect: (category: Category) => void;
  onClose: () => void;
}

function countAll(c: Category): number {
  return c.children.reduce((sum, child) => sum + 1 + countAll(child), 0);
}

function nodeMatches(node: Category, query: string): boolean {
  return node.categoryName.toLowerCase().includes(query)
    || node.children.some((c) => nodeMatches(c, query));
}

function Node({
  node, depth, query, selectedId, onPick,
}: {
  node: Category; depth: number; query: string;
  selectedId: number | null; onPick: (c: Category) => void;
}) {
  const matchesSelf = node.categoryName.toLowerCase().includes(query);
  const hasMatchingDescendant = node.children.some((c) => nodeMatches(c, query));
  const [expanded, setExpanded] = useState(depth < 1);

  useEffect(() => {
    if (query && hasMatchingDescendant) setExpanded(true);
  }, [query, hasMatchingDescendant]);

  if (query && !matchesSelf && !hasMatchingDescendant) return null;

  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.categoryId;

  return (
    <div>
      <div
        className={`group flex cursor-pointer items-center gap-1.5 rounded-lg py-2 pr-2 text-sm transition-colors ${
          isSelected ? "bg-brand-50 text-brand-700" : "hover:bg-slate-50"
        }`}
        style={{ paddingLeft: `${depth * 20 + 4}px` }}
        onClick={() => onPick(node)}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className={`flex size-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200 ${!hasChildren ? "invisible" : ""}`}
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        {expanded && hasChildren
          ? <FolderOpen className="size-4 shrink-0 text-amber-500" />
          : <Folder className="size-4 shrink-0 text-amber-500" />}
        <span className={isSelected ? "font-medium" : ""}>{node.categoryName}</span>
        <span className="text-xs text-slate-400">({countAll(node)})</span>
        {isSelected && (
          <span className="ml-auto shrink-0 text-xs font-medium text-brand-600">{node.categoryName} selected.</span>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <Node key={child.categoryId} node={child} depth={depth + 1}
              query={query} selectedId={selectedId} onPick={onPick} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryPickerModal({ open, initialCategoryId = null, onSelect, onClose }: CategoryPickerModalProps) {
  const [tree, setTree] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Category | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setLoading(true);
    CategoriesApi.tree()
      .then((t) => setTree(t))
      .catch(() => setTree([]))
      .finally(() => setLoading(false));
  }, [open]);

  const total = useMemo(() => tree.reduce((sum, c) => sum + 1 + countAll(c), 0), [tree]);
  const lowerQuery = query.trim().toLowerCase();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Incident Category</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Category/Subcategory (e.g., 'Gear' or 'Sales')"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none transition-colors focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100"
          />
        </div>

        <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-100">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
            Default Category ({total})
          </div>
          <div className="p-2">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-400">Loading categories…</p>
            ) : tree.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No categories available.</p>
            ) : (
              tree.map((node) => (
                <Node key={node.categoryId} node={node} depth={0} query={lowerQuery}
                  selectedId={selected?.categoryId ?? initialCategoryId ?? null}
                  onPick={setSelected} />
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            disabled={!selected}
            onClick={() => { if (selected) { onSelect(selected); onClose(); } }}
          >
            Select and Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
