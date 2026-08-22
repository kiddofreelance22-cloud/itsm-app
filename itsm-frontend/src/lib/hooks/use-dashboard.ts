"use client";
import { useState, useEffect, useCallback } from "react";
import { DashboardApi, AnalystDashboardStats } from "@/lib/api/dashboard.api";

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
