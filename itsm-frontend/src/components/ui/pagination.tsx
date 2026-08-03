"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(page: number, totalPages: number): number[] {
  const pages: number[] = [];
  const start = Math.max(1, Math.min(page - 1, totalPages - 2));
  const end = Math.min(totalPages, start + 2);
  for (let p = Math.max(1, start); p <= end; p++) pages.push(p);
  return pages;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = getPageNumbers(page, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-1.5 sm:justify-end"
    >
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className="flex size-8 items-center justify-center rounded-md border border-slate-300 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="size-4" />
      </button>

      {pages[0] > 1 && (
        <>
          <PageButton num={1} active={page === 1} onClick={onPageChange} />
          {pages[0] > 2 && <span className="px-1 text-slate-400">…</span>}
        </>
      )}

      {pages.map((p) => (
        <PageButton key={p} num={p} active={p === page} onClick={onPageChange} />
      ))}

      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && (
            <span className="px-1 text-slate-400">…</span>
          )}
          <PageButton num={totalPages} active={page === totalPages} onClick={onPageChange} />
        </>
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className="flex size-8 items-center justify-center rounded-md border border-slate-300 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}

function PageButton({
  num,
  active,
  onClick,
}: {
  num: number;
  active: boolean;
  onClick: (page: number) => void;
}) {
  return (
    <button
      onClick={() => onClick(num)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex size-8 items-center justify-center rounded-md border text-sm font-medium transition-colors",
        active
          ? "border-brand-600 bg-brand-50 text-brand-600"
          : "border-slate-300 text-slate-600 hover:bg-slate-50"
      )}
    >
      {num}
    </button>
  );
}
