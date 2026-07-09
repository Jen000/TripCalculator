import { Routes, Route, useLocation } from "react-router-dom";
import { trackPageview } from "./analytics";
import { TripProvider } from "./context/TripContext";
import { UserProvider } from "./context/UserContext";
import { BudgetProvider } from "./context/BudgetContext";
import { TripSettingsProvider } from "./context/TripSettingsContext";
import { ExpensesProvider } from "./context/ExpensesContext";
import { PaymentsProvider } from "./context/PaymentsContext";
import { useEffect, useMemo, useState } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { makeTheme } from "./theme";

import AuthGate from "./components/AuthGate";
import Layout from "./components/Layout";
import Summary from "./pages/Summary";
import ExpenseForm from "./pages/ExpenseForm";
import Settings from "./pages/Settings";
import AllExpenses from "./pages/AllExpenses";
import TripSettingsPage from "./pages/TripSettings";
import SettleUpPage from "./pages/SettleUp";

function PageviewTracker() {
  const location = useLocation();
  useEffect(() => { trackPageview(location.pathname); }, [location.pathname]);
  return null;
}

function getInitialMode(): "light" | "dark" {
  const saved = localStorage.getItem("themeMode");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [mode, setMode] = useState<"light" | "dark">(getInitialMode);
  useEffect(() => { localStorage.setItem("themeMode", mode); }, [mode]);
  const theme = useMemo(() => makeTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthGate>
        {({ signOut, user }) => (
          <TripProvider>
            <UserProvider>
              <TripSettingsProvider>
                <BudgetProvider>
                  <ExpensesProvider>
                    <PaymentsProvider>
                      <PageviewTracker />
                      <Layout user={user} onLogout={signOut}
                        mode={mode} onToggleMode={() => setMode((m) => m === "dark" ? "light" : "dark")}>
                        <Routes>
                          <Route path="/" element={<Summary />} />
                          <Route path="/expenses" element={<ExpenseForm />} />
                          <Route path="/expenses/all" element={<AllExpenses />} />
                          <Route path="/trip-settings" element={<TripSettingsPage />} />
                          <Route path="/settle-up" element={<SettleUpPage />} />
                          <Route path="/settings" element={<Settings />} />
                        </Routes>
                      </Layout>
                    </PaymentsProvider>
                  </ExpensesProvider>
                </BudgetProvider>
              </TripSettingsProvider>
            </UserProvider>
          </TripProvider>
        )}
      </AuthGate>
    </ThemeProvider>
  );
}