import { useEffect, useState } from "react";
import {
  Alert, Button, Card, CardContent, CircularProgress,
  Divider, Stack, TextField, Typography,
} from "@mui/material";
import { getCurrentUser, updatePassword } from "aws-amplify/auth";
import { useUser } from "../context/UserContext";

export default function Settings() {
  const { profile, loadingProfile, saveFirstName } = useUser();

  // First name
  const [firstName, setFirstName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (profile?.firstName) setFirstName(profile.firstName);
  }, [profile?.firstName]);

  const handleSaveName = async () => {
    if (!firstName.trim()) {
      setNameMsg({ type: "error", text: "Please enter your first name." });
      return;
    }
    setNameSaving(true);
    setNameMsg(null);
    try {
      await saveFirstName(firstName.trim());
      setNameMsg({ type: "success", text: "Name saved!" });
    } catch (e: any) {
      setNameMsg({ type: "error", text: e?.message ?? "Failed to save name." });
    } finally {
      setNameSaving(false);
    }
  };

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (!currentPassword || !newPassword) {
      setPwMsg({ type: "error", text: "Please enter both current and new password." });
      return;
    }
    setPwSaving(true);
    try {
      await getCurrentUser();
      await updatePassword({ oldPassword: currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setPwMsg({ type: "success", text: "Password updated." });
    } catch (e: any) {
      setPwMsg({ type: "error", text: e?.message ?? "Failed to update password." });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={800}>Account Settings</Typography>

      {/* First name */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={800}>Your Name</Typography>
          <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5 }}>
            Your first name is used to auto-populate the people list on trips you join.
          </Typography>
          <Divider sx={{ my: 2 }} />
          {nameMsg && <Alert severity={nameMsg.type} sx={{ mb: 1.5 }}>{nameMsg.text}</Alert>}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              fullWidth
              disabled={nameSaving || loadingProfile}
              placeholder={loadingProfile ? "Loading…" : "e.g. Jenna"}
            />
            <Button
              variant="contained"
              onClick={handleSaveName}
              disabled={nameSaving || loadingProfile || !firstName.trim()}
            >
              {nameSaving ? <CircularProgress size={18} color="inherit" /> : "Save"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={800}>Password</Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
            Change your password while you're signed in.
          </Typography>
          <Divider sx={{ my: 2 }} />
          {pwMsg && <Alert severity={pwMsg.type} sx={{ mb: 1.5 }}>{pwMsg.text}</Alert>}
          <Stack spacing={2}>
            <TextField
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              fullWidth
              disabled={pwSaving}
            />
            <TextField
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              fullWidth
              disabled={pwSaving}
            />
            <Button variant="contained" onClick={handleChangePassword} disabled={pwSaving}>
              {pwSaving ? <CircularProgress size={18} color="inherit" /> : "Update Password"}
            </Button>
            <Typography variant="caption" sx={{ opacity: 0.75 }}>
              If you forgot your password, use "Forgot password?" on the sign-in screen.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}