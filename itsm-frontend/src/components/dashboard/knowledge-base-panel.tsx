import Link from "next/link";
import { LayoutGrid, FileText } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KnowledgeArticle } from "@/types";

export function KnowledgeBasePanel({ articles }: { articles: KnowledgeArticle[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="size-[18px] text-slate-500" aria-hidden="true" />
          Knowledge Base
        </CardTitle>
        <Link href="/knowledge-base" className="text-sm font-medium text-brand-600 hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-slate-100">
        {articles.map((a) => (
          <Link
            key={a.id}
            href="/knowledge-base"
            className="flex items-center gap-2.5 py-2.5 text-sm text-slate-700 transition-colors first:pt-0 last:pb-0 hover:text-brand-600"
          >
            <FileText className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
            {a.title}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
