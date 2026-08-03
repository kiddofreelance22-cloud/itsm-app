"use client";
import { useState } from "react";
import Link from "next/link";
import { ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { ServiceRequest } from "@/types/request";
import { RequestStatusBadge } from "./request-status-badge";
import { PageSpinner } from "@/components/ui/spinner";

interface RequestTableProps {
  requests: ServiceRequest[];
  isLoading: boolean;
}

export function RequestTable({ requests, isLoading }: RequestTableProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (isLoading) return <PageSpinner />;

  if (!requests.length) {
    return (
      <div className="rounded-lg border bg-white py-12 text-center text-sm text-gray-500">
        No requests yet. Browse the catalog to submit your first request.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">Catalog Item</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Current Step</th>
            <th className="px-4 py-3">Submitted</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {requests.map((r) => (
            <>
              <tr
                key={r.requestId}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() =>
                  setExpanded(expanded === r.requestId ? null : r.requestId)
                }
              >
                <td className="px-4 py-3 font-mono text-gray-500">#{r.requestId}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {r.catalog.catalogName}
                </td>
                <td className="px-4 py-3">
                  <RequestStatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {r.currentStep?.stepName ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {expanded === r.requestId ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </td>
              </tr>

              {expanded === r.requestId && r.variableValues.length > 0 && (
                <tr key={`${r.requestId}-detail`}>
                  <td colSpan={6} className="bg-gray-50 px-6 py-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                      Submitted Values
                    </p>
                    <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
                      {r.variableValues.map((vv, i) => (
                        <div key={i}>
                          <dt className="text-xs text-gray-500">{vv.variable.label}</dt>
                          <dd className="text-sm font-medium text-gray-900">
                            {vv.value || "—"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
