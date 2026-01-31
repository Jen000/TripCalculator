import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { getCurrentUser, updatePassword } from "aws-amplify/auth";
import { useTrip } from "../context/TripContext";

export default function Settings() {
  // Trips
  const { addTrip } = useTrip();
  const [tripName, setTripName] = useState("");
  const [tripMsg, setTripMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [tripSaving, setTripSaving] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const handleAddTrip = async () => {
    setTripMsg(null);

    if (!tripName.trim()) {
      setTripMsg({ type: "error", text: "Please enter a trip name." });
      return;
    }

    setTripSaving(true);
    try {
      await addTrip(tripName.trim());
      setTripName("");
      setTripMsg({ type: "success", text: "Trip created! You can select it in the top bar." });
    } catch (e: any) {
      console.error("Create trip failed:", e);
      setTripMsg({ type: "error", text: e?.message ?? "Failed to create trip." });
    } finally {
      setTripSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwMsg(null);

    if (!currentPassword || !newPassword) {
      setPwMsg({ type: "error", text: "Please enter both current and new password." });
      return;
    }

    setPwSaving(true);
    try {
      // ensures the user is signed in
      await getCurrentUser();

      await updatePassword({
        oldPassword: currentPassword,
        newPassword: newPassword,
      });

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
      <Typography variant="h5" fontWeight={800}>
        Settings
      </Typography>
            {/* Trips section */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={800}>
            Trips
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
            Create a new trip. It will show up in the trip dropdown in the top bar.
          </Typography>

          <Divider sx={{ my: 2 }} />

          {tripMsg && <Alert severity={tripMsg.type}>{tripMsg.text}</Alert>}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
            <TextField
              label="Trip name"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              fullWidth
            />
            <Button variant="contained" onClick={handleAddTrip} disabled={tripSaving}>
              Add Trip
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Password section */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={800}>
            Password
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
            Change your password while you’re signed in.
          </Typography>

          <Divider sx={{ my: 2 }} />

          {pwMsg && <Alert severity={pwMsg.type}>{pwMsg.text}</Alert>}

          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              fullWidth
            />
            <TextField
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              fullWidth
            />

            <Button variant="contained" onClick={handleChangePassword} disabled={pwSaving}>
              Update Password
            </Button>

            <Typography variant="caption" sx={{ opacity: 0.75 }}>
              If you forgot your password, use “Forgot password?” on the sign-in screen.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
