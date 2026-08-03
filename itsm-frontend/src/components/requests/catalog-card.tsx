import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Catalog } from "@/types/catalog";

interface CatalogCardProps {
  catalog: Catalog;
}

export function CatalogCard({ catalog }: CatalogCardProps) {
  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardContent className="flex-1 pt-5 pb-3">
        <div className="flex items-start gap-3">
          {catalog.iconUrl ? (
            <img
              src={catalog.iconUrl}
              alt={catalog.catalogName}
              className="h-10 w-10 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <span className="text-blue-600 font-bold text-lg">
                {catalog.catalogName[0]}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm leading-tight">
              {catalog.catalogName}
            </h3>
            {catalog.shortDescription && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                {catalog.shortDescription}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {catalog.category.categoryName}
          </span>
        </div>
      </CardContent>
      <CardFooter className="pt-0 pb-4">
        <Button asChild size="sm" className="w-full gap-1">
          <Link href={`/service-requests/${catalog.catalogId}`}>
            Request <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
