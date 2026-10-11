"use client";
import { useState, useEffect, useCallback } from "react";
import { DashboardApi, AnalystDashboardStats } from "@/lib/api/dashboard.api";
import { AssignmentGroupApi, MyWorkgroup } from "@/lib/api/admin-modules.api";

export function useAnalystDashboard() {
  const [stats, setStats] = useState<AnalystDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await DashboardApi.getAnalystDashboard();
      setStats(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { stats, isLoading, error, refetch: fetchData };
}

/** Workgroups the current (analyst) user belongs to, with real incident counts. */
export function useMyWorkgroups() {
  const [workgroups, setWorkgroups] = useState<MyWorkgroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await AssignmentGroupApi.myWorkgroups();
      setWorkgroups(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load workgroups");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { workgroups, isLoading, error, refetch: fetchData };
}
