import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-4 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <SearchX className="size-8" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="max-w-sm text-sm text-slate-500">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <Button asChild>
        <Link href="/home">Back to Home</Link>
      </Button>
    </div>
  );
}
