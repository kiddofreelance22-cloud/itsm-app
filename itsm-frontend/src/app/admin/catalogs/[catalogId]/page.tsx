"use client";

import { useParams } from "next/navigation";
import { PageSpinner } from "@/components/ui/spinner";
import { CatalogEditor } from "@/components/admin/catalog-editor";
import { useCatalog, useCatalogs } from "@/lib/hooks/use-catalogs";
import { CreateCatalogDto, CreateVariableDto, CreateSectionDto } from "@/lib/api/catalogs.api";

export default function EditCatalogPage() {
  const params    = useParams();
  const catalogId = Number(params.catalogId);

  const {
    catalog, isLoading,
    createVar, updateVar, removeVar, reorderVars,
    createSection, updateSection, removeSection, reorderSections,
  } = useCatalog(catalogId);
  const { update } = useCatalogs("all");

  if (isLoading) return <PageSpinner />;
  if (!catalog)  return <p className="p-8 text-slate-500">Catalog item not found.</p>;

  return (
    <div className="min-h-screen flex flex-col">
      <CatalogEditor
        mode="edit"
        catalog={catalog}
        onSave={async (data: CreateCatalogDto) => {
          const ok = await update(catalogId, data);
          return ok ? catalog : null;
        }}
        onCreateVar={async (data: CreateVariableDto) => createVar(data)}
        onUpdateVar={async (id: number, data: Partial<CreateVariableDto>) => { await updateVar(id, data); }}
        onRemoveVar={async (id: number) => { await removeVar(id); }}
        onReorderVars={reorderVars}
        onCreateSection={async (data: CreateSectionDto) => { await createSection(data); }}
        onUpdateSection={async (id: number, data: Partial<CreateSectionDto>) => { await updateSection(id, data); }}
        onRemoveSection={async (id: number) => { await removeSection(id); }}
        onReorderSections={reorderSections}
      />
    </div>
  );
}
