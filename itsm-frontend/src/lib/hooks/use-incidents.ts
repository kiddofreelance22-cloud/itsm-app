"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  IncidentsApi,
  Incident,
  IncidentActivity,
  CreateIncidentDto,
  UpdateIncidentDto,
} from "@/lib/api/incidents.api";
import { useToast } from "./use-toast";
import { useSocket } from "./use-socket";

export function useIncidents(mode: "mine" | "all" | "assigned" | "workgroup" = "mine") {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { on } = useSocket();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data =
        mode === "all"
          ? await IncidentsApi.listAll()
          : mode === "workgroup"
          ? await IncidentsApi.listWorkgroup()
          : mode === "assigned"
          ? await IncidentsApi.listAssignedToMe()
          : await IncidentsApi.listMine();
      setIncidents(data);
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : String(e)) ?? "Failed to load incidents");
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time: refresh list when any incident is updated globally
  useEffect(() => {
    const off = on("incident:updated_global", () => {
      fetchData();
    });
    return off;
  }, [on, fetchData]);

  const create = useCallback(
    async (body: CreateIncidentDto): Promise<Incident | null> => {
      try {
        const incident = await IncidentsApi.create(body);
        toast({ title: "Incident created", variant: "success" });
        await fetchData();
        return incident;
      } catch (e: unknown) {
        toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
        return null;
      }
    },
    [fetchData, toast]
  );

  const update = useCallback(
    async (id: string, body: UpdateIncidentDto): Promise<boolean> => {
      try {
        await IncidentsApi.update(id, body);
        toast({ title: "Incident updated", variant: "success" });
        await fetchData();
        return true;
      } catch (e: unknown) {
        toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
        return false;
      }
    },
    [fetchData, toast]
  );

  const claim = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await IncidentsApi.claim(id);
        toast({ title: "Incident claimed", description: "It now appears in My Incidents.", variant: "success" });
        await fetchData();
        return true;
      } catch (e: unknown) {
        toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
        return false;
      }
    },
    [fetchData, toast]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await IncidentsApi.remove(id);
        toast({ title: "Incident deleted", variant: "success" });
        await fetchData();
        return true;
      } catch (e: unknown) {
        toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
        return false;
      }
    },
    [fetchData, toast]
  );

  return { incidents, isLoading, error, refetch: fetchData, create, update, claim, remove };
}

export function useIncident(id: string) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { on, joinIncident } = useSocket();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await IncidentsApi.getOne(id);
      setIncident(data);
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time: join incident room and listen for updates
  useEffect(() => {
    const leave = joinIncident(id);
    const off = on<Incident>("incident:updated", (updated) => {
      setIncident(updated);
    });
    return () => { leave(); off(); };
  }, [id, joinIncident, on]);

  return { incident, isLoading, error, refetch: fetchData };
}

export function useIncidentActivities(incidentId: string) {
  const [activities, setActivities] = useState<IncidentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { on } = useSocket();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await IncidentsApi.getActivities(incidentId);
      setActivities(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [incidentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time: new activity pushed by server
  useEffect(() => {
    const off = on<IncidentActivity>("activity:new", (activity) => {
      if (activity.incidentId === incidentId) {
        setActivities((prev) => {
          const exists = prev.some((a) => a.activityId === activity.activityId);
          return exists ? prev : [...prev, activity];
        });
      }
    });
    return off;
  }, [on, incidentId]);

  const addActivity = useCallback(
    async (content: string, isWorkNote = false) => {
      try {
        await IncidentsApi.addActivity(incidentId, { content, isWorkNote });
        // Activity will arrive via socket
      } catch (e: unknown) {
        toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
      }
    },
    [incidentId, toast]
  );

  return { activities, isLoading, addActivity };
}

export function useGroupQueue(groupId: number | null) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { on, joinGroupQueue } = useSocket();

  const fetchData = useCallback(async () => {
    if (!groupId) return;
    setIsLoading(true);
    try {
      const data = await IncidentsApi.listGroupQueue(groupId);
      setIncidents(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!groupId) return;
    const leave = joinGroupQueue(groupId);

    // New incident added to queue
    const offQueued = on<Incident>("incident:queued", (inc) => {
      setIncidents((prev) => {
        const exists = prev.some((i) => i.incidentId === (inc as Incident).incidentId);
        return exists ? prev : [inc, ...prev];
      });
    });

    // Incident claimed – remove from queue
    const offClaimed = on<{ incidentId: string }>("incident:claimed", ({ incidentId }) => {
      setIncidents((prev) => prev.filter((i) => i.incidentId !== incidentId));
    });

    return () => { leave(); offQueued(); offClaimed(); };
  }, [groupId, joinGroupQueue, on]);

  return { incidents, isLoading, refetch: fetchData };
}
