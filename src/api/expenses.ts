import { fetchAuthSession } from "aws-amplify/auth";

export type Expense = {
  expenseId: string;
  tripId: string;
  createdAt?: string;
  date: string;
  description: string;
  whoPaid: string;
  category: string;
  costCents: number;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function getExpenses(tripId: string) {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();

  const url = `${requireApiBaseUrl()}/expenses?tripId=${encodeURIComponent(tripId)}`;
  const res = await fetch(url, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { expenses: Expense[] };
}

export async function postExpense(input: {
  tripId: string;
  date: string;
  description: string;
  whoPaid: string;
  category: string;
  cost: number;
}) {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();

  const res = await fetch(`${requireApiBaseUrl()}/expenses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { message: string; expense: Expense };
}

function requireApiBaseUrl() {
  const base = API_BASE_URL;
  if (!base) throw new Error("VITE_API_BASE_URL is missing. Check .env and restart Vite.");
  return base;
}
