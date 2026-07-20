import { useEffect, useState } from "react";
import { getQueueCount, subscribe } from "@/lib/offline-queue";

/** Live pending-sync count + online status, for a status indicator in the UI. */
export function useOfflineQueue() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      getQueueCount().then((count) => {
        if (!cancelled) setPendingCount(count);
      });
    };
    refresh();
    const unsubscribe = subscribe(refresh);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { pendingCount, isOnline };
}
