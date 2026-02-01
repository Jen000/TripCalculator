import { Routes, Route } from "react-router-dom";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { TripProvider } from "./context/TripContext";
import { useEffect, useMemo, useState } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { makeTheme } from "./theme";

import Layout from "./components/Layout";
import Summary from "./pages/Summary";
import ExpenseForm from "./pages/ExpenseForm";
import Settings from "./pages/Settings";

function getInitialMode(): "light" | "dark" {
  const saved = localStorage.getItem("themeMode");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {

  const [mode, setMode] = useState<"light" | "dark">(getInitialMode);

  useEffect(() => {
    localStorage.setItem("themeMode", mode);
  }, [mode]);

  const theme = useMemo(() => makeTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
        <Authenticator hideSignUp
          components={{
            Header() {
              return <h2 style={{ textAlign: "center" }}>Trip Expense Tracker</h2>;
            },
          }}>
          {({ signOut, user }) => (
          <TripProvider>
            <Layout
                user={user}
                onLogout={() => signOut?.()} // ✅ wraps the optional param + optional undefined
                mode={mode}
                onToggleMode={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
              >
                <Routes>
                  <Route path="/" element={<Summary />} />
                  <Route path="/expenses" element={<ExpenseForm />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Layout>
            </TripProvider>
          )}
        </Authenticator>
      </ThemeProvider>
  );
}
