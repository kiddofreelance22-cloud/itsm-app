"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageSpinner } from "@/components/ui/spinner";
import { useMyWorkgroups } from "@/lib/hooks/use-dashboard";

export default function MyWorkgroupsPage() {
  const { workgroups, isLoading } = useMyWorkgroups();

  return (
    <div className="w-full">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "My Workgroups" }]} />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Workgroups</h1>
        <p className="mt-1 text-sm text-slate-500">
          Assignment groups you belong to, and how much of their incident load is yours.
        </p>
      </div>

      <Card className="mt-6 p-0">
        {isLoading ? (
          <PageSpinner />
        ) : workgroups.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            You are not a member of any assignment group yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">WG Name</th>
                <th className="px-5 py-3 text-center">Assigned To Me</th>
                <th className="px-5 py-3 text-center">Total Incidents</th>
                <th className="px-5 py-3 text-center">Resolved Tickets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workgroups.map((wg) => (
                <tr key={wg.groupId} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/incidents/queue?group=${wg.groupId}`}
                      className="flex items-center gap-2 font-medium text-slate-800 hover:text-brand-600"
                    >
                      <Users className="size-4 text-slate-400" />
                      {wg.groupName}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-400">{wg.groupCode}</p>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {wg.assignedToMe}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center font-medium text-slate-700">
                    {wg.totalIncidents}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                      {wg.resolvedTickets}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
