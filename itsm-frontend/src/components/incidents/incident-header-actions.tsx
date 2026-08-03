"use client";

import { useState } from "react";
import { Pencil, RefreshCcw, RotateCcw, MoreVertical, Printer, Copy, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { IncidentStatus } from "@/types/incident";

export function IncidentHeaderActions({ status }: { status: IncidentStatus }) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [reopening, setReopening] = useState(false);
  const canReopen = status === "Resolved" || status === "Closed";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm">
        <Pencil className="size-4" /> Edit
      </Button>

      <Button variant="secondary" size="sm" onClick={() => setRequestOpen(true)}>
        <RefreshCcw className="size-4" /> Request Update
      </Button>

      <Button size="sm" disabled={!canReopen} onClick={() => setReopenOpen(true)}>
        <RotateCcw className="size-4" /> Reopen
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="More actions">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Printer className="size-4" /> Print
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Copy className="size-4" /> Copy link
          </DropdownMenuItem>
          <DropdownMenuItem destructive>
            <Ban className="size-4" /> Cancel Incident
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Request Update modal */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request an update</DialogTitle>
            <DialogDescription>
              We&apos;ll notify the assigned agent to post the latest status on this incident.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              loading={requesting}
              onClick={() => {
                setRequesting(true);
                setTimeout(() => {
                  setRequesting(false);
                  setRequestOpen(false);
                }, 800);
              }}
            >
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen confirmation modal */}
      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen this incident?</DialogTitle>
            <DialogDescription>
              This will move the incident back to an active state so it can be worked on again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              loading={reopening}
              onClick={() => {
                setReopening(true);
                setTimeout(() => {
                  setReopening(false);
                  setReopenOpen(false);
                }, 800);
              }}
            >
              Yes, Reopen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
