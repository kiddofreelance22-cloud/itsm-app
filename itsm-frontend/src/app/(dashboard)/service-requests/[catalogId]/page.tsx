"use client";

import { useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { RequestConfirmation } from "@/components/requests/request-confirmation";
import { useAuth } from "@/lib/hooks/use-auth";
import type { ServiceRequest } from "@/types/request";
import type { RequestedFor } from "@/components/requests/request-wizard";

const RequestWizard = dynamic(
  () => import("@/components/requests/request-wizard").then((module) => module.RequestWizard),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
        Loading request form…
      </div>
    ),
  }
);
import { PageSpinner } from "@/components/ui/spinner";
import { useCatalog } from "@/lib/hooks/use-catalogs";
import { useRequests } from "@/lib/hooks/use-requests";

export default function CatalogRequestPage() {
  const params = useParams();
  const router = useRouter();
  const catalogId = Number(params.catalogId);
  const { catalog, isLoading } = useCatalog(catalogId);
  const { submit } = useRequests();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<ServiceRequest | null>(null);

  const handleSubmit = async (values: Record<number, string>, requestedFor: RequestedFor) => {
    if (!catalog) return;
    setSubmitting(true);
    const variableValues = Object.entries(values).map(([vid, value]) => ({
      variableId: Number(vid),
      value,
    }));
    // NOTE: requestedFor isn't sent — CreateRequestDto has no field to carry
    // "who this request is for" yet, so a request made on behalf of someone
    // else is still recorded as requestedBy the logged-in user. The wizard
    // captures it for the review step; wiring it through needs a backend
    // change (a requestedFor column + DTO field) before it's more than that.
    const result = await submit({ catalogId: catalog.catalogId, variableValues });
    setSubmitting(false);
    if (result) {
      setSubmittedRequest(result);
    }
  };

  if (isLoading) return <PageSpinner />;
  if (!catalog) return <p className="p-8 text-slate-500">Catalog item not found.</p>;

  if (submittedRequest) {
    return (
      <RequestConfirmation
        request={submittedRequest}
        catalog={catalog}
        user={user}
        onRaiseAnother={() => setSubmittedRequest(null)}
      />
    );
  }

  return (
    <div className="w-full">
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
          <Image
            src={catalog.iconUrl}
            alt=""
            width={56}
            height={56}
            unoptimized
            priority={false}
            className="size-14 rounded-xl object-cover"
          />
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
            {catalog.category?.categoryName ?? "Uncategorized"}
          </span>
        </div>
      </div>

      {catalog.description && (
        <p className="mb-6 text-sm text-slate-600 leading-relaxed">{catalog.description}</p>
      )}

      <RequestWizard
        catalog={catalog}
        isSubmitting={submitting}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </div>
  );
}
