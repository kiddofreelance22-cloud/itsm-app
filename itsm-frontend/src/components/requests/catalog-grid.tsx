"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Clock, Timer, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageSpinner } from "@/components/ui/spinner";
import { CatalogCard } from "./catalog-card";
import { CatalogCategorySidebar } from "./catalog-category-sidebar";
import { Catalog } from "@/types/catalog";

interface CatalogGridProps {
  catalogs: Catalog[];
  isLoading: boolean;
}

type SortMode = "popular" | "name" | "recent";

export function CatalogGrid({ catalogs, isLoading }: CatalogGridProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("popular");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = catalogs.filter(
      (c) =>
        c.catalogName.toLowerCase().includes(q) ||
        c.shortDescription?.toLowerCase().includes(q) ||
        (c.category?.categoryName?.toLowerCase().includes(q) ?? false)
    );
    if (category) {
      list = list.filter((c) => (c.category?.categoryName ?? "Uncategorized") === category);
    }
    if (subCategory) {
      list = list.filter((c) => c.subCategory === subCategory);
    }
    return list;
  }, [catalogs, search, category, subCategory]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sort === "name") {
      list.sort((a, b) => a.catalogName.localeCompare(b.catalogName));
    } else if (sort === "recent") {
      list.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    } else {
      // Popular first (showInPopular), then name as a stable tiebreaker.
      list.sort((a, b) => Number(b.showInPopular) - Number(a.showInPopular) || a.catalogName.localeCompare(b.catalogName));
    }
    return list;
  }, [filtered, sort]);

  const grouped = useMemo(() => {
    const map = new Map<string, Catalog[]>();
    for (const c of sorted) {
      const key = c.category?.categoryName ?? "Uncategorized";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [sorted]);

  const selected = catalogs.find((c) => c.catalogId === selectedId) ?? null;

  if (isLoading) return <PageSpinner />;

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr_300px]">
      {/* Category sidebar */}
      <aside className="hidden lg:block">
        <CatalogCategorySidebar
          catalogs={catalogs}
          selectedCategory={category}
          selectedSubCategory={subCategory}
          onSelectCategory={(c) => {
            setCategory(c);
            setSubCategory(null);
          }}
          onSelectSubCategory={(c, sub) => {
            setCategory(c);
            setSubCategory(sub);
          }}
        />
      </aside>

      {/* Main grid */}
      <div className="space-y-6 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search catalog items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="w-auto"
          >
            <option value="popular">Sort by: Popular</option>
            <option value="name">Sort by: Name A-Z</option>
            <option value="recent">Sort by: Recently Added</option>
          </Select>
        </div>

        {grouped.size === 0 && <p className="text-sm text-gray-500">No catalog items found.</p>}

        {Array.from(grouped.entries()).map(([categoryName, items]) => (
          <section key={categoryName}>
            <h2 className="mb-3 text-base font-semibold text-gray-700">{categoryName}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((c) => (
                <CatalogCard
                  key={c.catalogId}
                  catalog={c}
                  selected={c.catalogId === selectedId}
                  onSelect={() => setSelectedId(c.catalogId)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Selection summary panel */}
      <aside className="hidden lg:block">
        <Card className="sticky top-6">
          <CardContent className="pt-5">
            {selected ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">Request Summary</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{selected.catalogName}</p>
                  {selected.shortDescription && (
                    <p className="mt-1 text-sm text-slate-500">{selected.shortDescription}</p>
                  )}
                </div>
                <div className="space-y-2 border-t border-slate-100 pt-3 text-sm">
                  {selected.estimatedTime != null && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Timer className="size-4 text-slate-400" />
                      Estimated Time: {selected.estimatedTime} mins
                    </div>
                  )}
                  {selected.deliveryTimeSla != null && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="size-4 text-slate-400" />
                      Delivery Time (SLA): {selected.deliveryTimeSla} Working Hours
                    </div>
                  )}
                </div>
                <Button asChild className="w-full gap-1">
                  <Link href={`/service-requests/${selected.catalogId}`}>
                    Continue to Form <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Select a catalog item to see its details here before you request it.
              </p>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
