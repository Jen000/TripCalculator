import { fetchAuthSession } from "aws-amplify/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function requireApiBaseUrl() {
  const base = API_BASE_URL;
  if (!base) throw new Error("VITE_API_BASE_URL is missing.");
  return base;
}

async function authedFetch(path: string, init?: RequestInit) {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  const res = await fetch(`${requireApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = text?.trim();
    try {
      const json = text ? JSON.parse(text) : null;
      msg = json?.message || json?.error || msg;
    } catch { /* ignore */ }
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return res;
}

// ── Trip Settings ─────────────────────────────────────────────────────────────

export type TripSettings = {
  tripId: string;
  categories: string[];
  totalBudgetCents: number | null;
  categoryBudgets: { category: string; limitCents: number }[];
  members: { userId: string; email: string; role: "owner" | "member" }[];
  people: string[];
};

export async function getTripSettings(tripId: string): Promise<TripSettings> {
  const res = await authedFetch(`/trips/${encodeURIComponent(tripId)}/settings`);
  return (await res.json()) as TripSettings;
}

export async function updateTripSettings(
  tripId: string,
  settings: Partial<Pick<TripSettings, "categories" | "totalBudgetCents" | "categoryBudgets" | "people">>
): Promise<TripSettings> {
  const res = await authedFetch(`/trips/${encodeURIComponent(tripId)}/settings`, {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  return (await res.json()) as TripSettings;
}

export async function renameTripApi(tripId: string, name: string): Promise<void> {
  await authedFetch(`/trips/${encodeURIComponent(tripId)}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

// ── Members ───────────────────────────────────────────────────────────────────

export async function inviteTripMember(tripId: string, email: string): Promise<void> {
  await authedFetch(`/trips/${encodeURIComponent(tripId)}/members`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function removeTripMember(tripId: string, userId: string): Promise<void> {
  await authedFetch(`/trips/${encodeURIComponent(tripId)}/members/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

// ── Payments (Settle Up) ──────────────────────────────────────────────────────

export type Payment = {
  paymentId: string;
  tripId: string;
  fromUser: string;   // display name / username
  toUser: string;
  amountCents: number;
  note?: string;
  createdAt: string;
};

export async function getPayments(tripId: string): Promise<{ payments: Payment[] }> {
  const res = await authedFetch(`/trips/${encodeURIComponent(tripId)}/payments`);
  return (await res.json()) as { payments: Payment[] };
}

export async function recordPayment(
  tripId: string,
  input: { fromUser: string; toUser: string; amountCents: number; note?: string }
): Promise<{ payment: Payment }> {
  const res = await authedFetch(`/trips/${encodeURIComponent(tripId)}/payments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return (await res.json()) as { payment: Payment };
}

export async function deletePayment(tripId: string, paymentId: string): Promise<void> {
  await authedFetch(
    `/trips/${encodeURIComponent(tripId)}/payments/${encodeURIComponent(paymentId)}`,
    { method: "DELETE" }
  );
}