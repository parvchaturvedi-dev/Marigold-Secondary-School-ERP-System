import { useEffect, useState } from "react";
import { fetchDashboardSummary } from "../api/dashboardApi";

export function useDashboardSummary() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      try {
        const data = await fetchDashboardSummary();
        if (!mounted) return;
        setSummary(data);
        setError("");
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || "Dashboard data could not be loaded.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSummary();
    const timer = setInterval(loadSummary, 30000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return { summary, loading, error };
}
