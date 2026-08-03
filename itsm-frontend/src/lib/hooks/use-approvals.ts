"use client";
import { useState, useEffect, useCallback } from "react";
import { ApprovalsApi } from "@/lib/api/approvals.api";
import { ServiceRequest } from "@/types/request";
import { useToast } from "./use-toast";

export function useApprovals() {
  const [pending, setPending] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ApprovalsApi.listPending();
      setPending(data);
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : String(e)) ?? "Failed to load approvals");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const act = useCallback(
    async (
      requestId: number,
      action: "Approved" | "Rejected",
      comments?: string
    ): Promise<boolean> => {
      setIsActing(true);
      try {
        await ApprovalsApi.act(requestId, action, comments);
        toast({
          title: `Request ${action.toLowerCase()} successfully`,
          variant: action === "Approved" ? "success" : "info",
        });
        await fetch();
        return true;
      } catch (e: unknown) {
        toast({ title: "Action failed", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
        return false;
      } finally {
        setIsActing(false);
      }
    },
    [fetch, toast]
  );

  return { pending, isLoading, isActing, error, refetch: fetch, act };
}

