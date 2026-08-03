"use client";
import { useState, useEffect, useCallback } from "react";
import { CatalogsApi, CreateCatalogDto, CreateVariableDto } from "@/lib/api/catalogs.api";
import { Catalog, CatalogVariable } from "@/types/catalog";
import { useToast } from "./use-toast";

export function useCatalogs(mode: "active" | "all" = "active") {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data =
        mode === "active"
          ? await CatalogsApi.listActive()
          : await CatalogsApi.listAll();
      setCatalogs(data);
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(
    async (body: CreateCatalogDto): Promise<Catalog | null> => {
      try {
        const catalog = await CatalogsApi.create(body);
        toast({ title: "Catalog created", variant: "success" });
        await fetch();
        return catalog;
      } catch (e: unknown) {
        toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
        return null;
      }
    },
    [fetch, toast]
  );

  const update = useCallback(
    async (id: number, body: Partial<CreateCatalogDto>): Promise<boolean> => {
      try {
        await CatalogsApi.update(id, body);
        toast({ title: "Catalog updated", variant: "success" });
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
    async (id: number): Promise<boolean> => {
      try {
        await CatalogsApi.remove(id);
        toast({ title: "Catalog deleted", variant: "success" });
        await fetch();
        return true;
      } catch (e: unknown) {
        toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
        return false;
      }
    },
    [fetch, toast]
  );

  return { catalogs, isLoading, error, refetch: fetch, create, update, remove };
}

export function useCatalog(id: number) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await CatalogsApi.getOne(id);
      setCatalog(data);
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  const createVar = useCallback(
    async (body: CreateVariableDto): Promise<CatalogVariable | null> => {
      try {
        const v = await CatalogsApi.createVar(id, body);
        toast({ title: "Field added", variant: "success" });
        await fetch();
        return v;
      } catch (e: unknown) {
        toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
        return null;
      }
    },
    [id, fetch, toast]
  );

  const updateVar = useCallback(
    async (vid: number, body: Partial<CreateVariableDto>): Promise<boolean> => {
      try {
        await CatalogsApi.updateVar(id, vid, body);
        await fetch();
        return true;
      } catch (e: unknown) {
        toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
        return false;
      }
    },
    [id, fetch, toast]
  );

  const removeVar = useCallback(
    async (vid: number): Promise<boolean> => {
      try {
        await CatalogsApi.removeVar(id, vid);
        toast({ title: "Field removed", variant: "success" });
        await fetch();
        return true;
      } catch (e: unknown) {
        toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
        return false;
      }
    },
    [id, fetch, toast]
  );

  return { catalog, isLoading, error, refetch: fetch, createVar, updateVar, removeVar };
}

