"use client";

import Link from "next/link";
import { MoreVertical } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/incidents/status-badge";
import { PriorityBadge } from "@/components/incidents/priority-badge";
import { IncidentListItem } from "@/types/incident";

interface IncidentTableProps {
  incidents: IncidentListItem[];
  /** Show the Assignment Group column (used on the full "My Incidents" table). */
  showAssignmentGroup?: boolean;
  dateLabel?: string;
}

export function IncidentTable({
  incidents,
  showAssignmentGroup = false,
  dateLabel = "Updated On",
}: IncidentTableProps) {
  if (incidents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-sm font-medium text-slate-600">No incidents found</p>
        <p className="text-sm text-slate-400">Try adjusting your search or filters.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Incident ID</TableHead>
          <TableHead>Summary</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Priority</TableHead>
          {showAssignmentGroup && <TableHead>Assignment Group</TableHead>}
          <TableHead>{dateLabel}</TableHead>
          <TableHead className="text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {incidents.map((incident) => (
          <TableRow key={incident.id}>
            <TableCell>
              <Link
                href={`/incidents/${incident.id}`}
                className="font-medium text-brand-600 hover:underline"
              >
                {incident.id}
              </Link>
            </TableCell>
            <TableCell className="max-w-[220px] truncate text-slate-700">{incident.summary}</TableCell>
            <TableCell>
              <StatusBadge status={incident.status} />
            </TableCell>
            <TableCell>
              <PriorityBadge priority={incident.priority} />
            </TableCell>
            {showAssignmentGroup && <TableCell>{incident.assignmentGroup}</TableCell>}
            <TableCell className="text-slate-500">
              {dateLabel === "Created On" ? incident.createdOn : incident.updatedOn}
            </TableCell>
            <TableCell className="text-right">
              <button
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label={`More actions for ${incident.id}`}
              >
                <MoreVertical className="size-4" />
              </button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
