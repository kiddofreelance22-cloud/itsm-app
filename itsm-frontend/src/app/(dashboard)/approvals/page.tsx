"use client";

import { useState } from "react";
import { CheckSquare } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageSpinner } from "@/components/ui/spinner";
import { ApprovalCard } from "@/components/approvals/approval-card";
import { ApprovalActionDialog } from "@/components/approvals/approval-action-dialog";
import { useApprovals } from "@/lib/hooks/use-approvals";
import { ServiceRequest } from "@/types/request";

export default function ApprovalsPage() {
  const { pending, isLoading, isActing, act } = useApprovals();
  const [selected, setSelected] = useState<ServiceRequest | null>(null);
  const [action, setAction] = useState<"Approved" | "Rejected" | null>(null);

  const handleApprove = (req: ServiceRequest) => { setSelected(req); setAction("Approved"); };
  const handleReject  = (req: ServiceRequest) => { setSelected(req); setAction("Rejected"); };
  const handleClose   = () => { setSelected(null); setAction(null); };

  const handleConfirm = async (comments: string) => {
    if (!selected || !action) return;
    const ok = await act(selected.requestId, action, comments);
    if (ok) handleClose();
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "My Approvals" }]} />
      <div className="flex items-center gap-2">
        <CheckSquare className="size-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-slate-900">My Approvals</h1>
      </div>
      <p className="mt-1 text-sm text-slate-500">Review and act on pending approval requests.</p>

      <div className="mt-6">
        {isLoading ? (
          <PageSpinner />
        ) : pending.length === 0 ? (
          <div className="rounded-xl border bg-white py-16 text-center text-sm text-slate-400">
            <CheckSquare className="mx-auto mb-3 size-10 text-slate-200" />
            No pending approvals — you are all caught up!
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {pending.map((req) => (
              <ApprovalCard key={req.requestId} request={req}
                onApprove={handleApprove} onReject={handleReject} />
            ))}
          </div>
        )}
      </div>

      <ApprovalActionDialog
        open={!!selected && !!action}
        request={selected}
        action={action}
        isLoading={isActing}
        onConfirm={handleConfirm}
        onClose={handleClose}
      />
    </div>
  );
}
