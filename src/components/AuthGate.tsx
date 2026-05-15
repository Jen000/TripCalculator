import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  getCurrentUser,
  signIn,
  signOut as amplifySignOut,
  confirmSignIn,
  resetPassword,
  confirmResetPassword,
  type AuthUser,
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

type Flow = "loading" | "signIn" | "newPasswordRequired" | "forgotPassword" | "confirmReset";

type Props = {
  children: (args: { user: AuthUser; signOut: () => void }) => ReactNode;
};

function normalizeError(err: any): string {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  if (msg.includes("incorrect username or password") || msg.includes("not authorized"))
    return "Incorrect username or password.";
  if (msg.includes("user does not exist"))
    return "That account doesn't exist.";
  if (msg.includes("password reset required"))
    return 'Password reset required. Use "Forgot password?" below.';
  if (msg.includes("invalid verification code") || msg.includes("invalid code"))
    return "That code is invalid or expired. Please try again.";
  if (msg.includes("attempt limit exceeded"))
    return "Too many attempts. Please wait a few minutes and try again.";
  return err?.message ?? "Something went wrong. Please try again.";
}

export default function AuthGate({ children }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [flow, setFlow] = useState<Flow>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  // Field state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetUsername, setResetUsername] = useState("");
  const [resetCode, setResetCode] = useState("");

  // UI state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then((u) => setUser(u))
      .catch(() => setFlow("signIn"));

    const unsub = Hub.listen("auth", ({ payload }: any) => {
      if (payload.event === "signedIn") {
        getCurrentUser().then((u) => setUser(u)).catch(() => {});
      } else if (payload.event === "signedOut") {
        setUser(null);
        setFlow("signIn");
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    });
    return unsub;
  }, []);

  const bg = useMemo(
    () =>
      isDark
        ? `radial-gradient(900px 520px at 15% 10%, rgba(42,174,140,0.18), transparent 60%),
           radial-gradient(700px 480px at 85% 15%, rgba(168,213,186,0.10), transparent 55%),
           linear-gradient(180deg, #070b12 0%, #0b1411 55%, #070b12 100%)`
        : `radial-gradient(900px 520px at 15% 10%, rgba(168,213,186,0.38), transparent 60%),
           radial-gradient(700px 480px at 85% 15%, rgba(31,122,99,0.18), transparent 55%),
           linear-gradient(180deg, #F7F9F8 0%, #EEF7F2 60%, #F7F9F8 100%)`,
    [isDark]
  );

  const goToFlow = (next: Flow) => {
    setError(null);
    setSuccess(null);
    setFlow(next);
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSignIn = async () => {
    setError(null);
    setSuccess(null);
    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }
    setBusy(true);
    try {
      const result = await signIn({ username: username.trim(), password });
      const step = result.nextStep.signInStep;
      if (step === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
        goToFlow("newPasswordRequired");
      } else if (step === "DONE") {
        setUser(await getCurrentUser());
      } else {
        setError(`Unexpected sign-in step: ${step}. Please contact the app owner.`);
      }
    } catch (err: any) {
      setError(normalizeError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleNewPassword = async () => {
    setError(null);
    if (!newPassword) { setError("Please enter a new password."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords don't match."); return; }
    setBusy(true);
    try {
      const result = await confirmSignIn({ challengeResponse: newPassword });
      if (result.nextStep.signInStep === "DONE") {
        setUser(await getCurrentUser());
      }
    } catch (err: any) {
      setError(normalizeError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    if (!forgotEmail.trim()) { setError("Please enter your username."); return; }
    setBusy(true);
    try {
      await resetPassword({ username: forgotEmail.trim() });
      setResetUsername(forgotEmail.trim());
      setForgotEmail("");
      setFlow("confirmReset");
      setSuccess("A reset code was sent to your email address.");
    } catch (err: any) {
      setError(normalizeError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmReset = async () => {
    setError(null);
    if (!resetCode.trim()) { setError("Please enter the code from your email."); return; }
    if (!newPassword) { setError("Please enter a new password."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords don't match."); return; }
    setBusy(true);
    try {
      await confirmResetPassword({
        username: resetUsername,
        confirmationCode: resetCode.trim(),
        newPassword,
      });
      setResetCode("");
      setNewPassword("");
      setConfirmPassword("");
      setFlow("signIn");
      setSuccess("Password reset! You can now sign in with your new password.");
    } catch (err: any) {
      setError(normalizeError(err));
    } finally {
      setBusy(false);
    }
  };

  // ── Authenticated ─────────────────────────────────────────────────────────────

  if (user) {
    return <>{children({ user, signOut: () => amplifySignOut() })}</>;
  }

  if (flow === "loading") {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", background: bg }}>
        <CircularProgress sx={{ color: "primary.main" }} />
      </Box>
    );
  }

  // ── Auth card ─────────────────────────────────────────────────────────────────

  const subtitles: Record<Flow, string> = {
    loading: "",
    signIn: "Sign in to manage your trips and expenses",
    newPasswordRequired: "Set a new password to continue",
    forgotPassword: "We'll send a reset code to your email",
    confirmReset: "Enter the code from your email",
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
          border: `1px solid ${isDark ? "rgba(233,242,238,0.10)" : "rgba(31,122,99,0.16)"}`,
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
                  bgcolor: isDark ? "rgba(42,174,140,0.18)" : "rgba(31,122,99,0.12)",
                  color: isDark ? "rgba(233,242,238,0.92)" : "#1F7A63",
                }}
              />
              <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
                Trip Expense Tracker
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.72 }}>
                {subtitles[flow]}
              </Typography>
            </Stack>

            {/* Success banner */}
            {success && !error && (
              <Alert severity="success" sx={{ borderRadius: 3 }} onClose={() => setSuccess(null)}>
                {success}
              </Alert>
            )}

            {/* ── Sign In ── */}
            {flow === "signIn" && (
              <Stack spacing={2}>
                <TextField
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  fullWidth
                  disabled={busy}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSignIn(); }}
                />
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  fullWidth
                  disabled={busy}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSignIn(); }}
                />
                {error && <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>}
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleSignIn}
                  disabled={busy}
                  sx={{ py: 1.2, borderRadius: 3, fontWeight: 900 }}
                >
                  {busy ? <CircularProgress size={22} color="inherit" /> : "Sign In"}
                </Button>
                <Typography variant="body2" sx={{ textAlign: "center" }}>
                  <Link
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={() => { goToFlow("forgotPassword"); setForgotEmail(username); }}
                    sx={{ fontWeight: 700, color: "primary.main", cursor: "pointer" }}
                  >
                    Forgot password?
                  </Link>
                </Typography>
              </Stack>
            )}

            {/* ── New Password Required ── */}
            {flow === "newPasswordRequired" && (
              <Stack spacing={2}>
                <Alert severity="info" sx={{ borderRadius: 3 }}>
                  Your account requires a new password before you can continue.
                </Alert>
                <TextField
                  label="New password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  fullWidth
                  disabled={busy}
                />
                <TextField
                  label="Confirm new password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  fullWidth
                  disabled={busy}
                  onKeyDown={(e) => { if (e.key === "Enter") handleNewPassword(); }}
                />
                {error && <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>}
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleNewPassword}
                  disabled={busy}
                  sx={{ py: 1.2, borderRadius: 3, fontWeight: 900 }}
                >
                  {busy ? <CircularProgress size={22} color="inherit" /> : "Set Password"}
                </Button>
              </Stack>
            )}

            {/* ── Forgot Password ── */}
            {flow === "forgotPassword" && (
              <Stack spacing={2}>
                <TextField
                  label="Username"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  autoComplete="username"
                  fullWidth
                  disabled={busy}
                  onKeyDown={(e) => { if (e.key === "Enter") handleForgotPassword(); }}
                />
                {error && <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>}
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleForgotPassword}
                  disabled={busy}
                  sx={{ py: 1.2, borderRadius: 3, fontWeight: 900 }}
                >
                  {busy ? <CircularProgress size={22} color="inherit" /> : "Send Reset Code"}
                </Button>
                <Typography variant="body2" sx={{ textAlign: "center" }}>
                  <Link
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={() => goToFlow("signIn")}
                    sx={{ fontWeight: 700, color: "primary.main", cursor: "pointer" }}
                  >
                    Back to Sign In
                  </Link>
                </Typography>
              </Stack>
            )}

            {/* ── Confirm Reset ── */}
            {flow === "confirmReset" && (
              <Stack spacing={2}>
                <TextField
                  label="Reset code"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  autoComplete="one-time-code"
                  placeholder="Check your email"
                  fullWidth
                  disabled={busy}
                  slotProps={{ htmlInput: { inputMode: "numeric" } }}
                />
                <TextField
                  label="New password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  fullWidth
                  disabled={busy}
                />
                <TextField
                  label="Confirm new password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  fullWidth
                  disabled={busy}
                  onKeyDown={(e) => { if (e.key === "Enter") handleConfirmReset(); }}
                />
                {error && <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>}
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleConfirmReset}
                  disabled={busy}
                  sx={{ py: 1.2, borderRadius: 3, fontWeight: 900 }}
                >
                  {busy ? <CircularProgress size={22} color="inherit" /> : "Reset Password"}
                </Button>
                <Typography variant="body2" sx={{ textAlign: "center" }}>
                  <Link
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={() => goToFlow("signIn")}
                    sx={{ fontWeight: 700, color: "primary.main", cursor: "pointer" }}
                  >
                    Back to Sign In
                  </Link>
                </Typography>
              </Stack>
            )}

            {/* Footer */}
            <Typography variant="caption" sx={{ textAlign: "center", opacity: 0.65 }}>
              Accounts are invite-only. If you need access, contact the app owner.
            </Typography>

          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
