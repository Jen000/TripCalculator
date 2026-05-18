import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { getExpenses as apiGetExpenses, type Expense } from "../api/expenses";

type CacheEntry = {
  expenses: Expense[];
  fetchedAt: number;
};

type ExpensesContextValue = {
  getExpenses: (tripId: string) => Expense[] | null;
  isLoading: (tripId: string) => boolean;
  loadExpenses: (tripId: string, opts?: { force?: boolean }) => Promise<void>;
  addExpenseLocal: (expense: Expense) => void;
  updateExpenseLocal: (expense: Expense) => void;
  removeExpenseLocal: (tripId: string, expenseId: string) => void;
};

const ExpensesContext = createContext<ExpensesContextValue | null>(null);

const STALE_AFTER_MS = 30_000;

export function ExpensesProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<Record<string, CacheEntry>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const inflight = useRef<Record<string, Promise<void> | undefined>>({});

  const getExpenses = useCallback(
    (tripId: string): Expense[] | null => cache[tripId]?.expenses ?? null,
    [cache]
  );

  const isLoading = useCallback(
    (tripId: string): boolean => !!loadingMap[tripId],
    [loadingMap]
  );

  const loadExpenses = useCallback(
    async (tripId: string, opts?: { force?: boolean }) => {
      const existing = cache[tripId];
      const fresh = existing && Date.now() - existing.fetchedAt < STALE_AFTER_MS;
      if (fresh && !opts?.force) return;

      const pending = inflight.current[tripId];
      if (pending) {
        await pending;
        return;
      }

      setLoadingMap((m) => ({ ...m, [tripId]: true }));
      const p = (async () => {
        try {
          const data = await apiGetExpenses(tripId);
          setCache((prev) => ({
            ...prev,
            [tripId]: { expenses: data.expenses ?? [], fetchedAt: Date.now() },
          }));
        } finally {
          setLoadingMap((m) => ({ ...m, [tripId]: false }));
          delete inflight.current[tripId];
        }
      })();
      inflight.current[tripId] = p;
      await p;
    },
    [cache]
  );

  const addExpenseLocal = useCallback((expense: Expense) => {
    setCache((prev) => {
      const cur = prev[expense.tripId];
      if (!cur) return prev;
      return {
        ...prev,
        [expense.tripId]: {
          expenses: [expense, ...cur.expenses],
          fetchedAt: cur.fetchedAt,
        },
      };
    });
  }, []);

  const updateExpenseLocal = useCallback((expense: Expense) => {
    setCache((prev) => {
      const cur = prev[expense.tripId];
      if (!cur) return prev;
      return {
        ...prev,
        [expense.tripId]: {
          expenses: cur.expenses.map((e) =>
            e.expenseId === expense.expenseId ? expense : e
          ),
          fetchedAt: cur.fetchedAt,
        },
      };
    });
  }, []);

  const removeExpenseLocal = useCallback((tripId: string, expenseId: string) => {
    setCache((prev) => {
      const cur = prev[tripId];
      if (!cur) return prev;
      return {
        ...prev,
        [tripId]: {
          expenses: cur.expenses.filter((e) => e.expenseId !== expenseId),
          fetchedAt: cur.fetchedAt,
        },
      };
    });
  }, []);

  return (
    <ExpensesContext.Provider
      value={{
        getExpenses,
        isLoading,
        loadExpenses,
        addExpenseLocal,
        updateExpenseLocal,
        removeExpenseLocal,
      }}
    >
      {children}
    </ExpensesContext.Provider>
  );
}

export function useExpenses() {
  const ctx = useContext(ExpensesContext);
  if (!ctx) throw new Error("useExpenses must be used within ExpensesProvider");
  return ctx;
}
