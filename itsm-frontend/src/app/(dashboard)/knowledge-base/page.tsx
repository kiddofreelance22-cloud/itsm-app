import { BookOpen, FileText, Search } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function KnowledgeBasePage() {
  return (
    <div className="w-full">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "Knowledge Base" }]} />
      <div className="flex items-center gap-2">
        <BookOpen className="size-6 text-brand-600" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-slate-900">Knowledge Base</h1>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Find self-service articles and how-to guides.
      </p>

      <div className="mt-6">
        <Input placeholder="Search articles..." leadingIcon={<Search />} aria-label="Search knowledge base articles" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* knowledgeArticles mapping removed, using empty state */}
        <p className="text-sm text-slate-500">No articles available.</p>
      </div>
    </div>
  );
}
