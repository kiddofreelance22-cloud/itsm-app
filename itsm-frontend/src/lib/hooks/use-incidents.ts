"use client";
import { useState, useEffect, useCallback } from "react";
import { IncidentsApi, Incident, CreateIncidentDto, UpdateIncidentDto } from "@/lib/api/incidents.api";
import { useToast } from "./use-toast";

export function useIncidents(mode: "mine" | "all" = "mine") {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data =
        mode === "mine"
          ? await IncidentsApi.listMine()
          : await IncidentsApi.listAll();
      setIncidents(data);
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : String(e)) ?? "Failed to load incidents");
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(
    async (body: CreateIncidentDto): Promise<Incident | null> => {
      try {
        const incident = await IncidentsApi.create(body);
        toast({ title: "Incident created", variant: "success" });
        await fetch();
        return incident;
      } catch (e: unknown) {
        toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
        return null;
      }
    },
    [fetch, toast]
  );

  const update = useCallback(
    async (id: string, body: UpdateIncidentDto): Promise<boolean> => {
      try {
        await IncidentsApi.update(id, body);
        toast({ title: "Incident updated", variant: "success" });
        await fetch();
        return true;
      } catch (e: unknown) {
        toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
        return false;
      }
    },
    [fetch, toast]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await IncidentsApi.remove(id);
        toast({ title: "Incident deleted", variant: "success" });
        await fetch();
        return true;
      } catch (e: unknown) {
        toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
        return false;
      }
    },
    [fetch, toast]
  );

  return { incidents, isLoading, error, refetch: fetch, create, update, remove };
}

export function useIncident(id: string) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    IncidentsApi.getOne(id)
      .then(setIncident)
      .catch((e) => setError((e instanceof Error ? e.message : String(e))))
      .finally(() => setIsLoading(false));
  }, [id]);

  return { incident, isLoading, error };
}

