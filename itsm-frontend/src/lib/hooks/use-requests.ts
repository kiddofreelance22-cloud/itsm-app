"use client";
import { useState, useEffect, useCallback } from "react";
import { RequestsApi, SubmitRequestDto } from "@/lib/api/requests.api";
import { ServiceRequest } from "@/types/request";
import { useToast } from "./use-toast";

export function useRequests(mode: "mine" | "all" = "mine") {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data =
        mode === "mine"
          ? await RequestsApi.listMine()
          : await RequestsApi.listAll();
      setRequests(data);
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : String(e)) ?? "Failed to load requests");
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  useEffect(() => { fetch(); }, [fetch]);

  const submit = useCallback(
    async (body: SubmitRequestDto): Promise<ServiceRequest | null> => {
      try {
        const req = await RequestsApi.submit(body);
        toast({ title: "Request submitted successfully!", variant: "success" });
        return req;
      } catch (e: unknown) {
        toast({ title: "Submission failed", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
        return null;
      }
    },
    [toast]
  );

  return { requests, isLoading, error, refetch: fetch, submit };
}

export function useRequest(id: number) {
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    RequestsApi.getOne(id)
      .then(setRequest)
      .catch((e) => setError((e instanceof Error ? e.message : String(e))))
      .finally(() => setIsLoading(false));
  }, [id]);

  return { request, isLoading, error };
}

