"use client";
import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CatalogCard } from "./catalog-card";
import { PageSpinner } from "@/components/ui/spinner";
import { Catalog } from "@/types/catalog";

interface CatalogGridProps {
  catalogs: Catalog[];
  isLoading: boolean;
}

export function CatalogGrid({ catalogs, isLoading }: CatalogGridProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return catalogs.filter(
      (c) =>
        c.catalogName.toLowerCase().includes(q) ||
        c.shortDescription?.toLowerCase().includes(q) ||
        c.category.categoryName.toLowerCase().includes(q)
    );
  }, [catalogs, search]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, Catalog[]>();
    for (const c of filtered) {
      const key = c.category.categoryName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [filtered]);

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-8">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search catalog..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {grouped.size === 0 && (
        <p className="text-gray-500 text-sm">No catalog items found.</p>
      )}

      {Array.from(grouped.entries()).map(([category, items]) => (
        <section key={category}>
          <h2 className="text-base font-semibold text-gray-700 mb-3">{category}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((c) => (
              <CatalogCard key={c.catalogId} catalog={c} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
