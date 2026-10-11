"use client";

import { useCatalogs } from "@/lib/hooks/use-catalogs";
import { CatalogEditor } from "@/components/admin/catalog-editor";
import { CreateCatalogDto, CreateVariableDto } from "@/lib/api/catalogs.api";

export default function CreateCatalogPage() {
  const { create } = useCatalogs("all");

  return (
    <div className="min-h-screen flex flex-col">
      <CatalogEditor
        mode="create"
        catalog={null}
        onSave={async (data: CreateCatalogDto) => create(data)}
        onCreateVar={async () => null}
        onUpdateVar={async () => {}}
        onRemoveVar={async () => {}}
      />
    </div>
  );
}
