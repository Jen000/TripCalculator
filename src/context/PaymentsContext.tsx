import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { getPayments as apiGetPayments, type Payment } from "../api/tripSettings";

type CacheEntry = {
  payments: Payment[];
  fetchedAt: number;
};

type PaymentsContextValue = {
  getPayments: (tripId: string) => Payment[] | null;
  isLoading: (tripId: string) => boolean;
  loadPayments: (tripId: string, opts?: { force?: boolean }) => Promise<void>;
  addPaymentLocal: (payment: Payment) => void;
  removePaymentLocal: (tripId: string, paymentId: string) => void;
};

const PaymentsContext = createContext<PaymentsContextValue | null>(null);

const STALE_AFTER_MS = 30_000;

export function PaymentsProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<Record<string, CacheEntry>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const inflight = useRef<Record<string, Promise<void>>>({});

  const getPayments = useCallback(
    (tripId: string): Payment[] | null => cache[tripId]?.payments ?? null,
    [cache]
  );

  const isLoading = useCallback(
    (tripId: string): boolean => !!loadingMap[tripId],
    [loadingMap]
  );

  const loadPayments = useCallback(
    async (tripId: string, opts?: { force?: boolean }) => {
      const existing = cache[tripId];
      const fresh = existing && Date.now() - existing.fetchedAt < STALE_AFTER_MS;
      if (fresh && !opts?.force) return;

      if (inflight.current[tripId]) {
        await inflight.current[tripId];
        return;
      }

      setLoadingMap((m) => ({ ...m, [tripId]: true }));
      const p = (async () => {
        try {
          const data = await apiGetPayments(tripId);
          setCache((prev) => ({
            ...prev,
            [tripId]: { payments: data.payments ?? [], fetchedAt: Date.now() },
          }));
        } catch {
          setCache((prev) =>
            prev[tripId]
              ? prev
              : { ...prev, [tripId]: { payments: [], fetchedAt: Date.now() } }
          );
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

  const addPaymentLocal = useCallback((payment: Payment) => {
    setCache((prev) => {
      const cur = prev[payment.tripId];
      if (!cur) return prev;
      return {
        ...prev,
        [payment.tripId]: {
          payments: [...cur.payments, payment],
          fetchedAt: cur.fetchedAt,
        },
      };
    });
  }, []);

  const removePaymentLocal = useCallback((tripId: string, paymentId: string) => {
    setCache((prev) => {
      const cur = prev[tripId];
      if (!cur) return prev;
      return {
        ...prev,
        [tripId]: {
          payments: cur.payments.filter((p) => p.paymentId !== paymentId),
          fetchedAt: cur.fetchedAt,
        },
      };
    });
  }, []);

  return (
    <PaymentsContext.Provider
      value={{
        getPayments,
        isLoading,
        loadPayments,
        addPaymentLocal,
        removePaymentLocal,
      }}
    >
      {children}
    </PaymentsContext.Provider>
  );
}

export function usePayments() {
  const ctx = useContext(PaymentsContext);
  if (!ctx) throw new Error("usePayments must be used within PaymentsProvider");
  return ctx;
}
