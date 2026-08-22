"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Catalog } from "@/types/catalog";

interface CategoryNode {
  name: string;
  count: number;
  subCategories: { name: string; count: number }[];
}

interface CatalogCategorySidebarProps {
  catalogs: Catalog[];
  selectedCategory: string | null;
  selectedSubCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onSelectSubCategory: (category: string, subCategory: string | null) => void;
}

// Built client-side from the loaded catalog list — there's no dedicated
// categories-with-counts endpoint, so counts reflect whatever the browser
// already fetched (active catalogs) rather than a live server aggregate.
function buildTree(catalogs: Catalog[]): CategoryNode[] {
  const map = new Map<string, Map<string, number>>();
  for (const c of catalogs) {
    const cat = c.category?.categoryName ?? "Uncategorized";
    if (!map.has(cat)) map.set(cat, new Map());
    const subMap = map.get(cat)!;
    if (c.subCategory) {
      subMap.set(c.subCategory, (subMap.get(c.subCategory) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([name, subMap]) => ({
      name,
      count: catalogs.filter((c) => (c.category?.categoryName ?? "Uncategorized") === name).length,
      subCategories: Array.from(subMap.entries())
        .map(([subName, count]) => ({ name: subName, count }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function CatalogCategorySidebar({
  catalogs,
  selectedCategory,
  selectedSubCategory,
  onSelectCategory,
  onSelectSubCategory,
}: CatalogCategorySidebarProps) {
  const tree = useMemo(() => buildTree(catalogs), [catalogs]);

  return (
    <nav className="space-y-0.5 text-sm">
      <button
        type="button"
        onClick={() => onSelectCategory(null)}
        className={cn(
          "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 font-medium",
          selectedCategory === null ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
        )}
      >
        All Categories
        <span className="text-xs text-slate-400">{catalogs.length}</span>
      </button>

      {tree.map((cat) => {
        const isActiveCat = selectedCategory === cat.name;
        return (
          <div key={cat.name}>
            <button
              type="button"
              onClick={() => onSelectCategory(cat.name)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2.5 py-1.5",
                isActiveCat && !selectedSubCategory
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-slate-700 hover:bg-slate-50"
              )}
            >
              {cat.name}
              <span className="text-xs text-slate-400">{cat.count}</span>
            </button>
            {isActiveCat && cat.subCategories.length > 0 && (
              <div className="ml-3 space-y-0.5 border-l border-slate-100 pl-2.5">
                {cat.subCategories.map((sub) => (
                  <button
                    key={sub.name}
                    type="button"
                    onClick={() => onSelectSubCategory(cat.name, sub.name)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1 text-xs",
                      selectedSubCategory === sub.name
                        ? "bg-blue-50 font-medium text-blue-700"
                        : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    {sub.name}
                    <span className="text-slate-400">{sub.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
