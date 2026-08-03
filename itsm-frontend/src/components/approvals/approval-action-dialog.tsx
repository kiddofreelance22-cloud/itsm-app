"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ServiceRequest } from "@/types/request";

interface ApprovalActionDialogProps {
  open: boolean;
  request: ServiceRequest | null;
  action: "Approved" | "Rejected" | null;
  isLoading?: boolean;
  onConfirm: (comments: string) => Promise<void>;
  onClose: () => void;
}

export function ApprovalActionDialog({
  open,
  request,
  action,
  isLoading = false,
  onConfirm,
  onClose,
}: ApprovalActionDialogProps) {
  const [comments, setComments] = useState("");

  const handleConfirm = async () => {
    await onConfirm(comments);
    setComments("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {action === "Approved" ? "Approve Request" : "Reject Request"}
          </DialogTitle>
          {request && (
            <DialogDescription>
              #{request.requestId} — {request.catalog.catalogName}
              {" "}by {request.requestedBy.fullName}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Submitted values summary */}
          {request?.variableValues && request.variableValues.length > 0 && (
            <div className="rounded-md border bg-gray-50 p-3 space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Request Details
              </p>
              {request.variableValues.map((vv, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <span className="text-gray-500 min-w-0 shrink-0">
                    {vv.variable.label}:
                  </span>
                  <span className="font-medium text-gray-900 truncate">{vv.value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="comments">
              Comments{action === "Rejected" && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            <Textarea
              id="comments"
              rows={3}
              placeholder={
                action === "Rejected"
                  ? "Please provide a reason for rejection..."
                  : "Optional comments..."
              }
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={action === "Rejected" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isLoading || (action === "Rejected" && !comments.trim())}
            className="gap-2"
          >
            {isLoading && <Spinner size="sm" />}
            {action === "Approved" ? "Approve" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
