"use client";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "./use-toast";
import {
  StatusApi, PriorityApi, ImpactApi, UrgencyApi,
  SubCategoryApi, AssignmentGroupApi, LocationApi, ServiceCategoryApi, ServiceImpactApi, ServicePriorityApi, ServiceUrgencyApi, RequestSlaServiceWindowApi, ServiceCompletionApi, ClosureCodeApi, PendingReasonApi, RequestPendingReasonApi, PriorityMatrixApi, SlaServiceWindowApi,
} from "@/lib/api/admin-modules.api";
import { Status, Priority, Impact, Urgency, SubCategory, AssignmentGroup, Location, ServiceCategory, ServiceImpact, ServicePriority, ServiceUrgency, RequestSlaServiceWindow, ServiceCompletion, ClosureCode, PendingReason, RequestPendingReason, PriorityMatrix, SlaServiceWindow } from "@/types/admin";

type AdminPayload = Record<string, unknown>;
type AdminApi<T> = {
  list: () => Promise<T[]>;
  create: (body: AdminPayload) => Promise<T>;
  update: (id: number, body: AdminPayload) => Promise<T>;
  remove: (id: number) => Promise<void>;
};

function makeHook<T>(api: AdminApi<T>) {
  return function useModule() {
    const [items, setItems] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const fetch = useCallback(async () => {
      setIsLoading(true);
      try { setItems(await api.list()); }
      catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast({ title: "Error loading data", description: message, variant: "error" });
      }
      finally { setIsLoading(false); }
    }, [api, toast]);

    useEffect(() => { void fetch(); }, [fetch]);

    const create = useCallback(async (body: AdminPayload) => {
      try { await api.create(body); toast({ title: "Created", variant: "success" }); await fetch(); return true; }
      catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast({ title: "Error", description: message, variant: "error" });
        return false;
      }
    }, [api, fetch, toast]);

    const update = useCallback(async (id: number, body: AdminPayload) => {
      try { await api.update(id, body); toast({ title: "Updated", variant: "success" }); await fetch(); return true; }
      catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast({ title: "Error", description: message, variant: "error" });
        return false;
      }
    }, [api, fetch, toast]);

    const remove = useCallback(async (id: number) => {
      try { await api.remove(id); toast({ title: "Deleted", variant: "info" }); await fetch(); return true; }
      catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast({ title: "Error", description: message, variant: "error" });
        // Reconcile with the server even on failure — a delete that actually
        // succeeded (e.g. a stale duplicate request 404ing) shouldn't leave a
        // deleted row still showing in the list next to the error toast.
        await fetch();
        return false;
      }
    }, [api, fetch, toast]);

    return { items, isLoading, refetch: fetch, create, update, remove };
  };
}

export const useAdminStatus = makeHook<Status>(StatusApi);
export const useAdminPriority = makeHook<Priority>(PriorityApi);
export const useAdminImpact = makeHook<Impact>(ImpactApi);
export const useAdminUrgency = makeHook<Urgency>(UrgencyApi);
export const useAdminSubCategory = makeHook<SubCategory>(SubCategoryApi);
export const useAdminAssignmentGroup = makeHook<AssignmentGroup>(AssignmentGroupApi);
export const useAdminLocation = makeHook<Location>(LocationApi);
export const useAdminServiceCategory = makeHook<ServiceCategory>(ServiceCategoryApi);
export const useAdminServiceImpact = makeHook<ServiceImpact>(ServiceImpactApi);
export const useAdminServiceCompletion = makeHook<ServiceCompletion>(ServiceCompletionApi);
export const useAdminClosureCode = makeHook<ClosureCode>(ClosureCodeApi);
export const useAdminPendingReason = makeHook<PendingReason>(PendingReasonApi);
export const useAdminRequestPendingReason = makeHook<RequestPendingReason>(RequestPendingReasonApi);
export const useAdminPriorityMatrix = makeHook<PriorityMatrix>(PriorityMatrixApi);
export const useAdminSlaServiceWindow = makeHook<SlaServiceWindow>(SlaServiceWindowApi);
export const useAdminServicePriority = makeHook<ServicePriority>(ServicePriorityApi);
export const useAdminServiceUrgency = makeHook<ServiceUrgency>(ServiceUrgencyApi);
export const useAdminRequestSlaServiceWindow = makeHook<RequestSlaServiceWindow>(RequestSlaServiceWindowApi);
