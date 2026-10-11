import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-[11.5px] text-slate-400">
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <ChevronRight className="size-3 shrink-0 text-slate-300" aria-hidden="true" />}
          {item.href ? (
              <Link href={item.href} className="transition-colors hover:text-brand-600">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="font-medium text-slate-700">
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
