import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

type UserProfile = {
  userSub: string;
  firstName: string | null;
};

type UserContextValue = {
  profile: UserProfile | null;
  loadingProfile: boolean;
  saveFirstName: (firstName: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

async function authedFetch(path: string, init?: RequestInit) {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const refreshProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const res = await authedFetch("/users/me");
      const data = await res.json();
      setProfile(data);
    } catch {
      // Backend not wired yet — set empty profile
      setProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const saveFirstName = useCallback(async (firstName: string) => {
    const res = await authedFetch("/users/me", {
      method: "PUT",
      body: JSON.stringify({ firstName }),
    });
    const data = await res.json();
    setProfile((prev) => prev ? { ...prev, firstName: data.firstName } : { userSub: data.userSub, firstName: data.firstName });
  }, []);

  useEffect(() => { refreshProfile(); }, []);

  return (
    <UserContext.Provider value={{ profile, loadingProfile, saveFirstName, refreshProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}