import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useState } from "react";
import { getTripSettings, updateTripSettings, type TripSettings } from "../api/tripSettings";

export const DEFAULT_CATEGORIES = [
  "Lodging", "Gas", "Food", "Coffee", "Groceries", "Activities",
  "Park Fees", "Transit / Parking", "Shopping", "Flights", "Rental Car", "Misc",
];

type SettingsMap = Record<string, TripSettings>;

type TripSettingsContextValue = {
  getSettings: (tripId: string) => TripSettings | null;
  loadSettings: (tripId: string) => Promise<void>;
  saveSettings: (tripId: string, patch: Partial<Pick<TripSettings, "categories" | "totalBudgetCents" | "categoryBudgets" | "people">>) => Promise<void>;
  loadingSettings: boolean;
};

const TripSettingsContext = createContext<TripSettingsContextValue | null>(null);

const STORAGE_KEY = "tripSettingsCache";

function loadCache(): SettingsMap {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); }
  catch { return {}; }
}

function saveCache(map: SettingsMap) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

function makeFallback(tripId: string): TripSettings {
  return {
    tripId,
    categories: DEFAULT_CATEGORIES,
    totalBudgetCents: null,
    categoryBudgets: [],
    members: [],
    people: [],
  };
}

export function TripSettingsProvider({ children }: { children: ReactNode }) {
  const [settingsMap, setSettingsMap] = useState<SettingsMap>(loadCache);
  const [loadingSettings, setLoadingSettings] = useState(false);

  const getSettings = useCallback(
    (tripId: string): TripSettings | null => settingsMap[tripId] ?? null,
    [settingsMap]
  );

  const loadSettings = useCallback(async (tripId: string) => {
    setLoadingSettings(true);
    try {
      const s = await getTripSettings(tripId);
      setSettingsMap((prev) => {
        const next = { ...prev, [tripId]: s };
        saveCache(next);
        return next;
      });
    } catch {
      setSettingsMap((prev) => {
        if (prev[tripId]) return prev;
        const fallback = makeFallback(tripId);
        const next = { ...prev, [tripId]: fallback };
        saveCache(next);
        return next;
      });
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  const saveSettings = useCallback(
    async (
      tripId: string,
      patch: Partial<Pick<TripSettings, "categories" | "totalBudgetCents" | "categoryBudgets" | "people">>
    ) => {
      setSettingsMap((prev) => {
        const existing = prev[tripId] ?? makeFallback(tripId);
        const next = { ...prev, [tripId]: { ...existing, ...patch } };
        saveCache(next);
        return next;
      });
      try {
        const updated = await updateTripSettings(tripId, patch);
        setSettingsMap((prev) => {
          const next = { ...prev, [tripId]: updated };
          saveCache(next);
          return next;
        });
      } catch {
        // Backend not wired yet — local save is enough
      }
    },
    []
  );

  return (
    <TripSettingsContext.Provider value={{ getSettings, loadSettings, saveSettings, loadingSettings }}>
      {children}
    </TripSettingsContext.Provider>
  );
}

export function useTripSettings() {
  const ctx = useContext(TripSettingsContext);
  if (!ctx) throw new Error("useTripSettings must be used within TripSettingsProvider");
  return ctx;
}