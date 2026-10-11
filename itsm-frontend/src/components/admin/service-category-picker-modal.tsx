"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Folder } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ServiceCategoryApi } from "@/lib/api/admin-modules.api";
import { ServiceCategory } from "@/types/admin";

interface ServiceCategoryPickerModalProps {
  open: boolean;
  initialCategoryId?: number | null;
  onSelect: (category: ServiceCategory) => void;
  onClose: () => void;
}

export function ServiceCategoryPickerModal({ open, initialCategoryId = null, onSelect, onClose }: ServiceCategoryPickerModalProps) {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ServiceCategory | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(null);
    setLoading(true);
    ServiceCategoryApi.list().then(setCategories).catch(() => setCategories([])).finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? categories.filter((category) => category.categoryName.toLowerCase().includes(term)) : categories;
  }, [categories, query]);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Select Service Category</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search service categories" className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        </div>
        <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-100 p-2">
          {loading ? <p className="py-8 text-center text-sm text-slate-400">Loading service categories...</p> : filtered.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No service categories available.</p> : filtered.map((category) => (
            <button key={category.serviceCategoryId} type="button" onClick={() => setSelected(category)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${selected?.serviceCategoryId === category.serviceCategoryId || (!selected && initialCategoryId === category.serviceCategoryId) ? "bg-brand-50 text-brand-700" : "hover:bg-slate-50"}`}>
              <Folder className="size-4 shrink-0 text-amber-500" />
              <span className="truncate">{category.categoryName}</span>
              {category.parentCategoryName && <span className="ml-auto text-xs text-slate-400">{category.parentCategoryName}</span>}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={!selected} onClick={() => { if (selected) { onSelect(selected); onClose(); } }}>Select and Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
