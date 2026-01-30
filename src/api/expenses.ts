// src/api/expenses.ts
import { fetchAuthSession } from "aws-amplify/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function getExpenses(from?: string, to?: string) {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const url =
    `${API_BASE_URL}/expenses` +
    (params.toString() ? `?${params.toString()}` : "");

  const res = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json() as Promise<{ expenses: any[] }>;
}
