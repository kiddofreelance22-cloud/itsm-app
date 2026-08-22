"use client";
import { useState, useEffect, useCallback } from "react";
import { UsersApi, CreateUserDto, UpdateUserDto } from "@/lib/api/users.api";
import { RolesApi, CreateRoleDto } from "@/lib/api/roles.api";
import { CategoriesApi, CreateCategoryDto } from "@/lib/api/categories.api";
import { WorkflowsApi, CreateWorkflowDto, CreateStepDto } from "@/lib/api/workflows.api";
import { AdminUser, Role, Category } from "@/types/admin";
import { Workflow } from "@/types/workflow";
import { useToast } from "./use-toast";

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// ── Users ────────────────────────────────────────────────────────────────────
export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await UsersApi.list();
      setUsers(data);
      return data;
    } catch (e: unknown) {
      toast({ title: "Error loading users", description: msg(e), variant: "error" });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (body: CreateUserDto) => {
    try {
      const created = await UsersApi.create(body);
      toast({ title: "User created", variant: "success" });
      await fetch();
      return created;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return null;
    }
  }, [fetch, toast]);

  const update = useCallback(async (id: number, body: UpdateUserDto) => {
    try {
      await UsersApi.update(id, body);
      toast({ title: "User updated", variant: "success" });
      await fetch();
      return true;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return false;
    }
  }, [fetch, toast]);

  const remove = useCallback(async (id: number) => {
    try {
      await UsersApi.remove(id);
      toast({ title: "User deleted", variant: "success" });
      await fetch();
      return true;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return false;
    }
  }, [fetch, toast]);

  const deactivate = useCallback(async (id: number) => {
    try {
      await UsersApi.deactivate(id);
      toast({ title: "User deactivated", variant: "info" });
      await fetch();
      return true;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return false;
    }
  }, [fetch, toast]);

  return { users, isLoading, refetch: fetch, create, update, remove, deactivate };
}

// ── Roles ────────────────────────────────────────────────────────────────────
export function useAdminRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await RolesApi.list();
      setRoles(data);
      return data;
    } catch (e: unknown) {
      toast({ title: "Error loading roles", description: msg(e), variant: "error" });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (body: CreateRoleDto) => {
    try {
      await RolesApi.create(body);
      toast({ title: "Role created", variant: "success" });
      await fetch();
      return true;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return false;
    }
  }, [fetch, toast]);

  const update = useCallback(async (id: number, body: Partial<CreateRoleDto>) => {
    try {
      await RolesApi.update(id, body);
      toast({ title: "Role updated", variant: "success" });
      await fetch();
      return true;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return false;
    }
  }, [fetch, toast]);

  const assign = useCallback(async (userId: number, roleId: number) => {
    try {
      await RolesApi.assign(userId, roleId);
      toast({ title: "Role assigned", variant: "success" });
      await fetch();
      return true;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return false;
    }
  }, [fetch, toast]);

  const unassign = useCallback(async (userId: number, roleId: number) => {
    try {
      await RolesApi.unassign(userId, roleId);
      toast({ title: "Role removed", variant: "info" });
      await fetch();
      return true;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return false;
    }
  }, [fetch, toast]);

  return { roles, isLoading, refetch: fetch, create, update, assign, unassign };
}

// ── Categories ───────────────────────────────────────────────────────────────
export function useAdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try { setCategories(await CategoriesApi.list()); }
    catch (e: unknown) { toast({ title: "Error", description: msg(e), variant: "error" }); }
    finally { setIsLoading(false); }
  }, [toast]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (body: CreateCategoryDto) => {
    try {
      await CategoriesApi.create(body);
      toast({ title: "Category created", variant: "success" });
      await fetch();
      return true;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return false;
    }
  }, [fetch, toast]);

  const update = useCallback(async (id: number, body: Partial<CreateCategoryDto>) => {
    try {
      await CategoriesApi.update(id, body);
      toast({ title: "Category updated", variant: "success" });
      await fetch();
      return true;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return false;
    }
  }, [fetch, toast]);

  const remove = useCallback(async (id: number) => {
    try {
      await CategoriesApi.remove(id);
      toast({ title: "Category deleted", variant: "success" });
      await fetch();
      return true;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return false;
    }
  }, [fetch, toast]);

  return { categories, isLoading, refetch: fetch, create, update, remove };
}

// ── Workflows ────────────────────────────────────────────────────────────────
export function useAdminWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try { setWorkflows(await WorkflowsApi.list()); }
    catch (e: unknown) { toast({ title: "Error", description: msg(e), variant: "error" }); }
    finally { setIsLoading(false); }
  }, [toast]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (body: CreateWorkflowDto) => {
    try {
      const w = await WorkflowsApi.create(body);
      toast({ title: "Workflow created", variant: "success" });
      await fetch();
      return w;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return null;
    }
  }, [fetch, toast]);

  const update = useCallback(async (id: number, body: Partial<CreateWorkflowDto>) => {
    try {
      await WorkflowsApi.update(id, body);
      toast({ title: "Workflow updated", variant: "success" });
      await fetch();
      return true;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return false;
    }
  }, [fetch, toast]);

  const addStep = useCallback(async (id: number, body: CreateStepDto) => {
    try {
      await WorkflowsApi.addStep(id, body);
      toast({ title: "Step added", variant: "success" });
      await fetch();
      return true;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return false;
    }
  }, [fetch, toast]);

  const removeStep = useCallback(async (id: number, stepId: number) => {
    try {
      await WorkflowsApi.removeStep(id, stepId);
      toast({ title: "Step removed", variant: "info" });
      await fetch();
      return true;
    } catch (e: unknown) {
      toast({ title: "Error", description: msg(e), variant: "error" });
      return false;
    }
  }, [fetch, toast]);

  return { workflows, isLoading, refetch: fetch, create, update, addStep, removeStep };
}

