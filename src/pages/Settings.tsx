import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import { getCurrentUser, updatePassword } from "aws-amplify/auth";
import { useTrip } from "../context/TripContext";
import { deleteTrip } from "../api/trips";

export default function Settings() {
  // Trips
  const { addTrip, trips, loadingTrips, removeTripLocal } = useTrip();

  const [tripCreateName, setCreateTripName] = useState("");
  const [tripDeleteId, setTripDeleteId] = useState<string>("");
  const [tripMsg, setTripMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [tripCreating, setTripCreating] = useState(false);
  const [tripDeleting, setTripDeleting] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const deleteTripLabel = useMemo(() => {
    const t = trips.find((x) => x.tripId === tripDeleteId);
    return t?.name ?? "";
  }, [trips, tripDeleteId]);

  const confirmRequired = "CONFIRM";
  const confirmOk = deleteConfirmText.trim().toUpperCase() === confirmRequired;

  const handleAddTrip = async () => {
    setTripMsg(null);

    if (!tripCreateName.trim()) {
      setTripMsg({ type: "error", text: "Please enter a trip name." });
      return;
    }

    setTripCreating(true);
    try {
      await addTrip(tripCreateName.trim());
      setCreateTripName("");
      setTripMsg({ type: "success", text: "Trip created! You can select it in the top bar." });
    } catch (e: any) {
      console.error("Create trip failed:", e);
      setTripMsg({ type: "error", text: e?.message ?? "Failed to create trip." });
    } finally {
      setTripCreating(false);
    }
  };

  const openDeleteDialog = () => {
    setTripMsg(null);

    if (!tripDeleteId) {
      setTripMsg({ type: "error", text: "Please select a trip to delete." });
      return;
    }

    setDeleteConfirmText("");
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (tripDeleting) return; // don't allow closing while deleting
    setDeleteDialogOpen(false);
  };

  const handleConfirmDeleteTrip = async () => {
    setTripMsg(null);

    if (!tripDeleteId) {
      setDeleteDialogOpen(false);
      return;
    }

    setTripDeleting(true);
    try {
      await deleteTrip(tripDeleteId);
      removeTripLocal(tripDeleteId);
      setTripDeleteId("");
      setTripMsg({ type: "success", text: "Trip deleted." });
      setDeleteDialogOpen(false);
    } catch (e: any) {
      console.error("Delete trip failed:", e);
      setTripMsg({ type: "error", text: e?.message ?? "Failed to delete trip." });
    } finally {
      setTripDeleting(false);
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
      await getCurrentUser();
      await updatePassword({
        oldPassword: currentPassword,
        newPassword,
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

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
            Create a new trip. It will show up in the trip dropdown in the top bar.
          </Typography>

          {tripMsg && <Alert severity={tripMsg.type}>{tripMsg.text}</Alert>}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
            <TextField
              label="Trip name"
              value={tripCreateName}
              onChange={(e) => setCreateTripName(e.target.value)}
              fullWidth
              disabled={tripCreating}
            />
            <Button variant="contained" onClick={handleAddTrip} disabled={tripCreating}>
              {tripCreating ? <CircularProgress size={18} /> : "Add Trip"}
            </Button>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {/* Delete Trip */}
          <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
            Delete a trip and all its expenses.
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
            <FormControl fullWidth size="medium" disabled={loadingTrips || tripDeleting}>
              <InputLabel id="delete-trip-label">Trip</InputLabel>
              <Select
                labelId="delete-trip-label"
                label="Trip"
                value={tripDeleteId}
                onChange={(e) => setTripDeleteId(String(e.target.value))}
              >
                <MenuItem value="">
                  <em>Select a trip…</em>
                </MenuItem>
                {trips.map((t) => (
                  <MenuItem key={t.tripId} value={t.tripId}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              color="error"
              variant="contained"
              startIcon={<DeleteOutlineIcon />}
              onClick={openDeleteDialog}
              disabled={tripDeleting || !tripDeleteId}
            >
              Delete Trip
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
              {pwSaving ? <CircularProgress size={18} /> : "Update Password"}
            </Button>

            <Typography variant="caption" sx={{ opacity: 0.75 }}>
              If you forgot your password, use “Forgot password?” on the sign-in screen.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={(_, reason) => {
          // prevent backdrop/escape close for safety + during deleting
          if (tripDeleting) return;
          if (reason === "backdropClick" || reason === "escapeKeyDown") return;
          closeDeleteDialog();
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete trip?</DialogTitle>

        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Alert severity="warning">
              This will permanently delete <b>{deleteTripLabel || "this trip"}</b> and all of its
              expenses. This cannot be undone.
            </Alert>

            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Type <b>{confirmRequired}</b> to confirm.
            </Typography>

            <TextField
              autoFocus
              label="Type CONFIRM"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              disabled={tripDeleting}
              fullWidth
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDeleteDialog} disabled={tripDeleting}>
            Cancel
          </Button>

          <Button
            color="error"
            variant="contained"
            startIcon={
              tripDeleting ? <CircularProgress size={18} color="inherit" /> : <DeleteOutlineIcon />
            }
            onClick={handleConfirmDeleteTrip}
            disabled={!confirmOk || tripDeleting}
          >
            {tripDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
