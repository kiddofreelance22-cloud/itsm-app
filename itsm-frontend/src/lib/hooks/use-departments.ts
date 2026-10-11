"use client";
import { useState, useEffect, useCallback } from "react";
import { DepartmentsApi, CreateDepartmentDto, UpdateDepartmentDto } from "@/lib/api/departments.api";
import { Department } from "@/lib/api/departments.api";
import { useToast } from "./use-toast";

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await DepartmentsApi.list();
      setDepartments(data);
      return data;
    } catch (e: unknown) {
      toast({ title: "Error loading departments", description: msg(e), variant: "error" });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const create = useCallback(async (body: CreateDepartmentDto) => {
    try {
      const created = await DepartmentsApi.create(body);
      toast({ title: "Department created", variant: "success" });
      await fetch();
      return created;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return null;
    }
  }, [fetch, toast]);

  const update = useCallback(async (id: number, body: UpdateDepartmentDto) => {
    try {
      await DepartmentsApi.update(id, body);
      toast({ title: "Department updated", variant: "success" });
      await fetch();
      return true;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return false;
    }
  }, [fetch, toast]);

  const remove = useCallback(async (id: number) => {
    try {
      await DepartmentsApi.remove(id);
      toast({ title: "Department deleted", variant: "success" });
      await fetch();
      return true;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return false;
    }
  }, [fetch, toast]);

  return { departments, isLoading, refetch: fetch, create, update, remove };
}
