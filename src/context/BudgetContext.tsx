import type { ReactNode } from "react";
import { createContext, useContext, useCallback, useState } from "react";

export type CategoryBudget = {
  category: string;
  limitCents: number;
};

export type TripBudget = {
  totalLimitCents: number | null;
  categoryBudgets: CategoryBudget[];
};

type BudgetContextValue = {
  getBudget: (tripId: string) => TripBudget;
  setBudget: (tripId: string, budget: TripBudget) => void;
};

const BudgetContext = createContext<BudgetContextValue | null>(null);

const STORAGE_KEY = "tripBudgets";

function loadAll(): Record<string, TripBudget> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

const EMPTY: TripBudget = { totalLimitCents: null, categoryBudgets: [] };

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Record<string, TripBudget>>(loadAll);

  const getBudget = useCallback(
    (tripId: string): TripBudget => store[tripId] ?? EMPTY,
    [store]
  );

  const setBudget = useCallback((tripId: string, budget: TripBudget) => {
    setStore((prev) => {
      const next = { ...prev, [tripId]: budget };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  return (
    <BudgetContext.Provider value={{ getBudget, setBudget }}>
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget() {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error("useBudget must be used within BudgetProvider");
  return ctx;
}