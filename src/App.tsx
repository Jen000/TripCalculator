import { Routes, Route } from "react-router-dom";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import "./authenticator.css";
import { TripProvider } from "./context/TripContext";
import { useEffect, useMemo, useState } from "react";
import { ThemeProvider, CssBaseline, Stack, Typography, Chip } from "@mui/material";
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

      <Authenticator
        hideSignUp
        components={{
          Header() {
            return (
              <Stack spacing={1} sx={{ textAlign: "center", pt: 1 }}>
                <Chip
                  label="Invite-only"
                  size="small"
                  sx={{
                    mx: "auto",
                    fontWeight: 800,
                    bgcolor: mode === "dark" ? "rgba(42,174,140,0.18)" : "rgba(31,122,99,0.12)",
                    color: mode === "dark" ? "rgba(233,242,238,0.9)" : "#1F7A63",
                  }}
                />
                <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
                  Trip Expense Tracker
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.78 }}>
                  Sign in to manage your trips and expenses
                </Typography>
              </Stack>
            );
          },
          Footer() {
            return (
              <Typography
                variant="caption"
                sx={{ display: "block", textAlign: "center", opacity: 0.75, pt: 2 }}
              >
                Accounts are invite-only. If you need access, contact the app owner.
              </Typography>
            );
          },
        }}
      >
        {({ signOut, user }) => (
          <TripProvider>
            <Layout
              user={user}
              onLogout={() => signOut?.()}
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
