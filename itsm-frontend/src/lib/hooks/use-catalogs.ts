"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CatalogsApi, CreateCatalogDto, CreateVariableDto, CreateSectionDto } from "@/lib/api/catalogs.api";
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
  const hasLoaded = useRef(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!catalogId) return;
    // Keep the editor mounted during background refreshes so its active tab
    // and local UI state are not reset after variable or section changes.
    if (!hasLoaded.current) setIsLoading(true);
    try {
      const data = await CatalogsApi.getOne(catalogId);
      setCatalog(data);
      hasLoaded.current = true;
    } catch (e) {
      console.error("Failed to load catalog", e);
    } finally {
      setIsLoading(false);
    }
  }, [catalogId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const err = (e: unknown) => (e instanceof Error ? e.message : String(e));

  // ── Variables ──────────────────────────────────────────────────────────
  const createVar = useCallback(async (body: CreateVariableDto) => {
    try {
      const variable = await CatalogsApi.createVar(catalogId, body);
      toast({ title: "Variable added", variant: "success" });
      await fetchData();
      return variable;
    } catch (e: unknown) {
      toast({ title: "Error", description: err(e), variant: "error" });
      return null;
    }
  }, [catalogId, fetchData, toast]);

  const updateVar = useCallback(async (variableId: number, body: Partial<CreateVariableDto>) => {
    try {
      await CatalogsApi.updateVar(catalogId, variableId, body);
      await fetchData();
    } catch (e: unknown) {
      toast({ title: "Error", description: err(e), variant: "error" });
    }
  }, [catalogId, fetchData, toast]);

  const removeVar = useCallback(async (variableId: number) => {
    try {
      await CatalogsApi.removeVar(catalogId, variableId);
      toast({ title: "Variable removed", variant: "success" });
      await fetchData();
    } catch (e: unknown) {
      toast({ title: "Error", description: err(e), variant: "error" });
    }
  }, [catalogId, fetchData, toast]);

  const reorderVars = useCallback(async (variables: { variableId: number; sortOrder: number; sectionId?: number | null }[]) => {
    try {
      await CatalogsApi.reorderVars(catalogId, variables);
      await fetchData();
    } catch (e: unknown) {
      toast({ title: "Error", description: err(e), variant: "error" });
    }
  }, [catalogId, fetchData, toast]);

  // ── Sections ───────────────────────────────────────────────────────────
  const createSection = useCallback(async (body: CreateSectionDto) => {
    try {
      await CatalogsApi.createSection(catalogId, body);
      toast({ title: "Section added", variant: "success" });
      await fetchData();
    } catch (e: unknown) {
      toast({ title: "Error", description: err(e), variant: "error" });
    }
  }, [catalogId, fetchData, toast]);

  const updateSection = useCallback(async (sectionId: number, body: Partial<CreateSectionDto>) => {
    try {
      await CatalogsApi.updateSection(catalogId, sectionId, body);
      await fetchData();
    } catch (e: unknown) {
      toast({ title: "Error", description: err(e), variant: "error" });
    }
  }, [catalogId, fetchData, toast]);

  const removeSection = useCallback(async (sectionId: number) => {
    try {
      await CatalogsApi.removeSection(catalogId, sectionId);
      toast({ title: "Section removed", variant: "success" });
      await fetchData();
    } catch (e: unknown) {
      toast({ title: "Error", description: err(e), variant: "error" });
    }
  }, [catalogId, fetchData, toast]);

  const reorderSections = useCallback(async (sections: { sectionId: number; displayOrder: number }[]) => {
    try {
      await CatalogsApi.reorderSections(catalogId, sections);
      await fetchData();
    } catch (e: unknown) {
      toast({ title: "Error", description: err(e), variant: "error" });
    }
  }, [catalogId, fetchData, toast]);

  return {
    catalog, isLoading, refetch: fetchData,
    createVar, updateVar, removeVar, reorderVars,
    createSection, updateSection, removeSection, reorderSections,
  };
}
