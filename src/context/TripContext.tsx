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
const TRIPS_CACHE_KEY = "tripsListCache";
const TRIPS_CACHE_TTL_MS = 60_000;

type TripsCache = { trips: Trip[]; fetchedAt: number };

function loadTripsCache(): TripsCache | null {
  try {
    const raw = localStorage.getItem(TRIPS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.trips) || typeof parsed.fetchedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveTripsCache(trips: Trip[]) {
  try {
    localStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify({ trips, fetchedAt: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function TripProvider({ children }: { children: ReactNode }) {
  const initialCache = loadTripsCache();
  const [trips, setTrips] = useState<Trip[]>(initialCache?.trips ?? []);
  const [activeTripIdState, setActiveTripIdState] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY) || null;
  });
  // Only show the boot loading state if we don't have any cached trips to render.
  const [loadingTrips, setLoadingTrips] = useState(!initialCache);

  const setActiveTripId = (id: string | null) => {
    setActiveTripIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  };

  const refreshTrips = async () => {
    // If we have nothing rendered yet (no cache), show the spinner. Otherwise
    // revalidate quietly in the background — the cached list stays on screen.
    const hasRendered = trips.length > 0;
    if (!hasRendered) setLoadingTrips(true);
    try {
      const data = await getTrips();
      const list = data.trips ?? [];
      setTrips(list);
      saveTripsCache(list);

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
    } catch (err) {
      // Don't wipe currently-rendered trips on a transient network/server error.
      // An invited member with no cache will see 0 trips until the server recovers,
      // but existing cached data stays visible rather than disappearing.
      console.error("Failed to load trips:", err);
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
    // Skip the network call entirely if the cached trips list is still fresh.
    const fresh = initialCache && Date.now() - initialCache.fetchedAt < TRIPS_CACHE_TTL_MS;
    if (fresh) {
      // Make sure the selected trip still exists in the cached list.
      setActiveTripIdState((current) => {
        const list = initialCache.trips;
        const currentValid = current && list.some((t) => t.tripId === current);
        if (currentValid) return current;
        const saved = localStorage.getItem(STORAGE_KEY) || null;
        const savedValid = saved && list.some((t) => t.tripId === saved);
        const next = savedValid ? saved : list[0]?.tripId ?? null;
        if (next) localStorage.setItem(STORAGE_KEY, next);
        else localStorage.removeItem(STORAGE_KEY);
        return next;
      });
      return;
    }
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
