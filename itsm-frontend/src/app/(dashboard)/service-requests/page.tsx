"use client";

import { ShoppingCart } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CatalogGrid } from "@/components/requests/catalog-grid";
import { useCatalogs } from "@/lib/hooks/use-catalogs";

export default function ServiceRequestsPage() {
  const { catalogs, isLoading } = useCatalogs("active");

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "Service Catalog" }]} />
      <div className="flex items-center gap-2">
        <ShoppingCart className="size-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-slate-900">Service Catalog</h1>
      </div>
      <p className="mt-1 mb-6 text-sm text-slate-500">Browse available services and raise a request.</p>
      <CatalogGrid catalogs={catalogs} isLoading={isLoading} />
    </div>
  );
}
