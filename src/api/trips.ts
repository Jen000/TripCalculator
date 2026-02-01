import { fetchAuthSession } from "aws-amplify/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;


export type Trip = {
  tripId: string;
  name: string;
  createdAt?: string;
};

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
    // Try to pull a message out of JSON, otherwise fall back to status
    let msg = text?.trim();
    try {
      const json = text ? JSON.parse(text) : null;
      msg = json?.message || json?.error || msg;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(msg || `Request failed (${res.status})`);
  }

  return res;
}


export async function getTrips() {
  const res = await authedFetch("/trips");
  return (await res.json()) as { trips: Trip[] };
}

export async function createTrip(name: string) {
  const res = await authedFetch("/trips", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return (await res.json()) as { trip: Trip };
}

function requireApiBaseUrl() {
  const base = API_BASE_URL;
  if (!base) throw new Error("VITE_API_BASE_URL is missing. Check .env and restart Vite.");
  return base;
}

export async function deleteTrip(tripId: string) {
  const res = await authedFetch(`/trips/${encodeURIComponent(tripId)}`, {
    method: "DELETE",
  });
  return (await res.json()) as { message: string; deletedExpenses: number };
}

export async function exportTripCsv(tripId: string) {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new Error("No auth token found. Are you signed in?");

  const url = `${requireApiBaseUrl()}/trips/${encodeURIComponent(tripId)}/export`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(await res.text());

  const blob = await res.blob();
  const href = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = href;
  a.download = `trip-${tripId}-expenses.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(href);
}
