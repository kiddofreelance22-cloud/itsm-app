"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { DynamicForm } from "@/components/requests/dynamic-form";
import { PageSpinner } from "@/components/ui/spinner";
import { useCatalog } from "@/lib/hooks/use-catalogs";
import { useRequests } from "@/lib/hooks/use-requests";

export default function CatalogRequestPage() {
  const params = useParams();
  const router = useRouter();
  const catalogId = Number(params.catalogId);
  const { catalog, isLoading } = useCatalog(catalogId);
  const { submit } = useRequests();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestId, setRequestId] = useState<number | null>(null);

  const handleSubmit = async (values: Record<number, string>) => {
    if (!catalog) return;
    setSubmitting(true);
    const variableValues = Object.entries(values).map(([vid, value]) => ({
      variableId: Number(vid),
      value,
    }));
    const result = await submit({ catalogId: catalog.catalogId, variableValues });
    setSubmitting(false);
    if (result) {
      setRequestId(result.requestId);
      setSubmitted(true);
    }
  };

  if (isLoading) return <PageSpinner />;
  if (!catalog) return <p className="p-8 text-slate-500">Catalog item not found.</p>;

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <CheckCircle className="mx-auto mb-4 size-16 text-green-500" />
        <h2 className="text-2xl font-bold text-slate-900">Request Submitted!</h2>
        <p className="mt-2 text-slate-500">
          Your request #{requestId} for <strong>{catalog.catalogName}</strong> has been submitted
          {catalog.workflow ? " and is now pending approval." : "."}
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link href="/service-requests/my-requests"
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            View My Requests
          </Link>
          <Link href="/service-requests"
            className="rounded-lg border px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Back to Catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumb items={[
        { label: "Home", href: "/home" },
        { label: "Service Catalog", href: "/service-requests" },
        { label: catalog.catalogName },
      ]} />

      <Link href="/service-requests" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> Back to catalog
      </Link>

      <div className="flex items-start gap-4 mb-6">
        {catalog.iconUrl ? (
          <img src={catalog.iconUrl} alt="" className="size-14 rounded-xl object-cover" />
        ) : (
          <div className="size-14 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-blue-600 text-2xl font-bold">{catalog.catalogName[0]}</span>
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-slate-900">{catalog.catalogName}</h1>
          {catalog.shortDescription && (
            <p className="text-sm text-slate-500 mt-0.5">{catalog.shortDescription}</p>
          )}
          <span className="mt-1 inline-block text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
            {catalog.category.categoryName}
          </span>
        </div>
      </div>

      {catalog.description && (
        <p className="mb-6 text-sm text-slate-600 leading-relaxed">{catalog.description}</p>
      )}

      <Card>
        <CardContent className="pt-5">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Request Details</h2>
          <DynamicForm
            variables={catalog.variables}
            isSubmitting={submitting}
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
