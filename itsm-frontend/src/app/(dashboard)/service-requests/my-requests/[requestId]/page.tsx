"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageSpinner } from "@/components/ui/spinner";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { useRequest } from "@/lib/hooks/use-requests";

const CANCELLABLE_STATUSES = new Set(["Submitted", "In Progress"]);

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function requestNumber(id: number): string {
  return `REQ${String(id).padStart(8, "0")}`;
}

export default function RequestDetailPage() {
  const params = useParams<{ requestId: string }>();
  const requestId = Number(params.requestId);
  const { request, isLoading, error, cancel } = useRequest(requestId);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  if (isLoading) return <PageSpinner />;

  if (error || !request) {
    return (
      <div className="w-full">
        <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "My Service Requests", href: "/service-requests/my-requests" }, { label: "Not found" }]} />
        <p className="mt-6 text-sm text-slate-500">
          {error ?? "This request couldn't be found."}
        </p>
        <Link href="/service-requests/my-requests" className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
          <ArrowLeft className="size-3.5" /> Back to My Requests
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Breadcrumb items={[
        { label: "Home", href: "/home" },
        { label: "My Service Requests", href: "/service-requests/my-requests" },
        { label: requestNumber(request.requestId) },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{requestNumber(request.requestId)}</h1>
          <p className="mt-1 text-sm text-slate-500">{request.catalog?.catalogName ?? "—"}</p>
        </div>
        <div className="flex items-center gap-3">
          <RequestStatusBadge status={request.status} />
          {CANCELLABLE_STATUSES.has(request.status) && (
            <Button
              variant="outline"
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setShowCancelConfirm(true)}
            >
              <Ban className="size-4" /> Cancel Request
            </Button>
          )}
        </div>
      </div>

      <Card className="mt-6">
        <CardContent className="pt-5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Requested For</p>
              <p className="font-medium text-slate-800">{request.requestedBy.fullName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Requested On</p>
              <p className="font-medium text-slate-800">{fmtDate(request.createdAt)}</p>
            </div>
            {request.currentStep && (
              <div>
                <p className="text-xs text-slate-500">Current Step</p>
                <p className="font-medium text-slate-800">{request.currentStep.stepName}</p>
              </div>
            )}
            {request.closedAt && (
              <div>
                <p className="text-xs text-slate-500">Closed On</p>
                <p className="font-medium text-slate-800">{fmtDate(request.closedAt)}</p>
              </div>
            )}
            {request.variableValues.map((v) => (
              <div key={v.variable.variableId}>
                <p className="text-xs text-slate-500">{v.variable.label}</p>
                <p className="font-medium text-slate-800 truncate">{v.value || "—"}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Link href="/service-requests/my-requests" className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
        <ArrowLeft className="size-3.5" /> Back to My Requests
      </Link>

      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancel Request"
        description={`Are you sure you want to cancel ${requestNumber(request.requestId)}? This action cannot be undone.`}
        onConfirm={async () => {
          setIsCancelling(true);
          const ok = await cancel();
          setIsCancelling(false);
          if (ok) setShowCancelConfirm(false);
        }}
        onCancel={() => setShowCancelConfirm(false)}
        isLoading={isCancelling}
      />
    </div>
  );
}
