// Real unread-notification count for the header badge. Refreshes on mount and
// whenever the backend broadcasts a realtime change.
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api/apiClient";
import { onRealtimeEvent } from "../notifications/realtime";

export function useUnreadNotifications() {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const payload = await apiRequest("/notifications");
      const list = Array.isArray(payload) ? payload : payload?.notifications || [];
      setCount(list.filter((item) => item?.unread).length);
    } catch {
      /* best-effort — leave the previous count */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = onRealtimeEvent((payload) => {
      if (payload?.eventName === "socket:connected") return;
      load();
    });
    return unsubscribe;
  }, [load]);

  return count;
}
