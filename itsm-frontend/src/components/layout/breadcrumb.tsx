import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />}
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-brand-600">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="text-slate-700">
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
