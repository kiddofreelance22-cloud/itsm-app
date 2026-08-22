"use client";

import { useState, useEffect, useCallback } from "react";
import { CatalogsApi, CreateCatalogDto, CreateVariableDto } from "@/lib/api/catalogs.api";
import { Catalog } from "@/types/catalog";
import { useToast } from "./use-toast";

export function useCatalogs(mode: "active" | "all" = "active") {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = mode === "all"
        ? await CatalogsApi.listAll()
        : await CatalogsApi.listActive();
      setCatalogs(data);
    } catch (e) {
      console.error("Failed to load catalogs", e);
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const create = useCallback(async (body: CreateCatalogDto): Promise<Catalog | null> => {
    try {
      const catalog = await CatalogsApi.create(body);
      toast({ title: "Catalog item created", variant: "success" });
      await fetchData();
      return catalog;
    } catch (e: unknown) {
      toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
      return null;
    }
  }, [fetchData, toast]);

  const update = useCallback(async (id: number, body: Partial<CreateCatalogDto>): Promise<boolean> => {
    try {
      await CatalogsApi.update(id, body);
      toast({ title: "Catalog item saved", variant: "success" });
      await fetchData();
      return true;
    } catch (e: unknown) {
      toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
      return false;
    }
  }, [fetchData, toast]);

  const remove = useCallback(async (id: number): Promise<boolean> => {
    try {
      await CatalogsApi.remove(id);
      toast({ title: "Catalog item deleted", variant: "success" });
      await fetchData();
      return true;
    } catch (e: unknown) {
      toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
      return false;
    }
  }, [fetchData, toast]);

  return { catalogs, isLoading, refetch: fetchData, create, update, remove };
}

export function useCatalog(catalogId: number) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!catalogId) return;
    setIsLoading(true);
    try {
      const data = await CatalogsApi.getOne(catalogId);
      setCatalog(data);
    } catch (e) {
      console.error("Failed to load catalog", e);
    } finally {
      setIsLoading(false);
    }
  }, [catalogId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createVar = useCallback(async (body: CreateVariableDto) => {
    try {
      await CatalogsApi.createVar(catalogId, body);
      toast({ title: "Variable added", variant: "success" });
      await fetchData();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
    }
  }, [catalogId, fetchData, toast]);

  const updateVar = useCallback(async (variableId: number, body: Partial<CreateVariableDto>) => {
    try {
      await CatalogsApi.updateVar(catalogId, variableId, body);
      await fetchData();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
    }
  }, [catalogId, fetchData, toast]);

  const removeVar = useCallback(async (variableId: number) => {
    try {
      await CatalogsApi.removeVar(catalogId, variableId);
      toast({ title: "Variable removed", variant: "success" });
      await fetchData();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
    }
  }, [catalogId, fetchData, toast]);

  return { catalog, isLoading, refetch: fetchData, createVar, updateVar, removeVar };
}
