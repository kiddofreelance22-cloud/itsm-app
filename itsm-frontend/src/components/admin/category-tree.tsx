"use client";
import { useMemo, useState } from "react";
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, Pencil, Trash2, Plus, Users2, MapPin,
} from "lucide-react";
import { Category } from "@/types/admin";
import { ICON_MAP } from "@/components/admin/category-form-panel";

interface CategoryTreeProps {
  categories: Category[];
  onEdit: (c: Category) => void;
  onAddChild: (parent: Category) => void;
  onDelete: (c: Category) => void;
}

function countAll(c: Category): number {
  return c.children.reduce((sum, child) => sum + 1 + countAll(child), 0);
}

function TreeNode({
  node, depth, onEdit, onAddChild, onDelete,
}: {
  node: Category; depth: number;
  onEdit: (c: Category) => void; onAddChild: (parent: Category) => void; onDelete: (c: Category) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const Icon = node.icon ? ICON_MAP[node.icon] : null;
  const hasOwnScope = !!(node.workgroupIds?.length || node.locationIds?.length || node.memberIds?.length);

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 rounded-md py-2 pr-2 hover:bg-blue-50/60"
        style={{ paddingLeft: `${depth * 22 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`flex size-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200 ${!hasChildren ? "invisible" : ""}`}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>

        {expanded && hasChildren
          ? <FolderOpen className="size-3.5 shrink-0 text-slate-400" />
          : <Folder className="size-3.5 shrink-0 text-slate-400" />}

        {Icon && <Icon className="size-3.5 shrink-0 text-slate-400" />}

        <span className={`truncate text-[13px] ${node.isActive ? "text-slate-800" : "text-slate-400 line-through"}`}>
          {node.categoryName}
        </span>
        <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-600">L{Math.min(depth + 1, 5)}</span>

        {node.isActive && !hasChildren && (
          <span className="hidden shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 sm:inline-flex">✓ Configured</span>
        )}

        {hasOwnScope && (
          <span title="Has scoped workgroups/locations/members" className="flex shrink-0 items-center gap-0.5 text-slate-300">
            <Users2 className="size-3" />
            <MapPin className="size-3" />
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <button type="button" title="Add Subcategory" onClick={() => onAddChild(node)}
            className="rounded p-1 text-slate-300 hover:bg-slate-200 hover:text-brand-600">
            <Plus className="size-3.5" />
          </button>
          <button type="button" title="Edit category" onClick={() => onEdit(node)}
            className="rounded p-1 text-slate-300 hover:bg-slate-200 hover:text-blue-600">
            <Pencil className="size-3.5" />
          </button>
          <button type="button" title="Delete" onClick={() => onDelete(node)}
            className="rounded p-1 text-slate-300 hover:bg-slate-200 hover:text-red-600">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.categoryId} node={child} depth={depth + 1}
              onEdit={onEdit} onAddChild={onAddChild} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryTree({ categories, onEdit, onAddChild, onDelete }: CategoryTreeProps) {
  const total = useMemo(() => categories.reduce((sum, c) => sum + 1 + countAll(c), 0), [categories]);

  if (categories.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
        No categories yet. Use &quot;Add Root Category&quot; to create the first one.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.5px] text-slate-500">
        Category Tree <span className="ml-1 font-normal text-slate-400">({total})</span>
      </div>
      <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-3">
        {categories.map((c) => (
          <TreeNode key={c.categoryId} node={c} depth={0}
            onEdit={onEdit} onAddChild={onAddChild} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}
