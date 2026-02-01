import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createTrip, getTrips, type Trip } from "../api/trips";

type TripContextValue = {
  trips: Trip[];
  activeTripId: string | null;
  setActiveTripId: (id: string | null) => void;

  loadingTrips: boolean;
  refreshTrips: () => Promise<void>;

  addTrip: (name: string) => Promise<Trip>;

  // Optional helper (nice for after delete)
  removeTripLocal: (tripId: string) => void;
};

const TripContext = createContext<TripContextValue | null>(null);

const STORAGE_KEY = "activeTripId";

export function TripProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripIdState, setActiveTripIdState] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY) || null;
  });
  const [loadingTrips, setLoadingTrips] = useState(true);

  const setActiveTripId = (id: string | null) => {
    setActiveTripIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  };

  const refreshTrips = async () => {
    setLoadingTrips(true);
    try {
      const data = await getTrips();
      const list = data.trips ?? [];
      setTrips(list);

      // Keep current selection if it still exists; otherwise fall back to saved; otherwise first; otherwise null.
      const saved = localStorage.getItem(STORAGE_KEY) || null;

      setActiveTripIdState((current) => {
        const currentValid = current && list.some((t) => t.tripId === current);
        if (currentValid) return current;

        const savedValid = saved && list.some((t) => t.tripId === saved);
        const next = savedValid ? saved : list[0]?.tripId ?? null;

        // keep localStorage in sync
        if (next) localStorage.setItem(STORAGE_KEY, next);
        else localStorage.removeItem(STORAGE_KEY);

        return next;
      });
    } finally {
      setLoadingTrips(false);
    }
  };

  const addTrip = async (name: string) => {
    const data = await createTrip(name);
    const newTrip = data.trip;

    // Optimistic update so UI feels instant
    setTrips((prev) => [newTrip, ...prev]);

    // Set as active immediately
    setActiveTripId(newTrip.tripId);

    // Refresh from server to ensure consistency (and to pull any server fields)
    await refreshTrips();

    return newTrip;
  };

  const removeTripLocal = (tripId: string) => {
    setTrips((prev) => prev.filter((t) => t.tripId !== tripId));

    // If removing the active trip, clear it and localStorage.
    setActiveTripIdState((current) => {
      if (current !== tripId) return current;
      localStorage.removeItem(STORAGE_KEY);
      return null;
    });
  };

  useEffect(() => {
    refreshTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      trips,
      activeTripId: activeTripIdState,
      setActiveTripId,
      loadingTrips,
      refreshTrips,
      addTrip,
      removeTripLocal,
    }),
    [trips, activeTripIdState, loadingTrips]
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip must be used within TripProvider");
  return ctx;
}
