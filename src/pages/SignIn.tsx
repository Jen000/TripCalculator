import { useMemo, useState } from "react";
import { signIn } from "aws-amplify/auth";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";

function normalizeAuthError(err: any) {
  const msg = String(err?.message ?? err ?? "").toLowerCase();

  if (msg.includes("incorrect username or password") || msg.includes("not authorized")) {
    return "Incorrect username or password.";
  }
  if (msg.includes("user does not exist")) {
    return "That account doesn’t exist.";
  }
  if (msg.includes("password reset required")) {
    return "Password reset required. Use “Forgot password?” on the sign-in screen.";
  }
  return err?.message ?? "Failed to sign in.";
}

export default function SignInPage() {
  const theme = useTheme();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const bg = useMemo(() => {
    // Cozy, green-tinted background that still respects light/dark mode
    return theme.palette.mode === "dark"
      ? `radial-gradient(900px 520px at 15% 10%, rgba(42,174,140,0.18), transparent 60%),
         radial-gradient(700px 480px at 85% 15%, rgba(168,213,186,0.10), transparent 55%),
         linear-gradient(180deg, #070b12 0%, #0b1411 55%, #070b12 100%)`
      : `radial-gradient(900px 520px at 15% 10%, rgba(168,213,186,0.38), transparent 60%),
         radial-gradient(700px 480px at 85% 15%, rgba(31,122,99,0.18), transparent 55%),
         linear-gradient(180deg, #F7F9F8 0%, #EEF7F2 60%, #F7F9F8 100%)`;
  }, [theme.palette.mode]);

  const handleSignIn = async () => {
    setError(null);

    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }

    setLoading(true);
    try {
      await signIn({
        username: username.trim(),
        password,
      });
    } catch (err: any) {
      setError(normalizeAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        px: 2,
        py: 4,
        background: bg,
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 440,
          borderRadius: 4,
          overflow: "hidden",
          border: `1px solid ${
            theme.palette.mode === "dark"
              ? "rgba(233,242,238,0.10)"
              : "rgba(31,122,99,0.16)"
          }`,
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={3}>
            {/* Header */}
            <Stack spacing={1} sx={{ textAlign: "center" }}>
              <Chip
                label="Invite-only"
                size="small"
                sx={{
                  mx: "auto",
                  fontWeight: 800,
                  bgcolor:
                    theme.palette.mode === "dark"
                      ? "rgba(42,174,140,0.18)"
                      : "rgba(31,122,99,0.12)",
                  color:
                    theme.palette.mode === "dark"
                      ? "rgba(233,242,238,0.92)"
                      : "#1F7A63",
                }}
              />

              <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
                Trip Expense Tracker
              </Typography>

              <Typography variant="body2" sx={{ opacity: 0.78 }}>
                Sign in to manage your trips and expenses
              </Typography>
            </Stack>

            {/* Form */}
            <Stack spacing={2}>
              <TextField
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                fullWidth
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSignIn();
                }}
              />

              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                fullWidth
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSignIn();
                }}
              />

              {error && (
                <Alert severity="error" sx={{ borderRadius: 3 }}>
                  {error}
                </Alert>
              )}
            </Stack>

            {/* Action */}
            <Button
              variant="contained"
              size="large"
              onClick={handleSignIn}
              disabled={loading}
              sx={{ py: 1.2, borderRadius: 3, fontWeight: 900 }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : "Sign In"}
            </Button>

            {/* Footer */}
            <Typography variant="caption" sx={{ textAlign: "center", opacity: 0.75 }}>
              Accounts are invite-only. If you need access, contact the app owner.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
