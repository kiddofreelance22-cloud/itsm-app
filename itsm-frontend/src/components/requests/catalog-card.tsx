import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Catalog } from "@/types/catalog";

interface CatalogCardProps {
  catalog: Catalog;
  selected?: boolean;
  onSelect?: () => void;
}

export function CatalogCard({ catalog, selected, onSelect }: CatalogCardProps) {
  return (
    <Card
      onClick={onSelect}
      className={cn(
        "flex flex-col transition-shadow",
        onSelect && "cursor-pointer",
        selected ? "border-blue-500 ring-2 ring-blue-100 shadow-md" : "hover:shadow-md"
      )}
    >
      <CardContent className="flex-1 pt-5 pb-3">
        <div className="flex items-start gap-3">
          {catalog.iconUrl ? (
            <Image
              src={catalog.iconUrl}
              alt={catalog.catalogName}
              width={40}
              height={40}
              unoptimized
              priority={false}
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
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {catalog.category?.categoryName ?? "Uncategorized"}
          </span>
          {catalog.estimatedTime != null && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <Clock className="size-3" /> {catalog.estimatedTime} mins
            </span>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-0 pb-4">
        <Button
          asChild
          size="sm"
          className="w-full gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Link href={`/service-requests/${catalog.catalogId}`}>
            Request <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
