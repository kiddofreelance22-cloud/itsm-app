"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Check, Mail, MessageSquare, Globe, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { cn } from "@/lib/utils";
import type { ServiceRequest } from "@/types/request";
import type { Catalog } from "@/types/catalog";
import type { LoginResponse } from "@/lib/api/auth.api";

type AuthUser = LoginResponse["user"];

interface RequestConfirmationProps {
  request: ServiceRequest;
  catalog: Catalog;
  user: AuthUser | null;
  onRaiseAnother: () => void;
}

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function requestNumber(id: number): string {
  return `REQ${String(id).padStart(8, "0")}`;
}

// Map backend status onto the 3-stage "what happens next" timeline.
// Received is always complete once a request exists; the other two
// stages light up as the request progresses. Rejected/Closed states
// are called out separately rather than forced into the happy path.
function stageProgress(status: ServiceRequest["status"]): number {
  switch (status) {
    case "Submitted":
      return 1;
    case "In Progress":
    case "Approved":
      return 2;
    case "Closed":
      return 3;
    case "Rejected":
      return 1;
    default:
      return 1;
  }
}

export function RequestConfirmation({ request, catalog, user, onRaiseAnother }: RequestConfirmationProps) {
  const [copied, setCopied] = useState(false);
  const reqNumber = requestNumber(request.requestId);
  const progress = stageProgress(request.status);
  const isRejected = request.status === "Rejected";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reqNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard access denied — silently ignore, the number is visible either way
    }
  };

  const stages = [
    { label: "Request Received", done: progress >= 1 },
    { label: "In Progress", done: progress >= 2 },
    { label: "Completion", done: progress >= 3 },
  ];

  // Show a handful of the submitted answers so the summary isn't
  // catalog-specific — works whether this is a VPN request, a hardware
  // request, or anything else the catalog defines.
  const summaryFields = request.variableValues.slice(0, 6);

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="mb-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-14 text-green-500" />
        <h2 className="text-xl font-bold text-slate-900">Request Submitted Successfully!</h2>
        <p className="mt-1 text-sm text-slate-500">
          Your request has been raised and is being processed.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs text-slate-500">Request Number</p>
              <p className="text-base font-semibold text-slate-900">{reqNumber}</p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            >
              {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Catalog Item</p>
              <p className="font-medium text-slate-800">{catalog.catalogName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Requested For</p>
              <p className="font-medium text-slate-800">{request.requestedBy.fullName}</p>
            </div>
            {summaryFields.map((v) => (
              <div key={v.variable.variableId}>
                <p className="text-xs text-slate-500">{v.variable.label}</p>
                <p className="font-medium text-slate-800 truncate">{v.value || "—"}</p>
              </div>
            ))}
            <div>
              <p className="text-xs text-slate-500">Requested On</p>
              <p className="font-medium text-slate-800">{fmtDate(request.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Status</p>
              <RequestStatusBadge status={request.status} />
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="mb-4 text-sm font-semibold text-slate-800">
              {isRejected ? "Request status" : "What happens next?"}
            </p>

            {isRejected ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                This request was rejected{request.currentStep ? ` at ${request.currentStep.stepName}` : ""}.
                You can check the request timeline for details.
              </p>
            ) : (
              <div className="flex items-center">
                {stages.map((stage, i) => (
                  <div key={stage.label} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      {stage.done ? (
                        <CheckCircle2 className="size-6 text-blue-600" />
                      ) : (
                        <Circle className="size-6 text-slate-300" />
                      )}
                      <span
                        className={cn(
                          "text-[11px] text-center w-20",
                          stage.done ? "text-slate-700 font-medium" : "text-slate-400"
                        )}
                      >
                        {stage.label}
                      </span>
                    </div>
                    {i < stages.length - 1 && (
                      <div
                        className={cn(
                          "mx-1 h-0.5 flex-1 rounded",
                          stages[i + 1].done ? "bg-blue-600" : "bg-slate-200"
                        )}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="mb-3 text-sm font-semibold text-slate-800">
              You will receive updates on your request via
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
              {user?.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5" /> {user.email}
                </span>
              )}
              {user?.phone && (
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="size-3.5" /> {user.phone}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Globe className="size-3.5" /> Service Portal
              </span>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Link
              href="/service-requests/my-requests"
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-700"
            >
              View My Requests
            </Link>
            <button
              type="button"
              onClick={onRaiseAnother}
              className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Raise Another Request
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
