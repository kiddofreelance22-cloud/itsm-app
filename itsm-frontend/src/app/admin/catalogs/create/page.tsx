"use client";

import { useCatalogs } from "@/lib/hooks/use-catalogs";
import { CatalogEditor } from "@/components/admin/catalog-editor";
import { CreateCatalogDto, CreateVariableDto } from "@/lib/api/catalogs.api";

export default function CreateCatalogPage() {
  const { create } = useCatalogs("all");

  return (
    <div className="h-full flex flex-col -m-4 sm:-m-6 lg:-m-8">
      <CatalogEditor
        mode="create"
        catalog={null}
        onSave={async (data: CreateCatalogDto) => create(data)}
        onCreateVar={async () => {}}
        onUpdateVar={async () => {}}
        onRemoveVar={async () => {}}
      />
    </div>
  );
}
