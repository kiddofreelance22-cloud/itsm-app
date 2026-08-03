"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { PageSpinner } from "@/components/ui/spinner";
import { VariableBuilder } from "@/components/admin/variable-builder";
import { useCatalog } from "@/lib/hooks/use-catalogs";

export default function AdminCatalogDetailPage() {
  const params = useParams();
  const catalogId = Number(params.catalogId);
  const { catalog, isLoading, createVar, updateVar, removeVar } = useCatalog(catalogId);

  if (isLoading) return <PageSpinner />;
  if (!catalog) return <p className="p-8 text-slate-500">Catalog item not found.</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumb items={[
        { label: "Home", href: "/home" },
        { label: "Admin" },
        { label: "Catalogs", href: "/admin/catalogs" },
        { label: catalog.catalogName },
      ]} />

      <Link href="/admin/catalogs"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> Back to catalogs
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">{catalog.catalogName}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {catalog.category.categoryName}
          {catalog.workflow && <> · Workflow: {catalog.workflow.workflowName}</>}
        </p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <VariableBuilder
            catalogId={catalogId}
            variables={catalog.variables}
            onCreateVar={createVar}
            onUpdateVar={updateVar}
            onRemoveVar={removeVar}
          />
        </CardContent>
      </Card>
    </div>
  );
}
