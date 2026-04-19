import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";

import { useTrip } from "../context/TripContext";
import { useTripSettings } from "../context/TripSettingsContext";
import { inviteTripMember, removeTripMember, renameTripApi } from "../api/tripSettings";

export default function TripSettings() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { trips, activeTripId, refreshTrips } = useTrip();
  const { getSettings, loadSettings, saveSettings, loadingSettings } = useTripSettings();

  const trip = useMemo(() => trips.find((t) => t.tripId === activeTripId), [trips, activeTripId]);
  const settings = activeTripId ? getSettings(activeTripId) : null;

  // ── Load settings on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (activeTripId) loadSettings(activeTripId);
  }, [activeTripId]);

  // ── Rename ──────────────────────────────────────────────────────────────────
  const [renamingTrip, setRenamingTrip] = useState(false);
  const [tripNameInput, setTripNameInput] = useState(trip?.name ?? "");
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameMsg, setRenameMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { setTripNameInput(trip?.name ?? ""); }, [trip]);

  const handleRename = async () => {
    if (!activeTripId || !tripNameInput.trim()) return;
    setRenameLoading(true);
    setRenameMsg(null);
    try {
      await renameTripApi(activeTripId, tripNameInput.trim());
      await refreshTrips();
      setRenamingTrip(false);
      setRenameMsg({ type: "success", text: "Trip renamed." });
    } catch (e: any) {
      setRenameMsg({ type: "error", text: e?.message ?? "Failed to rename trip." });
    } finally {
      setRenameLoading(false);
    }
  };

  // ── Categories ──────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<string[]>(settings?.categories ?? []);
  const [newCategory, setNewCategory] = useState("");
  const [catMsg, setCatMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [catSaving, setCatSaving] = useState(false);

  useEffect(() => {
    if (settings?.categories) setCategories(settings.categories);
  }, [settings?.categories?.join(",")]);

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (categories.map((c) => c.toLowerCase()).includes(trimmed.toLowerCase())) {
      setCatMsg({ type: "error", text: "Category already exists." });
      return;
    }
    setCategories((prev) => [...prev, trimmed]);
    setNewCategory("");
    setCatMsg(null);
  };

  const removeCategory = (cat: string) => {
    setCategories((prev) => prev.filter((c) => c !== cat));
  };

  const saveCategories = async () => {
    if (!activeTripId) return;
    setCatSaving(true);
    setCatMsg(null);
    try {
      await saveSettings(activeTripId, { categories });
      setCatMsg({ type: "success", text: "Categories saved." });
    } catch (e: any) {
      setCatMsg({ type: "error", text: e?.message ?? "Failed to save categories." });
    } finally {
      setCatSaving(false);
    }
  };

  // ── Budget ──────────────────────────────────────────────────────────────────
  const [totalInput, setTotalInput] = useState(
    settings?.totalBudgetCents ? (settings.totalBudgetCents / 100).toFixed(0) : ""
  );
  const [catBudgets, setCatBudgets] = useState(
    settings?.categoryBudgets.map((cb) => ({
      category: cb.category,
      input: (cb.limitCents / 100).toFixed(0),
    })) ?? []
  );
  const [newBudgetCat, setNewBudgetCat] = useState("");
  const [budgetMsg, setBudgetMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [budgetSaving, setBudgetSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setTotalInput(settings.totalBudgetCents ? (settings.totalBudgetCents / 100).toFixed(0) : "");
    setCatBudgets(
      settings.categoryBudgets.map((cb) => ({
        category: cb.category,
        input: (cb.limitCents / 100).toFixed(0),
      }))
    );
  }, [settings?.totalBudgetCents, settings?.categoryBudgets?.length]);

  useEffect(() => {
    if (categories.length > 0 && !newBudgetCat) {
      const available = categories.filter((c) => !catBudgets.find((cb) => cb.category === c));
      if (available.length > 0) setNewBudgetCat(available[0]);
    }
  }, [categories]);

  const saveBudget = async () => {
    if (!activeTripId) return;
    setBudgetSaving(true);
    setBudgetMsg(null);
    try {
      const total = totalInput.trim() === "" ? null : Number(totalInput);
      if (total !== null && (!Number.isFinite(total) || total < 0)) {
        setBudgetMsg({ type: "error", text: "Invalid total budget." });
        return;
      }
      const categoryBudgets = catBudgets.map((cb) => ({
        category: cb.category,
        limitCents: Math.round(Number(cb.input) * 100),
      }));
      await saveSettings(activeTripId, {
        totalBudgetCents: total !== null ? Math.round(total * 100) : null,
        categoryBudgets,
      });
      setBudgetMsg({ type: "success", text: "Budget saved." });
    } catch (e: any) {
      setBudgetMsg({ type: "error", text: e?.message ?? "Failed to save budget." });
    } finally {
      setBudgetSaving(false);
    }
  };

  const availableBudgetCats = categories.filter(
    (c) => !catBudgets.find((cb) => cb.category === c)
  );

  // ── Members / Invite ────────────────────────────────────────────────────────
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!activeTripId || !inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteMsg(null);
    try {
      await inviteTripMember(activeTripId, inviteEmail.trim());
      setInviteEmail("");
      setInviteMsg({ type: "success", text: "Invite sent! They'll get an email to join this trip." });
      await loadSettings(activeTripId);
    } catch (e: any) {
      setInviteMsg({ type: "error", text: e?.message ?? "Failed to send invite." });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeTripId) return;
    setRemovingMember(userId);
    try {
      await removeTripMember(activeTripId, userId);
      await loadSettings(activeTripId);
    } catch (e: any) {
      // silently fail for now
    } finally {
      setRemovingMember(null);
    }
  };

  if (!activeTripId) {
    return (
      <Stack spacing={2}>
        <Typography variant="h5" fontWeight={800}>Trip Settings</Typography>
        <Alert severity="info">Select a trip from the top bar first.</Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} size="small">
          Summary
        </Button>
        <Typography variant="h5" fontWeight={800} sx={{ flex: 1 }}>
          Trip Settings
        </Typography>
      </Stack>

      {/* ── Rename ── */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={800}>Trip Name</Typography>
          <Divider sx={{ my: 1.5 }} />
          {renameMsg && <Alert severity={renameMsg.type} sx={{ mb: 1.5 }}>{renameMsg.text}</Alert>}
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              value={tripNameInput}
              onChange={(e) => setTripNameInput(e.target.value)}
              disabled={!renamingTrip || renameLoading}
              fullWidth
              size="small"
            />
            {!renamingTrip ? (
              <Button
                startIcon={<EditOutlinedIcon />}
                onClick={() => setRenamingTrip(true)}
                variant="outlined"
                size="small"
              >
                Rename
              </Button>
            ) : (
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="Save">
                  <IconButton
                    color="primary"
                    onClick={handleRename}
                    disabled={renameLoading || !tripNameInput.trim()}
                  >
                    {renameLoading ? <CircularProgress size={18} /> : <CheckIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Cancel">
                  <IconButton onClick={() => { setRenamingTrip(false); setTripNameInput(trip?.name ?? ""); }}>
                    <CloseIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* ── Categories ── */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={800}>Expense Categories</Typography>
          <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5 }}>
            Customize the categories available when adding expenses to this trip.
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          {catMsg && <Alert severity={catMsg.type} sx={{ mb: 1.5 }}>{catMsg.text}</Alert>}

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
            {categories.map((cat) => (
              <Chip
                key={cat}
                label={cat}
                onDelete={() => removeCategory(cat)}
                sx={{
                  fontWeight: 600,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  "& .MuiChip-deleteIcon": { color: theme.palette.error.main },
                }}
              />
            ))}
            {categories.length === 0 && (
              <Typography variant="body2" sx={{ opacity: 0.6 }}>No categories yet.</Typography>
            )}
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="New category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }}
              size="small"
              fullWidth
            />
            <Button
              variant="outlined"
              startIcon={<AddCircleOutlineIcon />}
              onClick={addCategory}
              disabled={!newCategory.trim()}
            >
              Add
            </Button>
          </Stack>

          <Button
            variant="contained"
            onClick={saveCategories}
            disabled={catSaving}
            sx={{ mt: 2 }}
            fullWidth
          >
            {catSaving ? <CircularProgress size={18} color="inherit" /> : "Save Categories"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Budget ── */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={800}>Budget</Typography>
          <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5 }}>
            Set an overall trip budget and/or per-category limits.
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          {budgetMsg && <Alert severity={budgetMsg.type} sx={{ mb: 1.5 }}>{budgetMsg.text}</Alert>}

          <Stack spacing={2}>
            <TextField
              label="Total trip budget (optional)"
              value={totalInput}
              onChange={(e) => setTotalInput(e.target.value)}
              type="number"
              inputProps={{ min: 0, step: "1" }}
              size="small"
              fullWidth
              placeholder="e.g. 2000"
              InputProps={{
                startAdornment: <Typography sx={{ mr: 0.5, opacity: 0.6 }}>$</Typography>,
              }}
            />

            {catBudgets.length > 0 && (
              <>
                <Divider />
                <Typography variant="body2" fontWeight={700}>Per-category limits</Typography>
                {catBudgets.map((cb) => (
                  <Stack key={cb.category} direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ minWidth: 140, fontWeight: 600 }}>
                      {cb.category}
                    </Typography>
                    <TextField
                      value={cb.input}
                      onChange={(e) =>
                        setCatBudgets((prev) =>
                          prev.map((x) => x.category === cb.category ? { ...x, input: e.target.value } : x)
                        )
                      }
                      type="number"
                      inputProps={{ min: 0, step: "1" }}
                      size="small"
                      fullWidth
                      placeholder="Limit $"
                    />
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setCatBudgets((prev) => prev.filter((x) => x.category !== cb.category))}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </>
            )}

            {availableBudgetCats.length > 0 && (
              <Stack direction="row" spacing={1}>
                <TextField
                  select
                  value={newBudgetCat}
                  onChange={(e) => setNewBudgetCat(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  label="Category"
                >
                  {availableBudgetCats.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="outlined"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={() => {
                    if (!newBudgetCat) return;
                    setCatBudgets((prev) => [...prev, { category: newBudgetCat, input: "" }]);
                    const remaining = availableBudgetCats.filter((c) => c !== newBudgetCat);
                    setNewBudgetCat(remaining[0] ?? "");
                  }}
                  disabled={!newBudgetCat}
                >
                  Add
                </Button>
              </Stack>
            )}

            <Button
              variant="contained"
              onClick={saveBudget}
              disabled={budgetSaving}
              fullWidth
            >
              {budgetSaving ? <CircularProgress size={18} color="inherit" /> : "Save Budget"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Members ── */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={800}>Trip Members</Typography>
          <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5 }}>
            Invite someone by email to share this trip. They'll be able to add and view expenses.
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          {inviteMsg && <Alert severity={inviteMsg.type} sx={{ mb: 1.5 }}>{inviteMsg.text}</Alert>}

          {/* Current members */}
          {settings?.members && settings.members.length > 0 && (
            <Stack spacing={1} sx={{ mb: 2 }}>
              {settings.members.map((m) => (
                <Stack
                  key={m.userId}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  }}
                >
                  <Stack>
                    <Typography variant="body2" fontWeight={700}>{m.email}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.6, textTransform: "capitalize" }}>
                      {m.role}
                    </Typography>
                  </Stack>
                  {m.role !== "owner" && (
                    <Tooltip title="Remove member">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveMember(m.userId)}
                        disabled={removingMember === m.userId}
                      >
                        {removingMember === m.userId
                          ? <CircularProgress size={16} />
                          : <DeleteOutlineIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              ))}
            </Stack>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
              type="email"
              size="small"
              fullWidth
              disabled={inviteLoading}
            />
            <Button
              variant="contained"
              startIcon={inviteLoading ? <CircularProgress size={16} color="inherit" /> : <PersonAddOutlinedIcon />}
              onClick={handleInvite}
              disabled={inviteLoading || !inviteEmail.trim()}
            >
              Invite
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}