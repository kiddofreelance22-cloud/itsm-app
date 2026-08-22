"use client";

import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CatalogGrid } from "@/components/requests/catalog-grid";
import { useCatalogs } from "@/lib/hooks/use-catalogs";

export default function ServiceCatalogPage() {
  const { catalogs, isLoading } = useCatalogs("active");

  return (
    <div className="w-full">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "Service Catalog" }]} />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Service Catalog</h1>
        <p className="mt-1 text-sm text-slate-500">Browse available services and raise a new request.</p>
      </div>

      <div className="mt-6">
        <CatalogGrid catalogs={catalogs} isLoading={isLoading} />
      </div>
    </div>
  );
}
