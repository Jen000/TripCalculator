import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createTrip, getTrips, type Trip } from "../api/trips";

type TripContextValue = {
  trips: Trip[];
  activeTripId: string | "";
  setActiveTripId: (id: string) => void;
  refreshTrips: () => Promise<void>;
  addTrip: (name: string) => Promise<Trip>;
  loadingTrips: boolean;
};

const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripIdState] = useState<string>("");
  const [loadingTrips, setLoadingTrips] = useState(true);

  const setActiveTripId = (id: string) => {
    setActiveTripIdState(id);
    localStorage.setItem("activeTripId", id);
  };

  const refreshTrips = async () => {
    setLoadingTrips(true);
    try {
      const data = await getTrips();
      const list = data.trips ?? [];
      setTrips(list);

      // restore last selection if possible
      const saved = localStorage.getItem("activeTripId") || "";
      const defaultId = saved && list.some((t) => t.tripId === saved) ? saved : list[0]?.tripId || "";
      setActiveTripIdState(defaultId);
      if (defaultId) localStorage.setItem("activeTripId", defaultId);
    } finally {
      setLoadingTrips(false);
    }
  };

  const addTrip = async (name: string) => {
    const data = await createTrip(name);
    const newTrip = data.trip;
    // refresh list and set active to new trip
    await refreshTrips();
    setActiveTripId(newTrip.tripId);
    return newTrip;
  };

  useEffect(() => {
    refreshTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ trips, activeTripId, setActiveTripId, refreshTrips, addTrip, loadingTrips }),
    [trips, activeTripId, loadingTrips]
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip must be used within TripProvider");
  return ctx;
}
