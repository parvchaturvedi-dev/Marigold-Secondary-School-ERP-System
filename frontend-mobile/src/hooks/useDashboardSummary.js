import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { fetchDashboardSummary } from "../api/dashboardApi";

export function useDashboardSummary() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    let requestInFlight = false;
    let timer = null;

    async function loadSummary() {
      if (requestInFlight) return;
      requestInFlight = true;
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
        requestInFlight = false;
      }
    }

    const startPolling = () => {
      if (!timer) timer = setInterval(loadSummary, 30000);
    };
    const stopPolling = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    loadSummary();
    if (AppState.currentState === "active") startPolling();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        loadSummary();
        startPolling();
      } else {
        stopPolling();
      }
    });

    return () => {
      mounted = false;
      stopPolling();
      subscription.remove();
    };
  }, []);

  return { summary, loading, error };
}
